import type { Book } from '../../../../types/book';
import type { DigitalBackupOptions, BackupOperationCheckpoint } from '../contracts';
import { prepareExport, snapshotDigest, WEB_EXPORT_MAX_BYTES } from './prepare';
import { checkCancelled, ExportFailure } from './types';
import type { CatalogSnapshot, ExportDestination, ExportProgress, ExportReport, PreparedExport } from './types';
import { BackupExportJournal } from './journal';
import { backupManifestFiles, validateBackupFileIntegrity } from '../validation';

export interface ExportDependencies {
  catalog: { read(signal?: AbortSignal): Promise<CatalogSnapshot> };
  readCover: (book: Book) => Promise<Blob | null>;
  validateMedia: (plan: PreparedExport, signal?: AbortSignal) => Promise<void>;
  journal: BackupExportJournal;
  maxBytes?: number;
  lock?: <T>(work: () => Promise<T>) => Promise<T>;
}
let active = false;
const activeOperations = new Set<string>();
export async function exportLock<T>(work: () => Promise<T>): Promise<T> {
  if (active) throw new ExportFailure('CONFLICT');
  active = true;
  try {
    if (globalThis.navigator?.locks) return await navigator.locks.request('minhaestante:backup-v2-export', { ifAvailable: true }, lock => {
      if (!lock) throw new ExportFailure('CONFLICT'); return work();
    });
    return await work(); // Native companion also owns a process-wide mutex. Web destination rejects absent Web Locks.
  } finally { active = false; }
}

export class BackupV2ExportCoordinator {
  constructor(private readonly dependencies: ExportDependencies) {}
  async prepare(options: DigitalBackupOptions, signal?: AbortSignal): Promise<PreparedExport> {
    checkCancelled(signal);
    const plan = await prepareExport(await this.dependencies.catalog.read(signal), options, this.dependencies.readCover,
      `backup-${crypto.randomUUID()}`, this.dependencies.maxBytes ?? WEB_EXPORT_MAX_BYTES, signal);
    await this.dependencies.validateMedia(plan, signal); checkCancelled(signal);
    await this.revalidate(plan, signal);
    return plan;
  }
  private async revalidate(plan: PreparedExport, signal?: AbortSignal) {
    checkCancelled(signal);
    if (await snapshotDigest(await this.dependencies.catalog.read(signal)) !== plan.snapshotDigest) throw new ExportFailure('CONFLICT');
  }
  async export(plan: PreparedExport, destination: ExportDestination, signal: AbortSignal,
    onProgress: (event: ExportProgress) => void = () => {}): Promise<ExportReport> {
    const operationId = plan.manifest.backupId;
    const selected = plan.manifest.media.filter(row => row.state === 'included');
    const omitted = plan.manifest.media.flatMap(row => row.state === 'omitted'
      ? [{ attachmentId: row.id, filename: row.filename, reason: row.reason }] : []);
    const requested = { ebooks: selected.filter(row => row.type === 'ebook').length, audiobooks: selected.filter(row => row.type === 'audiobook').length };
    // A repeated submission must not abandon the destination owned by the first invocation.
    if (activeOperations.has(operationId)) return { operationId, status: 'failed', error: 'CONFLICT', omitted,
      partialMayRemain: true, outputClosed: false, requested, includedMedia: 0, blockedFiles: [] };
    activeOperations.add(operationId);
    let outputState: BackupOperationCheckpoint['outputState'] = 'incomplete', started = false;
    try {
      return await (this.dependencies.lock ?? exportLock)(async () => {
        await this.dependencies.journal.start(operationId, plan.snapshotDigest); started = true;
        const checkpoint = async (stage: BackupOperationCheckpoint['stage'], state: BackupOperationCheckpoint['outputState']) => {
          await this.dependencies.journal.checkpoint(operationId, stage, state); outputState = state;
        };
        checkCancelled(signal); await this.revalidate(plan, signal);
        await checkpoint('preparing', 'incomplete');
        const receipt = await destination.execute({ operationId, manifest: plan.manifest, payloads: plan.payloads, signal, onProgress, checkpoint,
          revalidate: () => this.revalidate(plan, signal) });
        checkCancelled(signal); await this.revalidate(plan, signal);
        if (receipt.status !== 'verified' || receipt.destination !== destination.kind) throw new ExportFailure('INTEGRITY_MISMATCH');
        const expected = backupManifestFiles(plan.manifest);
        if (!/^[a-f0-9]{64}$/.test(receipt.zipSha256) || !Number.isSafeInteger(receipt.outputBytes) || receipt.outputBytes <= 0
          || receipt.entries.length !== expected.length || new Set(receipt.entries.map(row => row.archivePath)).size !== expected.length
          || expected.some(row => {
            const actual = receipt.entries.find(value => value.archivePath === row.archivePath);
            return !actual || !validateBackupFileIntegrity(row, { archivePath: actual.archivePath, sizeBytes: actual.sizeBytes,
              checksum: { algorithm: 'sha256', value: actual.sha256 } }).valid;
          })) throw new ExportFailure('INTEGRITY_MISMATCH');
        checkCancelled(signal); await destination.confirm?.();
        await checkpoint('completed', 'finalized');
        return { operationId, status: 'verified', receipt, omitted, partialMayRemain: false, outputClosed: true, requested, includedMedia: selected.length, blockedFiles: [] };
      });
    } catch (error) {
      const code = signal.aborted ? 'CANCELLED' : error instanceof ExportFailure ? error.code : 'IO_FAILED';
      if (error instanceof ExportFailure && error.outputClosed) outputState = 'closed-unverified';
      if (started) await this.dependencies.journal.checkpoint(operationId, code === 'CANCELLED' ? 'cancelled' : 'failed', outputState).catch(() => undefined);
      await destination.abandon?.().catch(() => undefined);
      return { operationId, status: code === 'CANCELLED' ? 'cancelled' : 'failed', error: code, omitted, partialMayRemain: true,
        outputClosed: outputState === 'closed-unverified', requested, includedMedia: 0, blockedFiles: selected.map(row => ({ attachmentId: row.id, filename: row.filename })) };
    } finally { activeOperations.delete(operationId); }
  }
}
