import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../../i18n/I18nContext';
import { App } from '../../App';
import { TRANSLATIONS } from '../../i18n/translations';
import { AVAILABLE_LOCALES, type LocaleId } from '../../i18n/types';
import { BookStorage } from '../../services/storage';
import DigitalAttachmentsSection from '../../components/DigitalAttachmentsSection';
import { DarkWalnutPalette } from '../../theme/woodTheme';
import { attachmentsDevEnabled } from '../../services/storage/digital/attachmentsDevGate';
import { getPlatformDigitalLibrary } from '../../services/storage/digital/platform';
import type { DigitalLibrary } from '../../services/storage/digital/composeDigitalLibrary';
import { DatabaseService } from '../../services/database/databaseService';
import { BookRepository } from '../../services/database/bookRepository';
import { BookAttachmentRepository } from '../../services/database/bookAttachmentRepository';
import { ReaderPositionRepository } from '../../services/database/readerPositionRepository';
import { ReadingSessionRepository } from '../../services/database/readingSessionRepository';
import { ReadingProgressRepository } from '../../services/database/readingProgressRepository';
import { getExpectedLocationTypeForFormat, type AttachmentFormat, type AttachmentType } from '../../types/digitalMedia';
import type { Book } from '../../types/book';
import type { SelectedDigitalFile, StorageResult } from '../../services/storage/digital/contracts';
import type { WebOpfsStorageProvider } from '../../services/storage/digital/web/WebOpfsStorageProvider';
import { storageSuccess } from '../../services/storage/digital/errors';
import { managedFileReference } from '../../services/storage/digital/validation';
import { sameConformanceValue } from './conformance';
import '../../index.css';

