import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { I18nProvider } from '../../i18n/I18nContext';
import type { LocaleId } from '../../i18n/types';
import { BookStorage } from '../../services/storage';
import { DatabaseService } from '../../services/database/databaseService';
import { BookRepository } from '../../services/database/bookRepository';
import { BookAttachmentRepository } from '../../services/database/bookAttachmentRepository';
import { ReaderPositionRepository } from '../../services/database/readerPositionRepository';
import { ReadingSessionRepository } from '../../services/database/readingSessionRepository';
import { ReadingProgressRepository } from '../../services/database/readingProgressRepository';
import { CoverStorageService, generateCoverFileName } from '../../services/storage/coverStorageService';
import { getPlatformDigitalLibrary } from '../../services/storage/digital/platform';
import { attachmentsDevEnabled } from '../../services/storage/digital/attachmentsDevGate';
import type { WebOpfsStorageProvider } from '../../services/storage/digital/web/WebOpfsStorageProvider';
import type { StorageResult, SelectedDigitalFile } from '../../services/storage/digital/contracts';
import type { AttachmentFormat } from '../../types/digitalMedia';
import { syntheticProofInput } from '../../services/storage/backupV2/experimental/syntheticDataset';
import { createBackupExporter } from '../../services/storage/backupV2/export/runtime';
import { BackupCatalogRepository } from '../../services/storage/backupV2/export/catalog';
import { canonical, snapshotDigest } from '../../services/storage/backupV2/export/prepare';
import { WebExportDestination } from '../../services/storage/backupV2/web/WebExportDestination';
import { BackupService } from '../../services/storage/backupService';
import type { DigitalBackupOptions } from '../../services/storage/backupV2/contracts';
import type { ExportDestination, ExportProgress, PreparedExport } from '../../services/storage/backupV2/export/types';
import BackupExportSection from '../../components/BackupExportSection';
import { DarkWalnutPalette } from '../../theme/woodTheme';
import { App } from '../../App';
import JSZip from 'jszip';
import '../../index.css';

