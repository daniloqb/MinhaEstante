import type { AttachmentFormat } from '../../../../types/digitalMedia';
import { isValidAttachmentTypeAndFormat } from '../../../../types/digitalMedia';
import { IndexedDbStore, browserExclusiveLock, type DurableRecordStore, type ExclusiveLock } from '../../web/IndexedDbStore';
import { STORAGE_FEATURES, type IDigitalStorageProvider, type StorageResult, type SelectedDigitalFile,
  type StorageCapabilities, type StorageFeature, type ImportDigitalFileRequest, type ImportOperationContext,
  type ManagedFileReference, type FileIntegrity, type StoredDigitalFile, type DigitalFileReference,
  type DigitalReadAccess, type StorageOperationContext, type DeleteManagedFileRequest, type ConfigurationRequest,
  type SourceSelectionRequest } from '../contracts';
import { type AttachmentLinkIntent, type IDigitalStorageJournal, type StorageOperationSnapshot, normalizeOperation, normalizeLinkIntent } from '../operations';
import { DigitalStorageException, normalizeStorageError, storageFailure, storageSuccess } from '../errors';
import { libraryLocationReference, managedFileReference, normalizeManagedReference, normalizeSelectedFile,
  normalizeIntegrity, sourceFileReference, opaqueToken, requireStorage } from '../validation';
import { BrowserOpfsFiles, CHUNK_SIZE, safeId, type OpfsFiles } from './OpfsFiles';
import { IncrementalSha256 } from './sha256';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
interface RecordV1 extends Mutable<StorageOperationSnapshot> {
  version: 1;
  token: string;
  filename: string;
  mimeType: string;
  expected?: FileIntegrity;
  promotionStarted?: boolean;
  confirmed?: boolean;
}
export type OpfsCheckpoint = 'intent' | 'fingerprint' | 'created' | 'writing' | 'staged' | 'verified' | 'promoting' | 'ready' | 'linking' | 'complete';
export interface WebOpfsOptions {
  records?: DurableRecordStore;
  files?: OpfsFiles;
  lock?: ExclusiveLock;
  storage?: StorageManager;
  available?: () => boolean;
  /** Dependency-injected diagnostics only; default composition never injects failures. */
  checkpoint?: (point: OpfsCheckpoint, operation: StorageOperationSnapshot) => Promise<void>;
}
const prefix = 'opfs:operation:';
const mime = (format: string) => format === 'epub' ? 'application/epub+zip' : format === 'pdf' ? 'application/pdf' : format === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
const errorCode = (error: unknown) => {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  if (name === 'QuotaExceededError') return 'INSUFFICIENT_SPACE' as const;
  if (name === 'NotFoundError') return 'FILE_NOT_FOUND' as const;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'PERMISSION_DENIED' as const;
  return normalizeStorageError(error).code;
};

