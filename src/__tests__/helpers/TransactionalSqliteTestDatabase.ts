import { DatabaseSync } from 'node:sqlite';
import { INITIAL_SCHEMA_SQL, V2_MIGRATION_SQL } from '../../services/database/databaseService';
import type { IDatabaseService } from '../../services/database/types';

/** Real desktop SQLite for rollback assertions. This is not an Android adapter. */
export class TransactionalSqliteTestDatabase implements IDatabaseService {
  readonly sql: DatabaseSync;
  failInsert = false;
  failCommit = false;
  failUpdate = false;
  constructor(path = ':memory:') {
    this.sql = new DatabaseSync(path);
    this.sql.exec(`PRAGMA foreign_keys=ON;${INITIAL_SCHEMA_SQL}${V2_MIGRATION_SQL}`);
  }
  async initialize() {}
  async execute(sql: string, parameters: any[] = []) {
    if (this.failInsert && sql.trimStart().startsWith('INSERT INTO book_attachments')) throw new Error('Synthetic SQLite failure');
    if (this.failUpdate && sql.trimStart().startsWith('UPDATE book_attachments')) throw new Error('Synthetic update failure');
    const result = this.sql.prepare(sql).run(...parameters);
    return { changes: Number(result.changes), lastId: Number(result.lastInsertRowid) };
  }
  async query<T>(sql: string, parameters: any[] = []) { return this.sql.prepare(sql).all(...parameters) as T[]; }
  async runInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>) {
    this.sql.exec('BEGIN');
    try {
      const result = await fn(this);
      if (this.failCommit) throw new Error('Synthetic commit failure');
      this.sql.exec('COMMIT'); return result;
    } catch (error) { this.sql.exec('ROLLBACK'); throw error; }
  }
  async close() { this.sql.close(); }
}
