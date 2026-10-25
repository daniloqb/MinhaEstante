import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { BookRepository } from '../services/database/bookRepository';
import { INITIAL_SCHEMA_SQL, V2_MIGRATION_SQL } from '../services/database/databaseService';
import { IDatabaseService } from '../services/database/types';
import { Book, BookFormat, ReadingStatus, getBookFormats, isBookOwned, updateBookFormats } from '../types/book';
import { BackupService } from '../services/storage/backupService';

// SQLite real de desktop, em arquivo temporário. Não simula o plugin Capacitor Android.
class TemporarySQLite implements IDatabaseService {
  private db: DatabaseSync;
  constructor(file: string) { this.db = new DatabaseSync(file); }
  async initialize() {
    this.db.exec(`PRAGMA foreign_keys = ON; ${INITIAL_SCHEMA_SQL} ${V2_MIGRATION_SQL}`);
  }
  async execute(sql: string, params: any[] = []) {
    const result = this.db.prepare(sql).run(...params);
    return { changes: Number(result.changes), lastId: Number(result.lastInsertRowid) };
  }
  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }
  async runInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  async close() { this.db.close(); }
}

const combinations: BookFormat[][] = [
  ['fisico'], ['ebook'], ['audiolivro'], ['fisico', 'ebook'], ['fisico', 'audiolivro'],
  ['ebook', 'audiolivro'], ['fisico', 'ebook', 'audiolivro'],
];

describe('Posse no BookRepository com SQLite real e backup isolado', () => {
  let directory: string;
  let db: TemporarySQLite;
  let repo: BookRepository;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'minhaestante-ownership-'));
    db = new TemporarySQLite(join(directory, 'library.sqlite'));
    repo = new BookRepository(db);
  });
  afterEach(async () => {
    BackupService.setRepository(null);
    await db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('preserva posse, modalidades e os cinco status após gravação, alteração e reabertura do arquivo', async () => {
    const books: Book[] = [];
    for (const formatos of combinations) {
      for (const owned of [true, false]) {
        for (const status of ['nenhum', 'quero_ler', 'lendo', 'lido', 'abandonado'] as ReadingStatus[]) {
          books.push({
            id: books.length + 1, uuid: `synthetic-${books.length + 1}`, origem: 'manual', titulo: 'Obra sintética',
            autores: ['Autor de teste'], generos: [], formatos, formato: formatos[0], tenho_fisico: owned,
            status_leitura: status, nota: 8, anoLeitura: 2025, mesLeitura: 3, dataCadastro: 1000, dataAtualizacao: 1000,
          });
        }
      }
    }
    // O SQLite real valida as 27 colunas e parâmetros do bulkInsert.
    expect(await repo.bulkInsert(books)).toBe(70);
    for (const book of books) {
      const updated = updateBookFormats(book, 'fisico');
      await repo.update(updated);
      const saved = (await repo.getById(book.id))!;
      expect(saved.tenho_fisico).toBe(book.tenho_fisico);
      expect(saved.status_leitura).toBe(book.status_leitura);
      expect(saved.formatos).toEqual(updated.formatos);
      // Alterar apenas posse preserva modalidades, leitura, notas e datas.
      await repo.update({ ...saved, tenho_fisico: !isBookOwned(saved) });
    }
    await db.close();
    db = new TemporarySQLite(join(directory, 'library.sqlite'));
    repo = new BookRepository(db);
    expect(await repo.count()).toBe(70);
    for (const book of books) {
      const saved = (await repo.getById(book.id))!;
      expect(saved.tenho_fisico).toBe(!book.tenho_fisico);
      expect(saved.status_leitura).toBe(book.status_leitura);
      expect(saved.formatos).toEqual(getBookFormats(updateBookFormats(book, 'fisico')));
      expect(saved.uuid).toBe(book.uuid);
      expect(saved.nota).toBe(book.nota);
      expect(saved.anoLeitura).toBe(book.anoLeitura);
      expect(saved.mesLeitura).toBe(book.mesLeitura);
    }
    expect(await db.query('PRAGMA foreign_key_check;')).toEqual([]);
  });

  it('não inventa posse quando um chamador legado omite a declaração', async () => {
    const saved = await repo.insert({
      origem: 'manual', titulo: 'Obra sintética sem posse', autores: [], generos: [], formato: 'fisico',
      status_leitura: 'nenhum', dataCadastro: 1000, dataAtualizacao: 1000,
    } as unknown as Book);
    expect((await repo.getById(saved.id))?.tenho_fisico).toBe(false);
    expect(await repo.count()).toBe(1);
  });

  it('restaura e reexporta o ZIP histórico com os mesmos dados e capas em SQLite real', async () => {
    // Fixture pessoal já existente e autorizada: nunca imprimir seus registros.
    const reference = new Uint8Array(readFileSync('public/assets/aistudio/20-10_019c1511.zip'));
    BackupService.setRepository(repo);
    const restored = await BackupService.restoreFromZip(reference, 'replace');
    expect(restored.booksRestored).toBe(215);
    expect(restored.coversRestored).toBe(207);
    const first = await repo.getAll();
    const counts = (books: Book[]) => ({
      records: books.length, owned: books.filter(isBookOwned).length,
      notOwned: books.filter((b) => !isBookOwned(b)).length,
      read: books.filter((b) => b.status_leitura === 'lido').length,
      wantToRead: books.filter((b) => b.status_leitura === 'quero_ler').length,
      none: books.filter((b) => b.status_leitura === 'nenhum').length,
      covers: books.filter((b) => b.capaLocalPath).length,
    });
    expect(counts(first)).toEqual({ records: 215, owned: 141, notOwned: 74, read: 97, wantToRead: 3, none: 115, covers: 207 });
    const exported = await BackupService.exportZipBackup();
    expect(exported.booksCount).toBe(215);
    expect(exported.coversCount).toBe(207);
    const exportedBytes = new Uint8Array(await exported.blob!.arrayBuffer());
    const extracted = await BackupService.validateAndExtractZip(exportedBytes);
    expect(extracted.manifest.version).toBe(1);
    expect(extracted.manifest.schemaVersion).toBe(2);

    // Segunda conexão em arquivo distinto; nenhuma biblioteca pessoal é tocada.
    const secondDb = new TemporarySQLite(join(directory, 'restored.sqlite'));
    try {
      const secondRepo = new BookRepository(secondDb);
      BackupService.setRepository(secondRepo);
      await BackupService.restoreFromZip(exportedBytes, 'replace');
      const second = await secondRepo.getAll();
      expect(counts(second)).toEqual(counts(first));
      const digest = (books: Book[]) => createHash('sha256').update(JSON.stringify(
        [...books].sort((a, b) => a.id - b.id).map(({ dataAtualizacao: _updated, ...book }) => book)
      )).digest('hex');
      expect(digest(second)).toBe(digest(first));
      const originalCovers = (await BackupService.validateAndExtractZip(reference)).coverFiles;
      for (const [path, bytes] of originalCovers) {
        expect(createHash('sha256').update(extracted.coverFiles.get(path) || '').digest('hex'))
          .toBe(createHash('sha256').update(bytes).digest('hex'));
      }
    } finally {
      await secondDb.close();
    }
  });
});
