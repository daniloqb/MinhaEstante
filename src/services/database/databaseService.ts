import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { IDatabaseService } from './types';
import { DigitalStorageException } from '../storage/digital/errors';
import { WebPersistentDatabaseAdapter } from './webPersistentDatabaseAdapter';

const DB_NAME = 'minha_estante_db';
export const CURRENT_DB_VERSION = 2;

/**
 * DDL inicial do banco de dados SQLite (Versão 1 - Biblioteca e Livros)
 */
export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  origem TEXT NOT NULL DEFAULT 'manual',
  id_externo TEXT,
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  autores_json TEXT NOT NULL DEFAULT '[]',
  editora TEXT,
  ano_publicacao INTEGER,
  paginas INTEGER,
  isbn10 TEXT,
  isbn13 TEXT,
  generos_json TEXT NOT NULL DEFAULT '[]',
  descricao TEXT,
  capa_url TEXT,
  capa_local_path TEXT,
  formato TEXT NOT NULL DEFAULT 'fisico',
  formatos_json TEXT,
  tenho_fisico INTEGER NOT NULL DEFAULT 1,
  status_leitura TEXT NOT NULL DEFAULT 'nenhum',
  emprestimo_json TEXT,
  mes_leitura INTEGER,
  ano_leitura INTEGER,
  nota REAL,
  observacoes TEXT,
  data_cadastro INTEGER NOT NULL,
  data_atualizacao INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_books_titulo ON books(titulo COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_books_status_leitura ON books(status_leitura);
CREATE INDEX IF NOT EXISTS idx_books_tenho_fisico ON books(tenho_fisico);
CREATE INDEX IF NOT EXISTS idx_books_formato ON books(formato);
CREATE INDEX IF NOT EXISTS idx_books_ano_leitura ON books(ano_leitura);
CREATE INDEX IF NOT EXISTS idx_books_isbn13 ON books(isbn13);
CREATE INDEX IF NOT EXISTS idx_books_isbn10 ON books(isbn10);
CREATE INDEX IF NOT EXISTS idx_books_data_cadastro ON books(data_cadastro DESC);
`;

/**
 * DDL da Migração Versão 2 (MinhaEstante 2.0 - Fase 1: Anexos, Posições e Acompanhamento)
 */
export const V2_MIGRATION_SQL = `
-- 1. Anexos de Mídia Digital (E-books EPUB/PDF e Audiolivros MP3/M4A/M4B)
CREATE TABLE IF NOT EXISTS book_attachments (
  id TEXT PRIMARY KEY,
  book_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  storage_provider TEXT NOT NULL,
  storage_reference TEXT NOT NULL,
  checksum TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  CONSTRAINT uq_book_attachment_type UNIQUE(book_id, type)
);

CREATE INDEX IF NOT EXISTS idx_book_attachments_book_id ON book_attachments(book_id);
CREATE INDEX IF NOT EXISTS idx_book_attachments_type ON book_attachments(type);

-- 2. Posição de Leitura e Reprodução (Última localização visitada no anexo)
CREATE TABLE IF NOT EXISTS reader_positions (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL,
  location_type TEXT NOT NULL,
  location TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (attachment_id) REFERENCES book_attachments(id) ON DELETE CASCADE,
  CONSTRAINT uq_reader_position_attachment UNIQUE(attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_reader_positions_attachment_id ON reader_positions(attachment_id);

-- 3. Acompanhamento Deliberado de Leitura (Sessões históricas e ativas)
CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  book_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  abandoned_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_status ON reading_sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_sessions_active_unique ON reading_sessions(book_id) WHERE status = 'active';

-- 4. Progresso de Leitura Acompanhado
CREATE TABLE IF NOT EXISTS reading_progress (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  unit TEXT NOT NULL,
  current_value REAL NOT NULL,
  total_value REAL,
  source TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES reading_sessions(id) ON DELETE CASCADE,
  CONSTRAINT uq_reading_progress_session UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_session_id ON reading_progress(session_id);
-- 5. Índice para o identificador estável UUID da obra
CREATE INDEX IF NOT EXISTS idx_books_uuid ON books(uuid);
`;

/**
 * Adaptador Web/Memória para desenvolvimento no Vite desktop e execução de testes no Vitest
 * Fornece integridade referencial, restrições UNIQUE e migrações transparentes
 */
export interface WebDatabaseSnapshot {
  version: 1;
  books: [number, any][]; attachments: [string, any][]; positions: [string, any][];
  sessions: [string, any][]; progress: [string, any][]; migrations: [number, number][];
  autoIncrementId: number;
}

export class WebInMemoryDatabaseAdapter implements IDatabaseService {
  private books: Map<number, any> = new Map();
  private attachments: Map<string, any> = new Map();
  private positions: Map<string, any> = new Map();
  private sessions: Map<string, any> = new Map();
  private progress: Map<string, any> = new Map();
  private migrations: Map<number, number> = new Map();

  private autoIncrementId = 1;
  private isReady = false;

  async initialize(): Promise<void> {
    if (this.isReady) return;
    this.migrations.set(1, Date.now());
    this.migrations.set(2, Date.now());
    this.isReady = true;
  }

  exportSnapshot(): WebDatabaseSnapshot {
    return structuredClone({ version: 1, books: [...this.books], attachments: [...this.attachments], positions: [...this.positions],
      sessions: [...this.sessions], progress: [...this.progress], migrations: [...this.migrations], autoIncrementId: this.autoIncrementId });
  }
  restoreSnapshot(snapshot: WebDatabaseSnapshot): void {
    if (!snapshot || snapshot.version !== 1 || !Number.isSafeInteger(snapshot.autoIncrementId) || snapshot.autoIncrementId < 1
      || !['books', 'attachments', 'positions', 'sessions', 'progress', 'migrations'].every((key) => Array.isArray((snapshot as any)[key]))) {
      throw new DigitalStorageException('RECOVERY_REQUIRED');
    }
    const tables = [snapshot.books, snapshot.attachments, snapshot.positions, snapshot.sessions, snapshot.progress];
    const valid = tables.every((table) => table.every((entry) => Array.isArray(entry) && entry.length === 2
      && entry[1] && typeof entry[1] === 'object' && entry[0] === entry[1].id)
      && new Set(table.map(([key]) => key)).size === table.length);
    const bookIds = new Set(snapshot.books.map(([id]) => id));
    const attachmentIds = new Set(snapshot.attachments.map(([id]) => id));
    const sessionIds = new Set(snapshot.sessions.map(([id]) => id));
    if (!valid || snapshot.books.some(([id]) => !Number.isSafeInteger(id) || id <= 0 || id >= snapshot.autoIncrementId)
      || snapshot.attachments.some(([,row]) => !bookIds.has(row.book_id))
      || snapshot.positions.some(([,row]) => !attachmentIds.has(row.attachment_id))
      || snapshot.sessions.some(([,row]) => !bookIds.has(row.book_id))
      || snapshot.progress.some(([,row]) => !sessionIds.has(row.session_id))
      || new Set(snapshot.attachments.map(([,row]) => `${row.book_id}:${row.type}`)).size !== snapshot.attachments.length
      || new Set(snapshot.positions.map(([,row]) => row.attachment_id)).size !== snapshot.positions.length) {
      throw new DigitalStorageException('RECOVERY_REQUIRED');
    }
    const copy = structuredClone(snapshot);
    this.books = new Map(copy.books); this.attachments = new Map(copy.attachments); this.positions = new Map(copy.positions);
    this.sessions = new Map(copy.sessions); this.progress = new Map(copy.progress); this.migrations = new Map(copy.migrations);
    this.autoIncrementId = copy.autoIncrementId;
  }

  getAppliedMigrationVersions(): number[] {
    return Array.from(this.migrations.keys()).sort((a, b) => a - b);
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.isReady) await this.initialize();
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    // DDL e PRAGMA no-op
    if (upper.startsWith('CREATE') || upper.startsWith('PRAGMA') || upper.startsWith('ALTER')) {
      return { changes: 0 };
    }

    // ----------------------------------------------------
    // SCHEMA MIGRATIONS
    // ----------------------------------------------------
    if (upper.startsWith('INSERT OR IGNORE INTO SCHEMA_MIGRATIONS') || upper.startsWith('INSERT INTO SCHEMA_MIGRATIONS')) {
      const version = Number(params[0]);
      const appliedAt = Number(params[1]) || Date.now();
      if (!this.migrations.has(version)) {
        this.migrations.set(version, appliedAt);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    // ----------------------------------------------------
    // BOOKS TABLE
    // ----------------------------------------------------
    if (upper.startsWith('INSERT INTO BOOKS')) {
      const match = trimmed.match(/\(([\s\S]*?)\)\s*VALUES/i);
      const row: any = {};
      if (match && match[1]) {
        const cols = match[1].split(',').map((c) => c.trim().toLowerCase());
        cols.forEach((col, idx) => {
          row[col] = params[idx];
        });
      } else {
        row.id = params[0];
        row.origem = params[1];
        row.id_externo = params[2];
        row.titulo = params[3];
        row.subtitulo = params[4];
        row.autores_json = params[5];
        row.editora = params[6];
        row.ano_publicacao = params[7];
        row.paginas = params[8];
        row.isbn10 = params[9];
        row.isbn13 = params[10];
        row.generos_json = params[11];
        row.descricao = params[12];
        row.capa_url = params[13];
        row.capa_local_path = params[14];
        row.formato = params[15];
        row.formatos_json = params[16];
        row.tenho_fisico = params[17];
        row.status_leitura = params[18];
        row.emprestimo_json = params[19];
        row.mes_leitura = params[20];
        row.ano_leitura = params[21];
        row.nota = params[22];
        row.observacoes = params[23];
        row.data_cadastro = params[24];
        row.data_atualizacao = params[25];
        if (params.length > 26) {
          row.uuid = params[26];
        }
      }

      const id = row.id && Number(row.id) > 0 ? Number(row.id) : this.autoIncrementId++;
      if (id >= this.autoIncrementId) {
        this.autoIncrementId = id + 1;
      }
      row.id = id;
      if (!row.uuid) {
        row.uuid = `book-uuid-${id}`;
      }
      this.books.set(id, row);
      return { changes: 1, lastId: id };
    }

    if (upper.startsWith('UPDATE BOOKS')) {
      const id = Number(params[params.length - 1]);
      const existing = this.books.get(id);
      if (existing) {
        const setMatch = trimmed.match(/SET\s+([\s\S]*?)\s+WHERE/i);
        const updated = { ...existing };
        if (setMatch && setMatch[1]) {
          const assignments = setMatch[1].split(',').map((a) => a.trim().split('=')[0].trim().toLowerCase());
          assignments.forEach((col, idx) => {
            updated[col] = params[idx];
          });
        }
        this.books.set(id, updated);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (upper.startsWith('DELETE FROM BOOKS WHERE ID =')) {
      const id = Number(params[0]);
      // Cascata manual de integridade no adapter em memória
      this.cascadeDeleteBook(id);
      const deleted = this.books.delete(id);
      return { changes: deleted ? 1 : 0 };
    }

    if (upper.startsWith('DELETE FROM BOOKS')) {
      const count = this.books.size;
      this.books.clear();
      this.attachments.clear();
      this.positions.clear();
      this.sessions.clear();
      this.progress.clear();
      this.autoIncrementId = 1;
      return { changes: count };
    }

    // ----------------------------------------------------
    // BOOK ATTACHMENTS TABLE
    // ----------------------------------------------------
    if (upper.startsWith('INSERT INTO BOOK_ATTACHMENTS') || upper.startsWith('INSERT OR REPLACE INTO BOOK_ATTACHMENTS')) {
      const row: any = {
        id: String(params[0]),
        book_id: Number(params[1]),
        type: String(params[2]),
        format: String(params[3]),
        filename: String(params[4]),
        mime_type: params[5] ? String(params[5]) : null,
        size_bytes: Number(params[6]),
        storage_provider: String(params[7]),
        storage_reference: String(params[8]),
        checksum: params[9] ? String(params[9]) : null,
        created_at: Number(params[10]) || Date.now(),
        updated_at: Number(params[11]) || Date.now(),
      };

      // Integridade referencial: o livro deve existir
      if (!this.books.has(row.book_id)) {
        throw new Error(`FOREIGN KEY constraint failed: Livro id ${row.book_id} não existe`);
      }

      // Restrição UNIQUE(book_id, type)
      for (const [existingId, existing] of this.attachments.entries()) {
        if (existing.book_id === row.book_id && existing.type === row.type && existingId !== row.id) {
          throw new Error(`UNIQUE constraint failed: book_attachments(book_id, type) para book ${row.book_id} e tipo ${row.type}`);
        }
      }

      this.attachments.set(row.id, row);
      return { changes: 1, lastId: row.id };
    }

    if (upper.startsWith('UPDATE BOOK_ATTACHMENTS')) {
      const id = String(params[params.length - 1]);
      const existing = this.attachments.get(id);
      if (existing) {
        const setMatch = trimmed.match(/SET\s+([\s\S]*?)\s+WHERE/i);
        const updated = { ...existing };
        if (setMatch && setMatch[1]) {
          const assignments = setMatch[1].split(',').map((a) => a.trim().split('=')[0].trim().toLowerCase());
          assignments.forEach((col, idx) => {
            updated[col] = params[idx];
          });
        }
        this.attachments.set(id, updated);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (upper.startsWith('DELETE FROM BOOK_ATTACHMENTS WHERE ID =')) {
      const id = String(params[0]);
      this.cascadeDeleteAttachment(id);
      const deleted = this.attachments.delete(id);
      return { changes: deleted ? 1 : 0 };
    }

    if (upper.startsWith('DELETE FROM BOOK_ATTACHMENTS WHERE BOOK_ID =')) {
      const bookId = Number(params[0]);
      let count = 0;
      for (const [id, att] of Array.from(this.attachments.entries())) {
        if (att.book_id === bookId) {
          this.cascadeDeleteAttachment(id);
          this.attachments.delete(id);
          count++;
        }
      }
      return { changes: count };
    }

    if (upper.startsWith('DELETE FROM BOOK_ATTACHMENTS')) {
      const count = this.attachments.size;
      this.attachments.clear();
      this.positions.clear();
      return { changes: count };
    }

    // ----------------------------------------------------
    // READER POSITIONS TABLE
    // ----------------------------------------------------
    if (upper.startsWith('INSERT INTO READER_POSITIONS') || upper.startsWith('INSERT OR REPLACE INTO READER_POSITIONS')) {
      const row: any = {
        id: String(params[0]),
        attachment_id: String(params[1]),
        location_type: String(params[2]),
        location: String(params[3]),
        updated_at: Number(params[4]) || Date.now(),
      };

      // Integridade referencial: anexo deve existir
      if (!this.attachments.has(row.attachment_id)) {
        throw new Error(`FOREIGN KEY constraint failed: Anexo ${row.attachment_id} não existe`);
      }

      // Substitui registro anterior se houver para o mesmo anexo (UNIQUE attachment_id)
      for (const [existingId, pos] of this.positions.entries()) {
        if (pos.attachment_id === row.attachment_id && existingId !== row.id) {
          this.positions.delete(existingId);
        }
      }

      this.positions.set(row.id, row);
      return { changes: 1, lastId: row.id };
    }

    if (upper.startsWith('UPDATE READER_POSITIONS')) {
      const id = String(params[params.length - 1]);
      const existing = this.positions.get(id);
      if (existing) {
        const setMatch = trimmed.match(/SET\s+([\s\S]*?)\s+WHERE/i);
        const updated = { ...existing };
        if (setMatch && setMatch[1]) {
          const assignments = setMatch[1].split(',').map((a) => a.trim().split('=')[0].trim().toLowerCase());
          assignments.forEach((col, idx) => {
            updated[col] = params[idx];
          });
        }
        this.positions.set(id, updated);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (upper.startsWith('DELETE FROM READER_POSITIONS WHERE ATTACHMENT_ID =')) {
      const attId = String(params[0]);
      let count = 0;
      for (const [id, pos] of Array.from(this.positions.entries())) {
        if (pos.attachment_id === attId) {
          this.positions.delete(id);
          count++;
        }
      }
      return { changes: count };
    }

    if (upper.startsWith('DELETE FROM READER_POSITIONS')) {
      const count = this.positions.size;
      this.positions.clear();
      return { changes: count };
    }

    // ----------------------------------------------------
    // READING SESSIONS TABLE
    // ----------------------------------------------------
    if (upper.startsWith('INSERT INTO READING_SESSIONS')) {
      const row: any = {
        id: String(params[0]),
        book_id: Number(params[1]),
        status: String(params[2]),
        started_at: Number(params[3]),
        completed_at: params[4] != null ? Number(params[4]) : null,
        abandoned_at: params[5] != null ? Number(params[5]) : null,
        updated_at: Number(params[6]) || Date.now(),
      };

      // Integridade referencial
      if (!this.books.has(row.book_id)) {
        throw new Error(`FOREIGN KEY constraint failed: Livro id ${row.book_id} não existe`);
      }

      // Restrição: no máximo 1 sessão com status 'active' para a mesma obra
      if (row.status === 'active') {
        for (const [existingId, sess] of this.sessions.entries()) {
          if (sess.book_id === row.book_id && sess.status === 'active' && existingId !== row.id) {
            throw new Error(`UNIQUE constraint failed: Já existe uma sessão ativa para o livro ${row.book_id}`);
          }
        }
      }

      this.sessions.set(row.id, row);
      return { changes: 1, lastId: row.id };
    }

    if (upper.startsWith('UPDATE READING_SESSIONS')) {
      const id = String(params[params.length - 1]);
      const existing = this.sessions.get(id);
      if (existing) {
        const setMatch = trimmed.match(/SET\s+([\s\S]*?)\s+WHERE/i);
        const updated = { ...existing };
        if (setMatch && setMatch[1]) {
          const assignments = setMatch[1].split(',').map((a) => a.trim().split('=')[0].trim().toLowerCase());
          assignments.forEach((col, idx) => {
            updated[col] = params[idx];
          });
        }

        // Valida se a atualização resultaria em duas sessões ativas
        if (updated.status === 'active') {
          for (const [existingId, sess] of this.sessions.entries()) {
            if (sess.book_id === updated.book_id && sess.status === 'active' && existingId !== id) {
              throw new Error(`UNIQUE constraint failed: Já existe uma sessão ativa para o livro ${updated.book_id}`);
            }
          }
        }

        this.sessions.set(id, updated);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (upper.startsWith('DELETE FROM READING_SESSIONS WHERE ID =')) {
      const id = String(params[0]);
      this.cascadeDeleteSession(id);
      const deleted = this.sessions.delete(id);
      return { changes: deleted ? 1 : 0 };
    }

    if (upper.startsWith('DELETE FROM READING_SESSIONS WHERE BOOK_ID =')) {
      const bookId = Number(params[0]);
      let count = 0;
      for (const [id, sess] of Array.from(this.sessions.entries())) {
        if (sess.book_id === bookId) {
          this.cascadeDeleteSession(id);
          this.sessions.delete(id);
          count++;
        }
      }
      return { changes: count };
    }

    if (upper.startsWith('DELETE FROM READING_SESSIONS')) {
      const count = this.sessions.size;
      this.sessions.clear();
      this.progress.clear();
      return { changes: count };
    }

    // ----------------------------------------------------
    // READING PROGRESS TABLE
    // ----------------------------------------------------
    if (upper.startsWith('INSERT INTO READING_PROGRESS') || upper.startsWith('INSERT OR REPLACE INTO READING_PROGRESS')) {
      const row: any = {
        id: String(params[0]),
        session_id: String(params[1]),
        unit: String(params[2]),
        current_value: Number(params[3]),
        total_value: params[4] != null ? Number(params[4]) : null,
        source: String(params[5]),
        updated_at: Number(params[6]) || Date.now(),
      };

      // Integridade referencial
      if (!this.sessions.has(row.session_id)) {
        throw new Error(`FOREIGN KEY constraint failed: Sessão ${row.session_id} não existe`);
      }

      // Substitui registro anterior se houver (UNIQUE session_id)
      for (const [existingId, prog] of this.progress.entries()) {
        if (prog.session_id === row.session_id && existingId !== row.id) {
          this.progress.delete(existingId);
        }
      }

      this.progress.set(row.id, row);
      return { changes: 1, lastId: row.id };
    }

    if (upper.startsWith('DELETE FROM READING_PROGRESS WHERE SESSION_ID =')) {
      const sessionId = String(params[0]);
      let count = 0;
      for (const [id, prog] of Array.from(this.progress.entries())) {
        if (prog.session_id === sessionId) {
          this.progress.delete(id);
          count++;
        }
      }
      return { changes: count };
    }

    if (upper.startsWith('DELETE FROM READING_PROGRESS')) {
      const count = this.progress.size;
      this.progress.clear();
      return { changes: count };
    }

    return { changes: 0 };
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const upper = sql.trim().toUpperCase();

    // ----------------------------------------------------
    // SCHEMA MIGRATIONS
    // ----------------------------------------------------
    if (upper.includes('FROM SCHEMA_MIGRATIONS')) {
      const rows = Array.from(this.migrations.entries()).map(([version, applied_at]) => ({
        version,
        applied_at,
      }));
      rows.sort((a, b) => a.version - b.version);
      return rows as any;
    }

    // ----------------------------------------------------
    // BOOK ATTACHMENTS
    // ----------------------------------------------------
    if (upper.includes('FROM BOOK_ATTACHMENTS')) {
      if (upper.includes('COUNT(*)')) {
        return [{ count: this.attachments.size }] as any;
      }
      if (upper.includes('WHERE STORAGE_PROVIDER = ? AND STORAGE_REFERENCE = ?')) {
        return Array.from(this.attachments.values()).filter((row) => row.storage_provider === params[0] && row.storage_reference === params[1]) as T[];
      }
      if (upper.includes('WHERE BOOK_ID = ? AND TYPE = ?') || upper.includes('WHERE BOOK_ID = ? AND TYPE =')) {
        const bookId = Number(params[0]);
        const type = String(params[1]);
        const found = Array.from(this.attachments.values()).filter(
          (a) => a.book_id === bookId && a.type === type
        );
        return found as any;
      }
      if (upper.includes('WHERE BOOK_ID = ?') || upper.includes('WHERE BOOK_ID =')) {
        const bookId = Number(params[0]);
        const found = Array.from(this.attachments.values()).filter((a) => a.book_id === bookId);
        found.sort((a, b) => a.created_at - b.created_at);
        return found as any;
      }
      if (upper.includes('WHERE ID = ?') || upper.includes('WHERE ID =')) {
        const id = String(params[0]);
        const row = this.attachments.get(id);
        return row ? ([row] as any) : [];
      }
      return Array.from(this.attachments.values()) as any;
    }

    // ----------------------------------------------------
    // READER POSITIONS
    // ----------------------------------------------------
    if (upper.includes('FROM READER_POSITIONS')) {
      if (upper.includes('COUNT(*)')) {
        return [{ count: this.positions.size }] as any;
      }
      if (upper.includes('WHERE ATTACHMENT_ID = ?') || upper.includes('WHERE ATTACHMENT_ID =')) {
        const attId = String(params[0]);
        const found = Array.from(this.positions.values()).filter((p) => p.attachment_id === attId);
        return found as any;
      }
      if (upper.includes('WHERE ID = ?') || upper.includes('WHERE ID =')) {
        const id = String(params[0]);
        const row = this.positions.get(id);
        return row ? ([row] as any) : [];
      }
      return Array.from(this.positions.values()) as any;
    }

    // ----------------------------------------------------
    // READING SESSIONS
    // ----------------------------------------------------
    if (upper.includes('FROM READING_SESSIONS')) {
      if (upper.includes('COUNT(*)')) {
        return [{ count: this.sessions.size }] as any;
      }
      if (upper.includes('WHERE BOOK_ID = ? AND STATUS = ?') || upper.includes("WHERE BOOK_ID = ? AND STATUS = 'ACTIVE'")) {
        const bookId = Number(params[0]);
        const status = params.length > 1 ? String(params[1]) : 'active';
        const found = Array.from(this.sessions.values()).filter(
          (s) => s.book_id === bookId && s.status.toLowerCase() === status.toLowerCase()
        );
        return found as any;
      }
      if (upper.includes('WHERE BOOK_ID = ?') || upper.includes('WHERE BOOK_ID =')) {
        const bookId = Number(params[0]);
        const found = Array.from(this.sessions.values()).filter((s) => s.book_id === bookId);
        found.sort((a, b) => b.started_at - a.started_at);
        return found as any;
      }
      if (upper.includes('WHERE ID = ?') || upper.includes('WHERE ID =')) {
        const id = String(params[0]);
        const row = this.sessions.get(id);
        return row ? ([row] as any) : [];
      }
      return Array.from(this.sessions.values()) as any;
    }

    // ----------------------------------------------------
    // READING PROGRESS
    // ----------------------------------------------------
    if (upper.includes('FROM READING_PROGRESS')) {
      if (upper.includes('COUNT(*)')) {
        return [{ count: this.progress.size }] as any;
      }
      if (upper.includes('WHERE SESSION_ID = ?') || upper.includes('WHERE SESSION_ID =')) {
        const sessId = String(params[0]);
        const found = Array.from(this.progress.values()).filter((p) => p.session_id === sessId);
        return found as any;
      }
      if (upper.includes('WHERE ID = ?') || upper.includes('WHERE ID =')) {
        const id = String(params[0]);
        const row = this.progress.get(id);
        return row ? ([row] as any) : [];
      }
      return Array.from(this.progress.values()) as any;
    }

    // ----------------------------------------------------
    // BOOKS
    // ----------------------------------------------------
    if (upper.includes('COUNT(*)')) {
      if (upper.includes('WHERE CAPA_LOCAL_PATH =')) {
        const targetPath = params[0];
        const excludeId = Number(params[1] || 0);
        let matchCount = 0;
        for (const row of this.books.values()) {
          if (row.capa_local_path === targetPath && row.id !== excludeId) {
            matchCount++;
          }
        }
        return [{ count: matchCount }] as any;
      }
      return [{ count: this.books.size }] as any;
    }

    if (upper.includes('WHERE UUID = ?') || upper.includes('WHERE UUID =')) {
      const targetUuid = String(params[0]);
      const found = Array.from(this.books.values()).filter((b) => b.uuid === targetUuid);
      return found as any;
    }

    if (upper.includes('WHERE ID = ?') || upper.includes('WHERE ID =')) {
      const id = Number(params[0]);
      const row = this.books.get(id);
      return row ? ([row] as any) : [];
    }

    if (upper.includes('LIKE ?')) {
      const pattern = String(params[0] || '').replace(/%/g, '').toLowerCase();
      const filtered = Array.from(this.books.values()).filter((row) => {
        const t = String(row.titulo || '').toLowerCase();
        const s = String(row.subtitulo || '').toLowerCase();
        const e = String(row.editora || '').toLowerCase();
        const i10 = String(row.isbn10 || '').toLowerCase();
        const i13 = String(row.isbn13 || '').toLowerCase();
        return (
          t.includes(pattern) ||
          s.includes(pattern) ||
          e.includes(pattern) ||
          i10.includes(pattern) ||
          i13.includes(pattern)
        );
      });
      filtered.sort((a, b) => String(a.titulo).localeCompare(String(b.titulo)));
      return filtered as any;
    }

    const all = Array.from(this.books.values());
    all.sort((a, b) => b.data_cadastro - a.data_cadastro);
    return all as any;
  }

  async runInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T> {
    return await fn(this);
  }

  async close(): Promise<void> {
    this.books.clear();
    this.attachments.clear();
    this.positions.clear();
    this.sessions.clear();
    this.progress.clear();
    this.migrations.clear();
    this.isReady = false;
  }

  /**
   * Cascata de exclusão referencial (ON DELETE CASCADE)
   */
  private cascadeDeleteBook(bookId: number): void {
    // 1. Exclui anexos e suas posições
    for (const [id, att] of Array.from(this.attachments.entries())) {
      if (att.book_id === bookId) {
        this.cascadeDeleteAttachment(id);
        this.attachments.delete(id);
      }
    }
    // 2. Exclui sessões e seus progressos
    for (const [id, sess] of Array.from(this.sessions.entries())) {
      if (sess.book_id === bookId) {
        this.cascadeDeleteSession(id);
        this.sessions.delete(id);
      }
    }
  }

  private cascadeDeleteAttachment(attachmentId: string): void {
    for (const [id, pos] of Array.from(this.positions.entries())) {
      if (pos.attachment_id === attachmentId) {
        this.positions.delete(id);
      }
    }
  }

  private cascadeDeleteSession(sessionId: string): void {
    for (const [id, prog] of Array.from(this.progress.entries())) {
      if (prog.session_id === sessionId) {
        this.progress.delete(id);
      }
    }
  }
}

/**
 * Mutex assíncrono para serialização estrita de operações e transações no SQLite nativo.
 * Garante exclusividade de acesso sem concorrência destrutiva entre chamadas assíncronas.
 */
export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  public async acquire(): Promise<() => void> {
    let releaseLock!: () => void;
    const lockAcquired = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const previousQueue = this.queue;
    this.queue = this.queue.then(() => lockAcquired);

    await previousQueue;
    return releaseLock;
  }

  public async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * Contexto de Transação Nativa SQLite
 * Garante que todas as operações executadas no escopo da transação utilizem `transaction = false`
 * no @capacitor-community/sqlite, impedindo o erro "Already in transaction".
 */
export class NativeTransactionContext implements IDatabaseService {
  constructor(private db: SQLiteDBConnection) {}

  async initialize(): Promise<void> {
    // Contexto criado com conexão já pronta
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (params.length === 0) {
      return await this.db.execute(sql, false);
    }
    return await this.db.run(sql, params, false);
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.db.query(sql, params);
    return (res.values || []) as T[];
  }

  async runInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T> {
    // Reentrância no mesmo contexto de transação ativo
    return await fn(this);
  }

  async close(): Promise<void> {
    // Conexão pertence ao adaptador pai; fechamento gerenciado lá
  }
}

/**
 * Adaptador Nativo SQLite usando @capacitor-community/sqlite
 */
export class NativeSQLiteDatabaseAdapter implements IDatabaseService {
  private sqlitePlugin: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private isInitialized = false;
  private mutex = new AsyncMutex();
  private currentTxContext: NativeTransactionContext | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) return;

    return await this.mutex.runExclusive(async () => {
      if (this.isInitialized && this.db) return;

      try {
        this.sqlitePlugin = new SQLiteConnection(CapacitorSQLite);
        const ret = await this.sqlitePlugin.checkConnectionsConsistency();
        const isConn = (await this.sqlitePlugin.isConnection(DB_NAME, false)).result;

        if (ret.result && isConn) {
          this.db = await this.sqlitePlugin.retrieveConnection(DB_NAME, false);
        } else {
          this.db = await this.sqlitePlugin.createConnection(
            DB_NAME,
            false,
            'no-encryption',
            CURRENT_DB_VERSION,
            false
          );
        }

        const isDBOpen = (await this.db.isDBOpen()).result;
        if (!isDBOpen) {
          await this.db.open();
        }

        // Ativa suporte estrito a chaves estrangeiras fora de qualquer transação
        await this.db.execute('PRAGMA foreign_keys = ON;', false);

        // Executa criação do esquema inicial sem iniciar transação interna
        await this.db.execute(INITIAL_SCHEMA_SQL, false);

        // Migração defensiva e versionada
        await this.runMigrations();

        this.isInitialized = true;
      } catch (err) {
        console.error('Falha ao inicializar banco de dados SQLite nativo:', err);
        throw err;
      }
    });
  }

  /**
   * Gerenciador de migrações transacionais e idempotentes
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    // 1. Verifica versões já aplicadas
    const migrationRows = await this.db.query('SELECT version FROM schema_migrations;');
    const appliedVersions = new Set<number>(
      (migrationRows.values || []).map((r: any) => Number(r.version))
    );

    // Registra versão 1 se não estiver explícita
    if (!appliedVersions.has(1)) {
      await this.db.run(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?);',
        [1, Date.now()],
        false
      );
      appliedVersions.add(1);
    }

    // Aplica Migração 2 (MinhaEstante 2.0 - Fase 1)
    if (!appliedVersions.has(2)) {
      await this.db.beginTransaction();
      try {
        // Colunas adicionadas à tabela books (aditivo e defensivo)
        const colCheck = await this.db.query('PRAGMA table_info(books);');
        const columns = (colCheck.values || []).map((c: any) => String(c.name).toLowerCase());

        if (!columns.includes('formatos_json')) {
          await this.db.execute('ALTER TABLE books ADD COLUMN formatos_json TEXT;', false);
        }
        if (!columns.includes('uuid')) {
          await this.db.execute('ALTER TABLE books ADD COLUMN uuid TEXT;', false);
        }

        // Novas tabelas de anexos, posições e sessões (executa com transaction = false)
        await this.db.execute(V2_MIGRATION_SQL, false);

        // Backfill defensivo de UUIDs para registros legados que não possuam identificador estável
        try {
          const rowsWithoutUuid = await this.db.query("SELECT id FROM books WHERE uuid IS NULL OR uuid = '';");
          if (rowsWithoutUuid.values && rowsWithoutUuid.values.length > 0) {
            for (const row of rowsWithoutUuid.values as any[]) {
              const generatedUuid = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `book-${row.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              await this.db.run('UPDATE books SET uuid = ? WHERE id = ?;', [generatedUuid, row.id], false);
            }
          }
        } catch (uuidErr) {
          console.warn('Aviso: Falha ao executar backfill de UUIDs:', uuidErr);
        }

        // Registra versão 2 concluída
        await this.db.run(
          'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);',
          [2, Date.now()],
          false
        );

        await this.db.commitTransaction();
      } catch (err) {
        try {
          const active = (await this.db.isTransactionActive()).result;
          if (active) {
            await this.db.rollbackTransaction();
          }
        } catch (rollbackErr) {
          console.warn('Erro ao executar rollback da migração 2:', rollbackErr);
        }
        console.error('Falha na migração da Versão 2:', err);
        throw err;
      }
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Banco SQLite não inicializado');

    // Se chamado no contexto de uma transação ativa nesta conexão, executa dentro dela com transaction = false
    if (this.currentTxContext) {
      return await this.currentTxContext.execute(sql, params);
    }

    // Execução autônoma fora de transação serializada pelo mutex
    return await this.mutex.runExclusive(async () => {
      if (!this.db) throw new Error('Banco SQLite não inicializado');
      if (this.currentTxContext) {
        return await this.currentTxContext.execute(sql, params);
      }
      if (params.length === 0) {
        return await this.db.execute(sql, false);
      }
      return await this.db.run(sql, params, false);
    });
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Banco SQLite não inicializado');
    const res = await this.db.query(sql, params);
    return (res.values || []) as T[];
  }

  async runInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Banco SQLite não inicializado');

    // Se já estiver dentro de uma transação ativa neste contexto, reentrância transparente
    if (this.currentTxContext) {
      return await fn(this.currentTxContext);
    }

    return this.runIsolatedInTransaction(fn);
  }

  /** Same established mutex/transaction path; explicit top-level callers cannot join an unrelated active transaction. */
  async runIsolatedInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T> {
    return this.withNativeTransaction(fn, true);
  }

  async readInSnapshot<T>(fn: (tx: IDatabaseService) => Promise<T>): Promise<T> {
    // Only scoped repositories may reenter this read. Unrelated global writes must await the mutex.
    return this.withNativeTransaction(tx => fn(tx!), false);
  }

  private async withNativeTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>, publishContext: boolean): Promise<T> {
    // Transação de nível superior: adquire bloqueio exclusivo no mutex
    return await this.mutex.runExclusive(async () => {
      if (!this.db) throw new Error('Banco SQLite não inicializado');

      const txContext = new NativeTransactionContext(this.db);
      this.currentTxContext = publishContext ? txContext : null;

      await this.db.beginTransaction();
      try {
        const result = await fn(txContext);
        const active = (await this.db.isTransactionActive()).result;
        if (active) {
          await this.db.commitTransaction();
        }
        return result;
      } catch (err) {
        try {
          const active = (await this.db.isTransactionActive()).result;
          if (active) {
            await this.db.rollbackTransaction();
          }
        } catch (rollbackErr) {
          console.warn('Erro ao executar rollback nativo:', rollbackErr);
        }
        throw err;
      } finally {
        this.currentTxContext = null;
      }
    });
  }

  async close(): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      this.currentTxContext = null;
      if (this.db) {
        const isOpen = (await this.db.isDBOpen()).result;
        if (isOpen) {
          await this.db.close();
        }
        if (this.sqlitePlugin) {
          await this.sqlitePlugin.closeConnection(DB_NAME, false);
        }
        this.db = null;
        this.isInitialized = false;
      }
    });
  }
}

