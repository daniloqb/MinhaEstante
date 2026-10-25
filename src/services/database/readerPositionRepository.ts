import {
  ReaderPosition,
  ReaderLocationType,
  isValidReaderLocation,
  getExpectedLocationTypeForFormat,
} from '../../types/digitalMedia';
import { IReaderPositionRepository, IDatabaseService, DbReaderPositionRow, DbBookAttachmentRow } from './types';
import { DatabaseService } from './databaseService';

export class ReaderPositionRepository implements IReaderPositionRepository {
  private db: IDatabaseService;

  constructor(dbService?: IDatabaseService) {
    this.db = dbService || DatabaseService.getInstance();
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  validateLocation(locationType: ReaderLocationType, location: string): boolean {
    return isValidReaderLocation(locationType, location);
  }

  private rowToPosition(row: DbReaderPositionRow): ReaderPosition {
    return {
      id: String(row.id),
      attachmentId: String(row.attachment_id),
      locationType: row.location_type as ReaderLocationType,
      location: String(row.location),
      updatedAt: Number(row.updated_at),
    };
  }

  async savePosition(
    params: Omit<ReaderPosition, 'id' | 'updatedAt'> & { id?: string }
  ): Promise<ReaderPosition> {
    await this.initialize();

    // 1. Validação do formato do local
    if (!this.validateLocation(params.locationType, params.location)) {
      throw new Error(
        `Localização inválida '${params.location}' para o tipo '${params.locationType}'.`
      );
    }

    // 2. Integridade referencial: verifica se o anexo existe
    const attachmentRows = await this.db.query<DbBookAttachmentRow>(
      'SELECT id, format FROM book_attachments WHERE id = ? LIMIT 1;',
      [params.attachmentId]
    );
    if (!attachmentRows || attachmentRows.length === 0) {
      throw new Error(`Anexo com id '${params.attachmentId}' não encontrado.`);
    }

    // 3. Compatibilidade entre formato do anexo e tipo de localização
    const attachmentFormat = attachmentRows[0].format as any;
    const expectedType = getExpectedLocationTypeForFormat(attachmentFormat);
    if (params.locationType !== expectedType) {
      throw new Error(
        `Tipo de localização incompatível '${params.locationType}' para anexo do formato '${attachmentFormat}'. Esperado: '${expectedType}'.`
      );
    }

    const now = Date.now();
    const existing = await this.getByAttachmentId(params.attachmentId);

    if (existing) {
      // Atualiza posição existente para este anexo (relação 1:1)
      await this.db.execute(
        `UPDATE reader_positions SET
          location_type = ?, location = ?, updated_at = ?
        WHERE attachment_id = ?;`,
        [params.locationType, params.location, now, params.attachmentId]
      );

      return {
        ...existing,
        locationType: params.locationType,
        location: params.location,
        updatedAt: now,
      };
    } else {
      const id =
        params.id ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

      await this.db.execute(
        `INSERT INTO reader_positions (
          id, attachment_id, location_type, location, updated_at
        ) VALUES (?, ?, ?, ?, ?);`,
        [id, params.attachmentId, params.locationType, params.location, now]
      );

      return {
        id,
        attachmentId: params.attachmentId,
        locationType: params.locationType,
        location: params.location,
        updatedAt: now,
      };
    }
  }

  async getByAttachmentId(attachmentId: string): Promise<ReaderPosition | null> {
    await this.initialize();
    const rows = await this.db.query<DbReaderPositionRow>(
      'SELECT * FROM reader_positions WHERE attachment_id = ? LIMIT 1;',
      [attachmentId]
    );
    if (!rows || rows.length === 0) return null;
    return this.rowToPosition(rows[0]);
  }

  async deleteByAttachmentId(attachmentId: string): Promise<boolean> {
    await this.initialize();
    const result = await this.db.execute(
      'DELETE FROM reader_positions WHERE attachment_id = ?;',
      [attachmentId]
    );
    const affected = result?.changes?.changes ?? result?.changes ?? 0;
    return affected > 0;
  }

  async count(): Promise<number> {
    await this.initialize();
    const rows = await this.db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM reader_positions;'
    );
    return rows?.[0]?.count ?? 0;
  }

  async clearAll(): Promise<void> {
    await this.initialize();
    await this.db.execute('DELETE FROM reader_positions;');
  }
}

export const readerPositionRepository = new ReaderPositionRepository();
