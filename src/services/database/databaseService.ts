import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { IDatabaseService } from './types';

const DB_NAME = 'minha_estante_db';
const CURRENT_DB_VERSION = 1;

/**
 * DDL inicial do banco de dados SQLite
 */
const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
 * Adaptador Web/Memória para desenvolvimento no Vite desktop e execução de testes no Vitest
 */
class WebInMemoryDatabaseAdapter implements IDatabaseService {
  private rows: Map<number, any> = new Map();
  private autoIncrementId = 1;
  private isReady = false;

  async initialize(): Promise<void> {
    this.isReady = true;
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.isReady) await this.initialize();
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('CREATE') || upper.startsWith('PRAGMA')) {
      return { changes: 0 };
    }

    if (upper.startsWith('INSERT INTO BOOKS')) {
      const id = params[0] ? Number(params[0]) : this.autoIncrementId++;
      if (id >= this.autoIncrementId) {
        this.autoIncrementId = id + 1;
      }
      const row = {
        id,
        origem: params[1],
        id_externo: params[2],
        titulo: params[3],
        subtitulo: params[4],
        autores_json: params[5],
        editora: params[6],
        ano_publicacao: params[7],
        paginas: params[8],
        isbn10: params[9],
        isbn13: params[10],
        generos_json: params[11],
        descricao: params[12],
        capa_url: params[13],
        capa_local_path: params[14],
        formato: params[15],
        tenho_fisico: params[16],
        status_leitura: params[17],
        emprestimo_json: params[18],
        mes_leitura: params[19],
        ano_leitura: params[20],
        nota: params[21],
        observacoes: params[22],
        data_cadastro: params[23],
        data_atualizacao: params[24],
      };
      this.rows.set(id, row);
      return { changes: 1, lastId: id };
    }

    if (upper.startsWith('UPDATE BOOKS')) {
      // Ex: UPDATE books SET ... WHERE id = ?
      const id = Number(params[params.length - 1]);
      const existing = this.rows.get(id);
      if (existing) {
        const updated = {
          ...existing,
          origem: params[0],
          id_externo: params[1],
          titulo: params[2],
          subtitulo: params[3],
          autores_json: params[4],
          editora: params[5],
          ano_publicacao: params[6],
          paginas: params[7],
          isbn10: params[8],
          isbn13: params[9],
          generos_json: params[10],
          descricao: params[11],
          capa_url: params[12],
          capa_local_path: params[13],
          formato: params[14],
          tenho_fisico: params[15],
          status_leitura: params[16],
          emprestimo_json: params[17],
          mes_leitura: params[18],
          ano_leitura: params[19],
          nota: params[20],
          observacoes: params[21],
          data_atualizacao: params[22],
        };
        this.rows.set(id, updated);
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (upper.startsWith('DELETE FROM BOOKS WHERE ID =')) {
      const id = Number(params[0]);
      const deleted = this.rows.delete(id);
      return { changes: deleted ? 1 : 0 };
    }

    if (upper.startsWith('DELETE FROM BOOKS')) {
      const count = this.rows.size;
      this.rows.clear();
      this.autoIncrementId = 1;
      return { changes: count };
    }

    return { changes: 0 };
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const upper = sql.trim().toUpperCase();

    if (upper.includes('COUNT(*)')) {
      if (upper.includes('WHERE CAPA_LOCAL_PATH =')) {
        const targetPath = params[0];
        const excludeId = Number(params[1] || 0);
        let matchCount = 0;
        for (const row of this.rows.values()) {
          if (row.capa_local_path === targetPath && row.id !== excludeId) {
            matchCount++;
          }
        }
        return [{ count: matchCount }] as any;
      }
      return [{ count: this.rows.size }] as any;
    }

    if (upper.includes('WHERE ID = ?') || upper.includes('WHERE ID =')) {
      const id = Number(params[0]);
      const row = this.rows.get(id);
      return row ? ([row] as any) : [];
    }

    if (upper.includes('LIKE ?')) {
      const pattern = String(params[0] || '').replace(/%/g, '').toLowerCase();
      const filtered = Array.from(this.rows.values()).filter((row) => {
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

    // Retorna todos os registros ordenados por data_cadastro DESC
    const all = Array.from(this.rows.values());
    all.sort((a, b) => b.data_cadastro - a.data_cadastro);
    return all as any;
  }

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return await fn();
  }

  async close(): Promise<void> {
    this.rows.clear();
  }
}

/**
 * Adaptador Nativo SQLite usando @capacitor-community/sqlite
 */
class NativeSQLiteDatabaseAdapter implements IDatabaseService {
  private sqlitePlugin: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
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

      await this.db.open();

      // Executa criação do esquema inicial
      await this.db.execute(INITIAL_SCHEMA_SQL);

      // Registra versão da migração
      await this.db.run(
        `INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?);`,
        [CURRENT_DB_VERSION, Date.now()]
      );

      this.isInitialized = true;
    } catch (err) {
      console.error('Falha ao inicializar banco de dados SQLite nativo:', err);
      throw err;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Banco SQLite não inicializado');
    if (params.length === 0) {
      return await this.db.execute(sql);
    }
    return await this.db.run(sql, params);
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Banco SQLite não inicializado');
    const res = await this.db.query(sql, params);
    return (res.values || []) as T[];
  }

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Banco SQLite não inicializado');
    await this.db.execute('BEGIN TRANSACTION;');
    try {
      const result = await fn();
      await this.db.execute('COMMIT;');
      return result;
    } catch (err) {
      await this.db.execute('ROLLBACK;');
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      if (this.sqlitePlugin) {
        await this.sqlitePlugin.closeConnection(DB_NAME, false);
      }
      this.db = null;
      this.isInitialized = false;
    }
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
      this.adapter = new WebInMemoryDatabaseAdapter();
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

  public async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.initialize();
    return this.adapter.runInTransaction(fn);
  }

  public async close(): Promise<void> {
    await this.adapter.close();
    this.initPromise = null;
  }

  /**
   * Método de conveniência para testes que força uso do adaptador de memória
   */
  public static createTestInstance(): DatabaseService {
    const service = new DatabaseService();
    service.adapter = new WebInMemoryDatabaseAdapter();
    return service;
  }
}
