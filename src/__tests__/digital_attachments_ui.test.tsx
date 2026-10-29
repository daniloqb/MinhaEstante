import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttachmentsPresentation, attachmentsPresentation } from '../services/storage/digital/attachmentsPresentation';
import { composeDigitalLibrary } from '../services/storage/digital/composeDigitalLibrary';
import { storageFailure, storageSuccess } from '../services/storage/digital/errors';
import { attachmentsDevEnabled } from '../services/storage/digital/attachmentsDevGate';
import { DatabaseService } from '../services/database/databaseService';
import { BookRepository } from '../services/database/bookRepository';
import { BookAttachmentRepository } from '../services/database/bookAttachmentRepository';
import { ReadingSessionRepository } from '../services/database/readingSessionRepository';
import { ReadingProgressRepository } from '../services/database/readingProgressRepository';
import { ReaderPositionRepository } from '../services/database/readerPositionRepository';
import { DigitalStorageTestProvider } from './helpers/DigitalStorageTestProvider';
import type { AttachmentLinkIntent, StorageOperationSnapshot } from '../services/storage/digital/operations';
import type { DigitalLibrary } from '../services/storage/digital/composeDigitalLibrary';
import type { StorageResult } from '../services/storage/digital/contracts';
import type { AttachmentFormat, BookAttachment } from '../types/digitalMedia';
import type { BookFormat } from '../types/book';
import { DigitalAttachmentsView, attachmentProgress } from '../components/DigitalAttachmentsSection';
import { DarkWalnutPalette } from '../theme/woodTheme';
import { AVAILABLE_LOCALES } from '../i18n/types';
import { TRANSLATIONS } from '../i18n/translations';
import type { IDatabaseService } from '../services/database/types';
import { TransactionalSqliteTestDatabase } from './helpers/TransactionalSqliteTestDatabase';

