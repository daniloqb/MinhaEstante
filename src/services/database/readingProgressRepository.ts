import {
  ReadingProgress,
  ProgressUnit,
  ProgressSource,
  isValidReadingProgress,
} from '../../types/digitalMedia';
import { IReadingProgressRepository, IDatabaseService, DbReadingProgressRow, DbReadingSessionRow } from './types';
import { DatabaseService } from './databaseService';

export class ReadingProgressRepository implements IReadingProgressRepository {
  private db: IDatabaseService;

  constructor(dbService?: IDatabaseService) {
    this.db = dbService || DatabaseService.getInstance();
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  validateProgress(unit: ProgressUnit, currentValue: number, totalValue?: number | null): boolean {
    return isValidReadingProgress(unit, currentValue, totalValue);
  }

  private rowToProgress(row: DbReadingProgressRow): ReadingProgress {
    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      unit: row.unit as ProgressUnit,
      currentValue: Number(row.current_value),
      totalValue: row.total_value != null ? Number(row.total_value) : null,
      source: row.source as ProgressSource,
      updatedAt: Number(row.updated_at),
    };
  }

  async saveProgress(
    params: Omit<ReadingProgress, 'id' | 'updatedAt'> & { id?: string }
  ): Promise<ReadingProgress> {
    await this.initialize();

    // 1. Validação de domínio do progresso
    if (!this.validateProgress(params.unit, params.currentValue, params.totalValue)) {
      throw new Error(
        `Progresso inválido: currentValue=${params.currentValue}, totalValue=${params.totalValue}, unit='${params.unit}'. Valores negativos ou currentValue > totalValue não são permitidos.`
      );
    }

    // 2. Integridade referencial: verifica se a sessão existe
    const sessionRows = await this.db.query<DbReadingSessionRow>(
      'SELECT id FROM reading_sessions WHERE id = ? LIMIT 1;',
      [params.sessionId]
    );
    if (!sessionRows || sessionRows.length === 0) {
      throw new Error(`Sessão de leitura com id '${params.sessionId}' não encontrada.`);
    }

    const now = Date.now();
    const existing = await this.getBySessionId(params.sessionId);

    if (existing) {
      // Atualiza progresso existente para a sessão (1:1)
      await this.db.execute(
        `UPDATE reading_progress SET
          unit = ?, current_value = ?, total_value = ?, source = ?, updated_at = ?
        WHERE session_id = ?;`,
        [
          params.unit,
          params.currentValue,
          params.totalValue ?? null,
          params.source,
          now,
          params.sessionId,
        ]
      );

      return {
        ...existing,
        unit: params.unit,
        currentValue: params.currentValue,
        totalValue: params.totalValue ?? null,
        source: params.source,
        updatedAt: now,
      };
    } else {
      const id =
        params.id ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `prog-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

      await this.db.execute(
        `INSERT INTO reading_progress (
          id, session_id, unit, current_value, total_value, source, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          params.sessionId,
          params.unit,
          params.currentValue,
          params.totalValue ?? null,
          params.source,
          now,
        ]
      );

      return {
        id,
        sessionId: params.sessionId,
        unit: params.unit,
        currentValue: params.currentValue,
        totalValue: params.totalValue ?? null,
        source: params.source,
        updatedAt: now,
      };
    }
  }

  async getBySessionId(sessionId: string): Promise<ReadingProgress | null> {
    await this.initialize();
    const rows = await this.db.query<DbReadingProgressRow>(
      'SELECT * FROM reading_progress WHERE session_id = ? LIMIT 1;',
      [sessionId]
    );
    if (!rows || rows.length === 0) return null;
    return this.rowToProgress(rows[0]);
  }

  async deleteBySessionId(sessionId: string): Promise<boolean> {
    await this.initialize();
    const result = await this.db.execute(
      'DELETE FROM reading_progress WHERE session_id = ?;',
      [sessionId]
    );
    const affected = result?.changes?.changes ?? result?.changes ?? 0;
    return affected > 0;
  }

  async count(): Promise<number> {
    await this.initialize();
    const rows = await this.db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM reading_progress;'
    );
    return rows?.[0]?.count ?? 0;
  }

  async clearAll(): Promise<void> {
    await this.initialize();
    await this.db.execute('DELETE FROM reading_progress;');
  }
}

export const readingProgressRepository = new ReadingProgressRepository();