/** Provider-specific OPFS bytes + IndexedDB journal. Domain links remain solely in the repositories. */
export class WebOpfsStorageProvider implements IDigitalStorageProvider, IDigitalStorageJournal {
  readonly id = 'web_digital';
  private readonly records: DurableRecordStore;
  private readonly files: OpfsFiles;
  private readonly lock: ExclusiveLock;
  private readonly storage?: StorageManager;
  private readonly sources = new Map<string, Blob>();
  private readonly reads = new Map<string, { file: ManagedFileReference; bytes: Blob }>();
  constructor(private readonly options: WebOpfsOptions = {}) {
    this.records = options.records ?? new IndexedDbStore(); this.files = options.files ?? new BrowserOpfsFiles();
    this.lock = options.lock ?? browserExclusiveLock; this.storage = options.storage ?? globalThis.navigator?.storage;
  }
  getCapabilities(): StorageCapabilities {
    const supported = this.options.available?.() ?? !!(globalThis.isSecureContext && globalThis.indexedDB
      && typeof globalThis.navigator?.locks?.request === 'function' && typeof globalThis.navigator?.storage?.getDirectory === 'function'
      && typeof globalThis.FileSystemFileHandle?.prototype.createWritable === 'function');
    const features = ['configure','selectFile','persistAccess','importFile','streamRead','streamWrite','sha256','readAccess','cancelOperations','importProgress'];
    const implemented = Object.fromEntries(STORAGE_FEATURES.map(f => [f, features.includes(f)])) as Record<StorageFeature, boolean>;
    return { providerAvailability: supported ? 'available' : 'unavailable', implemented,
      available: Object.fromEntries(STORAGE_FEATURES.map(f => [f, supported && implemented[f]])) as Record<StorageFeature, boolean> };
  }
  private async result<T>(work: () => Promise<T>): Promise<StorageResult<T>> {
    try { requireStorage(this.getCapabilities().providerAvailability === 'available', 'PROVIDER_UNAVAILABLE'); return storageSuccess(await work()); }
    catch (error) { return storageFailure(errorCode(error)); }
  }
  private layout(create = false) { return this.lock('opfs-layout', () => this.files.initialize(create)); }
  private async record(id: string): Promise<RecordV1> {
    const value = await this.records.get<RecordV1>(prefix + safeId(id));
    requireStorage(value, 'INVALID_REFERENCE');
    requireStorage(value.version === 1 && value.operationId === id && value.filename && value.mimeType, 'RECOVERY_REQUIRED');
    safeId(value.token); normalizeOperation(value);
    if (value.expected) normalizeIntegrity(value.expected);
    if (value.stored) requireStorage(value.stored.file.storageProvider === this.id && value.stored.file.storageReference === value.token
      && value.stored.metadata.format === value.format && value.expected?.checksum.value === value.stored.integrity.checksum.value
      && value.expected?.sizeBytes === value.stored.integrity.sizeBytes, 'RECOVERY_REQUIRED');
    return value;
  }
  private async save(r: RecordV1) { await this.records.put(prefix + r.operationId, { ...r, updatedAt: Date.now() }); }
  private point(p: OpfsCheckpoint, r: RecordV1) { return this.options.checkpoint?.(p, normalizeOperation(r)); }
  private async all(): Promise<RecordV1[]> {
    const values = await this.records.list<RecordV1>(prefix);
    return Promise.all(values.map(r => this.record(r.operationId)));
  }
  async getConfiguration() {
    return this.result(async () => {
      const config = await this.records.get<{ version: number }>('opfs:configuration');
      if (!config) return { state: 'not-configured' as const };
      requireStorage(config.version === 1, 'RECOVERY_REQUIRED'); await this.layout();
      return { state: 'configured' as const, permission: 'granted' as const, location: libraryLocationReference(this.id, 'opfs-v1') };
    });
  }
  readonly interaction = {
    requestConfiguration: (request: ConfigurationRequest) => this.result(async () => {
      requireStorage(request.interaction === 'user-initiated', 'PERMISSION_REQUIRED'); await this.layout(true);
      await this.records.put('opfs:configuration', { version: 1 });
      return { state: 'configured' as const, permission: 'granted' as const, location: libraryLocationReference(this.id, 'opfs-v1') };
    }),
    selectSource: (request: SourceSelectionRequest): Promise<StorageResult<SelectedDigitalFile>> => {
      // Open synchronously in the user's event; never consume activation before the input click.
      if (request.interaction !== 'user-initiated' || !globalThis.document) return Promise.resolve(storageFailure('PERMISSION_REQUIRED'));
      return new Promise(resolve => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = request.acceptedFormats.map(f => `.${f}`).join(',');
        const finish = (result: StorageResult<SelectedDigitalFile>) => { input.remove(); resolve(result); };
        input.addEventListener('cancel', () => finish(storageFailure('USER_CANCELLED')), { once: true });
        input.addEventListener('change', () => {
          const file = input.files?.[0]; if (!file) { finish(storageFailure('USER_CANCELLED')); return; }
          try { finish(storageSuccess(this.registerSource(file, file.name, file.type || undefined))); }
          catch (error) { finish(storageFailure(errorCode(error))); }
        }, { once: true });
        input.hidden = true; document.body.append(input); input.click();
      });
    },
  };
  registerSource(bytes: Blob, filename: string, mimeType?: string): SelectedDigitalFile {
    requireStorage(bytes instanceof Blob, 'INVALID_FILE');
    const token = crypto.randomUUID();
    const selected = normalizeSelectedFile({ state: 'selected', source: sourceFileReference(this.id, token), filename,
      mimeType, sizeBytes: bytes.size, access: 'session' }, this.id);
    this.sources.set(token, bytes); return selected;
  }
  async diagnose() {
    return this.result(async () => ({
      estimate: typeof this.storage?.estimate === 'function' ? await this.storage.estimate() : undefined,
      persisted: typeof this.storage?.persisted === 'function' ? await this.storage.persisted() : undefined,
      persistenceRequestSupported: typeof this.storage?.persist === 'function',
    }));
  }
  retentionDiagnostics() {
    return this.result(async () => {
      requireStorage(this.files.inventory, 'UNSUPPORTED_OPERATION'); await this.layout();
      const known=new Set((await this.all()).map(operation=>operation.token));
      const files=await this.files.inventory();
      return {
        stagingFiles:files.filter(f=>f.area==='staging').length,
        stagingBytes:files.filter(f=>f.area==='staging').reduce((n,f)=>n+(f.sizeBytes??0),0),
        committedFiles:files.filter(f=>f.area==='committed').length,
        committedBytes:files.filter(f=>f.area==='committed').reduce((n,f)=>n+(f.sizeBytes??0),0),
        unknownEntries:files.filter(f=>!f.token||!known.has(f.token)).length,
        unavailableSizes:files.filter(f=>f.sizeBytes===undefined).length,
        physicalDeletionAuthorized:false as const,
      };
    });
  }
  requestPersistence(request: ConfigurationRequest) {
    // Invoke persist before awaiting anything; denial is explicit, never a false storage guarantee.
    if (request.interaction !== 'user-initiated') return Promise.resolve(storageFailure<{ granted: boolean }>('PERMISSION_REQUIRED'));
    if (!this.storage?.persist) return Promise.resolve(storageFailure<{ granted: boolean }>('UNSUPPORTED_OPERATION'));
    const pending = this.storage.persist(); return this.result(async () => ({ granted: await pending }));
  }
  private async fingerprint(bytes: Blob, signal?: AbortSignal, progress?: (n: number) => void): Promise<FileIntegrity> {
    const hash = new IncrementalSha256();
    for (let offset = 0; offset < bytes.size; offset += CHUNK_SIZE) {
      if (signal?.aborted) throw new DigitalStorageException('OPERATION_CANCELLED');
      hash.update(new Uint8Array(await bytes.slice(offset, offset + CHUNK_SIZE).arrayBuffer()));
      progress?.(Math.min(offset + CHUNK_SIZE, bytes.size));
      if ((offset / CHUNK_SIZE) % 4 === 3) await new Promise(resolve => setTimeout(resolve, 0));
    }
    requireStorage(bytes.size > 0, 'INVALID_FILE');
    return { sizeBytes: bytes.size, checksum: { algorithm: 'sha256', value: hash.hex() } };
  }
  private async validateMedia(bytes: Blob, format: string) {
    const head = new Uint8Array(await bytes.slice(0, 65536).arrayBuffer());
    const text = new TextDecoder('latin1').decode(head);
    let valid = false;
    if (format === 'pdf') valid = text.startsWith('%PDF-') && (await bytes.slice(-1024).text()).includes('%%EOF');
    if (format === 'epub' && head.length >= 58) {
      const d = new DataView(head.buffer), nameLength = d.getUint16(26, true), extra = d.getUint16(28, true);
      const start = 30 + nameLength + extra;
      valid = d.getUint32(0,true) === 0x04034b50 && d.getUint16(8,true) === 0
        && text.slice(30,30+nameLength) === 'mimetype' && text.slice(start,start+20) === 'application/epub+zip';
    }
    if (format === 'mp3') valid = text.startsWith('ID3') || (head[0] === 255 && (head[1] & 0xe0) === 0xe0);
    if (format === 'm4a' || format === 'm4b') valid = text.slice(4,8) === 'ftyp' && /M4A |M4B |isom|mp42/.test(text.slice(8,64));
    requireStorage(valid, 'INVALID_FILE');
  }
  private async verifyRecord(r: RecordV1, area: 'staging' | 'committed', signal?: AbortSignal): Promise<Blob> {
    requireStorage(r.expected, 'RECOVERY_REQUIRED'); const bytes = await this.files.read(area, r.token);
    const actual = await this.fingerprint(bytes, signal);
    requireStorage(actual.sizeBytes === r.expected.sizeBytes && actual.checksum.value === r.expected.checksum.value, 'INTEGRITY_MISMATCH');
    await this.validateMedia(bytes, r.format); return bytes;
  }
  private stored(r: RecordV1): StoredDigitalFile {
    requireStorage(r.expected, 'RECOVERY_REQUIRED');
    return { state: 'stored', operationId: r.operationId, file: managedFileReference(this.id, r.token),
      metadata: { filename: r.filename, mimeType: r.mimeType, format: r.format as AttachmentFormat, sizeBytes: r.expected.sizeBytes }, integrity: r.expected };
  }
  private report(r: RecordV1, context: ImportOperationContext | undefined, stage: 'copying' | 'verifying', bytes: number) {
    try { context?.onProgress?.({ operationId: r.operationId, stage, bytesProcessed: bytes, totalBytes: r.expected?.sizeBytes }); }
    catch { /* consumer callbacks cannot affect durability */ }
  }
  private async promote(r: RecordV1, context?: ImportOperationContext): Promise<StoredDigitalFile> {
    const staged = await this.verifyRecord(r, 'staging', context?.signal);
    r.state = 'VERIFYING'; await this.save(r); await this.point('verified', r);
    let destination: Blob | undefined;
    try { destination = await this.files.read('committed', r.token); }
    catch (error) { if (errorCode(error) !== 'FILE_NOT_FOUND') throw error; }
    if (destination && destination.size > 0) await this.verifyRecord(r, 'committed', context?.signal);
    else {
      requireStorage(!destination || r.promotionStarted, 'RECOVERY_REQUIRED');
      r.promotionStarted = true; await this.save(r); await this.point('promoting', r);
      await this.files.write('committed', r.token, staged, context?.signal);
      await this.verifyRecord(r, 'committed', context?.signal);
    }
    r.stored = this.stored(r); r.errorCode = undefined;
    r.state = r.confirmed ? 'COMPLETED' : r.linkContext ? 'LINKING' : 'FILE_READY';
    r.bytesProcessed = r.expected!.sizeBytes; await this.save(r); await this.point('ready', r); return r.stored;
  }
  importFile(request: ImportDigitalFileRequest, context?: ImportOperationContext): Promise<StorageResult<StoredDigitalFile>> {
    return this.result(() => this.lock('opfs-content', () => this.lock(`opfs-operation:${safeId(request.operationId)}`, async () => {
      const selected = normalizeSelectedFile(request.selected, this.id);
      requireStorage(isValidAttachmentTypeAndFormat(request.type, request.format), 'UNSUPPORTED_FORMAT');
      requireStorage(selected.filename.split('.').pop()?.toLowerCase() === request.format, 'UNSUPPORTED_FORMAT');
      let r = await this.records.get<RecordV1>(prefix + request.operationId);
      if (r) {
        r = await this.record(request.operationId);
        requireStorage(r.type === request.type && r.format === request.format, 'OPERATION_CONFLICT');
        if (r.stored) { await this.verifyRecord(r, 'committed', context?.signal);
          if (r.state === 'RECOVERY_REQUIRED') { r.state = r.confirmed ? 'COMPLETED' : r.linkContext ? 'LINKING' : 'FILE_READY'; r.errorCode = undefined; await this.save(r); }
          return r.stored; }
      } else {
        r = { version: 1, token: crypto.randomUUID(), operationId: safeId(request.operationId), type: request.type,
          format: request.format, filename: selected.filename, mimeType: mime(request.format), state: 'PREPARING',
          bytesProcessed: 0, createdAt: Date.now(), updatedAt: Date.now() };
        await this.save(r); await this.point('intent', r);
      }
      try {
        await this.layout();
        const source = this.sources.get(selected.source.sourceReference); requireStorage(source, 'PERMISSION_REQUIRED');
        await this.validateMedia(source, request.format);
        const expected = await this.fingerprint(source, context?.signal);
        if (r.expected) requireStorage(r.expected.sizeBytes === expected.sizeBytes && r.expected.checksum.value === expected.checksum.value, 'OPERATION_CONFLICT');
        r.expected = expected; await this.save(r); await this.point('fingerprint', r);
        // Reuse only a fully confirmed, reverified record. Never deduplicate by name or size.
        const duplicate = (await this.all()).find(o => o.operationId !== r!.operationId && o.state === 'COMPLETED'
          && o.format === r!.format && o.expected?.sizeBytes === expected.sizeBytes && o.expected.checksum.value === expected.checksum.value);
        if (duplicate) {
          await this.verifyRecord(duplicate, 'committed', context?.signal);
          r.token = duplicate.token; r.stored = this.stored(r); r.state = 'FILE_READY'; await this.save(r); return r.stored;
        }
        if (typeof this.storage?.estimate === 'function') {
          const estimate = await this.storage.estimate();
          if (Number.isFinite(estimate.quota) && Number.isFinite(estimate.usage)) {
            requireStorage(estimate.quota! - estimate.usage! >= source.size * 2, 'INSUFFICIENT_SPACE');
          }
        }
        r.state = 'COPYING'; r.errorCode = undefined; await this.save(r); await this.point('created', r);
        let last = 0;
        await this.files.write('staging', r.token, source, context?.signal, async (bytes) => {
          this.report(r!, context, 'copying', bytes);
          if (bytes - last >= 1024 * 1024 || bytes === source.size) { last = bytes; r!.bytesProcessed = bytes; await this.save(r!); }
          await this.point('writing', r!);
        });
        await this.point('staged', r);
        return await this.promote(r, context);
      } catch (error) {
        r.errorCode = errorCode(error); r.state = 'RECOVERY_REQUIRED'; await this.save(r); throw error;
      }
    })));
  }
  recoverImport(id: string): Promise<StorageResult<StoredDigitalFile>> {
    return this.result(() => this.lock('opfs-content', () => this.lock(`opfs-operation:${safeId(id)}`, async () => {
      const r = await this.record(id); await this.layout();
      if (r.stored) { await this.verifyRecord(r, 'committed');
        r.state = r.confirmed ? 'COMPLETED' : r.linkContext ? 'LINKING' : 'FILE_READY'; r.errorCode = undefined; await this.save(r); return r.stored; }
      try { return await this.promote(r); }
      catch (error) { r.state = 'RECOVERY_REQUIRED'; r.errorCode = errorCode(error); await this.save(r); throw new DigitalStorageException('RECOVERY_REQUIRED'); }
    })));
  }
  listOperations() { return this.result(async () => (await this.all()).map(normalizeOperation)); }
  getOperation(id: string) { return this.result(async () => {
    const r = await this.record(id);
    // Force the shared coordinator through journal recovery before trusting a failed receipt again.
    return normalizeOperation(r.state === 'RECOVERY_REQUIRED' ? { ...r, stored: undefined } : r);
  }); }
  beginAttachmentLink(id: string, context: AttachmentLinkIntent) {
    return this.result(() => this.lock(`opfs-operation:${safeId(id)}`, async () => {
      const r = await this.record(id); requireStorage(r.stored, 'RECOVERY_REQUIRED');
      const next = normalizeLinkIntent(context);
      requireStorage(!r.linkContext || JSON.stringify(r.linkContext) === JSON.stringify(next), 'OPERATION_CONFLICT');
      await this.verifyRecord(r, 'committed'); r.linkContext = next;
      if (!r.confirmed) r.state = 'LINKING'; await this.save(r); await this.point('linking', r); return normalizeOperation(r);
    }));
  }
  completeImportOperation(id: string): Promise<StorageResult<void>> {
    return this.result(() => this.lock(`opfs-operation:${safeId(id)}`, async () => {
      const r = await this.record(id); requireStorage(r.stored && r.linkContext, 'RECOVERY_REQUIRED');
      await this.verifyRecord(r, 'committed'); await this.point('complete', r);
      r.confirmed = true; r.state = 'COMPLETED'; await this.save(r);
    }));
  }
  private async managed(file: ManagedFileReference) {
    const ref = normalizeManagedReference(file, this.id); safeId(ref.storageReference);
    const r = (await this.all()).find(o => o.token === ref.storageReference && !!o.stored);
    requireStorage(r, 'INVALID_REFERENCE'); return r;
  }
  getMetadata(file: ManagedFileReference) {
    return this.result(async () => { const r = await this.managed(file); await this.verifyRecord(r, 'committed'); return { file, metadata: r.stored!.metadata }; });
  }
  checkAccess(file: DigitalFileReference): Promise<StorageResult<{ accessible: true }>> {
    return this.result(async () => {
      if (file.kind === 'source') { requireStorage(file.storageProvider === this.id && this.sources.has(file.sourceReference), 'PERMISSION_REQUIRED'); }
      else { await this.verifyRecord(await this.managed(file), 'committed'); }
      return { accessible: true as const };
    });
  }
  verifyIntegrity(file: ManagedFileReference, expected: FileIntegrity, context?: StorageOperationContext) {
    return this.result(async () => { const r = await this.managed(file); await this.verifyRecord(r, 'committed', context?.signal);
      const normalized = normalizeIntegrity(expected); requireStorage(r.expected!.checksum.value === normalized.checksum.value && r.expected!.sizeBytes === normalized.sizeBytes, 'INTEGRITY_MISMATCH'); return r.expected!; });
  }
  acquireReadAccess(file: ManagedFileReference): Promise<StorageResult<DigitalReadAccess>> {
    return this.result(async () => {
      const r = await this.managed(file);
      const confirmed = (await this.all()).some(o => o.token === r.token && o.confirmed);
      requireStorage(confirmed, 'RECOVERY_REQUIRED');
      const bytes = await this.verifyRecord(r, 'committed'), token = opaqueToken<'read-access'>(crypto.randomUUID());
      this.reads.set(token, { file, bytes }); return { file, token, consumption: 'provider-stream' as const };
    });
  }
  resolveReadAccess(access: DigitalReadAccess): StorageResult<Blob> {
    const saved = this.reads.get(access.token);
    return saved && saved.file.storageProvider === access.file.storageProvider && saved.file.storageReference === access.file.storageReference
      ? storageSuccess(saved.bytes) : storageFailure('INVALID_REFERENCE');
  }
  async releaseReadAccess(access: DigitalReadAccess): Promise<StorageResult<void>> {
    const saved = this.reads.get(access.token);
    if (saved && saved.file.storageReference !== access.file.storageReference) return storageFailure('INVALID_REFERENCE');
    this.reads.delete(access.token); return storageSuccess(undefined);
  }
  async deleteManagedFile(_request: DeleteManagedFileRequest): Promise<StorageResult<void>> { return storageFailure('UNSUPPORTED_OPERATION'); }
  readonly recovery = {
    listPendingImports: async () => {
      const listed = await this.listOperations(); if (listed.status !== 'success') return listed;
      return storageSuccess(listed.value.filter(r => r.state !== 'COMPLETED').map(r => r.stored
        ? { operationId: r.operationId, stage: 'stored-unlinked' as const, file: r.stored.file }
        : { operationId: r.operationId, stage: 'copying' as const, temporaryReference: opaqueToken<'incomplete-import'>(r.operationId) }));
    },
    discardIncompleteImport: async (_id: string): Promise<StorageResult<void>> => storageFailure('UNSUPPORTED_OPERATION'),
    completeImportOperation: (id: string) => this.completeImportOperation(id),
  };
}
