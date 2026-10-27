import { isValidAttachmentTypeAndFormat } from '../../../types/digitalMedia';
import { DIGITAL_STORAGE_PROVIDER_IDS } from './contracts';
import type {
  ConfigurationRequest, DeleteManagedFileRequest, DigitalFileReference, DigitalReadAccess, DigitalStoragePlatform,
  FileIntegrity, IDigitalFileStorageService, IDigitalStorageProvider, ImportDigitalFileRequest, ImportOperationContext,
  ManagedFileReference, SelectedDigitalFile, SourceSelectionRequest, StorageCapabilities,
  StorageConfiguration, StorageFeature, StorageOperationContext, StorageResult, StoredDigitalFile, StoredFileMetadata,
} from './contracts';
import { normalizeStorageError, storageFailure, storageSuccess } from './errors';
import {
  normalizeCapabilities, normalizeConfiguration, normalizeFileReference, normalizeIntegrity,
  normalizeManagedReference, normalizeReadAccess, normalizeSelectedFile, normalizeStoredFile,
  normalizeStoredMetadata, opaqueToken, requireStorage, validateProviderId,
} from './validation';

/** Validação e despacho somente. Não conhece React, SDKs, bytes ou repositórios. */
export class DigitalFileStorageService implements IDigitalFileStorageService {
  private readonly providers = new Map<string, IDigitalStorageProvider>();
  private readonly defaultProviderId?: string;

  constructor(providers: readonly IDigitalStorageProvider[] = [], defaultProviderId?: string) {
    for (const provider of providers) {
      validateProviderId(provider.id);
      requireStorage(!this.providers.has(provider.id), 'OPERATION_FAILED');
      this.providers.set(provider.id, provider);
    }
    this.defaultProviderId = defaultProviderId ?? (providers.length === 1 ? providers[0].id : undefined);
  }

  private provider(id = this.defaultProviderId): IDigitalStorageProvider {
    const provider = id === undefined ? undefined : this.providers.get(id);
    requireStorage(provider, 'PROVIDER_UNAVAILABLE');
    return provider;
  }

  getCapabilities(providerId?: string): StorageResult<StorageCapabilities> {
    try { return storageSuccess(normalizeCapabilities(this.provider(providerId).getCapabilities())); }
    catch (error) { return storageFailure(normalizeStorageError(error).code); }
  }

  private async settle<T>(pending: Promise<StorageResult<T>>, normalize: (value: unknown) => T): Promise<StorageResult<T>> {
    try {
      const result = await pending;
      requireStorage(result && typeof result === 'object', 'OPERATION_FAILED');
      if (result.status === 'success') return storageSuccess(normalize(result.value));
      if (result.status === 'cancelled') {
        requireStorage(result.code === 'USER_CANCELLED' || result.code === 'OPERATION_CANCELLED', 'OPERATION_FAILED');
        return storageFailure(result.code);
      }
      requireStorage(result.status === 'error', 'OPERATION_FAILED');
      return storageFailure(normalizeStorageError(result.error).code);
    } catch (error) {
      return storageFailure(normalizeStorageError(error).code);
    }
  }

  /** O despacho é síncrono até chamar o provedor: não perder ativação do seletor. */
  private run<T>(id: string | undefined, features: readonly StorageFeature[],
    action: (provider: IDigitalStorageProvider, caps: StorageCapabilities) => Promise<StorageResult<T>>,
    normalize: (value: unknown) => T): Promise<StorageResult<T>> {
    try {
      const provider = this.provider(id);
      const caps = normalizeCapabilities(provider.getCapabilities());
      requireStorage(caps.providerAvailability === 'available', 'PROVIDER_UNAVAILABLE');
      for (const feature of features) requireStorage(caps.implemented[feature] && caps.available[feature], 'UNSUPPORTED_OPERATION');
      return this.settle(action(provider, caps), normalize);
    } catch (error) {
      return Promise.resolve(storageFailure(normalizeStorageError(error).code));
    }
  }

  getConfiguration(providerId?: string): Promise<StorageResult<StorageConfiguration>> {
    return this.run(providerId, [], (p) => p.getConfiguration(), (v) => normalizeConfiguration(v, this.provider(providerId).id));
  }

  requestConfiguration(request: ConfigurationRequest, providerId?: string): Promise<StorageResult<StorageConfiguration>> {
    return this.run(providerId, ['configure'], (p) => {
      requireStorage(request.interaction === 'user-initiated' && p.interaction, 'UNSUPPORTED_OPERATION');
      return p.interaction.requestConfiguration(request);
    }, (v) => normalizeConfiguration(v, this.provider(providerId).id));
  }

  selectSource(request: SourceSelectionRequest, providerId?: string): Promise<StorageResult<SelectedDigitalFile>> {
    return this.run(providerId, ['selectFile'], (p) => {
      requireStorage(request.interaction === 'user-initiated' && p.interaction, 'UNSUPPORTED_OPERATION');
      requireStorage(request.acceptedFormats.length > 0 && request.acceptedFormats.every((f) =>
        isValidAttachmentTypeAndFormat('ebook', f) || isValidAttachmentTypeAndFormat('audiobook', f)), 'UNSUPPORTED_FORMAT');
      return p.interaction.selectSource(request);
    }, (v) => normalizeSelectedFile(v, this.provider(providerId).id));
  }

