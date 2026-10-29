import type { Book } from '../../../types/book';
import type { AttachmentFormat, AttachmentType, BookAttachment } from '../../../types/digitalMedia';
import { BookRepository } from '../../database/bookRepository';
import { BookAttachmentRepository } from '../../database/bookAttachmentRepository';
import { ReaderPositionRepository } from '../../database/readerPositionRepository';
import { DatabaseService } from '../../database/databaseService';
import type { IDatabaseService } from '../../database/types';
import type { DigitalLibrary } from './composeDigitalLibrary';
import type { DigitalImportProgress, DigitalStorageErrorCode, SelectedDigitalFile, StorageResult, StoredDigitalFile } from './contracts';
import { DigitalStorageException, normalizeStorageError } from './errors';
import { getPlatformDigitalLibrary } from './platform';
import { managedFileReference } from './validation';

export type AttachmentAvailability = 'unknown' | 'available' | 'unavailable' | 'permission' | 'pending' | 'missing' | 'providerUnavailable';
export interface AttachmentItem {
  attachment: BookAttachment;
  availability: AttachmentAvailability;
  integrity: 'unknown' | 'recorded' | 'verified' | 'failed';
  errorCode?: DigitalStorageErrorCode;
}
export type AttachmentConfirmation =
  | { kind: 'replace'; previous: BookAttachment; imported: StoredDigitalFile; identical: boolean; hasPosition: boolean }
  | { kind: 'detach'; previous: BookAttachment; hasPosition: boolean };
export interface AttachmentsViewState {
  loading: boolean;
  persisted: boolean;
  configured: boolean;
  supported: boolean;
  manageable?: boolean;
  needsConfiguration?: boolean;
  recoverable?: AttachmentType[];
  items: AttachmentItem[];
  pending: AttachmentType[];
  busy?: { type?: AttachmentType; stage: 'configuring' | 'selecting' | 'reviewing' | 'recovering' | 'confirming' | DigitalImportProgress['stage']; filename?: string; progress?: DigitalImportProgress; cancelling?: boolean };
  confirmation?: AttachmentConfirmation;
  feedback?: { kind: 'success' | 'cancelled' | 'error' | 'pending'; code?: DigitalStorageErrorCode; message?: 'detached' | 'checked' | 'accessible' | 'recovered' };
  canCancel: boolean;
}
const formats: Record<AttachmentType, readonly AttachmentFormat[]> = { ebook: ['epub', 'pdf'], audiobook: ['mp3', 'm4a', 'm4b'] };
const terminal = (state: string) => ['COMPLETED', 'DELETED', 'DISCARDED'].includes(state);
const permissionError = (code: DigitalStorageErrorCode) => ['PERMISSION_DENIED', 'PERMISSION_REVOKED', 'PERMISSION_REQUIRED'].includes(code);
function unwrap<T>(result: StorageResult<T>): T {
  if (result.status === 'success') return result.value;
  throw new DigitalStorageException(result.status === 'error' ? result.error.code : result.code);
}
// Only presentation for active work survives navigation. No second journal or persistent state.
const active = new Map<string, AttachmentsPresentation>();

