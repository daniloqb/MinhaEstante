import { Book, ReadingStatus, BookFormat, BookOrigin, getBookFormats } from '../../types/book';
import { IBookRepository, IDatabaseService, DbBookRow } from './types';
import { DatabaseService } from './databaseService';
import { CoverStorageService } from '../storage/coverStorageService';

export class BookRepository implements IBookRepository {
  private db: IDatabaseService;

  constructor(dbService?: IDatabaseService) {
    this.db = dbService || DatabaseService.getInstance();
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  /**
   * Converte uma linha do SQLite para a entidade Book
   */
  private rowToBook(row: DbBookRow): Book {
    let autores: string[] = [];
    try {
      autores = JSON.parse(row.autores_json || '[]');
      if (!Array.isArray(autores)) autores = [];
    } catch {
      autores = [];
    }

    let generos: string[] = [];
    try {
      generos = JSON.parse(row.generos_json || '[]');
      if (!Array.isArray(generos)) generos = [];
    } catch {
      generos = [];
    }

    let emprestimo = null;
    if (row.emprestimo_json) {
      try {
        emprestimo = JSON.parse(row.emprestimo_json);
      } catch {
        emprestimo = null;
      }
    }

    let formatos: BookFormat[] = [];
    if (row.formatos_json) {
      try {
        formatos = JSON.parse(row.formatos_json);
        if (!Array.isArray(formatos)) formatos = [];
      } catch {
        formatos = [];
      }
    }
    if (formatos.length === 0) {
      formatos = getBookFormats({
        formato: (row.formato as BookFormat) || 'fisico',
        tenho_fisico: Number(row.tenho_fisico) === 1,
      });
    }

    const primaryFormat = (row.formato as BookFormat) || formatos[0] || 'fisico';
    const tenhoFisico = row.tenho_fisico != null ? (Number(row.tenho_fisico) === 1 || (row.tenho_fisico as any) === true) : false;

    return {
      id: Number(row.id),
      origem: (row.origem as BookOrigin) || 'manual',
      idExterno: row.id_externo || null,
      titulo: row.titulo || 'Sem título',
      subtitulo: row.subtitulo || null,
      autores,
      editora: row.editora || null,
      anoPublicacao: row.ano_publicacao != null ? Number(row.ano_publicacao) : null,
      paginas: row.paginas != null ? Number(row.paginas) : null,
      isbn10: row.isbn10 || null,
      isbn13: row.isbn13 || null,
      generos,
      descricao: row.descricao || null,
      capaUrl: row.capa_url || null,
      capaLocalPath: row.capa_local_path || null,
      formato: primaryFormat,
      formatos,
      tenho_fisico: tenhoFisico,
      status_leitura: (row.status_leitura as ReadingStatus) || 'nenhum',
      emprestimo,
      mesLeitura: row.mes_leitura != null ? Number(row.mes_leitura) : null,
      anoLeitura: row.ano_leitura != null ? Number(row.ano_leitura) : null,
      nota: row.nota != null ? Number(row.nota) : null,
      observacoes: row.observacoes || null,
      dataCadastro: Number(row.data_cadastro) || Date.now(),
      dataAtualizacao: Number(row.data_atualizacao) || Date.now(),
      uuid: row.uuid || undefined,
    };
  }

  /**
   * Converte uma entidade Book para os parâmetros posicionais do SQL
   */
  private bookToInsertParams(book: Partial<Book>, now: number): any[] {
    const id = book.id && book.id > 0 ? book.id : null;
    const autoresJson = JSON.stringify(book.autores || []);
    const generosJson = JSON.stringify(book.generos || []);
    const emprestimoJson = book.emprestimo ? JSON.stringify(book.emprestimo) : null;
    const formatos = getBookFormats(book);
    const formatosJson = JSON.stringify(formatos);
    const formato = book.formato || formatos[0] || 'fisico';
    const tenhoFisico = (typeof book.tenho_fisico === 'boolean'
      ? book.tenho_fisico
      : (book.tenho_fisico !== undefined ? Boolean(book.tenho_fisico) : formatos.includes('fisico'))
    ) ? 1 : 0;
    const statusLeitura = book.status_leitura || 'nenhum';

    const uuid = book.uuid || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `book-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    return [
      id,
      book.origem || 'manual',
      book.idExterno || null,
      book.titulo || 'Sem título',
      book.subtitulo || null,
      autoresJson,
      book.editora || null,
      book.anoPublicacao != null ? Number(book.anoPublicacao) : null,
      book.paginas != null ? Number(book.paginas) : null,
      book.isbn10 || null,
      book.isbn13 || null,
      generosJson,
      book.descricao || null,
      book.capaUrl || null,
      book.capaLocalPath || null,
      formato,
      formatosJson,
      tenhoFisico,
      statusLeitura,
      emprestimoJson,
      book.mesLeitura != null ? Number(book.mesLeitura) : null,
      book.anoLeitura != null ? Number(book.anoLeitura) : null,
      book.nota != null ? Number(book.nota) : null,
      book.observacoes || null,
      book.dataCadastro || now,
      now,
      uuid,
    ];
  }

  async getAll(): Promise<Book[]> {
    await this.initialize();
    const rows = await this.db.query<DbBookRow>(
      `SELECT * FROM books ORDER BY data_cadastro DESC;`
    );
    return rows.map((r) => this.rowToBook(r));
  }

  async getById(id: number): Promise<Book | null> {
    await this.initialize();
    const rows = await this.db.query<DbBookRow>(
      `SELECT * FROM books WHERE id = ? LIMIT 1;`,
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return this.rowToBook(rows[0]);
  }

  async getByUuid(uuid: string): Promise<Book | null> {
    await this.initialize();
    const rows = await this.db.query<DbBookRow>(
      `SELECT * FROM books WHERE uuid = ? LIMIT 1;`,
      [uuid]
    );
    if (!rows || rows.length === 0) return null;
    return this.rowToBook(rows[0]);
  }

  async insert(book: Omit<Book, 'id'> | Book): Promise<Book> {
    await this.initialize();
    const now = Date.now();
    let bookToSave: Book = { ...(book as Book) };

    // Se houver capa em Base64 ou URL remota, salva fisicamente no disco
    if (bookToSave.capaUrl && (bookToSave.capaUrl.startsWith('data:image/') || bookToSave.capaUrl.startsWith('http'))) {
      try {
        const { relativePath, originalUrl } = await CoverStorageService.saveCover(bookToSave.capaUrl, bookToSave.id);
        bookToSave.capaLocalPath = relativePath;
        bookToSave.capaUrl = originalUrl;
      } catch (err) {
        console.warn('Não foi possível persistir capa física no disco:', err);
      }
    }

    const params = this.bookToInsertParams(bookToSave, now);
    const assignedUuid = params[26];
    const result = await this.db.execute(
      `INSERT INTO books (
        id, origem, id_externo, titulo, subtitulo, autores_json, editora,
        ano_publicacao, paginas, isbn10, isbn13, generos_json, descricao,
        capa_url, capa_local_path, formato, formatos_json, tenho_fisico, status_leitura,
        emprestimo_json, mes_leitura, ano_leitura, nota, observacoes,
        data_cadastro, data_atualizacao, uuid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      params
    );

    const insertedId = result.lastId || result.changes?.lastId || bookToSave.id || 1;
    return {
      ...bookToSave,
      id: Number(insertedId),
      uuid: bookToSave.uuid || assignedUuid,
      dataCadastro: bookToSave.dataCadastro || now,
      dataAtualizacao: now,
    };
  }

  async update(book: Book): Promise<Book> {
    await this.initialize();
    const now = Date.now();
    let bookToSave: Book = { ...book };

    const oldBook = await this.getById(book.id);
    const oldPath = oldBook?.capaLocalPath;

    // Se a capa foi alterada e é um novo Data URL ou nova imagem
    if (book.capaUrl && (book.capaUrl.startsWith('data:image/') || (book.capaUrl.startsWith('http') && book.capaUrl !== oldBook?.capaUrl))) {
      try {
        const { relativePath, originalUrl } = await CoverStorageService.saveCover(book.capaUrl, book.id);
        bookToSave.capaLocalPath = relativePath;
        bookToSave.capaUrl = originalUrl;

        // Limpeza segura da capa anterior se for diferente e não for usada por outro livro
        if (oldPath && oldPath !== relativePath) {
          const count = await this.countCoverReferences(oldPath, book.id);
          if (count === 0) {
            await CoverStorageService.deleteCover(oldPath);
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar capa física no disco:', err);
      }
    }

    const autoresJson = JSON.stringify(bookToSave.autores || []);
    const generosJson = JSON.stringify(bookToSave.generos || []);
    const emprestimoJson = bookToSave.emprestimo ? JSON.stringify(bookToSave.emprestimo) : null;
    const formatos = getBookFormats(bookToSave);
    const formatosJson = JSON.stringify(formatos);
    const formato = bookToSave.formato || formatos[0] || 'fisico';
    const tenhoFisico = (typeof bookToSave.tenho_fisico === 'boolean'
      ? bookToSave.tenho_fisico
      : (bookToSave.tenho_fisico !== undefined ? Boolean(bookToSave.tenho_fisico) : formatos.includes('fisico'))
    ) ? 1 : 0;
    const statusLeitura = bookToSave.status_leitura || 'nenhum';

    const params = [
      bookToSave.origem || 'manual',
      bookToSave.idExterno || null,
      bookToSave.titulo || 'Sem título',
      bookToSave.subtitulo || null,
      autoresJson,
      bookToSave.editora || null,
      bookToSave.anoPublicacao != null ? Number(bookToSave.anoPublicacao) : null,
      bookToSave.paginas != null ? Number(bookToSave.paginas) : null,
      bookToSave.isbn10 || null,
      bookToSave.isbn13 || null,
      generosJson,
      bookToSave.descricao || null,
      bookToSave.capaUrl || null,
      bookToSave.capaLocalPath || null,
      formato,
      formatosJson,
      tenhoFisico,
      statusLeitura,
      emprestimoJson,
      bookToSave.mesLeitura != null ? Number(bookToSave.mesLeitura) : null,
      bookToSave.anoLeitura != null ? Number(bookToSave.anoLeitura) : null,
      bookToSave.nota != null ? Number(bookToSave.nota) : null,
      bookToSave.observacoes || null,
      now,
      bookToSave.id,
    ];

    await this.db.execute(
      `UPDATE books SET
        origem = ?, id_externo = ?, titulo = ?, subtitulo = ?, autores_json = ?,
        editora = ?, ano_publicacao = ?, paginas = ?, isbn10 = ?, isbn13 = ?,
        generos_json = ?, descricao = ?, capa_url = ?, capa_local_path = ?,
        formato = ?, formatos_json = ?, tenho_fisico = ?, status_leitura = ?, emprestimo_json = ?,
        mes_leitura = ?, ano_leitura = ?, nota = ?, observacoes = ?, data_atualizacao = ?
      WHERE id = ?;`,
      params
    );

    return {
      ...bookToSave,
      formato,
      formatos,
      tenho_fisico: tenhoFisico === 1,
      dataAtualizacao: now,
    };
  }

  async delete(id: number): Promise<boolean> {
    await this.initialize();
    const bookToDelete = await this.getById(id);
    const result = await this.db.execute(`DELETE FROM books WHERE id = ?;`, [id]);
    const changes = result.changes?.changes ?? result.changes ?? 0;

    if (changes > 0 && bookToDelete?.capaLocalPath) {
      const remainingRefs = await this.countCoverReferences(bookToDelete.capaLocalPath, id);
      if (remainingRefs === 0) {
        await CoverStorageService.deleteCover(bookToDelete.capaLocalPath);
      }
    }
    return changes > 0;
  }

  private async countCoverReferences(localPath: string, excludeId?: number): Promise<number> {
    const rows = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM books WHERE capa_local_path = ? AND id != ?;`,
      [localPath, excludeId || 0]
    );
    return rows && rows.length > 0 ? Number(rows[0].count) : 0;
  }

  async count(): Promise<number> {
    await this.initialize();
    const rows = await this.db.query<{ count: number }>(`SELECT COUNT(*) as count FROM books;`);
    return rows && rows.length > 0 ? Number(rows[0].count) : 0;
  }

  async clearAll(): Promise<void> {
    await this.initialize();
    await this.db.execute(`DELETE FROM books;`);
  }

  /**
   * Inserção em lote protegida por transação atômica
   */
  async bulkInsert(books: Book[]): Promise<number> {
    await this.initialize();
    if (!books || books.length === 0) return 0;

    let inserted = 0;
    await this.db.runInTransaction(async (tx) => {
      const executor = tx || this.db;
      const now = Date.now();
      for (const book of books) {
        const params = this.bookToInsertParams(book, now);
        await executor.execute(
          `INSERT INTO books (
            id, origem, id_externo, titulo, subtitulo, autores_json, editora,
            ano_publicacao, paginas, isbn10, isbn13, generos_json, descricao,
            capa_url, capa_local_path, formato, formatos_json, tenho_fisico, status_leitura,
            emprestimo_json, mes_leitura, ano_leitura, nota, observacoes,
            data_cadastro, data_atualizacao, uuid
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          params
        );
        inserted++;
      }
    });

    return inserted;
  }

  async search(query: string): Promise<Book[]> {
    await this.initialize();
    const cleanQuery = `%${query.trim()}%`;
    const rows = await this.db.query<DbBookRow>(
      `SELECT * FROM books 
       WHERE titulo LIKE ? OR subtitulo LIKE ? OR editora LIKE ? OR isbn10 LIKE ? OR isbn13 LIKE ?
       ORDER BY titulo ASC;`,
      [cleanQuery, cleanQuery, cleanQuery, cleanQuery, cleanQuery]
    );
    return rows.map((r) => this.rowToBook(r));
  }
}

export const bookRepository = new BookRepository();
