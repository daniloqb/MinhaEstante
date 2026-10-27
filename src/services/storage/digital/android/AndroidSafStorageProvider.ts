import { isValidAttachmentTypeAndFormat } from '../../../../types/digitalMedia';
import { DIGITAL_STORAGE_PROVIDER_IDS, STORAGE_FEATURES } from '../contracts';
import type {
  ConfigurationRequest, DeleteManagedFileRequest, DigitalFileReference, DigitalReadAccess, FileIntegrity,
  IDigitalStorageProvider, ImportDigitalFileRequest, ImportOperationContext, ManagedFileReference,
  SelectedDigitalFile, SourceFileReference, SourceSelectionRequest, StorageCapabilities,
  StorageConfiguration, StorageFeature, StorageOperationContext, StorageResult, StoredDigitalFile, StoredFileMetadata,
} from '../contracts';
import { normalizeStorageError, storageFailure, storageSuccess } from '../errors';
import { normalizeConfiguration, normalizeFileReference, normalizeSelectedFile, normalizeStoredFile, normalizeManagedReference,
  normalizeStoredMetadata, normalizeIntegrity, opaqueToken, requireStorage } from '../validation';
import { AndroidSafPlugin, isAndroidSafAvailable, SAF_STATES } from './bridge';
import type { AndroidSafBridge, AndroidManagedStorageBridge, AndroidSafStatus, SafDiagnosticResult } from './bridge';
import type { AttachmentLinkIntent, IDigitalStorageJournal, StorageOperationSnapshot } from '../operations';
import { normalizeLinkIntent, normalizeOperation } from '../operations';

/** SAF 2.2A: references are native registry tokens, never client-supplied content URIs. */
export class AndroidSafStorageProvider implements IDigitalStorageProvider, IDigitalStorageJournal {
  readonly id = DIGITAL_STORAGE_PROVIDER_IDS.android;
  constructor(private readonly bridge: AndroidSafBridge & Partial<AndroidManagedStorageBridge> = AndroidSafPlugin,
    private readonly isAvailable: () => boolean = isAndroidSafAvailable) {}

  getCapabilities(): StorageCapabilities {
    const features = new Set<StorageFeature>(['configure', 'selectDirectory', 'selectFile', 'persistAccess']);
    if (this.bridge.importFile) for (const f of ['importFile', 'nativeCopy', 'sha256', 'deleteManagedFiles', 'cancelOperations', 'importProgress'] as const) features.add(f);
    const implemented = Object.fromEntries(STORAGE_FEATURES.map((f) => [f, features.has(f)])) as Record<StorageFeature, boolean>;
    const available = Object.fromEntries(STORAGE_FEATURES.map((f) => [f, implemented[f] && this.isAvailable()])) as Record<StorageFeature, boolean>;
    return { providerAvailability: this.isAvailable() ? 'available' : 'unavailable', implemented, available };
  }