async function setup(formats: BookFormat[] = ['fisico'], db: IDatabaseService = DatabaseService.createTestInstance()) {
  const books = new BookRepository(db);
  const inserted = await books.insert({ origem: 'manual', titulo: 'UI synthetic', autores: [], generos: [], formato: formats[0], formatos: formats,
    tenho_fisico: false, status_leitura: 'quero_ler', nota: 8, dataCadastro: 1, dataAtualizacao: 1 });
  const book = (await books.getById(inserted.id))!;
  const provider = new DigitalStorageTestProvider();
  const ops = new Map<string, StorageOperationSnapshot>();
  const importFile = provider.importFile.getMockImplementation()!;
  provider.importFile.mockImplementation(async (request, context) => {
    const result = await importFile(request, context);
    if (result.status === 'success') ops.set(request.operationId, { operationId: request.operationId, state: 'FILE_READY',
      type: request.type, format: request.format, bytesProcessed: result.value.integrity.sizeBytes, createdAt: 1, updatedAt: 1, stored: result.value });
    return result;
  });
  const getOperation = async (id: string) => {
    const stored = [...provider.files.values()].find(file => file.operationId === id);
    return stored ? storageSuccess(ops.get(id) ?? { operationId: id, state: 'FILE_READY' as const, type: stored.metadata.format === 'epub' || stored.metadata.format === 'pdf' ? 'ebook' as const : 'audiobook' as const,
      format: stored.metadata.format, bytesProcessed: stored.integrity.sizeBytes, createdAt: 1, updatedAt: 1, stored }) : storageFailure('INVALID_REFERENCE');
  };
  const p = Object.assign(provider, { getOperation,
    listOperations: vi.fn(async () => storageSuccess([...ops.values()])),
    recoverImport: vi.fn(async () => storageFailure('RECOVERY_REQUIRED')),
    beginAttachmentLink: async (id: string, linkContext: AttachmentLinkIntent) => {
      const op = await getOperation(id); if (op.status !== 'success') return op;
      const next = { ...op.value, state: 'LINKING' as const, linkContext }; ops.set(id, next); return storageSuccess(next);
    },
    completeImportOperation: vi.fn(async (id: string) => { ops.set(id, { ...ops.get(id)!, state: 'COMPLETED' }); return storageSuccess(undefined); }),
  });
  const library = composeDigitalLibrary(db, p);
  let factory: () => Promise<StorageResult<DigitalLibrary>> = async () => storageSuccess(library);
  const presentation = new AttachmentsPresentation(book, db, () => factory());
  await presentation.refresh();
  return { db, book, provider: p, library, presentation, ops, setFactory: (fn: typeof factory) => { factory = fn; },
    select: (format: string) => { p.selection = { ...p.selection, filename: `synthetic.${format}` }; },
    reopen: () => new AttachmentsPresentation(book, db, async () => storageSuccess(library)),
  };
}
function markup(state: ReturnType<AttachmentsPresentation['getSnapshot']>, locale = AVAILABLE_LOCALES[0].id) {
  const t = TRANSLATIONS[locale];
  return renderToStaticMarkup(<DigitalAttachmentsView state={state} palette={DarkWalnutPalette} locale={locale} t={t.attachments} loadingText={t.common.loading}
    onAdd={() => {}} onConfigure={() => {}} onCancel={() => {}} onRefresh={() => {}} onReplace={() => {}} onDetach={() => {}}
    onVerify={() => {}} onRecover={() => {}} onConfirm={() => {}} onDismiss={() => {}} />);
}
afterEach(() => vi.useRealTimers());
describe('attachments UI adapter and actual React server rendering (simulated backend, not physical SAF)', () => {
  it('renders both empty slots and the backup limitation before import', async () => {
    const h = await setup(), html = markup(h.presentation.getSnapshot());
    expect(html).toContain('Nenhum e-book anexado'); expect(html).toContain('Nenhum audiolivro anexado');
    expect(html).toContain(TRANSLATIONS['pt-BR'].attachments.backupNotice);
    expect(html).not.toMatch(/Ler agora|Reproduzir|Substituir|Desassociar/);
  });
  it.each(['epub','pdf','mp3','m4a','m4b'])('imports and displays %s with the existing coordinator and a persisted link', async format => {
    const h = await setup(); h.select(format); await h.presentation.add(['epub','pdf'].includes(format) ? 'ebook' : 'audiobook');
    const s = h.presentation.getSnapshot(); expect(s.feedback?.kind).toBe('success'); expect(s.items).toHaveLength(1);
    expect(s.items[0].integrity).toBe('verified'); expect(markup(s)).toContain(`synthetic.${format}`);
    expect(await new BookAttachmentRepository(h.db).count()).toBe(1); expect(h.provider.verifyIntegrity).toHaveBeenCalled();
  });
  it('keeps both slots independent and prevents an add from replacing an occupied slot', async () => {
    const h = await setup(); await h.presentation.add('ebook'); h.select('mp3'); await h.presentation.add('audiobook');
    const html = markup(h.presentation.getSnapshot()); expect(h.presentation.getSnapshot().items).toHaveLength(2);
    expect(html).not.toContain('Adicionar e-book'); expect(html).not.toContain('Adicionar audiolivro');
    expect(h.provider.interaction.selectSource).toHaveBeenCalledTimes(2);
    await h.presentation.add('ebook'); expect(h.provider.interaction.selectSource).toHaveBeenCalledTimes(2);
  });
  it('dispatches selection synchronously in the click and prevents duplicate clicks', async () => {
    const h = await setup(); let finish!: (value: StorageResult<any>) => void;
    h.provider.interaction.selectSource.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = h.presentation.add('ebook'); expect(h.provider.interaction.selectSource).toHaveBeenCalledTimes(1);
    await h.presentation.add('ebook'); expect(h.provider.interaction.selectSource).toHaveBeenCalledTimes(1);
    finish(storageFailure('USER_CANCELLED')); await first;
    expect(h.presentation.getSnapshot().feedback?.kind).toBe('cancelled'); expect(h.provider.importFile).not.toHaveBeenCalled();
  });
  it('configures through the existing service and handles cancelled configuration', async () => {
    const h = await setup(); h.provider.configuration = { state: 'not-configured' }; await h.presentation.refresh();
    await h.presentation.add('ebook'); expect(h.provider.interaction.selectSource).not.toHaveBeenCalled();
    h.provider.interaction.requestConfiguration.mockResolvedValueOnce(storageFailure('USER_CANCELLED'));
    await h.presentation.configure(); expect(h.presentation.getSnapshot().feedback?.kind).toBe('cancelled');
  });
  it.each(['INVALID_FILE','INTEGRITY_MISMATCH','INSUFFICIENT_SPACE','PERMISSION_REVOKED','PROVIDER_UNAVAILABLE'] as const)('shows safe feedback for %s without changing the book', async code => {
    const h = await setup(); h.provider.importFile.mockResolvedValueOnce(storageFailure(code));
    await h.presentation.add('ebook'); expect(h.presentation.getSnapshot().feedback).toEqual({ kind: 'error', code });
    expect(await new BookRepository(h.db).getById(h.book.id)).toEqual(h.book); expect(await new BookAttachmentRepository(h.db).count()).toBe(0);
    expect(markup(h.presentation.getSnapshot())).not.toContain(code);
  });
  it('handles provider initialization failure while preserving existing attachment metadata', async () => {
    const h = await setup(); await h.presentation.add('ebook');
    const p = new AttachmentsPresentation(h.book, h.db, async () => storageFailure('PROVIDER_UNAVAILABLE'));
    await p.refresh(); expect(p.getSnapshot().items[0].attachment.filename).toBe('synthetic.epub');
    expect(p.getSnapshot().supported).toBe(false); expect(p.getSnapshot().items[0].availability).toBe('unknown');
  });
  it('distinguishes a revoked permission from missing bytes without deleting metadata', async () => {
    const h = await setup(); await h.presentation.add('ebook'); h.provider.checkAccess.mockResolvedValueOnce(storageFailure('PERMISSION_REVOKED'));
    await h.presentation.refresh(); expect(h.presentation.getSnapshot().items[0].availability).toBe('permission');
    h.provider.checkAccess.mockResolvedValueOnce(storageFailure('FILE_NOT_FOUND')); await h.presentation.refresh();
    expect(h.presentation.getSnapshot().items[0].availability).toBe('missing'); expect(await new BookAttachmentRepository(h.db).count()).toBe(1);
  });
  it('does not announce success on failed persistence or journal finalization', async () => {
    const h = await setup(); h.provider.completeImportOperation.mockResolvedValueOnce(storageFailure('RECOVERY_REQUIRED'));
    await h.presentation.add('ebook'); expect(h.presentation.getSnapshot().feedback?.kind).toBe('pending');
    expect(h.presentation.getSnapshot().pending).toContain('ebook'); expect(markup(h.presentation.getSnapshot())).not.toContain(TRANSLATIONS['pt-BR'].attachments.completed);
    await h.library.coordinator.recover([...h.ops.keys()][0]); await h.presentation.refresh();
    expect(h.presentation.getSnapshot().pending).toEqual([]); expect(h.presentation.getSnapshot().items).toHaveLength(1);
  });
  it('preserves old metadata when the coordinator rejects persistence', async () => {
    const h = await setup(); vi.spyOn(h.library.coordinator, 'applyChange').mockResolvedValueOnce(storageFailure('LINK_PERSISTENCE_FAILED'));
    await h.presentation.add('ebook'); expect(h.presentation.getSnapshot().feedback?.kind).toBe('pending');
    expect(await new BookAttachmentRepository(h.db).count()).toBe(0); expect(h.provider.deleteManagedFile).not.toHaveBeenCalled();
  });
  it('represents known and unknown progress without inventing percentages', async () => {
    const h = await setup(); const state = { ...h.presentation.getSnapshot(), busy: { type: 'ebook' as const, stage: 'copying' as const, progress: { operationId: 'test', stage: 'copying' as const, bytesProcessed: 1024, totalBytes: 2048 } } };
    expect(attachmentProgress(state)).toBe(50); expect(markup(state)).toContain('50%'); expect(markup(state)).toContain('value="50"');
    const unknown = { ...state, busy: { ...state.busy, progress: { ...state.busy.progress, totalBytes: undefined } } };
    expect(attachmentProgress(unknown)).toBeUndefined(); expect(markup(unknown)).not.toContain('value='); expect(markup(unknown)).not.toContain('%');
  });
  it('cancels an active import through AbortSignal and keeps responsive state across unsubscribe', async () => {
    const h = await setup(); let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
    h.provider.importFile.mockImplementationOnce(async (_request, context) => {
      entered(); return new Promise(resolve => context?.signal?.addEventListener('abort', () => resolve(storageFailure('OPERATION_CANCELLED')), { once: true }));
    });
    const unsubscribe = h.presentation.subscribe(() => {}), work = h.presentation.add('ebook'); await started; unsubscribe();
    expect(h.presentation.getSnapshot().busy).toBeDefined(); h.presentation.cancel(); await work;
    expect(h.presentation.getSnapshot().feedback?.kind).toBe('cancelled'); expect(await new BookAttachmentRepository(h.db).count()).toBe(0);
  });
  it('reopens using persisted rows and does not recompute SHA on refresh', async () => {
    const h = await setup(); await h.presentation.add('ebook'); const checks = h.provider.verifyIntegrity.mock.calls.length;
    const p = h.reopen(); await p.refresh(); await p.refresh();
    expect(p.getSnapshot().items[0].attachment).toEqual(h.presentation.getSnapshot().items[0].attachment);
    expect(p.getSnapshot().items[0].integrity).toBe('recorded'); expect(h.provider.verifyIntegrity).toHaveBeenCalledTimes(checks);
  });
  it('blocks operations tied to this book pending startup reconciliation, without starting another recovery', async () => {
    const h = await setup(); h.ops.set('pending', { operationId: 'pending', state: 'LINKING', format: 'epub', type: 'ebook', bytesProcessed: 1, createdAt: 1, updatedAt: 1,
      linkContext: { version: 1, bookId: h.book.id, bookUuid: h.book.uuid!, type: 'ebook', intent: 'attach', attachmentId: 'synthetic' } });
    await h.presentation.refresh(); await h.presentation.add('ebook'); expect(h.provider.interaction.selectSource).not.toHaveBeenCalled();
    expect(h.provider.recoverImport).not.toHaveBeenCalled(); expect(h.presentation.getSnapshot().pending).toEqual(['ebook']);
  });
  it.each(([['fisico'],['audiolivro'],['ebook','audiolivro']] as BookFormat[][]).map(formats => ({ formats })))('preserves complete book and deliberate history for modalities $formats', async ({ formats }) => {
    const h = await setup(formats); h.select(formats[0] === 'audiolivro' ? 'pdf' : formats.length > 1 ? 'mp3' : 'epub');
    const sessions = new ReadingSessionRepository(h.db);
    const session = await sessions.create({ bookId: h.book.id, startedAt: 1 });
    await sessions.complete(session.id, 2);
    const history = await sessions.getHistoryByBookId(h.book.id);
    await h.presentation.add(formats.length > 1 ? 'audiobook' : 'ebook');
    expect(await new BookRepository(h.db).getById(h.book.id)).toEqual(h.book);
    expect(await sessions.getHistoryByBookId(h.book.id)).toEqual(history);
  });
  it('refuses a preview, missing identity or stale UUID without creating partial books', async () => {
    const h = await setup(); const p = new AttachmentsPresentation({ id: h.book.id, uuid: 'stale' }, h.db, async () => storageSuccess(h.library));
    await p.refresh(); await p.add('ebook'); expect(p.getSnapshot().persisted).toBe(false); expect(h.provider.interaction.selectSource).not.toHaveBeenCalled();
  });
  it('handles a concurrent slot occupation after selection with no implicit replacement', async () => {
    const h = await setup();
    const stale = h.reopen(); await stale.refresh();
    await h.presentation.add('ebook'); const before = h.presentation.getSnapshot().items[0].attachment;
    await stale.add('ebook');
    expect(stale.getSnapshot().feedback).toEqual({ kind: 'error', code: 'ATTACHMENT_CONFLICT' });
    expect(h.provider.importFile).toHaveBeenCalledTimes(1);
    expect((await new BookAttachmentRepository(h.db).getByBookAndType(h.book.id, 'ebook'))).toEqual(before);
  });
  it('blocks a link if the book identity changes during the file copy', async () => {
    const h = await setup(), importFile = h.provider.importFile.getMockImplementation()!;
    h.provider.importFile.mockImplementationOnce(async (request, context) => {
      const result = await importFile(request, context);
      const books = new BookRepository(h.db);
      await books.delete(h.book.id);
      await books.insert({ ...h.book, uuid: crypto.randomUUID() });
      return result;
    });
    const link = vi.spyOn(h.library.coordinator, 'applyChange');
    await h.presentation.add('ebook');
    expect(link).not.toHaveBeenCalled();
    expect(await new BookAttachmentRepository(h.db).count()).toBe(0);
    expect(h.presentation.getSnapshot().persisted).toBe(false);
    expect(h.provider.deleteManagedFile).not.toHaveBeenCalled();
  });
  it('disables writes after a refresh failure and allows a later successful retry', async () => {
    const h = await setup(), query = vi.spyOn(h.db, 'query');
    query.mockRejectedValueOnce(new Error('private database failure'));
    await h.presentation.refresh();
    await h.presentation.add('ebook'); await h.presentation.configure();
    expect(h.presentation.getSnapshot().supported).toBe(false);
    expect(h.provider.interaction.selectSource).not.toHaveBeenCalled();
    expect(h.provider.interaction.requestConfiguration).not.toHaveBeenCalled();
    await h.presentation.refresh(); await h.presentation.add('ebook');
    expect(h.presentation.getSnapshot().feedback?.kind).toBe('success');
  });
  it.each(AVAILABLE_LOCALES)('renders localized labels and safe error feedback in $id', async ({ id }) => {
    const h = await setup(); const html = markup(h.presentation.getSnapshot(), id), text = TRANSLATIONS[id].attachments;
    expect(html).toContain(text.title); expect(html).toContain(text.addEbook); expect(html).toContain('focus-visible:outline'); expect(html).toContain('min-h-11');
    expect(Object.keys(text)).toEqual(Object.keys(TRANSLATIONS['pt-BR'].attachments)); expect(Object.values(text).every(Boolean)).toBe(true);
  });
  it('sanitizes unexpected failures without publishing private paths or exception messages', async () => {
    const h = await setup(); h.provider.importFile.mockRejectedValueOnce(new Error('content://private-do-not-expose'));
    await h.presentation.add('ebook'); expect(markup(h.presentation.getSnapshot())).not.toContain('content://');
  });
});
async function occupied(format: AttachmentFormat = 'epub', db?: IDatabaseService) {
  const h = await setup(undefined, db); h.select(format);
  const type = format === 'epub' || format === 'pdf' ? 'ebook' as const : 'audiobook' as const;
  await h.presentation.add(type);
  const row = (await new BookAttachmentRepository(h.db).getByBookAndType(h.book.id, type))!;
  const positions = new ReaderPositionRepository(h.db);
  const position = await positions.savePosition({ attachmentId: row.id,
    locationType: format === 'epub' ? 'epub_cfi' : format === 'pdf' ? 'pdf_page' : 'audio_seconds',
    location: format === 'epub' ? 'epubcfi(/6/2)' : '12' });
  const sessions = new ReadingSessionRepository(h.db), progresses = new ReadingProgressRepository(h.db);
  const session = await sessions.create({ bookId: h.book.id, startedAt: 1 });
  const progress = await progresses.saveProgress({ sessionId: session.id, unit: 'pages', currentValue: 10, totalValue: 100, source: 'manual' });
  const snapshot = async () => ({ book: await new BookRepository(h.db).getById(h.book.id), rows: await new BookAttachmentRepository(h.db).getByBookId(h.book.id),
    position: await positions.getByAttachmentId(row.id), history: await sessions.getHistoryByBookId(h.book.id), progress: await progresses.getBySessionId(session.id) });
  return { ...h, type, row, positions, position, session, progress, snapshot };
}
function differentNext(h: Awaited<ReturnType<typeof setup>>) {
  const original = h.provider.importFile.getMockImplementation()!;
  h.provider.importFile.mockImplementationOnce(async (request, context) => {
    const result = await original(request, context);
    if (result.status !== 'success') return result;
    const stored = { ...result.value, integrity: { ...result.value.integrity, checksum: { algorithm: 'sha256' as const, value: 'b'.repeat(64) } } };
    h.provider.files.set(stored.file.storageReference, stored);
    h.ops.set(request.operationId, { ...h.ops.get(request.operationId)!, stored });
    return storageSuccess(stored);
  });
}
function failNextCommit(h: Awaited<ReturnType<typeof setup>>) {
  if (!(h.db instanceof TransactionalSqliteTestDatabase)) throw Error('Rollback requires transactional SQLite');
  const db = h.db; db.failCommit = true; return () => { db.failCommit = false; };
}
describe('3.2 management through the existing coordinator (simulated storage, real repository semantics)', () => {
  it('shows management only for occupied categories', async () => {
    const h = await occupied(), html = markup(h.presentation.getSnapshot());
    for (const key of ['manage','replace','verify','detach'] as const) expect(html).toContain(TRANSLATIONS['pt-BR'].attachments[key]);
    expect((html.match(/<details/g) ?? []).length).toBe(1);
    expect(html).toContain('Adicionar audiolivro');
  });
  it('cancels the replacement picker without preparing or changing anything', async () => {
    const h = await occupied(), before = await h.snapshot(), count = h.provider.importFile.mock.calls.length;
    h.provider.interaction.selectSource.mockResolvedValueOnce(storageFailure('USER_CANCELLED'));
    await h.presentation.replace(h.type);
    expect(await h.snapshot()).toEqual(before); expect(h.provider.importFile).toHaveBeenCalledTimes(count);
    expect(h.presentation.getSnapshot().feedback?.kind).toBe('cancelled');
  });
  it('dispatches the replacement picker immediately and blocks competing actions and clicks', async () => {
    const h = await occupied(); let resolve!: (r: StorageResult<any>) => void;
    h.provider.interaction.selectSource.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const work = h.presentation.replace(h.type);
    expect(h.provider.interaction.selectSource).toHaveBeenCalledTimes(2);
    await h.presentation.replace(h.type); await h.presentation.requestDetach(h.type); await h.presentation.verify(h.type);
    expect(h.provider.interaction.selectSource).toHaveBeenCalledTimes(2);
    expect(attachmentsPresentation(h.book)).toBe(h.presentation);
    resolve(storageFailure('USER_CANCELLED')); await work;
  });
  it('cancels a prepared replacement without an automatic link or physical compensation on startup', async () => {
    const h = await occupied(), before = await h.snapshot(); differentNext(h);
    await h.presentation.replace(h.type);
    expect(h.presentation.getSnapshot().confirmation?.kind).toBe('replace'); expect(await h.snapshot()).toEqual(before);
    const prepared = [...h.ops.values()].find(o => o.state === 'FILE_READY')!;
    expect(prepared.linkContext).toBeUndefined(); h.presentation.cancelConfirmation();
    await h.library.initialize();
    expect(await h.snapshot()).toEqual(before); expect(h.ops.get(prepared.operationId)?.state).toBe('FILE_READY');
    expect(h.provider.deleteManagedFile).not.toHaveBeenCalled();
  });
  it.each(['epub','pdf','mp3','m4a','m4b'] as const)('preserves compatible %s position, ID and deliberate history for identical bytes', async format => {
    const h = await occupied(format), before = await h.snapshot();
    await h.presentation.replace(h.type);
    const c = h.presentation.getSnapshot().confirmation;
    expect(c?.kind === 'replace' && c.identical).toBe(true);
    await h.presentation.confirm();
    const after = await h.snapshot(); expect(after.position).toEqual(before.position);
    expect(after.rows[0].id).toBe(h.row.id); expect(after.rows[0].storageReference).not.toBe(h.row.storageReference);
    expect(after.book).toEqual(before.book); expect(after.history).toEqual(before.history); expect(after.progress).toEqual(before.progress);
    expect(h.provider.deleteManagedFile).not.toHaveBeenCalled();
  });
  it.each(['epub','pdf','mp3'] as const)('invalidates only the saved %s position after different content is confirmed', async format => {
    const h = await occupied(format), before = await h.snapshot(); differentNext(h);
    await h.presentation.replace(h.type);
    expect(await h.snapshot()).toEqual(before);
    expect(markup(h.presentation.getSnapshot())).toContain(TRANSLATIONS['pt-BR'].attachments.positionInvalidated);
    await h.presentation.confirm(); const after = await h.snapshot();
    expect(after.position).toBeNull(); expect(after.rows[0].id).not.toBe(h.row.id);
    expect(after.book).toEqual(before.book); expect(after.history).toEqual(before.history); expect(after.progress).toEqual(before.progress);
    expect(h.provider.files.has(h.row.storageReference)).toBe(true);
  });
  it('treats unproven equivalence conservatively', async () => {
    const h = await occupied(); await new BookAttachmentRepository(h.db).update({ ...h.row, checksum: null }); await h.presentation.refresh();
    await h.presentation.replace(h.type);
    const confirmation = h.presentation.getSnapshot().confirmation;
    expect(confirmation?.kind === 'replace' && confirmation.identical).toBe(false);
    await h.presentation.confirm(); expect(await h.positions.getByAttachmentId(h.row.id)).toBeNull();
  });
  it('preserves the other slot and the old position on native-style transaction rollback', async () => {
    const db = new TransactionalSqliteTestDatabase(), h = await occupied('epub', db); h.select('mp3'); await h.presentation.add('audiobook'); h.select('epub');
    const before = await h.snapshot(); differentNext(h); await h.presentation.replace(h.type); const reset = failNextCommit(h);
    await h.presentation.confirm();
    expect(await h.snapshot()).toEqual(before); expect(h.presentation.getSnapshot().feedback?.kind).toBe('pending');
    expect(h.provider.deleteManagedFile).not.toHaveBeenCalled();
    reset(); await h.presentation.recover(h.type);
    const after = await h.snapshot(); expect(after.position).toBeNull();
    expect(after.rows.find(r => r.type === 'audiobook')).toEqual(before.rows.find(r => r.type === 'audiobook'));
    expect(after.history).toEqual(before.history); expect(after.progress).toEqual(before.progress);
    await db.close();
  });
  it('keeps old metadata on import failure after the user selects a replacement', async () => {
    const h = await occupied(), before = await h.snapshot(); h.provider.importFile.mockResolvedValueOnce(storageFailure('INSUFFICIENT_SPACE'));
    await h.presentation.replace(h.type); expect(await h.snapshot()).toEqual(before); expect(h.presentation.getSnapshot().confirmation).toBeUndefined();
  });
  it('requires an explicit detach confirmation and preserves the old state on cancel', async () => {
    const h = await occupied(), before = await h.snapshot(); await h.presentation.requestDetach(h.type);
    expect(h.presentation.getSnapshot().confirmation?.hasPosition).toBe(true);
    expect(markup(h.presentation.getSnapshot())).toContain(TRANSLATIONS['pt-BR'].attachments.positionRemoved);
    h.presentation.cancelConfirmation(); expect(await h.snapshot()).toEqual(before);
  });
  it('detaches one slot without physical deletion or any bibliographic/history changes', async () => {
    const h = await occupied(); h.select('mp3'); await h.presentation.add('audiobook'); const before = await h.snapshot();
    await h.presentation.requestDetach('ebook'); await h.presentation.confirm(); const after = await h.snapshot();
    expect(after.position).toBeNull(); expect(after.rows).toEqual(before.rows.filter(r => r.type === 'audiobook'));
    expect(after.book).toEqual(before.book); expect(after.history).toEqual(before.history); expect(after.progress).toEqual(before.progress);
    expect(h.presentation.getSnapshot().feedback?.message).toBe('detached'); expect(h.provider.deleteManagedFile).not.toHaveBeenCalled();
    expect(h.provider.files.has(h.row.storageReference)).toBe(true);
  });
  it('detaches without a position and reports rollback without hiding a still-persisted link', async () => {
    const db = new TransactionalSqliteTestDatabase(), h = await occupied('epub', db); await h.positions.deleteByAttachmentId(h.row.id); const before = await h.snapshot();
    await h.presentation.requestDetach(h.type); expect(h.presentation.getSnapshot().confirmation?.hasPosition).toBe(false);
    const reset = failNextCommit(h); await h.presentation.confirm();
    expect(await h.snapshot()).toEqual(before); expect(h.presentation.getSnapshot().items).toHaveLength(1);
    reset(); await h.presentation.requestDetach(h.type); await h.presentation.confirm(); expect((await h.snapshot()).rows).toEqual([]); await db.close();
  });
  it('ignores a second confirmation while the first one is in flight', async () => {
    const h = await occupied(); await h.presentation.replace(h.type);
    const apply = vi.spyOn(h.library.coordinator, 'applyChange');
    await Promise.all([h.presentation.confirm(), h.presentation.confirm()]); expect(apply).toHaveBeenCalledTimes(1);
  });
  it.each(['replace','detach'] as const)('rejects a stale %s confirmation after the same ID receives another reference', async kind => {
    const h = await occupied();
    if (kind === 'replace') await h.presentation.replace(h.type); else await h.presentation.requestDetach(h.type);
    const repo = new BookAttachmentRepository(h.db);
    await repo.update({ ...h.row, storageReference: 'another-reference', updatedAt: h.row.updatedAt + 1 });
    const before = await h.snapshot(); await h.presentation.confirm();
    expect(h.presentation.getSnapshot().feedback?.code).toBe('ATTACHMENT_CONFLICT'); expect(await h.snapshot()).toEqual(before);
  });
  it('rejects a book UUID change while a confirmation is open', async () => {
    const h = await occupied(); await h.presentation.requestDetach(h.type);
    await new BookRepository(h.db).delete(h.book.id); await new BookRepository(h.db).insert({ ...h.book, uuid: crypto.randomUUID() });
    const detach = vi.spyOn(h.library.coordinator, 'detach'); await h.presentation.confirm(); expect(detach).not.toHaveBeenCalled();
  });
  it('does not silently remove a position created after a no-position confirmation', async () => {
    const h = await occupied(); await h.positions.deleteByAttachmentId(h.row.id); await h.presentation.requestDetach(h.type);
    await h.positions.savePosition({ attachmentId: h.row.id, locationType: 'epub_cfi', location: 'epubcfi(/6/4)' });
    await h.presentation.confirm(); expect(h.presentation.getSnapshot().feedback?.code).toBe('POSITION_POLICY_REQUIRED');
    expect(await new BookAttachmentRepository(h.db).getById(h.row.id)).not.toBeNull();
  });
  it('verifies only on explicit action and distinguishes access from checksum evidence', async () => {
    const h = await occupied(), before = await h.snapshot(), initial = h.provider.verifyIntegrity.mock.calls.length;
    await h.presentation.refresh(); await h.presentation.refresh(); expect(h.provider.verifyIntegrity).toHaveBeenCalledTimes(initial);
    await h.presentation.verify(h.type); expect(h.presentation.getSnapshot().feedback?.message).toBe('checked');
    expect(h.provider.verifyIntegrity).toHaveBeenCalledTimes(initial + 1); expect(await h.snapshot()).toEqual(before);
    h.provider.capabilities = { ...h.provider.capabilities, available: { ...h.provider.capabilities.available, sha256: false } }; await h.presentation.verify(h.type);
    expect(h.presentation.getSnapshot().feedback?.message).toBe('accessible'); expect(h.provider.verifyIntegrity).toHaveBeenCalledTimes(initial + 1);
    expect(h.presentation.getSnapshot().items[0].integrity).toBe('recorded');
  });
  it.each(['FILE_NOT_FOUND','FILE_UNAVAILABLE','PERMISSION_REVOKED','PROVIDER_UNAVAILABLE','INTEGRITY_MISMATCH'] as const)('shows %s safely without removing the link', async code => {
    const h = await occupied(), before = await h.snapshot();
    if (code === 'INTEGRITY_MISMATCH') h.provider.verifyIntegrity.mockResolvedValueOnce(storageFailure(code));
    else h.provider.checkAccess.mockResolvedValueOnce(storageFailure(code));
    await h.presentation.verify(h.type);
    expect(h.presentation.getSnapshot().feedback?.code).toBe(code); expect(await h.snapshot()).toEqual(before);
    if (code === 'INTEGRITY_MISMATCH') expect(h.presentation.getSnapshot().items[0].integrity).toBe('failed');
    expect(h.provider.deleteManagedFile).not.toHaveBeenCalled();
  });
  it('cancels supported verification with AbortSignal without changing the attachment', async () => {
    const h = await occupied(), before = await h.snapshot(); let started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    h.provider.verifyIntegrity.mockImplementationOnce(async (_file, _expected, context) => {
      started(); return new Promise(resolve => context?.signal?.addEventListener('abort', () => resolve(storageFailure('OPERATION_CANCELLED')), { once: true }));
    });
    const work = h.presentation.verify(h.type); await entered; h.presentation.cancel(); await work;
    expect(h.presentation.getSnapshot().feedback?.kind).toBe('cancelled'); expect(await h.snapshot()).toEqual(before);
  });
  it('does not offer false permission repair or silently choose another folder', async () => {
    const h = await occupied(); h.provider.configuration = { ...h.provider.configuration, state: 'configured', permission: 'revoked', location: (h.provider.configuration as any).location };
    h.provider.checkAccess.mockResolvedValueOnce(storageFailure('PERMISSION_REVOKED')); await h.presentation.refresh();
    const html = markup(h.presentation.getSnapshot()); expect(html).toContain(TRANSLATIONS['pt-BR'].attachments.accessHelp);
    expect(html).not.toContain(TRANSLATIONS['pt-BR'].attachments.prepareHint); expect(h.provider.interaction.requestConfiguration).not.toHaveBeenCalled();
  });
  it('preserves new persisted rows after reopening without rehashing automatically', async () => {
    const h = await occupied(); differentNext(h); await h.presentation.replace(h.type); await h.presentation.confirm();
    const before = await h.snapshot(), count = h.provider.verifyIntegrity.mock.calls.length;
    const reopen = h.reopen(); await reopen.refresh(); expect(reopen.getSnapshot().items[0].attachment).toEqual(before.rows[0]);
    expect(h.provider.verifyIntegrity).toHaveBeenCalledTimes(count);
  });
  it.each(['uuid','reference','timestamp'] as const)('also enforces the expected %s inside the coordinator', async field => {
    const h = await occupied(), before = await h.snapshot(); await h.presentation.replace(h.type);
    const confirmation = h.presentation.getSnapshot().confirmation;
    if (confirmation?.kind !== 'replace') throw Error('Missing prepared replacement');
    const expected = (row: BookAttachment) => ({ expectedBookUuid: field === 'uuid' ? 'stale-uuid' : h.book.uuid,
      expectedAttachmentId: row.id, expectedStorageReference: field === 'reference' ? 'stale-reference' : row.storageReference,
      expectedProvider: row.storageProvider, expectedUpdatedAt: field === 'timestamp' ? row.updatedAt + 1 : row.updatedAt });
    const result = await h.library.coordinator.applyChange({ bookId: h.book.id, type: h.type, imported: confirmation.imported,
      intent: 'replace', ...expected(h.row) });
    expect(result.status === 'error' && result.error.code).toBe('ATTACHMENT_CONFLICT'); expect(await h.snapshot()).toEqual(before);
    const detach = await h.library.coordinator.detach({ attachmentId: h.row.id, intent: 'detach-only', positionDecision: 'remove-current', ...expected(h.row) });
    expect(detach.status === 'error' && detach.error.code).toBe('ATTACHMENT_CONFLICT'); expect(await h.snapshot()).toEqual(before);
    h.presentation.cancelConfirmation();
  });
  it('rejects a detach request for a different category in the coordinator', async () => {
    const h = await occupied(), before = await h.snapshot();
    const result = await h.library.coordinator.detach({ attachmentId: h.row.id, expectedType: 'audiobook', expectedBookUuid: h.book.uuid,
      intent: 'detach-only', positionDecision: 'remove-current' });
    expect(result.status === 'error' && result.error.code).toBe('ATTACHMENT_CONFLICT'); expect(await h.snapshot()).toEqual(before);
  });
  it.each(AVAILABLE_LOCALES)('renders an accessible localized confirmation in $id', async ({ id }) => {
    const h = await occupied(); await h.presentation.replace(h.type); const html = markup(h.presentation.getSnapshot(), id), t = TRANSLATIONS[id].attachments;
    expect(html).toContain('<dialog'); expect(html).toContain('aria-modal="true"'); expect(html).toContain('aria-labelledby=');
    expect(html).toContain('aria-describedby='); expect(html).toContain(t.confirmReplace); expect(html).toContain(t.historyPreserved);
    expect(html).toContain('autofocus='); expect(html).toContain('100dvh'); h.presentation.cancelConfirmation();
  });
});
describe('DEV capability gate', () => {
  it('fails closed for every public build, including native DEV ID', async () => {
    const nativeGate = vi.fn(async () => true);
    expect(await attachmentsDevEnabled({ build: false, native: true, platform: 'android', nativeGate })).toBe(false); expect(nativeGate).not.toHaveBeenCalled();
  });
  it('requires the native DEBUG and app ID gate even when the Web artifact is development', async () => {
    expect(await attachmentsDevEnabled({ build: true, native: true, platform: 'android', nativeGate: async () => false })).toBe(false);
    expect(await attachmentsDevEnabled({ build: true, native: true, platform: 'android', nativeGate: async () => true })).toBe(true);
    expect(await attachmentsDevEnabled({ build: true, native: true, platform: 'android', nativeGate: async () => { throw Error('missing'); } })).toBe(false);
  });
  it('restricts Web DEV artifacts to local hosts and rejects unsupported native platforms', async () => {
    expect(await attachmentsDevEnabled({ build: true, native: false, hostname: 'localhost' })).toBe(true);
    expect(await attachmentsDevEnabled({ build: true, native: false, hostname: 'public.example' })).toBe(false);
    expect(await attachmentsDevEnabled({ build: true, native: true, platform: 'ios' })).toBe(false);
  });
});
