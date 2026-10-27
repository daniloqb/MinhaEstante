import { isValidAttachmentTypeAndFormat } from '../../../types/digitalMedia';
import type { AttachmentFormat } from '../../../types/digitalMedia';
import { STORAGE_FEATURES } from './contracts';
import type {
  DigitalFileMetadata, DigitalFileReference, DigitalReadAccess, DigitalStorageErrorCode, FileIntegrity,
  LibraryLocationReference, ManagedFileReference, OpaqueReference, SelectedDigitalFile,
  StorageCapabilities, StorageConfiguration, StorageFeature, StoredDigitalFile, StoredFileMetadata,
} from './contracts';
import { DigitalStorageException } from './errors';

export function requireStorage(condition: unknown, code: DigitalStorageErrorCode): asserts condition {
  if (!condition) throw new DigitalStorageException(code);
}
function record(value: unknown): Record<string, unknown> {
  requireStorage(value && typeof value === 'object', 'INVALID_FILE');
  return value as Record<string, unknown>;
}
export function opaqueToken<Kind extends string>(value: unknown): OpaqueReference<Kind> {
  requireStorage(typeof value === 'string' && value.trim().length > 0 && !/[\0\r\n]/.test(value), 'INVALID_REFERENCE');
  return value as OpaqueReference<Kind>;
}
export function validateProviderId(value: unknown): string {
  requireStorage(typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value), 'INVALID_REFERENCE');
  return value;
}
export function managedFileReference(storageProvider: string, storageReference: string): ManagedFileReference {
  return { kind: 'managed', storageProvider: validateProviderId(storageProvider), storageReference: opaqueToken<'managed'>(storageReference) };
}
export function sourceFileReference(storageProvider: string, sourceReference: string): Extract<DigitalFileReference, { kind: 'source' }> {
  return { kind: 'source', storageProvider: validateProviderId(storageProvider), sourceReference: opaqueToken<'source'>(sourceReference) };
}
export function libraryLocationReference(storageProvider: string, locationReference: string): LibraryLocationReference {
  return { kind: 'library-location', storageProvider: validateProviderId(storageProvider), locationReference: opaqueToken<'library-location'>(locationReference) };
}
export function normalizeFileReference(value: unknown): DigitalFileReference {
  const ref = record(value);
  requireStorage(ref.kind === 'source' || ref.kind === 'managed', 'INVALID_REFERENCE');
  const provider = validateProviderId(ref.storageProvider);
  return ref.kind === 'source'
    ? sourceFileReference(provider, opaqueToken(ref.sourceReference))
    : managedFileReference(provider, opaqueToken(ref.storageReference));
}
export function normalizeManagedReference(value: unknown, providerId?: string): ManagedFileReference {
  const ref = normalizeFileReference(value);
  requireStorage(ref.kind === 'managed', 'INVALID_REFERENCE');
  if (providerId !== undefined) requireStorage(ref.storageProvider === providerId, 'PROVIDER_MISMATCH');
  return ref;
}
export function sameManagedFile(a: ManagedFileReference, b: ManagedFileReference): boolean {
  return a.storageProvider === b.storageProvider && a.storageReference === b.storageReference;
}
export function positiveSize(value: unknown): number {
  requireStorage(typeof value === 'number' && Number.isSafeInteger(value) && value > 0, 'INVALID_FILE');
  return value;
}
function filename(value: unknown): string {
  requireStorage(typeof value === 'string' && value.trim().length > 0 && value !== '.' && value !== '..' && !/[/\\\0\r\n]/.test(value), 'INVALID_FILE');
  return value;
}
function mimeType(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  requireStorage(typeof value === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(value), 'INVALID_FILE');
  return value;
}
export function normalizeSelectedFile(value: unknown, providerId: string): SelectedDigitalFile {
  const selected = record(value);
  requireStorage(selected.state === 'selected', 'INVALID_FILE');
  const source = normalizeFileReference(selected.source);
  requireStorage(source.kind === 'source', 'INVALID_REFERENCE');
  requireStorage(source.storageProvider === providerId, 'PROVIDER_MISMATCH');
  requireStorage(selected.access === 'session' || selected.access === 'persistable' || selected.access === 'persistent', 'INVALID_FILE');
  return {
    state: 'selected', source, filename: filename(selected.filename), mimeType: mimeType(selected.mimeType),
    // Selection is metadata only: an empty document can be selected; import validates content later.
    sizeBytes: selected.sizeBytes === undefined ? undefined : selectedSize(selected.sizeBytes), access: selected.access,
  };
}
function selectedSize(value: unknown): number {
  requireStorage(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, 'INVALID_FILE');
  return value;
}
export function normalizeMetadata(value: unknown): DigitalFileMetadata {
  const metadata = record(value);
  const format = metadata.format as AttachmentFormat;
  requireStorage(isValidAttachmentTypeAndFormat('ebook', format) || isValidAttachmentTypeAndFormat('audiobook', format), 'UNSUPPORTED_FORMAT');
  return { filename: filename(metadata.filename), mimeType: mimeType(metadata.mimeType), sizeBytes: positiveSize(metadata.sizeBytes), format };
}
export function normalizeIntegrity(value: unknown): FileIntegrity {
  const integrity = record(value);
  const checksum = record(integrity.checksum);
  requireStorage(checksum.algorithm === 'sha256' && typeof checksum.value === 'string' && /^[a-f\d]{64}$/i.test(checksum.value), 'INVALID_FILE');
  return { sizeBytes: positiveSize(integrity.sizeBytes), checksum: { algorithm: 'sha256', value: checksum.value.toLowerCase() } };
}
export function normalizeStoredFile(value: unknown): StoredDigitalFile {
  const stored = record(value);
  requireStorage(stored.state === 'stored', 'INVALID_FILE');
  const metadata = normalizeMetadata(stored.metadata);
  const integrity = normalizeIntegrity(stored.integrity);
  requireStorage(metadata.sizeBytes === integrity.sizeBytes, 'INTEGRITY_MISMATCH');
  return { state: 'stored', operationId: opaqueToken(stored.operationId), file: normalizeManagedReference(stored.file), metadata, integrity };
}
export function normalizeStoredMetadata(value: unknown, file: ManagedFileReference): StoredFileMetadata {
  const result = record(value);
  const ref = normalizeManagedReference(result.file, file.storageProvider);
  requireStorage(sameManagedFile(ref, file), 'INVALID_REFERENCE');
  return { file: ref, metadata: normalizeMetadata(result.metadata) };
}
export function normalizeConfiguration(value: unknown, providerId: string): StorageConfiguration {
  const config = record(value);
  if (config.state === 'not-configured') return { state: 'not-configured' };
  requireStorage(config.state === 'configured', 'OPERATION_FAILED');
  const location = record(config.location);
  requireStorage(location.kind === 'library-location', 'INVALID_REFERENCE');
  requireStorage(location.storageProvider === providerId, 'PROVIDER_MISMATCH');
  requireStorage(config.permission === 'granted' || config.permission === 'denied' || config.permission === 'revoked' || config.permission === 'unknown', 'OPERATION_FAILED');
  return {
    state: 'configured', permission: config.permission,
    location: libraryLocationReference(providerId, opaqueToken(location.locationReference)),
  };
}
export function normalizeCapabilities(value: unknown): StorageCapabilities {
  const caps = record(value);
  const impl = record(caps.implemented);
  const avail = record(caps.available);
  requireStorage(caps.providerAvailability === 'available' || caps.providerAvailability === 'unavailable', 'OPERATION_FAILED');
  const implemented = {} as Record<StorageFeature, boolean>;
  const available = {} as Record<StorageFeature, boolean>;
  for (const feature of STORAGE_FEATURES) {
    requireStorage(typeof impl[feature] === 'boolean' && typeof avail[feature] === 'boolean' && (!avail[feature] || impl[feature]), 'OPERATION_FAILED');
    implemented[feature] = impl[feature] as boolean;
    available[feature] = avail[feature] as boolean;
  }
  return { providerAvailability: caps.providerAvailability, implemented, available };
}
export function normalizeReadAccess(value: unknown, file: ManagedFileReference): DigitalReadAccess {
  const access = record(value);
  const ref = normalizeManagedReference(access.file, file.storageProvider);
  requireStorage(sameManagedFile(file, ref), 'INVALID_REFERENCE');
  requireStorage(access.consumption === 'provider-stream' || access.consumption === 'native-consumer', 'OPERATION_FAILED');
  return { file: ref, token: opaqueToken<'read-access'>(access.token), consumption: access.consumption };
}
