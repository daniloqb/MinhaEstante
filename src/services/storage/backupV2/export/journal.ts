import type { BackupOperationCheckpoint, BackupOperationStage } from '../contracts';
import type { DurableRecordStore } from '../../web/IndexedDbStore';
import { ExportFailure } from './types';

const prefix = 'backup-export:v1:';
export class BackupExportJournal {
  constructor(private readonly records: DurableRecordStore) {}
  async start(operationId: string, planDigest: string) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(operationId) || await this.records.get(prefix + operationId)) throw new ExportFailure('CONFLICT');
    const checkpoint: BackupOperationCheckpoint = { version: 1, operationId, backupId: operationId, direction: 'export', stage: 'planning', planDigest,
      childImportOperationIds: [], verifiedEntryPaths: [], committed: { bookUuids: [], attachmentIds: [], sessionIds: [], progressIds: [] },
      outputState: 'not-created', cancelRequested: false };
    await this.records.put(prefix + operationId, checkpoint);
  }
  async checkpoint(operationId: string, stage: BackupOperationStage, outputState: BackupOperationCheckpoint['outputState']) {
    const prior = await this.records.get<BackupOperationCheckpoint>(prefix + operationId);
    if (!prior || prior.version !== 1 || prior.direction !== 'export') throw new ExportFailure('RECOVERY_REQUIRED');
    await this.records.put(prefix + operationId, { ...prior, stage, outputState, cancelRequested: stage === 'cancelled' });
  }
  async unfinished() {
    const values = await this.records.list<BackupOperationCheckpoint>(prefix);
    if (values.some(row => row.version !== 1 || row.direction !== 'export')) throw new ExportFailure('RECOVERY_REQUIRED');
    // Read-only recovery: never resume, rewrite destinations or alter a different active tab's receipt.
    return values.filter(row => row.outputState !== 'finalized');
  }
}
