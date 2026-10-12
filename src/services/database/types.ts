import { Book } from '../../types/book';

export interface DbBookRow {
  id: number;
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

export interface IBookRepository {
  initialize(): Promise<void>;
  getAll(): Promise<Book[]>;
  getById(id: number): Promise<Book | null>;
  insert(book: Omit<Book, 'id'> | Book): Promise<Book>;
  update(book: Book): Promise<Book>;
  delete(id: number): Promise<boolean>;
  count(): Promise<number>;
  clearAll(): Promise<void>;
  bulkInsert(books: Book[]): Promise<number>;
  search(query: string): Promise<Book[]>;
}

export interface IDatabaseService {
  initialize(): Promise<void>;
  execute(sql: string, params?: any[]): Promise<any>;
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
