import { Capacitor } from '@capacitor/core';
import { DatabaseService } from '../../../database/databaseService';
import { CoverStorageService, validateImageMagicBytes } from '../../coverStorageService';
import { IndexedDbStore } from '../../web/IndexedDbStore';
import { getPlatformDigitalLibrary } from '../../digital/platform';
import type { WebOpfsStorageProvider } from '../../digital/web/WebOpfsStorageProvider';
import { BackupCatalogRepository } from './catalog';
import { BackupExportJournal } from './journal';
import { BackupV2ExportCoordinator } from './BackupV2ExportCoordinator';
import { ANDROID_EXPORT_MAX_BYTES, WEB_EXPORT_MAX_BYTES } from './prepare';
import type { ExportDestination, PreparedExport } from './types';
import { ExportFailure } from './types';
import type { Book } from '../../../../types/book';
import { attachmentsDevEnabled } from '../../digital/attachmentsDevGate';

export async function readExportCover(book: Book): Promise<Blob | null> {
  let base64: string | null = null;
  if (book.capaLocalPath) {
    base64 = await CoverStorageService.readCoverBinary(book.capaLocalPath);
    if (!base64) throw new ExportFailure('MEDIA_UNAVAILABLE');
  } else if (book.capaUrl?.startsWith('data:image/')) base64 = book.capaUrl.split(',')[1];
  if (!base64) return null;
  base64 = base64.includes(',') ? base64.split(',')[1] : base64;
  if (base64.length > 3 * 1024 ** 2 || !validateImageMagicBytes(base64)) throw new ExportFailure('LIMIT_EXCEEDED');
  const text = atob(base64); return new Blob([Uint8Array.from(text, char => char.charCodeAt(0))]);
}
export async function createBackupExporter(options: { catalog?: BackupCatalogRepository } = {}) {
  if (!await attachmentsDevEnabled()) throw new ExportFailure('CAPABILITY_UNAVAILABLE');
  const native = Capacitor.isNativePlatform(), journal = new BackupExportJournal(new IndexedDbStore());
  const libraryResult = await getPlatformDigitalLibrary();
  if (libraryResult.status !== 'success') throw new ExportFailure('CAPABILITY_UNAVAILABLE');
  const provider = libraryResult.value.provider;
  let supported: boolean, reason: string | null, select: (plan: PreparedExport) => Promise<ExportDestination>, validate: (plan: PreparedExport, signal?: AbortSignal) => Promise<void>;
  let availableBytes: number | null = null;
  let nativeRecovery: readonly { operationId: string; stage: string }[] = [];
  if (native) {
    const module = await import('../android/NativeExportDestination');
    const capabilities = await module.NativeBackupExport.capabilities();
    supported = capabilities.status === 'success' && capabilities.value.enabled;
    if (capabilities.status === 'success') availableBytes = capabilities.value.temporaryAvailableBytes;
    const recovery = await module.NativeBackupExport.unfinished();
    if (recovery.status === 'success') nativeRecovery = recovery.value.operations;
    reason = supported ? null : 'external-unavailable'; select = module.selectNativeExportDestination; validate = module.validateNativeSources;
  } else {
    const module = await import('../web/WebExportDestination');
    const capability = module.webExportCapability(); supported = capability.supported; reason = capability.reason;
    select = () => module.selectWebExportDestination(provider as WebOpfsStorageProvider);
    validate = async (plan, signal) => { await module.exportBlobs(plan, provider as WebOpfsStorageProvider, signal); };
    try { const quota = await navigator.storage.estimate(); availableBytes = (quota.quota ?? 0) - (quota.usage ?? 0); } catch { /* unknown */ }
  }
  const coordinator = new BackupV2ExportCoordinator({ catalog: options.catalog ?? new BackupCatalogRepository(DatabaseService.getInstance()), readCover: readExportCover,
    validateMedia: validate, journal, ...(native ? { maxBytes: ANDROID_EXPORT_MAX_BYTES } : {}) });
  return { coordinator, select, supported, reason, native, availableBytes, maxBytes: native ? ANDROID_EXPORT_MAX_BYTES : WEB_EXPORT_MAX_BYTES,
    unfinished: [...new Map([...await journal.unfinished(), ...nativeRecovery].map(row => [row.operationId, row])).values()] };
}