/** UI adapter: repository queries and existing service/coordinator calls, never file or SQL writes. */
export class AttachmentsPresentation {
  private state: AttachmentsViewState = { loading: true, persisted: false, configured: false, supported: false, items: [], pending: [], canCancel: false };
  private readonly listeners = new Set<() => void>();
  private readonly books: BookRepository;
  private readonly attachments: BookAttachmentRepository;
  private readonly positions: ReaderPositionRepository;
  private library?: DigitalLibrary;
  private abort?: AbortController;
  private revision = 0;
  private operationId?: string;
  private operationType?: AttachmentType;
  private readonly verified = new Set<string>();
  private readonly failedIntegrity = new Set<string>();
  private progressTimer?: ReturnType<typeof setTimeout>;
  private latestProgress?: DigitalImportProgress;
  private lastProgress = 0;
  constructor(readonly book: Pick<Book, 'id' | 'uuid'>, db: IDatabaseService = DatabaseService.getInstance(),
    private readonly factory = getPlatformDigitalLibrary) {
    this.books = new BookRepository(db); this.attachments = new BookAttachmentRepository(db); this.positions = new ReaderPositionRepository(db);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<AttachmentsViewState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private key() { return `${this.book.id}:${this.book.uuid}`; }
  private fileKey(row: BookAttachment) { return `${row.id}:${row.storageReference}:${row.checksum}`; }
  private fail(error: unknown) {
    const code = normalizeStorageError(error).code;
    this.update({ feedback: code === 'USER_CANCELLED' || code === 'OPERATION_CANCELLED' ? { kind: 'cancelled' }
      : { kind: ['RECOVERY_REQUIRED', 'LINK_PERSISTENCE_FAILED'].includes(code) ? 'pending' : 'error', code } });
  }
  private start(busy: NonNullable<AttachmentsViewState['busy']>) {
    if (this.state.busy || (active.has(this.key()) && active.get(this.key()) !== this)) return false;
    active.set(this.key(), this); this.update({ busy, feedback: undefined }); return true;
  }
  private finish() {
    if (this.progressTimer) clearTimeout(this.progressTimer);
    this.progressTimer = undefined; this.latestProgress = undefined;
    this.abort = undefined;
    this.update({ busy: undefined, confirmation: undefined, canCancel: false });
    if (active.get(this.key()) === this) active.delete(this.key());
  }
  async refresh() {
    const revision = ++this.revision;
    try {
      const book = await this.books.getById(this.book.id);
      const persisted = !!book?.uuid && book.uuid === this.book.uuid;
      if (!persisted) { if (revision === this.revision) this.update({ loading: false, persisted: false, configured: false, supported: false, items: [], pending: [] }); return; }
      const rows = await this.attachments.getByBookId(this.book.id);
      let library = this.library;
      if (!library) {
        const result = await this.factory();
        if (result.status !== 'success') {
          if (revision === this.revision) this.update({ loading: false, persisted, configured: false, supported: false, items: rows.map(attachment => ({ attachment, availability: 'unknown', integrity: 'unknown' })), feedback: { kind: 'error', code: result.status === 'error' ? result.error.code : 'PROVIDER_UNAVAILABLE' } });
          return;
        }
        library = this.library = result.value;
      }
      const caps = unwrap(library.service.getCapabilities());
      const supported = caps.providerAvailability === 'available' && caps.available.selectFile && caps.available.importFile && caps.available.sha256;
      const config = await library.service.getConfiguration();
      const configured = config.status === 'success' && config.value.state === 'configured' && config.value.permission === 'granted';
      const journal = await library.provider.listOperations();
      const pending = new Set<AttachmentType>();
      const recoverable = new Set<AttachmentType>();
      if (journal.status === 'success') {
        for (const op of journal.value) {
          if (terminal(op.state)) continue;
          if (op.linkContext?.bookUuid === this.book.uuid && op.linkContext?.bookId === this.book.id) {
            pending.add(op.type); recoverable.add(op.type);
          } else if (op.operationId === this.operationId && op.state !== 'FILE_READY') pending.add(op.type);
        }
      } else { pending.add('ebook'); pending.add('audiobook'); }
      const items: AttachmentItem[] = await Promise.all(rows.map(async attachment => {
        const access = await library.service.checkAccess(managedFileReference(attachment.storageProvider, attachment.storageReference));
        const code = access.status === 'error' ? access.error.code : undefined;
        const availability: AttachmentAvailability = pending.has(attachment.type) ? 'pending' : access.status === 'success' ? 'available'
          : code && permissionError(code) ? 'permission' : code === 'FILE_NOT_FOUND' ? 'missing' : code === 'PROVIDER_UNAVAILABLE' || code === 'PROVIDER_MISMATCH' ? 'providerUnavailable' : 'unavailable';
        return { attachment, availability, errorCode: code, integrity: this.failedIntegrity.has(this.fileKey(attachment)) ? 'failed'
          : access.status === 'success' && this.verified.has(this.fileKey(attachment)) ? 'verified' : attachment.checksum ? 'recorded' : 'unknown' };
      }));
      if (revision !== this.revision) return;
      this.update({ loading: false, persisted, configured, supported, manageable: true, items, pending: [...pending], recoverable: [...recoverable],
        needsConfiguration: config.status === 'success' && config.value.state === 'not-configured' });
      if (config.status === 'error' && !this.state.busy) this.update({ feedback: { kind: permissionError(config.error.code) ? 'error' : 'pending', code: config.error.code } });
      if (this.state.feedback?.kind === 'pending' && this.operationId && journal.status === 'success'
        && journal.value.some(op => op.operationId === this.operationId && op.state === 'COMPLETED')) {
        this.update({ feedback: undefined });
      }
    } catch (error) { if (revision === this.revision) { this.update({ loading: false, configured: false, supported: false }); this.fail(error); } }
  }
  configure = (): Promise<void> => {
    if (!this.library || this.state.loading || !this.state.persisted || !this.state.supported || !this.start({ stage: 'configuring' })) return Promise.resolve();
    // No await before dispatching an interactive native picker.
    const selection = this.library.service.requestConfiguration({ interaction: 'user-initiated' });
    return (async () => { try { unwrap(await selection); } catch (error) { this.fail(error); }
      finally { await this.refresh(); this.finish(); } })();
  };
  add = (type: AttachmentType): Promise<void> => {
    if (!this.library || this.state.loading || !this.state.persisted || !this.state.configured || !this.state.supported
      || this.state.pending.includes(type) || this.state.items.some(row => row.attachment.type === type)
      || !this.start({ type, stage: 'selecting' })) return Promise.resolve();
    // Keep browser user activation: all asynchronous identity/slot checks happen AFTER selection.
    const selection = this.library.service.selectSource({ interaction: 'user-initiated', acceptedFormats: formats[type] });
    return this.importSelection(type, selection);
  };
  replace = (type: AttachmentType): Promise<void> => {
    const previous = this.state.items.find(row => row.attachment.type === type)?.attachment;
    if (!previous || !this.library || this.state.loading || !this.state.persisted || !this.state.configured || !this.state.supported
      || this.state.pending.includes(type) || !this.start({ type, stage: 'selecting' })) return Promise.resolve();
    const selection = this.library.service.selectSource({ interaction: 'user-initiated', acceptedFormats: formats[type] });
    return this.importSelection(type, selection, previous);
  };
  private async assertTarget(type: AttachmentType, expected?: BookAttachment) {
    const book = await this.books.getById(this.book.id);
    const current = await this.attachments.getByBookAndType(this.book.id, type);
    if (!book?.uuid || book.uuid !== this.book.uuid || (expected ? !current || current.id !== expected.id
      || current.storageReference !== expected.storageReference || current.storageProvider !== expected.storageProvider
      || current.updatedAt !== expected.updatedAt || current.checksum !== expected.checksum || current.format !== expected.format
      || current.sizeBytes !== expected.sizeBytes : !!current)) throw new DigitalStorageException('ATTACHMENT_CONFLICT');
    const journal = unwrap(await this.library!.provider.listOperations());
    if (journal.some(op => !terminal(op.state) && op.operationId !== this.operationId && op.linkContext?.bookUuid === this.book.uuid
      && op.linkContext?.bookId === this.book.id && op.type === type)) throw new DigitalStorageException('RECOVERY_REQUIRED');
    return book;
  }
  private expected(previous: BookAttachment) {
    return { expectedBookUuid: this.book.uuid, expectedAttachmentId: previous.id, expectedStorageReference: previous.storageReference,
      expectedProvider: previous.storageProvider, expectedUpdatedAt: previous.updatedAt };
  }
  private report = (progress: DigitalImportProgress) => {
    if (!this.state.busy || this.state.busy.stage === 'confirming' || this.state.busy.stage === 'reviewing') return;
    this.latestProgress = progress;
    const emit = () => {
      this.progressTimer = undefined;
      if (!this.state.busy || !this.latestProgress) return;
      this.lastProgress = Date.now();
      this.update({ busy: { ...this.state.busy, stage: this.latestProgress.stage, progress: this.latestProgress } });
    };
    if (Date.now() - this.lastProgress >= 120) emit();
    else if (!this.progressTimer) this.progressTimer = setTimeout(emit, 120);
  };
  private async importSelection(type: AttachmentType, selection: Promise<StorageResult<SelectedDigitalFile>>, previous?: BookAttachment) {
    let awaitingConfirmation = false;
    try {
      const selected = unwrap(await selection);
      const book = await this.assertTarget(type, previous);
      const format = selected.filename.split('.').pop()?.toLowerCase() as AttachmentFormat;
      if (!formats[type].includes(format)) throw new DigitalStorageException('UNSUPPORTED_FORMAT');
      const library = this.library!;
      const caps = unwrap(library.service.getCapabilities());
      this.abort = new AbortController();
      this.operationId = `ui-${crypto.randomUUID()}`; this.operationType = type;
      this.update({ busy: { type, stage: 'validating', filename: selected.filename }, canCancel: caps.available.cancelOperations });
      const imported = unwrap(await library.service.importFile({ operationId: this.operationId, selected, type, format }, {
        ...(caps.available.cancelOperations ? { signal: this.abort.signal } : {}),
        ...(caps.available.importProgress ? { onProgress: this.report } : {}),
      }));
      if (this.progressTimer) clearTimeout(this.progressTimer);
      this.progressTimer = undefined;
      this.update({ busy: { type, stage: 'confirming', filename: selected.filename }, canCancel: false });
      // Selection/copy can outlive a restore or deletion. Do not attach to a reused numeric ID.
      await this.assertTarget(type, previous);
      if (previous) {
        const hasPosition = !!await this.positions.getByAttachmentId(previous.id);
        const identical = !!previous.checksum && /^[a-f\d]{64}$/i.test(previous.checksum)
          && previous.checksum === imported.integrity.checksum.value && previous.sizeBytes === imported.integrity.sizeBytes
          && previous.format === imported.metadata.format;
        this.update({ busy: { type, stage: 'reviewing' }, confirmation: { kind: 'replace', previous, imported, identical, hasPosition } });
        awaitingConfirmation = true;
        return;
      }
      const linked = unwrap(await library.coordinator.applyChange({ bookId: book.id, expectedBookUuid: this.book.uuid, type, imported, intent: 'attach' }));
      const persisted = await this.attachments.getByBookAndType(book.id, type);
      if (!persisted || persisted.id !== linked.id || persisted.storageReference !== linked.storageReference) throw new DigitalStorageException('RECOVERY_REQUIRED');
      this.verified.add(this.fileKey(persisted));
      this.update({ feedback: { kind: 'success' } });
    } catch (error) { this.fail(error); }
    finally { if (!awaitingConfirmation) { await this.refresh(); this.finish(); } }
  }
  requestDetach = async (type: AttachmentType) => {
    const previous = this.state.items.find(row => row.attachment.type === type)?.attachment;
    if (!previous || !this.library || this.state.loading || !this.state.persisted || this.state.pending.includes(type)
      || !this.start({ type, stage: 'validating' })) return;
    try {
      await this.assertTarget(type, previous);
      const hasPosition = !!await this.positions.getByAttachmentId(previous.id);
      this.update({ busy: { type, stage: 'reviewing' }, confirmation: { kind: 'detach', previous, hasPosition } });
    } catch (error) { this.fail(error); await this.refresh(); this.finish(); }
  };
  cancelConfirmation = () => {
    if (!this.state.confirmation || this.state.busy?.stage !== 'reviewing') return;
    // FILE_READY without a link intent stays in the provider journal, never auto-associated.
    this.operationId = undefined;
    this.update({ feedback: { kind: 'cancelled' } }); this.finish(); void this.refresh();
  };
  confirm = async () => {
    const confirmation = this.state.confirmation;
    if (!confirmation || this.state.busy?.stage !== 'reviewing') return;
    const { previous } = confirmation;
    this.update({ busy: { type: previous.type, stage: 'confirming' }, confirmation: undefined, canCancel: false });
    try {
      await this.assertTarget(previous.type, previous);
      const position = await this.positions.getByAttachmentId(previous.id);
      if (position && !confirmation.hasPosition && (confirmation.kind === 'detach' || !confirmation.identical)) throw new DigitalStorageException('POSITION_POLICY_REQUIRED');
      if (confirmation.kind === 'replace') {
        const linked = unwrap(await this.library!.coordinator.applyChange({ bookId: this.book.id, type: previous.type,
          imported: confirmation.imported, intent: 'replace', ...this.expected(previous),
          ...(confirmation.hasPosition && !confirmation.identical ? { positionDecision: 'invalidate-current' as const } : {}) }));
        const persisted = await this.attachments.getByBookAndType(this.book.id, previous.type);
        if (!persisted || persisted.id !== linked.id || persisted.storageReference !== linked.storageReference) throw new DigitalStorageException('RECOVERY_REQUIRED');
        this.verified.add(this.fileKey(persisted)); this.failedIntegrity.delete(this.fileKey(persisted));
        this.update({ feedback: { kind: 'success' } });
      } else {
        unwrap(await this.library!.coordinator.detach({ attachmentId: previous.id, expectedType: previous.type, intent: 'detach-only', ...this.expected(previous),
          ...(confirmation.hasPosition ? { positionDecision: 'remove-current' as const } : {}) }));
        if (await this.attachments.getByBookAndType(this.book.id, previous.type)) throw new DigitalStorageException('ATTACHMENT_CONFLICT');
        this.update({ feedback: { kind: 'success', message: 'detached' } });
      }
    } catch (error) { this.fail(error); }
    finally { await this.refresh(); this.finish(); }
  };
  verify = async (type: AttachmentType) => {
    const previous = this.state.items.find(row => row.attachment.type === type)?.attachment;
    if (!previous || !this.library || this.state.loading || !this.state.persisted || this.state.pending.includes(type)
      || !this.start({ type, stage: 'verifying', filename: previous.filename })) return;
    try {
      await this.assertTarget(type, previous);
      const file = managedFileReference(previous.storageProvider, previous.storageReference);
      unwrap(await this.library.service.checkAccess(file));
      const capabilities = unwrap(this.library.service.getCapabilities(previous.storageProvider));
      const canHash = capabilities.available.sha256 && !!previous.checksum && /^[a-f\d]{64}$/i.test(previous.checksum);
      this.abort = new AbortController();
      this.update({ canCancel: !!canHash && capabilities.available.cancelOperations });
      if (canHash) {
        unwrap(await this.library.service.verifyIntegrity(file, { sizeBytes: previous.sizeBytes, checksum: { algorithm: 'sha256', value: previous.checksum! } },
          capabilities.available.cancelOperations ? { signal: this.abort.signal } : undefined));
      }
      await this.assertTarget(type, previous);
      if (canHash) { this.verified.add(this.fileKey(previous)); this.failedIntegrity.delete(this.fileKey(previous)); }
      else this.verified.delete(this.fileKey(previous));
      this.update({ feedback: { kind: 'success', message: canHash ? 'checked' : 'accessible' } });
    } catch (error) {
      this.verified.delete(this.fileKey(previous));
      if (normalizeStorageError(error).code === 'INTEGRITY_MISMATCH') this.failedIntegrity.add(this.fileKey(previous));
      this.fail(error);
    } finally { await this.refresh(); this.finish(); }
  };
  recover = async (type: AttachmentType) => {
    if (!this.library || !this.state.persisted || !this.state.recoverable?.includes(type) || !this.start({ type, stage: 'recovering' })) return;
    try {
      const book = await this.books.getById(this.book.id);
      if (book?.uuid !== this.book.uuid) throw new DigitalStorageException('ATTACHMENT_CONFLICT');
      const operations = unwrap(await this.library.provider.listOperations()).filter(op => !terminal(op.state) && op.type === type
        && op.linkContext?.bookId === this.book.id && op.linkContext?.bookUuid === this.book.uuid);
      for (const op of operations) unwrap(await this.library.coordinator.recover(op.operationId));
      this.update({ feedback: { kind: 'success', message: 'recovered' } });
    } catch (error) { this.fail(error); }
    finally { await this.refresh(); this.finish(); }
  };
  cancel = () => {
    if (!this.state.canCancel || !this.state.busy || this.state.busy.stage === 'confirming') return;
    this.abort?.abort(); this.update({ busy: { ...this.state.busy, cancelling: true } });
  };
  get activeType() { return this.operationType; }
}
export function attachmentsPresentation(book: Pick<Book, 'id' | 'uuid'>) {
  return active.get(`${book.id}:${book.uuid}`) ?? new AttachmentsPresentation(book);
}