  importFile(request: ImportDigitalFileRequest, context?: ImportOperationContext): Promise<StorageResult<StoredDigitalFile>> {
    const id = request.selected?.source?.storageProvider;
    return this.run(id, ['importFile', 'sha256'], async (p, caps) => {
      requireStorage(caps.available.nativeCopy || (caps.available.streamRead && caps.available.streamWrite), 'UNSUPPORTED_OPERATION');
      if (context?.signal?.aborted) return storageFailure('OPERATION_CANCELLED');
      requireStorage(!context?.signal || caps.available.cancelOperations, 'UNSUPPORTED_OPERATION');
      requireStorage(!context?.onProgress || caps.available.importProgress, 'UNSUPPORTED_OPERATION');
      const selected = normalizeSelectedFile(request.selected, p.id);
      requireStorage(selected.sizeBytes === undefined || selected.sizeBytes > 0, 'INVALID_FILE');
      opaqueToken(request.operationId);
      requireStorage(isValidAttachmentTypeAndFormat(request.type, request.format), 'UNSUPPORTED_FORMAT');
      const config = await this.getConfiguration(p.id);
      if (config.status !== 'success') return config;
      requireStorage(config.value.state === 'configured', 'NOT_CONFIGURED');
      requireStorage(config.value.permission !== 'revoked', 'PERMISSION_REVOKED');
      requireStorage(config.value.permission !== 'unknown', 'PERMISSION_REQUIRED');
      requireStorage(config.value.permission === 'granted', 'PERMISSION_DENIED');
      const access = await this.checkAccess(selected.source);
      if (access.status !== 'success') return access;
      if (context?.signal?.aborted) return storageFailure('OPERATION_CANCELLED');
      return p.importFile({ ...request, selected }, context);
    }, (v) => {
      const stored = normalizeStoredFile(v);
      requireStorage(stored.file.storageProvider === id, 'PROVIDER_MISMATCH');
      requireStorage(stored.operationId === request.operationId && stored.metadata.format === request.format, 'INVALID_FILE');
      if (request.selected.sizeBytes !== undefined) requireStorage(stored.metadata.sizeBytes === request.selected.sizeBytes, 'INTEGRITY_MISMATCH');
      return stored;
    });
  }

  getMetadata(file: ManagedFileReference): Promise<StorageResult<StoredFileMetadata>> {
    return this.run(file?.storageProvider, [], (p) => p.getMetadata(normalizeManagedReference(file)), (v) => normalizeStoredMetadata(v, file));
  }

  checkAccess(file: DigitalFileReference): Promise<StorageResult<{ readonly accessible: true }>> {
    return this.run(file?.storageProvider, [], (p) => p.checkAccess(normalizeFileReference(file)), (v) => {
      requireStorage(v && typeof v === 'object' && 'accessible' in v && v.accessible === true, 'FILE_UNAVAILABLE');
      return { accessible: true };
    });
  }

  verifyIntegrity(file: ManagedFileReference, expected: FileIntegrity, context?: StorageOperationContext): Promise<StorageResult<FileIntegrity>> {
    return this.run(file?.storageProvider, ['sha256'], (p, caps) => {
      if (context?.signal?.aborted) return Promise.resolve(storageFailure('OPERATION_CANCELLED'));
      requireStorage(!context?.signal || caps.available.cancelOperations, 'UNSUPPORTED_OPERATION');
      return p.verifyIntegrity(normalizeManagedReference(file), normalizeIntegrity(expected), context);
    }, (v) => {
      const actual = normalizeIntegrity(v);
      const normalizedExpected = normalizeIntegrity(expected);
      requireStorage(actual.sizeBytes === normalizedExpected.sizeBytes && actual.checksum.value === normalizedExpected.checksum.value, 'INTEGRITY_MISMATCH');
      return actual;
    });
  }

  acquireReadAccess(file: ManagedFileReference): Promise<StorageResult<DigitalReadAccess>> {
    return this.run(file?.storageProvider, ['readAccess'], (p) => p.acquireReadAccess(normalizeManagedReference(file)), (v) => {
      const access = normalizeReadAccess(v, file);
      if (access.consumption === 'provider-stream') {
        const caps = normalizeCapabilities(this.provider(file.storageProvider).getCapabilities());
        requireStorage(caps.available.streamRead, 'UNSUPPORTED_OPERATION');
      }
      return access;
    });
  }

  releaseReadAccess(access: DigitalReadAccess): Promise<StorageResult<void>> {
    return this.run(access?.file?.storageProvider, ['readAccess'], (p) => p.releaseReadAccess(normalizeReadAccess(access, access.file)), this.normalizeVoid);
  }

  deleteManagedFile(request: DeleteManagedFileRequest): Promise<StorageResult<void>> {
    return this.run(request.file?.storageProvider, ['deleteManagedFiles'], (p) => {
      requireStorage(request.intent === 'delete-managed-file', 'UNSUPPORTED_OPERATION');
      return p.deleteManagedFile({ file: normalizeManagedReference(request.file), intent: request.intent });
    }, this.normalizeVoid);
  }

  private normalizeVoid(value: unknown): void { requireStorage(value === undefined, 'OPERATION_FAILED'); }
}

/** A composição futura fornece a plataforma uma vez. Nenhum SDK nem fake é inicializado. */
export function createDigitalFileStorageService(platform: DigitalStoragePlatform,
  providers: readonly IDigitalStorageProvider[] = []): IDigitalFileStorageService {
  return new DigitalFileStorageService(providers, DIGITAL_STORAGE_PROVIDER_IDS[platform]);
}