/**
 * DatabaseService Singleton
 */
export class DatabaseService implements IDatabaseService {
  private static instance: DatabaseService | null = null;
  private adapter: IDatabaseService;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    if (Capacitor.isNativePlatform()) {
      this.adapter = new NativeSQLiteDatabaseAdapter();
    } else {
      this.adapter = typeof window === 'undefined' ? new WebInMemoryDatabaseAdapter() : new WebPersistentDatabaseAdapter();
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.adapter.initialize().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  public async execute(sql: string, params?: any[]): Promise<any> {
    await this.initialize();
    return this.adapter.execute(sql, params);
  }

  public async query<T>(sql: string, params?: any[]): Promise<T[]> {
    await this.initialize();
    return this.adapter.query<T>(sql, params);
  }

  public async runInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T> {
    await this.initialize();
    return this.adapter.runInTransaction(fn);
  }

  public async readInSnapshot<T>(fn: (tx: IDatabaseService) => Promise<T>): Promise<T> {
    await this.initialize();
    if (this.adapter.readInSnapshot) return this.adapter.readInSnapshot(fn);
    const run = this.adapter.runIsolatedInTransaction ?? this.adapter.runInTransaction;
    return run.call(this.adapter, (tx) => fn(tx ?? this.adapter)) as Promise<T>;
  }

  public async runIsolatedInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T> {
    await this.initialize();
    return this.adapter.runIsolatedInTransaction ? this.adapter.runIsolatedInTransaction(fn) : this.adapter.runInTransaction(fn);
  }

  public async close(): Promise<void> {
    await this.adapter.close();
    this.initPromise = null;
  }

  /**
   * Método de conveniência para testes que força uso de adaptador isolado em memória
   */
  public static createTestInstance(): DatabaseService {
    const service = new DatabaseService();
    service.adapter = new WebInMemoryDatabaseAdapter();
    return service;
  }
}
