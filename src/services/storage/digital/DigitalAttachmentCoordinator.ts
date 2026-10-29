import { BookAttachmentRepository } from '../../database/bookAttachmentRepository';
import { BookRepository } from '../../database/bookRepository';
import { ReaderPositionRepository } from '../../database/readerPositionRepository';
import type { IDatabaseService } from '../../database/types';
import type { BookAttachment } from '../../../types/digitalMedia';
import type { IDigitalFileStorageService, StorageResult, StoredDigitalFile } from './contracts';
import type { AttachmentChangeRequest, DetachAttachmentRequest, IDigitalAttachmentCoordinator } from './attachmentPlanning';
import { planAttachmentChange } from './attachmentPlanning';
import type { AttachmentLinkIntent, IDigitalStorageJournal } from './operations';
import { normalizeLinkIntent } from './operations';
import { DigitalStorageException, normalizeStorageError, storageFailure, storageSuccess } from './errors';
import { normalizeStoredFile, requireStorage } from './validation';

function unwrap<T>(result: StorageResult<T>): T {
  if (result.status === 'success') return result.value;
  throw new DigitalStorageException(result.status === 'cancelled' ? result.code : result.error.code);
}

/** Short SQLite transactions, exclusively through the existing adapter and scoped repositories. */
export class DigitalAttachmentCoordinator implements IDigitalAttachmentCoordinator {
  private static readonly slots = new Set<string>();
  constructor(private readonly db: IDatabaseService, private readonly storage: IDigitalFileStorageService,
    private readonly journal: IDigitalStorageJournal) {}