  private async run<T>(invoke: () => Promise<StorageResult<T>>, normalize: (value: T) => T): Promise<StorageResult<T>> {
    try {
      requireStorage(this.isAvailable(), 'PROVIDER_UNAVAILABLE');
      const result = await invoke();
      requireStorage(result && typeof result === 'object', 'OPERATION_FAILED');
      if (result.status === 'success') return storageSuccess(normalize(result.value));
      if (result.status === 'cancelled') {
        requireStorage(result.code === 'USER_CANCELLED' || result.code === 'OPERATION_CANCELLED', 'OPERATION_FAILED');
        return storageFailure(result.code);
      }
      requireStorage(result.status === 'error', 'OPERATION_FAILED');
      return storageFailure(normalizeStorageError(result.error).code);
    } catch (error) { return storageFailure(normalizeStorageError(error).code); }
  }
  private status(value: AndroidSafStatus): AndroidSafStatus {
    requireStorage(value && SAF_STATES.includes(value.state), 'OPERATION_FAILED');
    for (const key of ['read', 'write', 'persistedRead', 'persistedWrite', 'canCreate', 'needsReconfiguration'] as const) {
      requireStorage(typeof value[key] === 'boolean', 'OPERATION_FAILED');
    }
    return { configuration: normalizeConfiguration(value.configuration, this.id), state: value.state,
      read: value.read, write: value.write, persistedRead: value.persistedRead, persistedWrite: value.persistedWrite,
      canCreate: value.canCreate, needsReconfiguration: value.needsReconfiguration };
  }
  getSafStatus(): Promise<StorageResult<AndroidSafStatus>> {
    return this.run(() => this.bridge.getConfiguration(), (v) => this.status(v));
  }
  async getConfiguration(): Promise<StorageResult<StorageConfiguration>> {
    const result = await this.getSafStatus();
    return result.status === 'success' ? storageSuccess(result.value.configuration) : result;
  }
  readonly interaction = {
    requestConfiguration: async (request: ConfigurationRequest): Promise<StorageResult<StorageConfiguration>> => {
      const result = await this.run(() => {
        requireStorage(request.interaction === 'user-initiated', 'PERMISSION_REQUIRED');
        return this.bridge.selectDirectory(request);
      }, (v) => this.status(v));
      return result.status === 'success' ? storageSuccess(result.value.configuration) : result;
    },
    selectSource: (request: SourceSelectionRequest): Promise<StorageResult<SelectedDigitalFile>> => this.run(() => {
      requireStorage(request.interaction === 'user-initiated', 'PERMISSION_REQUIRED');
      requireStorage(request.acceptedFormats.length > 0 && request.acceptedFormats.every((f) =>
        isValidAttachmentTypeAndFormat('ebook', f) || isValidAttachmentTypeAndFormat('audiobook', f)), 'UNSUPPORTED_FORMAT');
      return this.bridge.selectDocument(request);
    }, (v) => normalizeSelectedFile(v, this.id)),
  };
  getSelectedMetadata(file: SourceFileReference): Promise<StorageResult<SelectedDigitalFile>> {
    return this.run(() => {
      const ref = this.source(file);
      return this.bridge.getSelectedMetadata({ sourceReference: ref.sourceReference });
    }, (v) => {
      const selected = normalizeSelectedFile(v, this.id);
      requireStorage(selected.source.sourceReference === file.sourceReference, 'INVALID_REFERENCE');
      return selected;
    });
  }
  private source(file: DigitalFileReference): SourceFileReference {
    const ref = normalizeFileReference(file);
    requireStorage(ref.storageProvider === this.id, 'PROVIDER_MISMATCH');
    requireStorage(ref.kind === 'source', 'UNSUPPORTED_OPERATION');
    return ref;
  }
  checkAccess(file: DigitalFileReference): Promise<StorageResult<{ readonly accessible: true }>> {
    return this.run(() => {
      if (file.kind === 'managed') {
        const ref = normalizeManagedReference(file, this.id);
        requireStorage(this.bridge.checkManagedAccess, 'UNSUPPORTED_OPERATION');
        return this.bridge.checkManagedAccess({ storageReference: ref.storageReference });
      }
      const ref = this.source(file);
      return this.bridge.checkSourceAccess({ sourceReference: ref.sourceReference });
    }, (v) => { requireStorage(v?.accessible === true, 'FILE_UNAVAILABLE'); return { accessible: true }; });
  }
  runDiagnostics(request: ConfigurationRequest): Promise<StorageResult<SafDiagnosticResult>> {
    return this.run(() => {
      requireStorage(request.interaction === 'user-initiated', 'PERMISSION_REQUIRED');
      return this.bridge.runDiagnostics(request);
    }, (v) => {
      requireStorage(v && typeof v.writeVerified === 'boolean' && typeof v.readVerified === 'boolean'
        && typeof v.cleanupSucceeded === 'boolean', 'OPERATION_FAILED');
      return { writeVerified: v.writeVerified, readVerified: v.readVerified, cleanupSucceeded: v.cleanupSucceeded,
        errorCode: v.errorCode ? normalizeStorageError({ code: v.errorCode }).code : undefined,
        cleanupError: v.cleanupSucceeded ? undefined : 'DIAGNOSTIC_CLEANUP_FAILED' };
    });
  }

