import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BookRepository } from '../services/database/bookRepository';
import { BookAttachmentRepository } from '../services/database/bookAttachmentRepository';
import { ReaderPositionRepository } from '../services/database/readerPositionRepository';
import { ReadingProgressRepository } from '../services/database/readingProgressRepository';
import { ReadingSessionRepository } from '../services/database/readingSessionRepository';
import { TransactionalSqliteTestDatabase as SQLite } from './helpers/TransactionalSqliteTestDatabase';
import { DigitalAttachmentCoordinator } from '../services/storage/digital/DigitalAttachmentCoordinator';
import { DigitalFileStorageService } from '../services/storage/digital/DigitalFileStorageService';
import type { AttachmentLinkIntent, IDigitalStorageJournal, StorageOperationSnapshot } from '../services/storage/digital/operations';
import { normalizeOperation } from '../services/storage/digital/operations';
import type { AttachmentChangeRequest } from '../services/storage/digital/attachmentPlanning';
import type { StoredDigitalFile, StorageResult } from '../services/storage/digital/contracts';
import { storageFailure, storageSuccess } from '../services/storage/digital/errors';
import { DigitalStorageTestProvider, storedFile } from './helpers/DigitalStorageTestProvider';
import type { Book } from '../types/book';

// Real desktop SQLite transactions; the journal/provider below are metadata fakes, NOT Android evidence.
class Journal implements IDigitalStorageJournal {
  readonly records = new Map<string, StorageOperationSnapshot>();
  failCompletion = false;
  seed(stored: StoredDigitalFile) {
    this.records.set(stored.operationId, { operationId: stored.operationId, stored, state: 'FILE_READY',
      type: stored.metadata.format === 'epub' || stored.metadata.format === 'pdf' ? 'ebook' : 'audiobook',
      format: stored.metadata.format, bytesProcessed: stored.metadata.sizeBytes, createdAt: 1, updatedAt: 1 });
  }
  async listOperations() { return storageSuccess([...this.records.values()].map(normalizeOperation)); }
  async getOperation(id: string) { return this.records.has(id) ? storageSuccess(normalizeOperation(this.records.get(id))) : storageFailure('INVALID_REFERENCE'); }
  async beginAttachmentLink(id: string, context: AttachmentLinkIntent) {
    const prior = this.records.get(id)!;
    if (prior.linkContext && JSON.stringify(prior.linkContext) !== JSON.stringify(context)) return storageFailure('OPERATION_CONFLICT');
    const next: StorageOperationSnapshot = { ...prior, state: 'LINKING', linkContext: context };
    this.records.set(id, next); return storageSuccess(next);
  }
  async completeImportOperation(id: string) {
    if (this.failCompletion) return storageFailure('OPERATION_FAILED');
    this.records.set(id, { ...this.records.get(id)!, state: 'COMPLETED' }); return storageSuccess(undefined);
  }
  async recoverImport(id: string) { return storageSuccess(this.records.get(id)!.stored!); }
}
function value<T>(result: StorageResult<T>): T {
  expect(result.status).toBe('success'); if (result.status !== 'success') throw new Error('Synthetic expectation'); return result.value;
}

