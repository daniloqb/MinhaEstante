import { Book } from '../../types/book';
import {
  BookAttachment,
  AttachmentType,
  ReaderPosition,
  ReaderLocationType,
  ReadingSession,
  ReadingProgress,
  ProgressUnit,
} from '../../types/digitalMedia';

// ==========================================
// LINHAS DO BANCO DE DADOS SQLITE (DB ROWS)
// ==========================================

export interface DbBookRow {
  id: number;
  uuid?: string | null;
  origem: string;
  id_externo: string | null;
  titulo: string;
  subtitulo: string | null;
  autores_json: string;
  editora: string | null;
  ano_publicacao: number | null;
  paginas: number | null;
  isbn10: string | null;
  isbn13: string | null;
  generos_json: string;
  descricao: string | null;
  capa_url: string | null;
  capa_local_path: string | null;
  formato: string;
  formatos_json?: string | null;
  tenho_fisico: number; // 0 ou 1
  status_leitura: string;
  emprestimo_json: string | null;
  mes_leitura: number | null;
  ano_leitura: number | null;
  nota: number | null;
  observacoes: string | null;
  data_cadastro: number;
  data_atualizacao: number;
}

export interface DbBookAttachmentRow {
  id: string;
  book_id: number;
  type: string;
  format: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number;
  storage_provider: string;
  storage_reference: string;
  checksum: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbReaderPositionRow {
  id: string;
  attachment_id: string;
  location_type: string;
  location: string;
  updated_at: number;
}

export interface DbReadingSessionRow {
  id: string;
  book_id: number;
  status: string;
  started_at: number;
  completed_at: number | null;
  abandoned_at: number | null;
  updated_at: number;
}

export interface DbReadingProgressRow {
  id: string;
  session_id: string;
  unit: string;
  current_value: number;
  total_value: number | null;
  source: string;
  updated_at: number;
}

// ==========================================
// CONTRATOS DE REPOSITÓRIO (INTERFACES)
// ==========================================

export interface IBookRepository {
  initialize(): Promise<void>;
  getAll(): Promise<Book[]>;
  getById(id: number): Promise<Book | null>;
  getByUuid?(uuid: string): Promise<Book | null>;
  insert(book: Omit<Book, 'id'> | Book): Promise<Book>;
  update(book: Book): Promise<Book>;
  delete(id: number): Promise<boolean>;
  count(): Promise<number>;
  clearAll(): Promise<void>;
  bulkInsert(books: Book[]): Promise<number>;
  search(query: string): Promise<Book[]>;
}

export interface IBookAttachmentRepository {
  initialize(): Promise<void>;
  create(attachment: Omit<BookAttachment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<BookAttachment>;
  getById(id: string): Promise<BookAttachment | null>;
  getByBookAndType(bookId: number, type: AttachmentType): Promise<BookAttachment | null>;
  getByBookId(bookId: number): Promise<BookAttachment[]>;
  update(attachment: BookAttachment): Promise<BookAttachment>;
  delete(id: string): Promise<boolean>;
  deleteByBookId(bookId: number): Promise<number>;
  exists(bookId: number, type: AttachmentType): Promise<boolean>;
  count(): Promise<number>;
  clearAll(): Promise<void>;
}

export interface IReaderPositionRepository {
  initialize(): Promise<void>;
  savePosition(position: Omit<ReaderPosition, 'id' | 'updatedAt'> & { id?: string }): Promise<ReaderPosition>;
  getByAttachmentId(attachmentId: string): Promise<ReaderPosition | null>;
  deleteByAttachmentId(attachmentId: string): Promise<boolean>;
  validateLocation(locationType: ReaderLocationType, location: string): boolean;
  count(): Promise<number>;
  clearAll(): Promise<void>;
}

export interface IReadingSessionRepository {
  initialize(): Promise<void>;
  create(params: { bookId: number; startedAt?: number }): Promise<ReadingSession>;
  getActiveSession(bookId: number): Promise<ReadingSession | null>;
  getHistoryByBookId(bookId: number): Promise<ReadingSession[]>;
  getById(id: string): Promise<ReadingSession | null>;
  update(session: ReadingSession): Promise<ReadingSession>;
  complete(id: string, completedAt?: number): Promise<ReadingSession>;
  abandon(id: string, abandonedAt?: number): Promise<ReadingSession>;
  delete(id: string): Promise<boolean>;
  deleteByBookId(bookId: number): Promise<number>;
  count(): Promise<number>;
  clearAll(): Promise<void>;
}

export interface IReadingProgressRepository {
  initialize(): Promise<void>;
  saveProgress(params: Omit<ReadingProgress, 'id' | 'updatedAt'> & { id?: string }): Promise<ReadingProgress>;
  getBySessionId(sessionId: string): Promise<ReadingProgress | null>;
  deleteBySessionId(sessionId: string): Promise<boolean>;
  validateProgress(unit: ProgressUnit, currentValue: number, totalValue?: number | null): boolean;
  count(): Promise<number>;
  clearAll(): Promise<void>;
}

export interface IDatabaseService {
  /** Short coherent read; callbacks must use repositories and perform no writes or file I/O. */
  readInSnapshot?<T>(fn: (tx: IDatabaseService) => Promise<T>): Promise<T>;
  initialize(): Promise<void>;
  execute(sql: string, params?: any[]): Promise<any>;
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  runInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T>;
  /** Top-level coordination must queue on the existing adapter mutex, not join another caller's transaction. */
  runIsolatedInTransaction?<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