  private async nativeContext<T>(id: string, context: ImportOperationContext | undefined,
    action: () => Promise<StorageResult<T>>): Promise<StorageResult<T>> {
    if (context?.signal?.aborted) return storageFailure('OPERATION_CANCELLED');
    let listener: { remove(): Promise<void> } | undefined;
    try {
      if (context?.onProgress) {
        requireStorage(this.bridge.addListener, 'UNSUPPORTED_OPERATION');
        listener = await this.bridge.addListener('importProgress', (event) => {
          if (event.operationId !== id || !['validating', 'preparing', 'copying', 'verifying', 'committing'].includes(event.stage)
            || !Number.isSafeInteger(event.bytesProcessed) || event.bytesProcessed < 0) return;
          if (event.totalBytes !== undefined && (!Number.isSafeInteger(event.totalBytes) || event.totalBytes <= 0)) return;
          try { context.onProgress?.({ operationId: id, stage: event.stage, bytesProcessed: event.bytesProcessed, totalBytes: event.totalBytes }); } catch { /* consumer callback cannot break physical copy */ }
        });
      }
      if (context?.signal?.aborted) return storageFailure('OPERATION_CANCELLED');
      const abort = () => { void this.bridge.cancelOperation?.({ operationId: id }).catch(() => undefined); };
      context?.signal?.addEventListener('abort', abort, { once: true });
      try { return await action(); } finally { context?.signal?.removeEventListener('abort', abort); }
    } finally { await listener?.remove().catch(() => undefined); }
  }
  importFile(request: ImportDigitalFileRequest, context?: ImportOperationContext): Promise<StorageResult<StoredDigitalFile>> {
    return this.run(() => {
      requireStorage(this.bridge.importFile, 'UNSUPPORTED_OPERATION');
      const selected = normalizeSelectedFile(request.selected, this.id);
      opaqueToken(request.operationId);
      requireStorage(isValidAttachmentTypeAndFormat(request.type, request.format), 'UNSUPPORTED_FORMAT');
      return this.nativeContext(request.operationId, context, () => this.bridge.importFile!({ operationId: request.operationId,
        sourceReference: selected.source.sourceReference, type: request.type, format: request.format }));
    }, (v) => {
      const stored = normalizeStoredFile(v);
      requireStorage(stored.file.storageProvider === this.id && stored.operationId === request.operationId
        && stored.metadata.format === request.format, 'INVALID_FILE');
      return stored;
    });
  }
  getMetadata(file: ManagedFileReference): Promise<StorageResult<StoredFileMetadata>> {
    return this.run(() => {
      const ref = normalizeManagedReference(file, this.id);
      requireStorage(this.bridge.getManagedMetadata, 'UNSUPPORTED_OPERATION');
      return this.bridge.getManagedMetadata({ storageReference: ref.storageReference });
    }, (v) => normalizeStoredMetadata(v, file));
  }
  verifyIntegrity(file: ManagedFileReference, expected: FileIntegrity, context?: StorageOperationContext): Promise<StorageResult<FileIntegrity>> {
    return this.run(() => {
      const ref = normalizeManagedReference(file, this.id);
      requireStorage(this.bridge.verifyManagedFile, 'UNSUPPORTED_OPERATION');
      const id = crypto.randomUUID();
      return this.nativeContext(id, context, () => this.bridge.verifyManagedFile!({ storageReference: ref.storageReference, verificationId: id }));
    }, (v) => {
      const actual = normalizeIntegrity(v); const wanted = normalizeIntegrity(expected);
      requireStorage(actual.sizeBytes === wanted.sizeBytes && actual.checksum.value === wanted.checksum.value, 'INTEGRITY_MISMATCH');
      return actual;
    });
  }
  async deleteManagedFile(request: DeleteManagedFileRequest): Promise<StorageResult<void>> {
    const result = await this.run(() => {
      const ref = normalizeManagedReference(request.file, this.id);
      requireStorage(request.intent === 'delete-managed-file' && this.bridge.deleteManagedFile, 'UNSUPPORTED_OPERATION');
      return this.bridge.deleteManagedFile({ storageReference: ref.storageReference, intent: request.intent });
    }, (v) => { requireStorage(v?.done === true, 'OPERATION_FAILED'); return { done: true as const }; });
    return result.status === 'success' ? storageSuccess(undefined) : result;
  }
  async listOperations(): Promise<StorageResult<readonly StorageOperationSnapshot[]>> {
    const result = await this.run(() => {
      requireStorage(this.bridge.listOperations, 'UNSUPPORTED_OPERATION'); return this.bridge.listOperations();
    }, (v) => { requireStorage(Array.isArray(v.operations), 'RECOVERY_REQUIRED'); return { operations: v.operations.map(normalizeOperation) }; });
    return result.status === 'success' ? storageSuccess(result.value.operations) : result;
  }
  getOperation(operationId: string): Promise<StorageResult<StorageOperationSnapshot>> {
    return this.run(() => { requireStorage(this.bridge.getOperation, 'UNSUPPORTED_OPERATION'); return this.bridge.getOperation({ operationId }); }, normalizeOperation);
  }
  beginAttachmentLink(operationId: string, context: AttachmentLinkIntent): Promise<StorageResult<StorageOperationSnapshot>> {
    return this.run(() => { requireStorage(this.bridge.beginAttachmentLink, 'UNSUPPORTED_OPERATION');
      return this.bridge.beginAttachmentLink({ operationId, linkContext: normalizeLinkIntent(context) }); }, normalizeOperation);
  }
  async completeImportOperation(operationId: string): Promise<StorageResult<void>> {
    const result = await this.run(() => { requireStorage(this.bridge.completeImportOperation, 'UNSUPPORTED_OPERATION');
      return this.bridge.completeImportOperation({ operationId }); }, (v) => { requireStorage(v?.done, 'OPERATION_FAILED'); return { done: true as const }; });
    return result.status === 'success' ? storageSuccess(undefined) : result;
  }
  recoverImport(operationId: string): Promise<StorageResult<StoredDigitalFile>> {
    return this.run(() => { requireStorage(this.bridge.recoverImport, 'UNSUPPORTED_OPERATION'); return this.bridge.recoverImport({ operationId }); }, normalizeStoredFile);
  }
  readonly recovery = {
    listPendingImports: async () => {
      const result = await this.listOperations();
      if (result.status !== 'success') return result;
      return storageSuccess(result.value.filter((o) => !['COMPLETED', 'DELETED', 'DISCARDED'].includes(o.state)).map((o) =>
        o.stored ? { operationId: o.operationId, stage: 'stored-unlinked' as const, file: o.stored.file }
          : { operationId: o.operationId, stage: 'copying' as const, temporaryReference: opaqueToken<'incomplete-import'>(o.operationId) }));
    },
    discardIncompleteImport: async (operationId: string): Promise<StorageResult<void>> => {
      const result = await this.run(() => { requireStorage(this.bridge.discardIncompleteImport, 'UNSUPPORTED_OPERATION');
        return this.bridge.discardIncompleteImport({ operationId }); }, (v) => { requireStorage(v?.done, 'OPERATION_FAILED'); return { done: true as const }; });
      return result.status === 'success' ? storageSuccess(undefined) : result;
    },
    completeImportOperation: (id: string) => this.completeImportOperation(id),
  };
  // Reader/player handles remain outside 2.2B.
  private unsupported<T>(): Promise<StorageResult<T>> { return Promise.resolve(storageFailure('UNSUPPORTED_OPERATION')); }
  acquireReadAccess(_f: ManagedFileReference): Promise<StorageResult<DigitalReadAccess>> { return this.unsupported(); }
  releaseReadAccess(_a: DigitalReadAccess): Promise<StorageResult<void>> { return this.unsupported(); }
}