describe('2.2B coordinator: real desktop SQLite + simulated native journal', () => {
  let directory: string; let db: SQLite; let journal: Journal; let provider: DigitalStorageTestProvider;
  let coordinator: DigitalAttachmentCoordinator; let books: BookRepository; let attachments: BookAttachmentRepository; let book: Book;
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'saf-coordinator-')); db = new SQLite(join(directory, 'library.sqlite'));
    journal = new Journal(); provider = new DigitalStorageTestProvider();
    coordinator = new DigitalAttachmentCoordinator(db, new DigitalFileStorageService([provider]), journal);
    books = new BookRepository(db); attachments = new BookAttachmentRepository(db);
    book = await books.insert({ origem: 'manual', titulo: 'Synthetic fixture', autores: [], generos: [], formato: 'fisico', formatos: ['fisico'],
      tenho_fisico: false, status_leitura: 'quero_ler', nota: 7, observacoes: 'synthetic', dataCadastro: 1, dataAtualizacao: 1 });
    book = (await books.getById(book.id))!;
  });
  afterEach(async () => { await db.close(); rmSync(directory, { recursive: true, force: true }); });
  function ready(id: string, format: 'epub' | 'pdf' | 'mp3' | 'm4a' | 'm4b' = 'epub') {
    const stored: StoredDigitalFile = { ...storedFile(provider.id, id), metadata: { ...storedFile().metadata, format, filename: `synthetic.${format}` } };
    provider.files.set(stored.file.storageReference, stored); journal.seed(stored); return stored;
  }
  function request(stored: StoredDigitalFile, replaceId?: string): AttachmentChangeRequest {
    return { bookId: book.id, type: stored.metadata.format === 'epub' || stored.metadata.format === 'pdf' ? 'ebook' : 'audiobook',
      imported: stored, intent: replaceId ? 'replace' : 'attach', expectedAttachmentId: replaceId };
  }
  it('links ebook and audiobook independently and preserves every Book field', async () => {
    value(await coordinator.applyChange(request(ready('ebook')))); value(await coordinator.applyChange(request(ready('audio', 'm4b'))));
    expect((await attachments.getByBookId(book.id)).map((a) => a.type).sort()).toEqual(['audiobook', 'ebook']);
    expect(await books.getById(book.id)).toEqual(book); expect(journal.records.get('ebook')?.state).toBe('COMPLETED');
  });
  it('requires explicit replacement and keeps previous file', async () => {
    const first = value(await coordinator.applyChange(request(ready('first'))));
    expect(await coordinator.applyChange(request(ready('second')))).toEqual(storageFailure('ATTACHMENT_CONFLICT'));
    const next = value(await coordinator.applyChange(request(ready('third', 'pdf'), first.id)));
    expect(next.id).not.toBe(first.id); expect(await attachments.getById(first.id)).toBeNull();
    expect(provider.files.has(first.storageReference)).toBe(true); expect(provider.deleteManagedFile).not.toHaveBeenCalled();
  });
  it('failed replacement rolls back deletion and retains both physical files for recovery', async () => {
    const first = value(await coordinator.applyChange(request(ready('first')))); const replacement = ready('replacement', 'pdf');
    db.failInsert = true;
    expect(await coordinator.applyChange(request(replacement, first.id))).toEqual(storageFailure('LINK_PERSISTENCE_FAILED'));
    expect(await attachments.getById(first.id)).toEqual(first); expect(journal.records.get('replacement')?.state).toBe('LINKING');
    expect(provider.files.size).toBe(2); expect(await books.getById(book.id)).toEqual(book);
    db.failInsert = false; const next = value(await coordinator.recover('replacement'));
    expect('id' in next).toBe(true); expect(await attachments.count()).toBe(1); expect(provider.files.has(first.storageReference)).toBe(true);
  });
  it('SQLite failure before first link leaves no false attachment and recovery is idempotent', async () => {
    const source = ready('first'); db.failInsert = true;
    expect(await coordinator.applyChange(request(source))).toEqual(storageFailure('LINK_PERSISTENCE_FAILED'));
    expect(await attachments.count()).toBe(0); expect(journal.records.get('first')?.linkContext).toBeDefined();
    db.failInsert = false;
    const recovered = value(await coordinator.recover('first')); const twice = value(await coordinator.recover('first'));
    expect(twice).toEqual(recovered); expect(await attachments.count()).toBe(1);
  });
  it('reconciles committed SQLite when native completion failed without duplicate INSERT', async () => {
    const source = ready('first'); journal.failCompletion = true;
    expect(await coordinator.applyChange(request(source))).toEqual(storageFailure('RECOVERY_REQUIRED'));
    const persisted = (await attachments.getByBookId(book.id))[0]; expect(persisted).toBeDefined();
    journal.failCompletion = false;
    const recreated = new DigitalAttachmentCoordinator(db, new DigitalFileStorageService([provider]), journal);
    expect(value(await recreated.recover('first'))).toEqual(persisted); expect(await attachments.count()).toBe(1);
  });
  it('ready file without linking receipt is recovered as unlinked, never assigned implicitly', async () => {
    ready('unlinked'); expect(value(await coordinator.recover('unlinked'))).toMatchObject({ state: 'stored' });
    expect(await attachments.count()).toBe(0); expect(await books.getById(book.id)).toEqual(book);
  });
  it('refuses book ID reuse with different UUID after interrupted link', async () => {
    db.failInsert = true; await coordinator.applyChange(request(ready('first'))); db.failInsert = false;
    await books.delete(book.id); await books.insert({ ...book, uuid: 'different-book-identity' });
    expect(await coordinator.recover('first')).toEqual(storageFailure('ATTACHMENT_CONFLICT'));
    expect(await attachments.count()).toBe(0);
  });
  it('never transfers or deletes ReaderPosition until a policy is explicitly decided', async () => {
    const first = value(await coordinator.applyChange(request(ready('first'))));
    const positions = new ReaderPositionRepository(db); const position = await positions.savePosition({ attachmentId: first.id, locationType: 'epub_cfi', location: 'epubcfi(/6/2)' });
    expect(await coordinator.applyChange(request(ready('second', 'pdf'), first.id))).toEqual(storageFailure('POSITION_POLICY_REQUIRED'));
    expect(await coordinator.detach({ attachmentId: first.id, intent: 'detach-only' })).toEqual(storageFailure('POSITION_POLICY_REQUIRED'));
    expect(await positions.getByAttachmentId(first.id)).toEqual(position); expect(await attachments.getById(first.id)).toEqual(first);
  });
  it.each([
    ['epub', 'epub_cfi', 'epubcfi(/6/2)'], ['pdf', 'pdf_page', '12'], ['mp3', 'audio_seconds', '42'],
  ] as const)('identical %s preserves the attachment identity and exact current position', async (format, locationType, location) => {
    const first = value(await coordinator.applyChange(request(ready('first', format))));
    const positions = new ReaderPositionRepository(db);
    const position = await positions.savePosition({ attachmentId: first.id, locationType, location });
    const next = value(await coordinator.applyChange(request(ready('same', format), first.id)));
    expect(next.id).toBe(first.id); expect(next.storageReference).not.toBe(first.storageReference);
    expect(await positions.getByAttachmentId(next.id)).toEqual(position);
    expect(await attachments.count()).toBe(1);
    expect(value(await coordinator.recover('same'))).toEqual(next);
    expect(value(await coordinator.listRetainedFiles())).toHaveLength(1);
  });
  it.each([
    ['epub', 'epub_cfi', 'epubcfi(/6/2)'], ['pdf', 'pdf_page', '12'], ['m4b', 'audio_seconds', '42'],
  ] as const)('different %s invalidates only after explicit confirmation and preserves reading history', async (format, locationType, location) => {
    const first = value(await coordinator.applyChange(request(ready('first', format))));
    const otherFormat = format === 'm4b' ? 'epub' : 'm4b';
    const other = value(await coordinator.applyChange(request(ready('other', otherFormat))));
    const positions = new ReaderPositionRepository(db);
    const position = await positions.savePosition({ attachmentId: first.id, locationType, location });
    const sessions = new ReadingSessionRepository(db);
    const session = await sessions.create({ bookId: book.id });
    const progressRepo = new ReadingProgressRepository(db);
    const progress = await progressRepo.saveProgress({ sessionId: session.id, unit: 'pages', currentValue: 10, totalValue: 100, source: 'manual' });
    const secondBase = ready('different', format);
    const second: StoredDigitalFile = { ...secondBase, integrity: { ...secondBase.integrity,
      checksum: { algorithm: 'sha256', value: 'b'.repeat(64) } } };
    provider.files.set(second.file.storageReference, second); journal.seed(second);
    const change = request(second, first.id);
    expect(await coordinator.applyChange(change)).toEqual(storageFailure('POSITION_POLICY_REQUIRED'));
    expect(await positions.getByAttachmentId(first.id)).toEqual(position);
    const confirmed = { ...change, positionDecision: 'invalidate-current' as const };
    db.failCommit = true;
    expect(await coordinator.applyChange(confirmed)).toEqual(storageFailure('LINK_PERSISTENCE_FAILED'));
    expect(await positions.getByAttachmentId(first.id)).toEqual(position);
    expect(await attachments.getById(first.id)).toEqual(first);
    db.failCommit = false; db.failInsert = true;
    expect(await coordinator.recover('different')).toEqual(storageFailure('LINK_PERSISTENCE_FAILED'));
    expect(await positions.getByAttachmentId(first.id)).toEqual(position);
    db.failInsert = false;
    const next = value(await coordinator.recover('different'));
    expect('id' in next && next.id).not.toBe(first.id);
    expect(await positions.getByAttachmentId(first.id)).toBeNull();
    expect(await positions.count()).toBe(0);
    expect(await attachments.getById(other.id)).toEqual(other);
    expect(await sessions.getById(session.id)).toEqual(session);
    expect(await progressRepo.getBySessionId(session.id)).toEqual(progress);
    expect(await books.getById(book.id)).toEqual(book);
    value(await coordinator.recover('different')); expect(await attachments.count()).toBe(2);
  });
  it('identical replacement rollback preserves both IDs and position, then reconciles a committed journal failure', async () => {
    const first = value(await coordinator.applyChange(request(ready('first'))));
    const positions = new ReaderPositionRepository(db);
    const position = await positions.savePosition({ attachmentId: first.id, locationType: 'epub_cfi', location: 'epubcfi(/6/2)' });
    db.failUpdate = true;
    expect(await coordinator.applyChange(request(ready('same'), first.id))).toEqual(storageFailure('LINK_PERSISTENCE_FAILED'));
    expect(await positions.getByAttachmentId(first.id)).toEqual(position);
    expect(await attachments.getById(first.id)).toEqual(first);
    db.failUpdate = false; journal.failCompletion = true;
    expect(await coordinator.recover('same')).toEqual(storageFailure('RECOVERY_REQUIRED'));
    journal.failCompletion = false; value(await coordinator.recover('same'));
    expect(await positions.getByAttachmentId(first.id)).toEqual(position);
    expect(await attachments.count()).toBe(1);
  });
  it('explicit detach removes only the selected link/current position and rolls back on commit failure', async () => {
    const first = value(await coordinator.applyChange(request(ready('first'))));
    const other = value(await coordinator.applyChange(request(ready('other', 'mp3'))));
    const positions = new ReaderPositionRepository(db);
    const position = await positions.savePosition({ attachmentId: first.id, locationType: 'epub_cfi', location: 'epubcfi(/6/2)' });
    const sessions = new ReadingSessionRepository(db); const session = await sessions.create({ bookId: book.id });
    const detach = { attachmentId: first.id, intent: 'detach-only' as const, positionDecision: 'remove-current' as const };
    db.failCommit = true; expect((await coordinator.detach(detach)).status).toBe('error');
    expect(await positions.getByAttachmentId(first.id)).toEqual(position); expect(await attachments.getById(first.id)).toEqual(first);
    db.failCommit = false; value(await coordinator.detach(detach)); value(await coordinator.detach(detach));
    expect(await positions.getByAttachmentId(first.id)).toBeNull(); expect(await attachments.getById(other.id)).toEqual(other);
    expect(await sessions.getById(session.id)).toEqual(session); expect(await books.getById(book.id)).toEqual(book);
    expect(provider.deleteManagedFile).not.toHaveBeenCalled();
  });
  it('recovery of an unlinked receipt checks availability instead of trusting stored metadata', async () => {
    ready('unlinked'); provider.verifyIntegrity.mockResolvedValueOnce(storageFailure('PERMISSION_REVOKED'));
    expect(await coordinator.recover('unlinked')).toEqual(storageFailure('PERMISSION_REVOKED'));
    expect(journal.records.get('unlinked')?.stored).toBeDefined();
  });
  it('replacement keeps deliberate reading session history', async () => {
    const first = value(await coordinator.applyChange(request(ready('first'))));
    const sessions = new ReadingSessionRepository(db); const session = await sessions.create({ bookId: book.id });
    value(await coordinator.applyChange(request(ready('second', 'pdf'), first.id)));
    expect(await sessions.getById(session.id)).toEqual(session);
  });
  it('rejects simultaneous writes to the same slot', async () => {
    let release!: () => void; const held = new Promise<void>((r) => { release = r; });
    let entered!: () => void; const start = new Promise<void>((r) => { entered = r; });
    provider.verifyIntegrity.mockImplementationOnce(async (_file, integrity) => { entered(); await held; return storageSuccess(integrity); });
    const first = coordinator.applyChange(request(ready('first'))); await start;
    expect(await coordinator.applyChange(request(ready('second')))).toEqual(storageFailure('OPERATION_CONFLICT'));
    release(); value(await first); expect(await attachments.count()).toBe(1);
  });
  it('rechecks actual current reference after verification before replacing', async () => {
    const first = value(await coordinator.applyChange(request(ready('first'))));
    provider.verifyIntegrity.mockImplementationOnce(async (_file, integrity) => {
      await attachments.update({ ...first, storageReference: 'concurrently-replaced' }); return storageSuccess(integrity);
    });
    expect(await coordinator.applyChange(request(ready('second'), first.id))).toEqual(storageFailure('ATTACHMENT_CONFLICT'));
    expect((await attachments.getById(first.id))?.storageReference).toBe('concurrently-replaced');
  });
  it('verifies integrity before creating SQLite metadata', async () => {
    provider.verifyIntegrity.mockResolvedValueOnce(storageFailure('INTEGRITY_MISMATCH'));
    expect(await coordinator.applyChange(request(ready('first')))).toEqual(storageFailure('INTEGRITY_MISMATCH'));
    expect(await attachments.count()).toBe(0); expect(journal.records.get('first')?.state).toBe('LINKING');
  });
  it('operation receipt cannot be redirected to another book', async () => {
    db.failInsert = true; const stored = ready('first'); await coordinator.applyChange(request(stored)); db.failInsert = false;
    const other = await books.insert({ ...book, id: 2, uuid: 'other-uuid' });
    expect(await coordinator.applyChange({ ...request(stored), bookId: other.id })).toEqual(storageFailure('OPERATION_CONFLICT'));
    expect(await attachments.count()).toBe(0);
  });
  it('detaching removes only metadata; retains source/managed bytes and Book fields', async () => {
    const current = value(await coordinator.applyChange(request(ready('first'))));
    value(await coordinator.detach({ attachmentId: current.id, intent: 'detach-only' }));
    expect(await attachments.count()).toBe(0); expect(provider.files.has(current.storageReference)).toBe(true);
    expect(provider.deleteManagedFile).not.toHaveBeenCalled(); expect(await books.getById(book.id)).toEqual(book);
  });
  it('fails closed on malformed native journal context and strips private payload', () => {
    expect(() => normalizeOperation({ operationId: 'one', state: 'unknown' })).toThrow();
    const source = ready('first');
    const clean = normalizeOperation({ ...journal.records.get('first')!, uri: 'content://private' });
    expect(JSON.stringify(clean)).not.toContain('content://'); expect(clean.stored).toEqual(source);
  });
  it('does not trust a caller changing the format of a verified journal receipt', async () => {
    const stored = ready('verified-epub');
    const forged: StoredDigitalFile = { ...stored, metadata: { ...stored.metadata, filename: 'synthetic.pdf', format: 'pdf', mimeType: 'application/pdf' } };
    expect(await coordinator.applyChange(request(forged))).toEqual(storageFailure('RECOVERY_REQUIRED'));
    expect(await attachments.count()).toBe(0);
  });
  it('a source selection cannot be passed as a confirmed stored file', async () => {
    expect(await coordinator.applyChange({ bookId: book.id, type: 'ebook', intent: 'attach',
      imported: provider.selection as unknown as StoredDigitalFile })).toEqual(storageFailure('INVALID_FILE'));
    expect(await attachments.count()).toBe(0);
  });
});