/** Opt-in synthetic runtime fixture. No second UI/storage implementation and no physical cleanup. */
async function prepareDiagnostic() {
  if (!await attachmentsDevEnabled()) throw Error('DEV gate required');
  const db = DatabaseService.getInstance(), books = new BookRepository(db), attachments = new BookAttachmentRepository(db);
  const positions = new ReaderPositionRepository(db), sessions = new ReadingSessionRepository(db), progress = new ReadingProgressRepository(db);
  const root = createRoot(document.getElementById('root')!);
  const marker = 'attachments-management-synthetic-3.2';
  let book: Book, library: DigitalLibrary;
  const sources = new Map<string, SelectedDigitalFile>();
  const wait = async (condition: () => boolean) => {
    for (let i = 0; i < 300; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw Error('Synthetic UI condition timed out');
  };
  const section = () => document.querySelector('section:has([data-attachment-slot])');
  const idle = () => wait(() => section()?.getAttribute('aria-busy') === 'false');
  const click = (label: string) => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent === label);
    if (!button || button.disabled) throw Error(`Test action unavailable: ${label}`);
    const details = button.closest('details'); if (details) details.open = true;
    button.focus(); button.click();
  };
  const row = async (type: AttachmentType) => {
    const current = await attachments.getByBookAndType(book.id, type); if (!current) throw Error('Missing synthetic attachment'); return current;
  };
  async function fixture(format: AttachmentFormat, variant = 'base') {
    const key = `${format}:${variant}`, cached = sources.get(key); if (cached) return cached;
    if (library.provider.id === 'saf_document') {
      const { AndroidSafPlugin } = await import('../../services/storage/digital/android/bridge');
      const result = await AndroidSafPlugin.createDiagnosticSources({ interaction: 'user-initiated', intent: 'create-synthetic-fixtures-in-dev-library', includeLarge: variant === 'large',
        variant: variant === 'different' ? 'different' : 'base' });
      if (result.status !== 'success') throw Error('Native synthetic sources unavailable');
      for (const source of result.value.sources) if (source.fixture === 'valid' || source.fixture === 'large') {
        sources.set(`${source.selected.filename.split('.').pop()}:${source.fixture === 'large' ? 'large' : variant}`, source.selected);
      }
      return sources.get(key)!;
    }
    const provider = library.provider as WebOpfsStorageProvider;
    let bytes: Blob;
    if (format === 'epub') {
      const { default: JSZip } = await import('jszip'); const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
      zip.file('META-INF/container.xml', '<container/>'); zip.file('synthetic.txt', variant);
      bytes = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    } else if (format === 'pdf') bytes = new Blob(['%PDF-1.4\n', variant === 'large' ? new Uint8Array(32 * 1024 * 1024) : variant, '\n%%EOF\n'], { type: 'application/pdf' });
    else bytes = new Blob(['ID3', new Uint8Array(256), variant], { type: 'audio/mpeg' });
    const filename = variant === 'long' ? `${'synthetic-long-name-'.repeat(11)}.${format}` : `synthetic.${format}`;
    const selected = provider.registerSource(bytes, filename); sources.set(key, selected); return selected;
  }
  async function choose(format: AttachmentFormat, variant = 'base') {
    const selected = await fixture(format, variant), original = library.service.selectSource.bind(library.service);
    // Explicit test injection of picker completion; native/OPFS copying, journal and DB remain real.
    library.service.selectSource = () => { library.service.selectSource = original; return Promise.resolve(storageSuccess(selected)); };
  }
  async function snapshot() {
    const rows = await attachments.getByBookId(book.id), history = await sessions.getHistoryByBookId(book.id);
    return { book: await books.getById(book.id), attachments: rows, positions: await Promise.all(rows.map(r => positions.getByAttachmentId(r.id))),
      sessions: history, progress: await Promise.all(history.map(s => progress.getBySessionId(s.id))) };
  }
  async function seedPosition(type: AttachmentType = 'ebook') {
    const current = await row(type);
    return positions.savePosition({ attachmentId: current.id, locationType: getExpectedLocationTypeForFormat(current.format), location: current.format === 'epub' ? 'epubcfi(/6/2)' : '12' });
  }
  async function start(uuid?: string) {
    library = unwrap(await getPlatformDigitalLibrary());
    const config = unwrap(await library.service.getConfiguration());
    if (config.state === 'not-configured') {
      if (library.provider.id !== 'web_digital') throw Error('Configure an explicit synthetic SAF folder first');
      unwrap(await library.service.requestConfiguration({ interaction: 'user-initiated' }));
    }
    if (uuid) {
      const stored = await books.getByUuid(uuid);
      if (!stored || stored.observacoes !== marker) throw Error('Only this diagnostic synthetic book can be reopened'); book = stored;
    } else {
      const inserted = await books.insert({ origem: 'manual', titulo: `Attachments management synthetic ${crypto.randomUUID().slice(0, 8)}`, autores: ['Synthetic'], generos: [],
        tenho_fisico: false, formato: 'fisico', formatos: ['fisico'], status_leitura: 'quero_ler', nota: 8, observacoes: marker,
        dataCadastro: Date.now(), dataAtualizacao: Date.now() }); book = (await books.getById(inserted.id))!;
    }
    await render();
    return { bookUuid: book.uuid, provider: library.provider.id };
  }
  async function render(locale: LocaleId = 'pt-BR', mode: 'section' | 'app' = 'section') {
    if (!AVAILABLE_LOCALES.some(value => value.id === locale)) throw Error('Unknown diagnostic locale');
    BookStorage.saveLocale(locale);
    root.render(<I18nProvider key={`${locale}:${mode}`}>{mode === 'app' ? <App /> :
      <main className="max-w-3xl mx-auto p-4" style={{ background: DarkWalnutPalette.woodDark, minHeight: '100dvh' }}>
        <DigitalAttachmentsSection key={book.uuid} book={book} palette={DarkWalnutPalette} />
      </main>}
    </I18nProvider>);
    await new Promise(resolve => setTimeout(resolve, 50));
    if (mode === 'section') await idle();
    return TRANSLATIONS[locale].attachments;
  }
  async function navigationFixture() {
    const inserted = await books.insert({ origem: 'manual', titulo: `UX 3.3 companion synthetic ${crypto.randomUUID().slice(0, 8)}`, autores: ['Synthetic'], generos: ['Synthetic'],
      tenho_fisico: true, formato: 'ebook', formatos: ['ebook', 'audiolivro'], status_leitura: 'lido', nota: 7,
      observacoes: marker, editora: 'Synthetic', paginas: 100, anoPublicacao: 2026, mesLeitura: 10, anoLeitura: 2026,
      emprestimo: { nomePessoa: 'Synthetic borrower', dataEmprestimo: '2026-10-01', dataDevolucao: '2099-01-01', devolvido: false },
      dataCadastro: Date.now(), dataAtualizacao: Date.now() });
    return (await books.getById(inserted.id))!;
  }
  async function run() {
    await start(); const checks: string[] = [], initial = await snapshot();
    const check = (label: string, value: unknown) => { if (!value) throw Error('Management check failed: ' + label); checks.push(label); };
    await choose('epub'); click('Adicionar e-book'); await new Promise(r => setTimeout(r, 50)); await idle();
    await choose('mp3'); click('Adicionar audiolivro'); await new Promise(r => setTimeout(r, 50)); await idle();
    check('two independent slots', (await snapshot()).attachments.length === 2);
    const session = await sessions.create({ bookId: book.id });
    await progress.saveProgress({ sessionId: session.id, unit: 'pages', currentValue: 10, totalValue: 100, source: 'manual' });
    await seedPosition(); const before = await snapshot();
    await choose('epub'); click('Substituir arquivo'); await wait(() => !!document.querySelector('dialog[open]'));
    check('explicit accessible confirmation', !!document.querySelector('dialog[aria-labelledby][aria-describedby]'));
    check('cancel initially focused', document.activeElement?.textContent === 'Cancelar');
    check('same content explains preserved position', document.querySelector('dialog')?.textContent?.includes('será preservada'));
    check('preparation leaves old link untouched', sameConformanceValue(before, await snapshot()));
    click('Cancelar'); await new Promise(r => setTimeout(r, 50)); await idle();
    check('cancel retains position and history', sameConformanceValue(before, await snapshot()));
    check('focus returns to initiating action', document.activeElement?.textContent === 'Substituir arquivo');
    await choose('epub'); click('Substituir arquivo'); await wait(() => !!document.querySelector('dialog[open]'));
    click('Confirmar substituição'); await new Promise(r => setTimeout(r, 50)); await idle();
    const identical = await snapshot(); check('identical replacement keeps attachment ID', identical.attachments.find(a => a.type === 'ebook')?.id === before.attachments.find(a => a.type === 'ebook')?.id);
    check('identical replacement preserves position', sameConformanceValue(before.positions, identical.positions));
    await choose('epub', 'different'); click('Substituir arquivo'); await wait(() => !!document.querySelector('dialog[open]'));
    check('different content warns about invalidation', document.querySelector('dialog')?.textContent?.includes('será removida'));
    const runTransaction = db.runIsolatedInTransaction.bind(db);
    db.runIsolatedInTransaction = work => {
      db.runIsolatedInTransaction = runTransaction;
      return runTransaction(async tx => { await work(tx); throw Error('Controlled synthetic commit failure'); });
    };
    click('Confirmar substituição'); await new Promise(r => setTimeout(r, 50)); await idle();
    check('real transaction rollback preserves complete snapshot', sameConformanceValue(identical, await snapshot()));
    click('Rever operação pendente'); await new Promise(r => setTimeout(r, 50)); await idle();
    const different = await snapshot(); check('explicit recovery invalidates incompatible position', !different.positions.some(Boolean));
    check('other slot survives replacement', sameConformanceValue(before.attachments.find(a => a.type === 'audiobook'), different.attachments.find(a => a.type === 'audiobook')));
    check('sessions preserved', sameConformanceValue(before.sessions, different.sessions)); check('deliberate progress preserved', sameConformanceValue(before.progress, different.progress));
    click('Verificar arquivo'); await new Promise(r => setTimeout(r, 50)); await idle();
    check('explicit SHA verified', section()?.textContent?.includes('Integridade do arquivo confirmada.'));
    await seedPosition(); click('Desassociar arquivo'); await wait(() => !!document.querySelector('dialog[open]'));
    check('detach warns about bytes and position', document.querySelector('dialog')?.textContent?.includes('não serão apagados') && document.querySelector('dialog')?.textContent?.includes('será removida'));
    const beforeDetach = await snapshot(); click('Cancelar'); await new Promise(r => setTimeout(r, 50)); await idle();
    check('detach cancel preserves all metadata', sameConformanceValue(beforeDetach, await snapshot()));
    click('Desassociar arquivo'); await wait(() => !!document.querySelector('dialog[open]')); click('Confirmar desassociação'); await new Promise(r => setTimeout(r, 50)); await idle();
    const detached = await snapshot(); check('only the selected link is detached', detached.attachments.length === 1 && detached.attachments[0].type === 'audiobook');
    check('book unchanged', sameConformanceValue(initial.book, detached.book));
    check('history survives detachment', sameConformanceValue(before.sessions, detached.sessions) && sameConformanceValue(before.progress, detached.progress));
    const old = beforeDetach.attachments.find(a => a.type === 'ebook')!;
    check('detached bytes remain accessible', (await library.service.checkAccess(managedFileReference(old.storageProvider, old.storageReference))).status === 'success');
    return { passed: checks.length, checks, bookUuid: book.uuid, provider: library.provider.id, picker: 'injected synthetic completion; real storage and UI' };
  }
  const verifyAll = async () => Promise.all((await attachments.getByBookId(book.id)).map(async current => ({ type: current.type,
    status: (await library.service.verifyIntegrity(managedFileReference(current.storageProvider, current.storageReference), {
      sizeBytes: current.sizeBytes, checksum: { algorithm: 'sha256', value: current.checksum! },
    })).status })));
  return { start, run, choose, snapshot, seedPosition, idle, verifyAll, render, navigationFixture };
}
function unwrap<T>(result: StorageResult<T>): T {
  if (result.status !== 'success') throw Error(result.status === 'error' ? result.error.code : result.code); return result.value;
}
void prepareDiagnostic().then(api => { (window as any).attachmentManagement = api; }).catch(() => {
  document.getElementById('root')!.textContent = 'Diagnóstico disponível apenas em DEV local ou Android DEV.';
});