function unwrap<T>(value: StorageResult<T>): T { if (value.status !== 'success') throw Error('Synthetic storage operation failed'); return value.value; }
const marker = 'backup-export-synthetic-4.2B';
async function main() {
  if (!await attachmentsDevEnabled()) throw Error('DEV required');
  const root = createRoot(document.getElementById('root')!), db = DatabaseService.getInstance(), books = new BookRepository(db);
  const syntheticUuids = [0,1,2].map(i => `backup-export-42b-book-${i}`), catalog = new BackupCatalogRepository(db, syntheticUuids);
  let uiTestDestination = false, legacyCalls = 0;
  const testDestination = async () => {
    const library = unwrap(await getPlatformDigitalLibrary());
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('backup-export-test-results', { create: true });
    return new WebExportDestination(await dir.getFileHandle(`backup-${crypto.randomUUID()}.zip`, { create: true }), library.provider as WebOpfsStorageProvider, 'test-opfs');
  };
  const exporterFactory = async () => {
    const result = await createBackupExporter({ catalog });
    return uiTestDestination ? { ...result, supported: true, select: testDestination } : result;
  };
  // Existing legacy test override: same v1 serializer/delivery, scoped only to this diagnostic's fixtures.
  class FixtureBooks extends BookRepository {
    override async getAll() { return (await Promise.all(syntheticUuids.map(uuid => this.getByUuid(uuid)))).filter((book): book is NonNullable<typeof book> => !!book); }
  }
  BackupService.setRepository(new FixtureBooks(db));
  const attachments = new BookAttachmentRepository(db), positions = new ReaderPositionRepository(db), sessions = new ReadingSessionRepository(db), progress = new ReadingProgressRepository(db);
  let prepared: PreparedExport | undefined, stop: AbortController | undefined, runtime: Awaited<ReturnType<typeof createBackupExporter>>;
  let before = '', latestProgress: ExportProgress | undefined;
  async function render(locale: LocaleId = 'pt-BR', app = false) {
    BookStorage.saveLocale(locale);
    root.render(<I18nProvider key={`${locale}:${app}`}>{app ? <App /> : <main className="max-w-3xl mx-auto p-3" style={{ background: DarkWalnutPalette.paperSurface, minHeight: '100dvh' }}>
      <BackupExportSection palette={DarkWalnutPalette} exporterFactory={exporterFactory} legacyExport={async () => {
        legacyCalls++; const result = await BackupService.exportZipBackup(); if (!uiTestDestination) await BackupService.deliverBackupFile(result);
      }} />
    </main>}</I18nProvider>);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const api = {
    async seed(paddingBytes = 1024 ** 2) {
      // Only known UUIDs are queried; the rest of the DEV catalog is not read or exported.
      const library = unwrap(await getPlatformDigitalLibrary());
      if (library.provider.id === 'web_digital') unwrap(await library.service.requestConfiguration({ interaction: 'user-initiated' }));
      const fixture = await syntheticProofInput(paddingBytes), generated = new Map<AttachmentFormat, SelectedDigitalFile>();
      const native = Capacitor.isNativePlatform();
      if (native) {
        const { AndroidSafPlugin } = await import('../../services/storage/digital/android/bridge');
        const nativeSources = unwrap(await AndroidSafPlugin.createDiagnosticSources({ interaction: 'user-initiated', intent: 'create-synthetic-fixtures-in-dev-library', includeLarge: paddingBytes >= 100 * 1024 ** 2 }));
        for (const item of nativeSources.sources.filter(item => item.fixture === 'valid' || item.fixture === 'large')) generated.set(item.selected.filename.split('.').pop() as AttachmentFormat, item.selected);
      }
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const uuid = `backup-export-42b-book-${i}`;
        let book = await books.getByUuid(uuid);
        if (book && book.observacoes !== marker) throw Error('Synthetic UUID collision');
        if (!book) book = await books.insert({ uuid, origem: 'manual', titulo: `Backup export synthetic ${i} 日本語`, autores: ['Synthetic'], generos: [],
          tenho_fisico: i === 2, formato: i === 2 ? 'ebook' : 'fisico', formatos: i === 2 ? ['ebook', 'audiolivro'] : ['fisico'], status_leitura: i === 2 ? 'lido' : 'quero_ler',
          nota: 8, observacoes: marker, dataCadastro: 1, dataAtualizacao: 2 });
        rows.push(book);
      }
      const coverSource = fixture.sources.find(row => row.archivePath === 'covers/proof.png')!;
      if (!rows[0].capaLocalPath) {
        const bytes = new Uint8Array(await new Response(await coverSource.open()).arrayBuffer());
        const base64 = btoa(String.fromCharCode(...bytes));
        const saved = await CoverStorageService.saveCoverDirect(generateCoverFileName('backup-42b'), base64);
        if (!saved) throw Error('Synthetic cover could not be saved');
        rows[0] = await books.update({ ...rows[0], capaLocalPath: saved });
      }
      for (const format of ['epub', 'pdf', 'mp3'] as const) {
        const book = rows[format === 'pdf' ? 1 : 0], type = format === 'mp3' ? 'audiobook' : 'ebook';
        const existing = await attachments.getByBookAndType(book.id, type);
        const wantedSize = native ? generated.get(format)?.sizeBytes : fixture.manifest.media.find(row => row.format === format)?.sizeBytes;
        if (existing && (format !== 'pdf' || existing.sizeBytes === wantedSize)) continue;
        let selected = generated.get(format);
        if (!selected && !native) {
          const source = fixture.sources.find(row => row.archivePath.endsWith(`.${format}`))!, directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('backup-export-synthetic-fixtures', { create: true });
          const handle = await directory.getFileHandle(`source-${paddingBytes}.${format}`, { create: true });
          await (await source.open()).pipeTo(await handle.createWritable());
          selected = (library.provider as WebOpfsStorageProvider).registerSource(await handle.getFile(), `synthetic.${format}`);
        }
        if (!selected) throw Error('Synthetic source unavailable');
        const stored = unwrap(await library.service.importFile({ operationId: `backup-42b-import-${format}-${paddingBytes}`, selected, format, type }));
        unwrap(await library.coordinator.applyChange({ bookId: book.id, expectedBookUuid: book.uuid, type, imported: stored, intent: existing ? 'replace' : 'attach',
          ...(existing ? { expectedAttachmentId: existing.id, expectedStorageReference: existing.storageReference, expectedProvider: existing.storageProvider, expectedUpdatedAt: existing.updatedAt } : {}) }));
      }
      const epub = (await attachments.getByBookAndType(rows[0].id, 'ebook'))!;
      if (!await positions.getByAttachmentId(epub.id)) await positions.savePosition({ attachmentId: epub.id, locationType: 'epub_cfi', location: 'epubcfi(/6/2)' });
      if (!(await sessions.getHistoryByBookId(rows[0].id)).length) {
        const session = await sessions.create({ bookId: rows[0].id });
        await progress.saveProgress({ sessionId: session.id, unit: 'pages', currentValue: 5, totalValue: 100, source: 'manual' });
      }
      runtime = await exporterFactory(); before = await snapshotDigest(await catalog.read()); await render();
      return { books: (await catalog.read()).books.length, provider: library.provider.id, snapshotDigest: before, supported: runtime.supported, reason: runtime.reason };
    },
    async prepare(options: DigitalBackupOptions = { includeEbooks: true, includeAudiobooks: true }) {
      runtime ??= await exporterFactory(); stop = new AbortController(); prepared = await runtime.coordinator.prepare(options, stop.signal);
      return { counts: prepared.manifest.counts, options: prepared.manifest.options, totalBytes: prepared.totalBytes, planDigest: prepared.snapshotDigest,
        media: prepared.manifest.media.map(row => ({ id: row.id, state: row.state, sizeBytes: row.sizeBytes, sha256: row.sha256 })) };
    },
    async export(external = false, cancelBytes: number | null = null, nativeFault?: 'write' | 'finalize' | 'verify') {
      if (!prepared || !runtime) throw Error('Prepare first');
      let destination: ExportDestination;
      if (external || Capacitor.isNativePlatform()) destination = await runtime.select(prepared);
      else {
        const library = unwrap(await getPlatformDigitalLibrary()), dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('backup-export-test-results', { create: true });
        const handle = await dir.getFileHandle(`${prepared.manifest.backupId}.zip`, { create: true });
        destination = new WebExportDestination(handle, library.provider as WebOpfsStorageProvider, 'test-opfs');
      }
      if (nativeFault && Capacitor.isNativePlatform()) {
        const { NativeBackupExport } = await import('../../services/storage/backupV2/android/NativeExportDestination');
        const result = await NativeBackupExport.setDiagnosticFault({ operationId: prepared.manifest.backupId, mode: nativeFault });
        if (result.status !== 'success') throw Error('Diagnostic fault rejected');
      }
      const events: ExportProgress[] = []; stop ??= new AbortController();
      const report = await runtime.coordinator.export(prepared, destination, stop.signal, event => {
        latestProgress = event; events.push(event); if (cancelBytes !== null && event.bytesProcessed >= cancelBytes) stop!.abort();
      });
      const preserved = before === await snapshotDigest(await catalog.read());
      if (!preserved) throw Error('Synthetic catalog changed during export');
      return { report, preserved, events: events.length, lastProgress: latestProgress };
    },
    async legacy() {
      const backup = await BackupService.exportZipBackup();
      const zip = await JSZip.loadAsync(await backup.blob!.arrayBuffer());
      const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
      return { version: manifest.version, entries: Object.keys(zip.files), booksCount: backup.booksCount, coversCount: backup.coversCount, bytes: backup.blob?.size ?? null };
    },
    async resume() { runtime = await exporterFactory(); before = await snapshotDigest(await catalog.read()); return { digest: before }; },
    async useUiTestDestination() { if (Capacitor.isNativePlatform()) throw Error('Browser-only UI test sink'); uiTestDestination = true; await render(); },
    legacyCalls: () => legacyCalls,
    async transfer(operationId: string) {
      if (!/^backup-[a-f0-9-]{36}$/.test(operationId) || Capacitor.isNativePlatform()) throw Error('Only owned browser artifacts');
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('backup-export-test-results');
      const file = await (await dir.getFileHandle(`${operationId}.zip`)).getFile();
      const response = await fetch(`/__backup_export_artifacts/${operationId}.zip`, { method: 'POST', body: file });
      if (!response.ok) throw Error('Synthetic transfer unavailable'); return { bytes: file.size };
    },
    cancel() { stop?.abort(); },
    render,
    async preserved() { return before === await snapshotDigest(await catalog.read()); },
    async stateDigest() { return snapshotDigest(await catalog.read()); },
    async transactionProbe() {
      if (!Capacitor.isNativePlatform()) throw Error('Native transaction evidence requires Android');
      const initial = await snapshotDigest(await catalog.read()); let finished = false, queued!: Promise<unknown>;
      await db.runIsolatedInTransaction(async tx => {
        await new BookRepository(tx).getByUuid('backup-export-42b-book-0');
        queued = catalog.read().then(value => { finished = true; return value; });
        await new Promise(resolve => setTimeout(resolve, 100));
        if (finished) throw Error('Snapshot joined an unrelated native transaction');
      });
      await queued;
      if (initial !== await snapshotDigest(await catalog.read())) throw Error('Read-only transaction changed catalog');
      return { native: true, separateReadQueued: true, catalogPreserved: true };
    },
    async snapshotIsolationProbe() {
      if (!Capacitor.isNativePlatform()) throw Error('Requires native SQLite');
      const initial = await snapshotDigest(await catalog.read()); let finished = false, queued!: Promise<unknown>;
      await db.readInSnapshot(async tx => {
        await new BookRepository(tx).getByUuid('backup-export-42b-book-0');
        // The native execute API rejects read queries. WHERE 0 exercises its write path without matching any row.
        queued = db.execute('UPDATE books SET titulo = titulo WHERE 0;').then(value => { finished = true; return value; });
        await new Promise(resolve => setTimeout(resolve, 100));
        if (finished) throw Error('Global executor entered the read snapshot');
      });
      await queued;
      if (initial !== await snapshotDigest(await catalog.read())) throw Error('Snapshot probe changed catalog');
      return { native: true, globalExecutorQueued: true, catalogPreserved: true };
    },
    async recovery() { return (await exporterFactory()).unfinished; },
    canonical,
  };
  Object.assign(window, { backupExportTest: api }); await render();
}
void main();
