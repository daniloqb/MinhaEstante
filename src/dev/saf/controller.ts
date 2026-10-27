import { DatabaseService } from '../../services/database/databaseService';
import { BookRepository } from '../../services/database/bookRepository';
import { ReaderPositionRepository } from '../../services/database/readerPositionRepository';
import { ReadingSessionRepository } from '../../services/database/readingSessionRepository';
import { ReadingProgressRepository } from '../../services/database/readingProgressRepository';
import { getExpectedLocationTypeForFormat } from '../../types/digitalMedia';
import { BookAttachmentRepository } from '../../services/database/bookAttachmentRepository';
import type { IDatabaseService } from '../../services/database/types';
import type { Book } from '../../types/book';
import type { AttachmentType } from '../../types/digitalMedia';
import { DigitalAttachmentCoordinator } from '../../services/storage/digital/DigitalAttachmentCoordinator';
import type { DigitalFileStorageService } from '../../services/storage/digital/DigitalFileStorageService';
import { AndroidSafPlugin, AndroidSafStorageProvider } from '../../services/storage/digital/android';
import type { DiagnosticSource } from '../../services/storage/digital/android/bridge';
import type { DigitalImportProgress, SelectedDigitalFile, StorageResult, StoredDigitalFile } from '../../services/storage/digital/contracts';
import { DigitalStorageException } from '../../services/storage/digital/errors';

function value<T>(r: StorageResult<T>): T {
  if (r.status === 'success') return r.value;
  throw new DigitalStorageException(r.status === 'error' ? r.error.code : r.code);
}

