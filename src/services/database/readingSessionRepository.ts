import { ReadingSession, ReadingSessionStatus } from '../../types/digitalMedia';
import { IReadingSessionRepository, IDatabaseService, DbReadingSessionRow } from './types';
import { DatabaseService } from './databaseService';

export class ReadingSessionRepository implements IReadingSessionRepository {
  private db: IDatabaseService;

  constructor(dbService?: IDatabaseService) {
    this.db = dbService || DatabaseService.getInstance();
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  private rowToSession(row: DbReadingSessionRow): ReadingSession {
    return {
      id: String(row.id),
      bookId: Number(row.book_id),
      status: row.status as ReadingSessionStatus,
      startedAt: Number(row.started_at),
      completedAt: row.completed_at != null ? Number(row.completed_at) : null,
      abandonedAt: row.abandoned_at != null ? Number(row.abandoned_at) : null,
      updatedAt: Number(row.updated_at),
    };
  }

  async create(params: { bookId: number; startedAt?: number }): Promise<ReadingSession> {
    await this.initialize();

    // 1. Integridade referencial: verifica se o livro pai existe
    const bookRows = await this.db.query<{ id: number }>(
      'SELECT id FROM books WHERE id = ? LIMIT 1;',
      [params.bookId]
    );
    if (!bookRows || bookRows.length === 0) {
      throw new Error(`Livro com id ${params.bookId} não encontrado.`);
    }

    // 2. Restrição de unicidade de sessão ativa: no máximo 1 sessão ativa por obra
    const active = await this.getActiveSession(params.bookId);
    if (active) {
      throw new Error(
        `Já existe uma sessão de leitura ativa para o livro id ${params.bookId}. Conclua ou abandone a sessão atual antes de iniciar um novo ciclo.`
      );
    }

    const now = Date.now();
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const session: ReadingSession = {
      id,
      bookId: params.bookId,
      status: 'active',
      startedAt: params.startedAt || now,
      completedAt: null,
      abandonedAt: null,
      updatedAt: now,
    };

    await this.db.execute(
      `INSERT INTO reading_sessions (
        id, book_id, status, started_at, completed_at, abandoned_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        session.id,
        session.bookId,
        session.status,
        session.startedAt,
        session.completedAt,
        session.abandonedAt,
        session.updatedAt,
      ]
    );

    return session;
  }

  async getActiveSession(bookId: number): Promise<ReadingSession | null> {
    await this.initialize();
    const rows = await this.db.query<DbReadingSessionRow>(
      "SELECT * FROM reading_sessions WHERE book_id = ? AND status = 'active' LIMIT 1;",
      [bookId]
    );
    if (!rows || rows.length === 0) return null;
    return this.rowToSession(rows[0]);
  }

  async getHistoryByBookId(bookId: number): Promise<ReadingSession[]> {
    await this.initialize();
    const rows = await this.db.query<DbReadingSessionRow>(
      'SELECT * FROM reading_sessions WHERE book_id = ? ORDER BY started_at DESC;',
      [bookId]
    );
    return (rows || []).map((r) => this.rowToSession(r));
  }

  async getById(id: string): Promise<ReadingSession | null> {
    await this.initialize();
    const rows = await this.db.query<DbReadingSessionRow>(
      'SELECT * FROM reading_sessions WHERE id = ? LIMIT 1;',
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return this.rowToSession(rows[0]);
  }

  async update(session: ReadingSession): Promise<ReadingSession> {
    await this.initialize();
    const now = Date.now();

    // Se estiver atualizando para ativa, garante unicidade
    if (session.status === 'active') {
      const active = await this.getActiveSession(session.bookId);
      if (active && active.id !== session.id) {
        throw new Error(
          `Não é possível ativar a sessão pois já existe outra sessão ativa para o livro ${session.bookId}.`
        );
      }
    }

    await this.db.execute(
      `UPDATE reading_sessions SET
        status = ?, started_at = ?, completed_at = ?, abandoned_at = ?, updated_at = ?
      WHERE id = ?;`,
      [
        session.status,
        session.startedAt,
        session.completedAt ?? null,
        session.abandonedAt ?? null,
        now,
        session.id,
      ]
    );

    return {
      ...session,
      updatedAt: now,
    };
  }

  async complete(id: string, completedAt?: number): Promise<ReadingSession> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Sessão de leitura com id '${id}' não encontrada.`);
    }

    const now = Date.now();
    const completedSession: ReadingSession = {
      ...existing,
      status: 'completed',
      completedAt: completedAt || now,
      updatedAt: now,
    };

    return await this.update(completedSession);
  }

  async abandon(id: string, abandonedAt?: number): Promise<ReadingSession> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Sessão de leitura com id '${id}' não encontrada.`);
    }

    const now = Date.now();
    const abandonedSession: ReadingSession = {
      ...existing,
      status: 'abandoned',
      abandonedAt: abandonedAt || now,
      updatedAt: now,
    };

    return await this.update(abandonedSession);
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();
    const result = await this.db.execute(
      'DELETE FROM reading_sessions WHERE id = ?;',
      [id]
    );
    const affected = result?.changes?.changes ?? result?.changes ?? 0;
    return affected > 0;
  }

  async deleteByBookId(bookId: number): Promise<number> {
    await this.initialize();
    const result = await this.db.execute(
      'DELETE FROM reading_sessions WHERE book_id = ?;',
      [bookId]
    );
    return result?.changes?.changes ?? result?.changes ?? 0;
  }

  async count(): Promise<number> {
    await this.initialize();
    const rows = await this.db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM reading_sessions;'
    );
    return rows?.[0]?.count ?? 0;
  }

  async clearAll(): Promise<void> {
    await this.initialize();
    await this.db.execute('DELETE FROM reading_sessions;');
  }
}

export const readingSessionRepository = new ReadingSessionRepository();
