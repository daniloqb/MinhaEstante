import type { WebOpfsStorageProvider } from '../../digital/web/WebOpfsStorageProvider';
import { managedFileReference } from '../../digital/validation';
import { ExportFailure, checkCancelled } from '../export/types';
import type { ExportDestination, ExportExecution, ExportReceipt, PreparedExport } from '../export/types';
import type { WorkerExportRequest, WorkerReply } from './messages';

export function webExportCapability(environment = globalThis.navigator?.userAgent ?? '') {
  if (/Android|iPhone|iPad|iPod/i.test(environment)) return { supported: false, reason: 'mobile-unverified' as const };
  const supported = !!(globalThis.isSecureContext && globalThis.Worker && globalThis.navigator?.locks
    && typeof (globalThis as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function');
  return { supported, reason: supported ? null : 'external-unavailable' as const };
}
export async function exportBlobs(plan: Pick<PreparedExport, 'payloads'>, provider: WebOpfsStorageProvider, signal?: AbortSignal) {
  const sources: WorkerExportRequest['payloads'][number][] = [];
  for (const source of plan.payloads) {
    checkCancelled(signal);
    let blob = source.blob;
    if (source.managed) {
      const row = source.managed;
      const result = await provider.openExportSource(managedFileReference(row.storageProvider, row.storageReference),
        { sizeBytes: source.sizeBytes, checksum: { algorithm: 'sha256', value: source.sha256 } });
      if (result.status !== 'success') throw new ExportFailure(result.status === 'error' && result.error.code === 'INTEGRITY_MISMATCH' ? 'INTEGRITY_MISMATCH' : 'MEDIA_UNAVAILABLE', { attachmentId: row.id, filename: row.filename });
      blob = result.value;
    }
    if (!blob || blob.size !== source.sizeBytes) throw new ExportFailure('INTEGRITY_MISMATCH');
    sources.push({ archivePath: source.archivePath, sizeBytes: source.sizeBytes, sha256: source.sha256, blob });
  }
  return sources;
}
export function selectWebExportDestination(provider: WebOpfsStorageProvider): Promise<ExportDestination> {
  if (!webExportCapability().supported) return Promise.reject(new ExportFailure('CAPABILITY_UNAVAILABLE'));
  const picker = (globalThis as unknown as { showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
  // Called synchronously from the click. Preparation/preview happened before this gesture.
  return picker({ suggestedName: `MinhaEstante_Backup_v2_${Date.now()}.zip`, types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }] })
    .then(handle => new WebExportDestination(handle, provider));
}
function errorCode(code: string) {
  if (code === 'CANCELLED') return 'CANCELLED';
  if (code === 'QUOTA') return 'INSUFFICIENT_SPACE';
  if (code === 'INTEGRITY') return 'INTEGRITY_MISMATCH';
  if (code === 'MANIFEST' || code === 'ZIP_FORMAT') return 'ARCHIVE_INVALID';
  return 'IO_FAILED';
}
export class WebExportDestination implements ExportDestination {
  constructor(private readonly handle: FileSystemFileHandle, private readonly provider: WebOpfsStorageProvider,
    readonly kind: ExportReceipt['destination'] = 'web-external',
    private readonly createWorker = () => new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' })) {}
  async execute(request: ExportExecution): Promise<ExportReceipt> {
    checkCancelled(request.signal);
    const payloads = await exportBlobs(request, this.provider, request.signal);
    checkCancelled(request.signal);
    const worker = this.createWorker();
    return new Promise((resolve, reject) => {
      let settled = false, timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = (receipt?: ExportReceipt, error?: ExportFailure) => {
        if (settled) return; settled = true; clearTimeout(timeout); request.signal.removeEventListener('abort', cancel); worker.terminate();
        if (receipt) resolve(receipt); else reject(error ?? new ExportFailure('IO_FAILED'));
      };
      const cancel = () => {
        if (settled || timeout) return;
        try { worker.postMessage({ type: 'cancel' }); }
        catch { finish(undefined, new ExportFailure('CANCELLED')); return; }
        // Native filesystem promises need not honor AbortSignal. A bounded termination is still failure, never success.
        timeout = setTimeout(() => finish(undefined, new ExportFailure('CANCELLED')), 5000);
      };
      request.signal.addEventListener('abort', cancel, { once: true });
      worker.onerror = () => finish(undefined, new ExportFailure('IO_FAILED'));
      worker.onmessageerror = () => finish(undefined, new ExportFailure('CAPABILITY_UNAVAILABLE'));
      worker.onmessage = event => {
        const value = event.data as WorkerReply;
        if (settled) return;
        if (value.type === 'progress') { request.onProgress(value.progress); return; }
        if (value.type === 'checkpoint') {
          void (async () => {
            try {
              checkCancelled(request.signal); await request.checkpoint(value.stage, value.outputState);
              if (value.revalidate) await request.revalidate();
              if (!settled) worker.postMessage({ type: 'ack', token: value.token, ok: true });
            } catch (error) {
              try { if (!settled) worker.postMessage({ type: 'ack', token: value.token, ok: false }); } catch { /* termination still settles the caller */ }
              finish(undefined, error instanceof ExportFailure ? error : new ExportFailure('IO_FAILED'));
            }
          })(); return;
        }
        if (value.type === 'failed') { finish(undefined, new ExportFailure(errorCode(value.code))); return; }
        if (request.signal.aborted) finish(undefined, new ExportFailure('CANCELLED')); else finish(value.receipt);
      };
      try { worker.postMessage({ type: 'start', request: { operationId: request.operationId, manifest: request.manifest,
        payloads, destination: this.handle, kind: this.kind } satisfies WorkerExportRequest });
        if (request.signal.aborted) cancel();
      } catch { finish(undefined, new ExportFailure('CAPABILITY_UNAVAILABLE')); }
    });
  }
}