/** Not imported by the production entry. Created only after native DEV gate succeeds. */
export function createSafDiagnosticController(provider: AndroidSafStorageProvider, service: DigitalFileStorageService) {
  const db = DatabaseService.getInstance();
  const books = new BookRepository(db);
  const attachments = new BookAttachmentRepository(db);
  let book: Book | undefined;
  let fixtures: readonly DiagnosticSource[] = [];
  let selected: SelectedDigitalFile | undefined;
  let operationId = '';
  let abort: AbortController | undefined;
  let failLink = false;
  let failCommit = false;
  let failFinalize = false;
  let progress: DigitalImportProgress | undefined;
  const stored = new Map<string, StoredDigitalFile>();
  function scoped(tx: IDatabaseService): IDatabaseService {
    return {
      initialize: () => tx.initialize(), close: () => tx.close(),
      query: (sql, params) => tx.query(sql, params),
      execute: (sql, params) => {
        if (failLink && sql.trimStart().startsWith('INSERT INTO book_attachments')) {
          failLink = false; throw new DigitalStorageException('LINK_PERSISTENCE_FAILED');
        }
        return tx.execute(sql, params);
      },
      runInTransaction: (fn) => tx.runInTransaction((nested) => fn(scoped(nested ?? tx))),
    };
  }
  const testDb: IDatabaseService = {
    ...scoped(db),
    runIsolatedInTransaction: (fn) => db.runIsolatedInTransaction(async (tx) => {
      const result = await fn(scoped(tx ?? db));
      if (failCommit) { failCommit = false; throw new DigitalStorageException('LINK_PERSISTENCE_FAILED'); }
      return result;
    }),
  };
  const coordinator = new DigitalAttachmentCoordinator(testDb, service, {
    listOperations: () => provider.listOperations(), getOperation: (id) => provider.getOperation(id),
    beginAttachmentLink: (id, context) => provider.beginAttachmentLink(id, context), recoverImport: (id) => provider.recoverImport(id),
    completeImportOperation: (id) => {
      if (failFinalize) { failFinalize = false; return Promise.resolve({ status: 'error' as const,
        error: { code: 'RECOVERY_REQUIRED' as const, messageKey: 'digitalStorage.errors.RECOVERY_REQUIRED' } }); }
      return provider.completeImportOperation(id);
    },
  });
  async function testBook() {
    if (!book) {
      const existing = (await books.getAll()).filter((b) => b.observacoes === 'minhaestante-saf-dev-2.2b');
      book = existing.sort((a, b) => a.dataCadastro - b.dataCadastro || a.id - b.id).at(-1);
    }
    if (!book) throw new DigitalStorageException('INVALID_REFERENCE');
    return book;
  }
  function type(file: SelectedDigitalFile): AttachmentType {
    return ['epub', 'pdf'].includes(file.filename.split('.').pop()?.toLowerCase() ?? '') ? 'ebook' : 'audiobook';
  }
  async function file(id = operationId) {
    const current = stored.get(id) ?? value(await provider.getOperation(id)).stored;
    if (!current) throw new DigitalStorageException('RECOVERY_REQUIRED');
    return current;
  }
  const api = {
    get state() { return { operationId, progress, selected, fixtureCount: fixtures.length, bookId: book?.id }; },
    async createBook() {
      book = await books.insert({ origem: 'manual', titulo: 'SAF DEV synthetic book', autores: ['Synthetic'], generos: [],
        tenho_fisico: false, formato: 'fisico', formatos: ['fisico'], status_leitura: 'quero_ler',
        observacoes: 'minhaestante-saf-dev-2.2b', dataCadastro: Date.now(), dataAtualizacao: Date.now() });
      return { bookId: book.id, bookUuid: book.uuid };
    },
    async generateSources(includeLarge = false, variant: 'base' | 'different' = 'base') {
      fixtures = value(await AndroidSafPlugin.createDiagnosticSources({ interaction: 'user-initiated',
        intent: 'create-synthetic-fixtures-in-dev-library', includeLarge, variant })).sources;
      selected = fixtures[0]?.selected;
      return fixtures.map((f, index) => ({ index, format: f.selected.filename.split('.').pop(), fixture: f.fixture,
        sizeBytes: f.selected.sizeBytes, sha256: f.expectedIntegrity.checksum.value }));
    },
    selectFixture(index: number) { selected = fixtures[index]?.selected; return selected; },
    setSelected(next: SelectedDigitalFile) { selected = next; },
    async selectDocument() {
      const result = await service.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub', 'pdf', 'mp3', 'm4a', 'm4b'] });
      if (result.status === 'success') selected = result.value;
      return result;
    },
    async importSelected(options: { link?: boolean; replace?: boolean; id?: string; fault?: string; failSQLite?: boolean; failCommit?: boolean; failFinalize?: boolean; positionDecision?: 'invalidate-current'; cancelOnProgress?: boolean; faultAfterBytes?: number } = {}) {
      if (!selected) throw new DigitalStorageException('INVALID_REFERENCE');
      const sourceFile = selected;
      const currentOperationId = options.id ?? `dev-${crypto.randomUUID()}`; operationId = currentOperationId;
      const currentAbort = new AbortController(); abort = currentAbort; progress = undefined;
      if (options.fault) value(await AndroidSafPlugin.setDiagnosticFault({ interaction: 'user-initiated', operationId: currentOperationId,
        mode: options.fault, afterBytes: options.faultAfterBytes ?? 65536 }));
      const format = sourceFile.filename.split('.').pop()?.toLowerCase() as 'epub' | 'pdf' | 'mp3' | 'm4a' | 'm4b';
      const imported = await service.importFile({ operationId: currentOperationId, selected: sourceFile, type: type(sourceFile), format },
        { signal: currentAbort.signal, onProgress: (next) => { progress = next; if(options.cancelOnProgress&&next.stage==='copying'&&next.bytesProcessed>0)currentAbort.abort(); api.onProgress?.(next); } });
      if (imported.status !== 'success') return { operationId: currentOperationId, imported };
      stored.set(currentOperationId, imported.value);
      const expected = fixtures.find((f) => f.selected.source.sourceReference === sourceFile.source.sourceReference)?.expectedIntegrity;
      if (expected && (expected.checksum.value !== imported.value.integrity.checksum.value || expected.sizeBytes !== imported.value.integrity.sizeBytes)) throw new DigitalStorageException('INTEGRITY_MISMATCH');
      let link;
      if (options.link) {
        const target = await testBook();
        const current = await attachments.getByBookAndType(target.id, type(sourceFile));
        failLink = !!options.failSQLite; failCommit = !!options.failCommit; failFinalize = !!options.failFinalize;
        link = await coordinator.applyChange({ bookId: target.id, type: type(sourceFile), imported: imported.value,
          intent: options.replace ? 'replace' : 'attach', expectedAttachmentId: options.replace ? current?.id : undefined, positionDecision: options.positionDecision });
      }
      return { operationId: currentOperationId, imported, link };
    },
    onProgress: undefined as ((p: DigitalImportProgress) => void) | undefined,
    cancel() { abort?.abort(); return { cancellationRequested: true, operationId }; },
    async verify(id = operationId) { const current = await file(id); return service.verifyIntegrity(current.file, current.integrity); },
    async metadata(id = operationId) { return service.getMetadata((await file(id)).file); },
    async list() { return provider.listOperations(); },
    async recover(id = operationId) {
      const result = await coordinator.recover(id);
      if (result.status === 'success' && 'state' in result.value) stored.set(id, result.value);
      return result;
    },
    async clearFault(id = operationId) { return AndroidSafPlugin.setDiagnosticFault({ interaction: 'user-initiated', operationId: id, mode: 'none' }); },
    async deleteUnlinked(id = operationId) { return service.deleteManagedFile({ file: (await file(id)).file, intent: 'delete-managed-file' }); },
    async discardIncomplete(id = operationId) { return provider.recovery.discardIncompleteImport(id); },
    async detach(category: AttachmentType, positionDecision?: 'remove-current') {
      const current = await attachments.getByBookAndType((await testBook()).id, category);
      return current ? coordinator.detach({ attachmentId: current.id, intent: 'detach-only', positionDecision }) : { status: 'success' as const, value: undefined };
    },
    async seedPosition(category: AttachmentType) {
      const current = await attachments.getByBookAndType((await testBook()).id, category);
      if (!current) throw new DigitalStorageException('INVALID_REFERENCE');
      return new ReaderPositionRepository(db).savePosition({ attachmentId: current.id,
        locationType: getExpectedLocationTypeForFormat(current.format), location: current.format === 'epub' ? 'epubcfi(/6/2)' : '12' });
    },
    async seedHistory() {
      const session = await new ReadingSessionRepository(db).create({ bookId: (await testBook()).id });
      await new ReadingProgressRepository(db).saveProgress({ sessionId: session.id, unit: 'pages', currentValue: 10, totalValue: 100, source: 'manual' });
      return session.id;
    },
    async positionsAndHistory() {
      const rows = await attachments.getByBookId((await testBook()).id);
      const positions = await Promise.all(rows.map((row) => new ReaderPositionRepository(db).getByAttachmentId(row.id)));
      const sessions = await new ReadingSessionRepository(db).getHistoryByBookId((await testBook()).id);
      const progress = await Promise.all(sessions.map((session) => new ReadingProgressRepository(db).getBySessionId(session.id)));
      return { positions, sessions, progress };
    },
    async snapshot() {
      const target=await testBook(); const history=await api.positionsAndHistory();
      return { book: await books.getById(target.id), attachments: await attachments.getByBookId(target.id), ...history };
    },
    async retainedFiles() { return coordinator.listRetainedFiles(); },
    async queryBook() {
      const target = await testBook(); const saved = await books.getById(target.id);
      return { bookId: target.id, ownership: saved?.tenho_fisico, formats: saved?.formatos, readingStatus: saved?.status_leitura,
        attachments: await attachments.getByBookId(target.id) };
    },
    async nativeTransactionRegression() {
      const make = () => books.insert({ origem: 'manual', titulo: 'DEV transaction fixture', autores: [], generos: [],
        tenho_fisico: false, formato: 'fisico', formatos: ['fisico'], status_leitura: 'nenhum', nota: 0,
        dataCadastro: Date.now(), dataAtualizacao: Date.now() });
      const first = await make(); const second = await make();
      let started!: () => void; let release!: () => void;
      const entered = new Promise<void>((resolve) => { started = resolve; });
      const hold = new Promise<void>((resolve) => { release = resolve; });
      const a = db.runIsolatedInTransaction(async (tx) => {
        await new BookRepository(tx).update({ ...first, nota: 9 }); started(); await hold;
        throw new DigitalStorageException('LINK_PERSISTENCE_FAILED');
      });
      await entered;
      const b = db.runIsolatedInTransaction(async (tx) => {
        const repo = new BookRepository(tx);
        await tx!.runInTransaction(() => repo.update({ ...second, nota: 8 }));
      });
      release(); const results = await Promise.allSettled([a, b]);
      return { first: results[0].status, second: results[1].status,
        rollbackPreserved: (await books.getById(first.id))?.nota === 0,
        otherTransactionCommitted: (await books.getById(second.id))?.nota === 8 };
    },
  };
  return api;
}
export type SafDiagnosticController = ReturnType<typeof createSafDiagnosticController>;