  private async slot<T>(key: string, work: () => Promise<StorageResult<T>>): Promise<StorageResult<T>> {
    if (DigitalAttachmentCoordinator.slots.has(key)) return storageFailure('OPERATION_CONFLICT');
    DigitalAttachmentCoordinator.slots.add(key);
    try { return await work(); }
    catch (error) { return storageFailure(normalizeStorageError(error).code); }
    finally { DigitalAttachmentCoordinator.slots.delete(key); }
  }
  private transaction<T>(work: (db: IDatabaseService) => Promise<T>): Promise<T> {
    const run = this.db.runIsolatedInTransaction ?? this.db.runInTransaction;
    return run.call(this.db, (tx) => work(tx ?? this.db)) as Promise<T>;
  }
  private matches(row: BookAttachment | null, stored: StoredDigitalFile, context: AttachmentLinkIntent): boolean {
    return !!row && row.id === context.attachmentId && row.bookId === context.bookId && row.type === context.type
      && row.storageProvider === stored.file.storageProvider && row.storageReference === stored.file.storageReference
      && row.sizeBytes === stored.integrity.sizeBytes && row.checksum === stored.integrity.checksum.value && row.format === stored.metadata.format;
  }
  private assertRequest(context: AttachmentLinkIntent, request: AttachmentChangeRequest) {
    requireStorage(context.bookId === request.bookId && context.type === request.type && context.intent === request.intent
      && context.expectedAttachmentId === request.expectedAttachmentId
      && (context.positionPolicy !== 'invalidate-current' || request.positionDecision === 'invalidate-current'), 'OPERATION_CONFLICT');
    requireStorage(request.expectedBookUuid === undefined || context.bookUuid === request.expectedBookUuid, 'ATTACHMENT_CONFLICT');
    this.assertExpected(request, { storageProvider: context.expectedProvider, storageReference: context.expectedStorageReference, updatedAt: context.expectedUpdatedAt });
  }
  private assertExpected(request: { expectedStorageReference?: string; expectedProvider?: string; expectedUpdatedAt?: number },
    current: { storageProvider?: string; storageReference?: string; updatedAt?: number } | null) {
    requireStorage((request.expectedStorageReference === undefined || current?.storageReference === request.expectedStorageReference)
      && (request.expectedProvider === undefined || current?.storageProvider === request.expectedProvider)
      && (request.expectedUpdatedAt === undefined || current?.updatedAt === request.expectedUpdatedAt), 'ATTACHMENT_CONFLICT');
  }
  async applyChange(request: AttachmentChangeRequest): Promise<StorageResult<BookAttachment>> {
    return this.slot(`${request.bookId}:${request.type}`, async () => {
      const stored = normalizeStoredFile(request.imported);
      const operation = unwrap(await this.journal.getOperation(stored.operationId));
      requireStorage(operation.stored && operation.stored.file.storageReference === stored.file.storageReference
        && operation.stored.file.storageProvider === stored.file.storageProvider
        && operation.stored.integrity.checksum.value === stored.integrity.checksum.value
        && operation.stored.integrity.sizeBytes === stored.integrity.sizeBytes
        && operation.stored.metadata.format === stored.metadata.format, 'RECOVERY_REQUIRED');
      let context: AttachmentLinkIntent;
      if (operation.linkContext) {
        context = normalizeLinkIntent(operation.linkContext); this.assertRequest(context, request);
      } else {
        const book = await new BookRepository(this.db).getById(request.bookId);
        requireStorage(book?.uuid, 'ATTACHMENT_CONFLICT');
        requireStorage(request.expectedBookUuid === undefined || book.uuid === request.expectedBookUuid, 'ATTACHMENT_CONFLICT');
        const current = await new BookAttachmentRepository(this.db).getByBookAndType(request.bookId, request.type);
        this.assertExpected(request, current);
        unwrap(planAttachmentChange(request, current));
        const identical = !!current && current.checksum === stored.integrity.checksum.value
          && current.format === stored.metadata.format && current.sizeBytes === stored.integrity.sizeBytes;
        if (current && !identical) requireStorage(!await new ReaderPositionRepository(this.db).getByAttachmentId(current.id)
          || request.positionDecision === 'invalidate-current', 'POSITION_POLICY_REQUIRED');
        context = normalizeLinkIntent({ version: 1, bookId: request.bookId, bookUuid: book.uuid,
          type: request.type, intent: request.intent, attachmentId: identical ? current!.id : crypto.randomUUID(),
          ...(current ? { expectedAttachmentId: current.id, expectedStorageReference: current.storageReference,
            expectedProvider: current.storageProvider, expectedUpdatedAt: current.updatedAt,
            ...(identical ? { positionPolicy: 'preserve-identical' as const } : request.positionDecision === 'invalidate-current'
              ? { positionPolicy: 'invalidate-current' as const } : {}) } : {}) });
      }
      unwrap(await this.journal.beginAttachmentLink(stored.operationId, context));
      // Native LINKING protects the verified file against managed deletion during SQLite work.
      unwrap(await this.storage.verifyIntegrity(stored.file, stored.integrity));
      let attachment: BookAttachment;
      try {
        attachment = await this.transaction(async (tx) => {
          const book = await new BookRepository(tx).getById(context.bookId);
          requireStorage(book?.uuid === context.bookUuid, 'ATTACHMENT_CONFLICT');
          const repo = new BookAttachmentRepository(tx);
          const current = await repo.getByBookAndType(context.bookId, context.type);
          if (current && this.matches(current, stored, context)) return current;
          const plan = unwrap(planAttachmentChange({ ...request, imported: stored }, current));
          if (current) {
            requireStorage(current.storageProvider === context.expectedProvider && current.storageReference === context.expectedStorageReference
              && current.updatedAt === context.expectedUpdatedAt, 'ATTACHMENT_CONFLICT');
            if (context.positionPolicy === 'preserve-identical') {
              requireStorage(current.checksum === stored.integrity.checksum.value && current.format === stored.metadata.format
                && current.sizeBytes === stored.integrity.sizeBytes && context.attachmentId === current.id, 'ATTACHMENT_CONFLICT');
              // Same logical bytes: keep attachment and position IDs, including position timestamp.
              return repo.update({ ...current, ...plan.next, id: current.id });
            }
            requireStorage(!await new ReaderPositionRepository(tx).getByAttachmentId(current.id)
              || context.positionPolicy === 'invalidate-current', 'POSITION_POLICY_REQUIRED');
            await repo.delete(current.id); // rollback restores it if the following create/commit fails
          }
          return repo.create({ ...plan.next, id: context.attachmentId });
        });
      } catch (error) {
        if (error instanceof DigitalStorageException) throw error;
        // Keep FILE_READY/LINKING and the existing attachment. Recovery must requery SQLite.
        return storageFailure('LINK_PERSISTENCE_FAILED');
      }
      const persisted = await new BookAttachmentRepository(this.db).getById(attachment.id);
      requireStorage(persisted && this.matches(persisted, stored, context), 'RECOVERY_REQUIRED');
      const complete = await this.journal.completeImportOperation(stored.operationId);
      if (complete.status !== 'success') return storageFailure('RECOVERY_REQUIRED');
      return storageSuccess(persisted);
    });
  }
  async recover(operationId: string): Promise<StorageResult<BookAttachment | StoredDigitalFile>> {
    try {
      let operation = unwrap(await this.journal.getOperation(operationId));
      const stored = operation.stored ?? unwrap(await this.journal.recoverImport(operationId));
      operation = unwrap(await this.journal.getOperation(operationId));
      if (!operation.linkContext) {
        unwrap(await this.storage.verifyIntegrity(stored.file, stored.integrity));
        return storageSuccess(stored);
      } // never choose a book implicitly
      const context = normalizeLinkIntent(operation.linkContext);
      return this.applyChange({ imported: stored, bookId: context.bookId, type: context.type,
        intent: context.intent, expectedAttachmentId: context.expectedAttachmentId,
        ...(context.positionPolicy === 'invalidate-current' ? { positionDecision: 'invalidate-current' as const } : {}) });
    } catch (error) { return storageFailure(normalizeStorageError(error).code); }
  }
  /** Durable COMPLETED receipts retain known file identities; SQLite determines current usage.
   * This is a review queue, never a deletion permit. Previously linked bytes stay protected natively.
   */
  async listRetainedFiles(): Promise<StorageResult<readonly { operationId: string; file: StoredDigitalFile['file'];
    eligibility: 'awaiting-explicit-deletion-policy' }[]>> {
    try {
      const operations = unwrap(await this.journal.listOperations());
      const retained = [];
      for (const operation of operations) {
        if (operation.state !== 'COMPLETED' || !operation.stored || !operation.linkContext) continue;
        const file = operation.stored.file;
        const rows = await this.db.query<{ id: string }>(
          'SELECT id FROM book_attachments WHERE storage_provider = ? AND storage_reference = ? LIMIT 1;',
          [file.storageProvider, file.storageReference]);
        if (rows.length === 0) retained.push({ operationId: operation.operationId, file,
          eligibility: 'awaiting-explicit-deletion-policy' as const });
      }
      return storageSuccess(retained);
    } catch (error) { return storageFailure(normalizeStorageError(error).code); }
  }
  async detach(request: DetachAttachmentRequest): Promise<StorageResult<void>> {
    try {
      requireStorage(request.intent === 'detach-only', 'UNSUPPORTED_OPERATION');
      const previous = await new BookAttachmentRepository(this.db).getById(request.attachmentId);
      if (!previous) {
        requireStorage(request.expectedStorageReference === undefined, 'ATTACHMENT_CONFLICT');
        return storageSuccess(undefined);
      }
      this.assertExpected(request, previous);
      requireStorage(request.expectedType === undefined || previous.type === request.expectedType, 'ATTACHMENT_CONFLICT');
      return this.slot(`${previous.bookId}:${previous.type}`, async () => {
        await this.transaction(async (tx) => {
          const repo = new BookAttachmentRepository(tx);
          const current = await repo.getById(previous.id);
          requireStorage(current?.storageReference === previous.storageReference && current?.storageProvider === previous.storageProvider
            && current?.updatedAt === previous.updatedAt && current?.bookId === previous.bookId && current?.type === previous.type, 'ATTACHMENT_CONFLICT');
          this.assertExpected(request, current);
          if (request.expectedBookUuid !== undefined) {
            const book = await new BookRepository(tx).getById(previous.bookId);
            requireStorage(book?.uuid === request.expectedBookUuid, 'ATTACHMENT_CONFLICT');
          }
          requireStorage(!await new ReaderPositionRepository(tx).getByAttachmentId(previous.id)
            || request.positionDecision === 'remove-current', 'POSITION_POLICY_REQUIRED');
          await repo.delete(previous.id);
        });
        return storageSuccess(undefined); // no file deletion, no change to Book or sessions
      });
    } catch (error) { return storageFailure(normalizeStorageError(error).code); }
  }
}
