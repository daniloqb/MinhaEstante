import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type { ExportDestination, ExportExecution, ExportProgress, ExportReceipt, PreparedExport } from '../export/types';
import { ExportFailure, checkCancelled } from '../export/types';
import type { BackupErrorCode } from '../contracts';

type Result<T> = { status: 'success'; value: T } | { status: 'error'; code: string; outputClosed?: boolean };
interface NativeBridge {
  diagnoseChromeExternal(): Promise<Result<unknown>>;
  selectChromeExternalDiagnostic(request: { interaction: 'user-initiated' }): Promise<Result<unknown>>;
  setDiagnosticFault(request: { operationId: string; mode: 'write' | 'finalize' | 'verify' }): Promise<Result<unknown>>;
  capabilities(): Promise<Result<{ enabled: boolean; maxBytes: number; temporaryAvailableBytes: number }>>;
  validateSources(request: { sources: unknown[] }): Promise<Result<unknown>>;
  selectDestination(request: { operationId: string; interaction: 'user-initiated' }): Promise<Result<unknown>>;
  stageMetadata(request: { operationId: string; archivePath: string; sizeBytes: number; sha256: string; text?: string; base64?: string }): Promise<Result<unknown>>;
  write(request: { operationId: string; manifest: string; sources: unknown[] }): Promise<Result<ExportReceipt>>;
  confirm(request: { operationId: string }): Promise<Result<unknown>>;
  abandon(request: { operationId: string }): Promise<Result<unknown>>;
  cancel(request: { operationId: string }): Promise<Result<unknown>>;
  unfinished(): Promise<Result<{ operations: { operationId: string; stage: string }[] }>>;
  addListener(event: 'progress', callback: (progress: ExportProgress) => void): Promise<PluginListenerHandle>;
}
export const NativeBackupExport = registerPlugin<NativeBridge>('BackupV2Export');
const codes = new Set(['INVALID_MANIFEST','INVALID_REFERENCE','INVALID_PATH','INTEGRITY_MISMATCH','LIMIT_EXCEEDED','MEDIA_UNAVAILABLE',
  'CONFLICT','CAPABILITY_UNAVAILABLE','INSUFFICIENT_SPACE','PERMISSION_REQUIRED','IO_FAILED','CANCELLED','RECOVERY_REQUIRED']);
function unwrap<T>(value: Result<T>): T {
  if (value.status === 'success') return value.value;
  throw new ExportFailure((codes.has(value.code) ? value.code : value.code === 'INTEGRITY' ? 'INTEGRITY_MISMATCH' : 'IO_FAILED') as BackupErrorCode, undefined, value.outputClosed === true);
}
function descriptor(source: PreparedExport['payloads'][number]) {
  return { archivePath: source.archivePath, sizeBytes: source.sizeBytes, sha256: source.sha256, ...(source.managed ? {
    storageReference: source.managed.storageReference, attachmentId: source.managed.id, bookId: source.managed.bookId, format: source.managed.format,
  } : {}) };
}
export async function validateNativeSources(plan: PreparedExport) {
  for (const row of plan.payloads.filter(row => row.managed)) {
    try { unwrap(await NativeBackupExport.validateSources({ sources: [descriptor(row)] })); }
    catch (error) { throw new ExportFailure(error instanceof ExportFailure ? error.code : 'MEDIA_UNAVAILABLE', { attachmentId: row.managed!.id, filename: row.managed!.filename }); }
  }
}
export async function selectNativeExportDestination(plan: PreparedExport): Promise<ExportDestination> {
  unwrap(await NativeBackupExport.selectDestination({ operationId: plan.manifest.backupId, interaction: 'user-initiated' }));
  return new NativeExportDestination(plan.manifest.backupId);
}
export class NativeExportDestination implements ExportDestination {
  readonly kind = 'saf' as const;
  constructor(private readonly operationId: string) {}
  async execute(request: ExportExecution): Promise<ExportReceipt> {
    const cancel = () => { void NativeBackupExport.cancel({ operationId: this.operationId }).catch(() => undefined); };
    request.signal.addEventListener('abort', cancel, { once: true });
    let listener: PluginListenerHandle | undefined;
    try {
      checkCancelled(request.signal); await request.checkpoint('preparing', 'incomplete');
      for (const source of request.payloads) {
        checkCancelled(request.signal);
        if (!source.blob) continue;
        const data = source.archivePath.endsWith('.json') ? { text: await source.blob.text() } : { base64: await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new ExportFailure('IO_FAILED')); reader.readAsDataURL(source.blob!);
        }) };
        unwrap(await NativeBackupExport.stageMetadata({ operationId: this.operationId, ...descriptor(source), ...data }));
      }
      checkCancelled(request.signal); await request.revalidate(); await request.checkpoint('transferring', 'incomplete');
      listener = await NativeBackupExport.addListener('progress', progress => { if (progress.operationId === this.operationId) request.onProgress(progress); });
      const receipt = unwrap(await NativeBackupExport.write({ operationId: this.operationId, manifest: JSON.stringify(request.manifest), sources: request.payloads.map(descriptor) }));
      checkCancelled(request.signal); await request.checkpoint('verifying', 'closed-unverified');
      return receipt;
    } finally { request.signal.removeEventListener('abort', cancel); await listener?.remove(); }
  }
  async confirm() { unwrap(await NativeBackupExport.confirm({ operationId: this.operationId })); }
  async abandon() { unwrap(await NativeBackupExport.abandon({ operationId: this.operationId })); }
}
