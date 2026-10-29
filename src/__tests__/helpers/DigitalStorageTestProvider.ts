import { vi } from 'vitest';
import {
  STORAGE_FEATURES, libraryLocationReference, managedFileReference, opaqueToken, sourceFileReference,
  storageFailure, storageSuccess,
} from '../../services/storage/digital';
import type {
  DeleteManagedFileRequest, DigitalFileReference, DigitalReadAccess, FileIntegrity, IDigitalStorageProvider,
  ImportDigitalFileRequest, ImportOperationContext, SelectedDigitalFile, StorageCapabilities, StorageConfiguration,
  StorageFeature, StorageOperationContext, StorageResult, StoredDigitalFile,
} from '../../services/storage/digital';

export const TEST_SHA256 = 'a'.repeat(64);
export function selectedFile(provider = 'test_provider'): SelectedDigitalFile {
  return {
    state: 'selected', source: sourceFileReference(provider, 'selection-token'), filename: 'synthetic.epub',
    sizeBytes: 512_000_000, mimeType: 'application/epub+zip', access: 'session',
  };
}
export function storedFile(provider = 'test_provider', operationId = 'operation-1'): StoredDigitalFile {
  return {
    state: 'stored', operationId, file: managedFileReference(provider, `managed-${operationId}`),
    metadata: { filename: 'synthetic.epub', sizeBytes: 512_000_000, format: 'epub', mimeType: 'application/epub+zip' },
    integrity: { sizeBytes: 512_000_000, checksum: { algorithm: 'sha256', value: TEST_SHA256 } },
  };
}

/** Fake de metadados exclusivo dos testes: não lê, copia ou grava arquivos/binários. */
export class DigitalStorageTestProvider implements IDigitalStorageProvider {
  readonly files = new Map<string, StoredDigitalFile>();
  capabilities: StorageCapabilities = {
    providerAvailability: 'available',
    implemented: Object.fromEntries(STORAGE_FEATURES.map((f) => [f, true])) as Record<StorageFeature, boolean>,
    available: Object.fromEntries(STORAGE_FEATURES.map((f) => [f, true])) as Record<StorageFeature, boolean>,
  };
  configuration: StorageConfiguration;
  selection: SelectedDigitalFile;
  constructor(readonly id = 'test_provider') {
    this.selection = selectedFile(id);
    this.configuration = { state: 'configured', permission: 'granted', location: libraryLocationReference(id, 'location-1') };
  }
  getCapabilities = vi.fn(() => this.capabilities);
  getConfiguration = vi.fn(async () => storageSuccess(this.configuration));
  interaction = {
    requestConfiguration: vi.fn(() => Promise.resolve(storageSuccess(this.configuration))),
    selectSource: vi.fn((): Promise<StorageResult<SelectedDigitalFile>> => Promise.resolve(storageSuccess(this.selection))),
  };
  importFile = vi.fn(async (request: ImportDigitalFileRequest, context?: ImportOperationContext): Promise<StorageResult<StoredDigitalFile>> => {
    if (context?.signal?.aborted) return storageFailure('OPERATION_CANCELLED');
    const stored = storedFile(this.id, request.operationId);
    const sizeBytes = request.selected.sizeBytes ?? stored.metadata.sizeBytes;
    const result: StoredDigitalFile = {
      ...stored, metadata: { ...stored.metadata, filename: request.selected.filename, sizeBytes, format: request.format },
      integrity: { ...stored.integrity, sizeBytes },
    };
    for (const stage of ['validating', 'preparing', 'copying', 'verifying', 'committing'] as const) {
      const bytesProcessed = stage === 'verifying' || stage === 'committing' ? sizeBytes : stage === 'copying' ? 1024 : 0;
      context?.onProgress?.({ operationId: request.operationId, stage, bytesProcessed, totalBytes: sizeBytes });
    }
    this.files.set(result.file.storageReference, result);
    return storageSuccess(result);
  });
  getMetadata = vi.fn(async (file: StoredDigitalFile['file']) => {
    const found = this.files.get(file.storageReference);
    return found ? storageSuccess({ file, metadata: found.metadata }) : storageFailure('FILE_NOT_FOUND');
  });
  checkAccess = vi.fn(async (file: DigitalFileReference): Promise<StorageResult<{ accessible: true }>> =>
    file.kind === 'source' || this.files.has(file.storageReference)
      ? storageSuccess({ accessible: true }) : storageFailure('FILE_NOT_FOUND'));
  verifyIntegrity = vi.fn(async (_file: StoredDigitalFile['file'], expected: FileIntegrity, _context?: StorageOperationContext): Promise<StorageResult<FileIntegrity>> => storageSuccess(expected));
  acquireReadAccess = vi.fn(async (file: StoredDigitalFile['file']): Promise<StorageResult<DigitalReadAccess>> =>
    this.files.has(file.storageReference)
      ? storageSuccess({ file, token: opaqueToken<'read-access'>('ephemeral-token'), consumption: 'provider-stream' })
      : storageFailure('FILE_NOT_FOUND'));
  releaseReadAccess = vi.fn(async (_access: DigitalReadAccess) => storageSuccess(undefined));
  deleteManagedFile = vi.fn(async (request: DeleteManagedFileRequest): Promise<StorageResult<void>> =>
    this.files.delete(request.file.storageReference) ? storageSuccess(undefined) : storageFailure('FILE_NOT_FOUND'));
}
