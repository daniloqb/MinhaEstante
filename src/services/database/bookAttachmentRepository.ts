import {
  BookAttachment,
  AttachmentType,
  AttachmentFormat,
  isValidAttachmentTypeAndFormat,
} from '../../types/digitalMedia';
import { IBookAttachmentRepository, IDatabaseService, DbBookAttachmentRow } from './types';
import { DatabaseService } from './databaseService';

export class BookAttachmentRepository implements IBookAttachmentRepository {
  private db: IDatabaseService;

  constructor(dbService?: IDatabaseService) {
    this.db = dbService || DatabaseService.getInstance();
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  private rowToAttachment(row: DbBookAttachmentRow): BookAttachment {
    return {
      id: String(row.id),
      bookId: Number(row.book_id),
      type: row.type as AttachmentType,
      format: row.format as AttachmentFormat,
      filename: row.filename,
      mimeType: row.mime_type || null,
      sizeBytes: Number(row.size_bytes),
      storageProvider: row.storage_provider,
      storageReference: row.storage_reference,
      checksum: row.checksum || null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  async create(
    params: Omit<BookAttachment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<BookAttachment> {
    await this.initialize();

    // 1. Validação de domínio da combinação tipo e formato
    if (!isValidAttachmentTypeAndFormat(params.type, params.format)) {
      throw new Error(
        `Combinação inválida de tipo '${params.type}' e formato '${params.format}'. Tipo ebook aceita apenas epub/pdf; audiobook aceita mp3/m4a/m4b.`
      );
    }

    if (params.sizeBytes < 0) {
      throw new Error('O tamanho do arquivo (sizeBytes) não pode ser negativo.');
    }

    // 2. Integridade referencial: verifica se o livro pai existe
    const bookRows = await this.db.query<{ id: number }>(
      'SELECT id FROM books WHERE id = ? LIMIT 1;',
      [params.bookId]
    );
    if (!bookRows || bookRows.length === 0) {
      throw new Error(`Livro com id ${params.bookId} não encontrado.`);
    }

    // 3. Restrição de unicidade: no máximo um anexo por tipo por livro
    const alreadyExists = await this.exists(params.bookId, params.type);
    if (alreadyExists) {
      throw new Error(
        `O livro id ${params.bookId} já possui um anexo do tipo '${params.type}'. Remova ou substitua o anexo existente.`
      );
    }

    const now = Date.now();
    const id =
      params.id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    const attachment: BookAttachment = {
      id,
      bookId: params.bookId,
      type: params.type,
      format: params.format,
      filename: params.filename,
      mimeType: params.mimeType || null,
      sizeBytes: params.sizeBytes,
      storageProvider: params.storageProvider,
      storageReference: params.storageReference,
      checksum: params.checksum || null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.execute(
      `INSERT INTO book_attachments (
        id, book_id, type, format, filename, mime_type,
        size_bytes, storage_provider, storage_reference,
        checksum, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        attachment.id,
        attachment.bookId,
        attachment.type,
        attachment.format,
        attachment.filename,
        attachment.mimeType,
        attachment.sizeBytes,
        attachment.storageProvider,
        attachment.storageReference,
        attachment.checksum,
        attachment.createdAt,
        attachment.updatedAt,
      ]
    );

    return attachment;
  }

  async getById(id: string): Promise<BookAttachment | null> {
    await this.initialize();
    const rows = await this.db.query<DbBookAttachmentRow>(
      'SELECT * FROM book_attachments WHERE id = ? LIMIT 1;',
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return this.rowToAttachment(rows[0]);
  }

  async getByBookAndType(bookId: number, type: AttachmentType): Promise<BookAttachment | null> {
    await this.initialize();
    const rows = await this.db.query<DbBookAttachmentRow>(
      'SELECT * FROM book_attachments WHERE book_id = ? AND type = ? LIMIT 1;',
      [bookId, type]
    );
    if (!rows || rows.length === 0) return null;
    return this.rowToAttachment(rows[0]);
  }

  async getByBookId(bookId: number): Promise<BookAttachment[]> {
    await this.initialize();
    const rows = await this.db.query<DbBookAttachmentRow>(
      'SELECT * FROM book_attachments WHERE book_id = ? ORDER BY created_at ASC;',
      [bookId]
    );
    return (rows || []).map((r) => this.rowToAttachment(r));
  }

  async update(attachment: BookAttachment): Promise<BookAttachment> {
    await this.initialize();

    if (!isValidAttachmentTypeAndFormat(attachment.type, attachment.format)) {
      throw new Error(
        `Combinação inválida de tipo '${attachment.type}' e formato '${attachment.format}'.`
      );
    }

    const now = Date.now();
    await this.db.execute(
      `UPDATE book_attachments SET
        type = ?, format = ?, filename = ?, mime_type = ?,
        size_bytes = ?, storage_provider = ?, storage_reference = ?,
        checksum = ?, updated_at = ?
      WHERE id = ?;`,
      [
        attachment.type,
        attachment.format,
        attachment.filename,
        attachment.mimeType || null,
        attachment.sizeBytes,
        attachment.storageProvider,
        attachment.storageReference,
        attachment.checksum || null,
        now,
        attachment.id,
      ]
    );

    return {
      ...attachment,
      updatedAt: now,
    };
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();
    const result = await this.db.execute(
      'DELETE FROM book_attachments WHERE id = ?;',
      [id]
    );
    const affected = result?.changes?.changes ?? result?.changes ?? 0;
    return affected > 0;
  }

  async deleteByBookId(bookId: number): Promise<number> {
    await this.initialize();
    const result = await this.db.execute(
      'DELETE FROM book_attachments WHERE book_id = ?;',
      [bookId]
    );
    return result?.changes?.changes ?? result?.changes ?? 0;
  }

  async exists(bookId: number, type: AttachmentType): Promise<boolean> {
    await this.initialize();
    const found = await this.getByBookAndType(bookId, type);
    return found !== null;
  }

  async count(): Promise<number> {
    await this.initialize();
    const rows = await this.db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM book_attachments;'
    );
    return rows?.[0]?.count ?? 0;
  }

  async clearAll(): Promise<void> {
    await this.initialize();
    await this.db.execute('DELETE FROM book_attachments;');
  }
}

export const bookAttachmentRepository = new BookAttachmentRepository();
