/// <reference lib="webworker" />
import { boundedBlobStream, BackupZipFailure, verifyBackupZip, writeBackupZip } from '../zip/streamingZip';
import { DEFAULT_BACKUP_LIMITS } from '../contracts';
import { digestBlob, WEB_EXPORT_MAX_BYTES, WEB_EXPORT_MAX_ENTRY_BYTES } from '../export/prepare';
import { IncrementalSha256 } from '../../digital/web/sha256';
import type { WorkerExportRequest, WorkerReply, WorkerRequest } from './messages';
import type { BackupZipProgress } from '../zip/streamingZip';
const scope = self as unknown as DedicatedWorkerGlobalScope;
const controller = new AbortController();
let started = false, sequence = 0;
const pending = new Map<number, { resolve: () => void; reject: () => void }>();
function send(value: WorkerReply) { scope.postMessage(value); }
async function checkpoint(stage: Extract<WorkerReply, { type: 'checkpoint' }>['stage'], outputState: Extract<WorkerReply, { type: 'checkpoint' }>['outputState'], revalidate = false) {
  if (controller.signal.aborted) throw new BackupZipFailure('CANCELLED');
  const token = ++sequence;
  await new Promise<void>((resolve, reject) => {
    pending.set(token, { resolve, reject: () => reject(new BackupZipFailure(controller.signal.aborted ? 'CANCELLED' : 'INTEGRITY')) });
    send({ type: 'checkpoint', token, stage, outputState, revalidate });
  });
}
async function run(request: WorkerExportRequest) {
  const start = performance.now(), limits = { ...DEFAULT_BACKUP_LIMITS, maxEntryBytes: WEB_EXPORT_MAX_ENTRY_BYTES, maxTotalBytes: WEB_EXPORT_MAX_BYTES, maxManifestBytes: 1024 * 1024 };
  let last = 0;
  const progress = (event: BackupZipProgress) => {
    const now = performance.now();
    if (now - last >= 100 || ['finalize', 'before-finalize', 'done'].includes(event.phase)) {
      last = now; send({ type: 'progress', progress: { ...event, operationId: request.operationId,
        // Codec verification alone cannot declare coordinator/snapshot completion.
        stage: event.stage === 'completed' ? 'verifying' : event.stage } });
    }
  };
  await checkpoint('transferring', 'incomplete');
  const raw = await request.destination.createWritable();
  if (controller.signal.aborted) { await raw.abort().catch(() => undefined); throw new BackupZipFailure('CANCELLED'); }
  const writer = raw.getWriter(), writtenSha = new IncrementalSha256();
  let written = 0;
  const output = new WritableStream<Uint8Array>({
    async write(chunk) { await writer.write(chunk); writtenSha.update(chunk); written += chunk.byteLength; },
    async close() { try { await writer.close(); } finally { writer.releaseLock(); } },
    async abort(reason) { try { await writer.abort(reason); } finally { writer.releaseLock(); } },
  });
  try {
    const books = JSON.parse(await request.payloads.find(row => row.archivePath === 'books.json')!.blob.text()) as { uuid: string }[];
    const metrics = await writeBackupZip({ manifest: request.manifest, bookUuids: books.map(row => row.uuid),
      sources: request.payloads.map(row => ({ archivePath: row.archivePath, sizeBytes: row.sizeBytes, open: () => boundedBlobStream(row.blob) })) }, output,
    { level: 0, signal: controller.signal, limits, onProgress: progress, beforeFinalize: () => checkpoint('finalizing', 'incomplete', true) });
    await checkpoint('verifying', 'closed-unverified');
    const file = await request.destination.getFile();
    if (file.size !== written || written !== metrics.outputBytes) throw new BackupZipFailure('INTEGRITY');
    const zipSha256 = await digestBlob(file, controller.signal);
    if (zipSha256 !== writtenSha.hex()) throw new BackupZipFailure('INTEGRITY');
    const verified = await verifyBackupZip(file, limits, controller.signal, progress);
    if (JSON.stringify(verified.manifest) !== JSON.stringify(request.manifest)) throw new BackupZipFailure('MANIFEST');
    await checkpoint('reconciling', 'closed-unverified', true);
    send({ type: 'complete', receipt: { status: 'verified', destination: request.kind, outputBytes: file.size, zipSha256,
      entries: verified.entries, durationMs: performance.now() - start } });
  } catch (error) {
    await writer.abort().catch(() => undefined); try { writer.releaseLock(); } catch { /* already released */ }
    throw error;
  }
}
scope.onmessage = event => {
  const message = event.data as WorkerRequest;
  if (message.type === 'cancel') { controller.abort(); for (const wait of pending.values()) wait.reject(); pending.clear(); return; }
  if (message.type === 'ack') { const wait = pending.get(message.token); pending.delete(message.token); if (message.ok) wait?.resolve(); else wait?.reject(); return; }
  if (started) { send({ type: 'failed', code: 'CONFLICT' }); return; }
  started = true;
  void run(message.request).catch(error => send({ type: 'failed', code: controller.signal.aborted ? 'CANCELLED' : error instanceof BackupZipFailure ? error.code
    : error instanceof DOMException && error.name === 'QuotaExceededError' ? 'QUOTA' : 'IO_FAILED' }));
};
