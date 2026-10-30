import { describe, expect, it, vi } from 'vitest';
import type { Book } from '../types/book';
import type { BackupReadingData, DigitalBackupOptions } from '../services/storage/backupV2/contracts';
import type { CatalogSnapshot, ExportDestination } from '../services/storage/backupV2/export/types';
import { ExportFailure } from '../services/storage/backupV2/export/types';
import { BackupV2ExportCoordinator } from '../services/storage/backupV2/export/BackupV2ExportCoordinator';
import { prepareExport, digestBlob, snapshotDigest } from '../services/storage/backupV2/export/prepare';
import { BackupExportJournal } from '../services/storage/backupV2/export/journal';
import type { DurableRecordStore } from '../services/storage/web/IndexedDbStore';
import { WebPersistentDatabaseAdapter } from '../services/database/webPersistentDatabaseAdapter';
import { BackupCatalogRepository } from '../services/storage/backupV2/export/catalog';
import { BookRepository } from '../services/database/bookRepository';
import { syntheticProofInput } from '../services/storage/backupV2/experimental/syntheticDataset';
import { boundedBlobStream, verifyBackupZip, writeBackupZip } from '../services/storage/backupV2/zip/streamingZip';
import { backupExportMessages } from '../services/storage/backupV2/i18n/messages';

class Records implements DurableRecordStore {
  values = new Map<string, unknown>(); writes = 0;
  async get<T>(key: string) { return structuredClone(this.values.get(key)) as T | undefined; }
  async put<T>(key: string, value: T) { this.writes++; this.values.set(key, structuredClone(value)); }
  async list<T>(prefix: string) { return [...this.values].filter(([key]) => key.startsWith(prefix)).map(([, value]) => structuredClone(value)) as T[]; }
  async compareAndSet<T>(key: string, revision: number, value: T) {
    if (((this.values.get(key) as { revision: number } | undefined)?.revision ?? 0) !== revision) throw Error('CAS conflict');
    await this.put(key, { version: 1, revision: revision + 1, value });
  }
}
async function fixture() {
  const input = await syntheticProofInput(), blobs = new Map<string, Blob>();
  for (const row of input.sources) blobs.set(row.archivePath, await new Response(await row.open()).blob());
  const books = JSON.parse(await blobs.get('books.json')!.text()) as Book[];
  const reading = JSON.parse(await blobs.get('reading.json')!.text()) as BackupReadingData;
  const snapshot: CatalogSnapshot = { books, attachments: input.manifest.media.map(row => ({ id: row.id, bookId: books.find(book => book.uuid === row.bookUuid)!.id,
    type: row.type, format: row.format, filename: row.filename, sizeBytes: row.sizeBytes!, storageProvider: 'web_digital', storageReference: `synthetic-${row.id}`,
    checksum: row.sha256, createdAt: row.createdAt, updatedAt: row.updatedAt })),
    positions: [...reading.readerPositions], sessions: reading.sessions.map(({ bookUuid, ...row }) => ({ ...row, bookId: books.find(book => book.uuid === bookUuid)!.id })), progress: [...reading.progress] };
  const records = new Records(), journal = new BackupExportJournal(records), readCover = async (book: Book) => book.capaLocalPath ? blobs.get('covers/proof.png')! : null;
  const deps = { catalog: { read: async () => structuredClone(snapshot) }, readCover, journal, validateMedia: vi.fn(async () => {}) };
  const coordinator = new BackupV2ExportCoordinator(deps);
  const destination: ExportDestination = { kind: 'test-opfs', async execute(request) {
    const chunks: Uint8Array[] = [], sink = new WritableStream<Uint8Array>({ write(bytes) { chunks.push(bytes); } });
    await request.checkpoint('transferring', 'incomplete');
    await writeBackupZip({ manifest: request.manifest, bookUuids: books.map(book => book.uuid!), sources: request.payloads.map(row => ({
      archivePath: row.archivePath, sizeBytes: row.sizeBytes, open: () => boundedBlobStream(row.blob ?? blobs.get(`media/${row.managed!.type === 'ebook' ? 'ebooks' : 'audiobooks'}/${row.managed!.id}.${row.managed!.format}`)!),
    })) }, sink, { signal: request.signal, beforeFinalize: request.revalidate, onProgress: request.onProgress });
    await request.checkpoint('verifying', 'closed-unverified');
    const blob = new Blob(chunks as BlobPart[]), verified = await verifyBackupZip(blob);
    return { status: 'verified', outputBytes: blob.size, zipSha256: await digestBlob(blob), entries: verified.entries, durationMs: 1, destination: 'test-opfs' };
  } };
  const prepare = (options: DigitalBackupOptions = { includeEbooks: true, includeAudiobooks: true }) => coordinator.prepare(options);
  return { snapshot, blobs, records, journal, deps, coordinator, destination, prepare };
}

describe('4.2B coordinator: synthetic catalog and small stream integration, not physical SAF/OPFS', () => {
  it.each([[true, false, 2], [false, true, 1], [true, true, 3]] as const)('selects categories independently (%s/%s)', async (includeEbooks, includeAudiobooks, included) => {
    const f = await fixture(), before = structuredClone(f.snapshot), plan = await f.prepare({ includeEbooks, includeAudiobooks });
    expect(plan.manifest.backupVersion).toBe(2); expect(plan.manifest.counts.includedMedia).toBe(included);
    const report = await f.coordinator.export(plan, f.destination, new AbortController().signal);
    expect(report.status).toBe('verified'); expect(f.snapshot).toEqual(before);
    expect(plan.manifest.media.filter(row => row.state === 'omitted').every(row => row.state === 'omitted' && row.reason === 'category-not-selected')).toBe(true);
  });
  it('does not route unchecked options through the v2 coordinator', async () => {
    const f = await fixture(); await expect(f.prepare({ includeEbooks: false, includeAudiobooks: false })).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' });
    expect(f.deps.validateMedia).not.toHaveBeenCalled();
  });
  it('still selects v2 for a selected category with no attachments', async () => {
    const f = await fixture(); f.snapshot.attachments = []; f.snapshot.positions = [];
    const plan = await f.prepare({ includeEbooks: true, includeAudiobooks: false });
    expect(plan.manifest.counts.includedMedia).toBe(0); expect(plan.manifest.backupVersion).toBe(2);
    expect((await f.coordinator.export(plan, f.destination, new AbortController().signal)).status).toBe('verified');
  });
  it('preserves deliberate sessions/progress when media categories are omitted, excluding dependent positions', async () => {
    const f = await fixture(), plan = await f.prepare({ includeEbooks: false, includeAudiobooks: true });
    const reading = JSON.parse(await plan.payloads.find(row => row.archivePath === 'reading.json')!.blob!.text());
    expect(reading.readerPositions).toEqual([]); expect(reading.sessions).toHaveLength(1); expect(reading.progress).toEqual(f.snapshot.progress);
    expect(reading.sessions[0].bookUuid).toBe(f.snapshot.books[0].uuid); expect(reading.sessions[0]).not.toHaveProperty('bookId');
  });
  it('retains a reader position only when the corresponding media is included', async () => {
    const f = await fixture(), plan = await f.prepare();
    const reading = JSON.parse(await plan.payloads.find(row => row.archivePath === 'reading.json')!.blob!.text());
    expect(reading.readerPositions).toEqual(f.snapshot.positions);
  });
  it('freezes the prepared snapshot and strips physical cover/display references', async () => {
    const f = await fixture(); f.snapshot.books[0].capaUrl = 'content://private-display'; const plan = await f.prepare();
    expect(Object.isFrozen(plan)).toBe(true); expect(Object.isFrozen(plan.payloads[0])).toBe(true);
    const books = await plan.payloads[0].blob!.text(); expect(books).not.toContain('content://');
    expect(JSON.stringify(plan.manifest)).not.toContain('storageReference');
    expect(JSON.parse(books)[0].capaLocalPath).toMatch(/^covers\//);
  });
  it.each(['book', 'attachment', 'position', 'history'] as const)('rejects a %s change after preview', async kind => {
    const f = await fixture(), plan = await f.prepare(), execute = vi.spyOn(f.destination, 'execute');
    if (kind === 'book') f.snapshot.books[0].nota = 1;
    if (kind === 'attachment') f.snapshot.attachments[0].storageReference = 'changed';
    if (kind === 'position') f.snapshot.positions[0].location = 'epubcfi(/6/4)';
    if (kind === 'history') f.snapshot.progress[0].currentValue = 4;
    expect(await f.coordinator.export(plan, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', error: 'CONFLICT' });
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects replacement during finalization and never confirms the destination', async () => {
    const f = await fixture(), plan = await f.prepare(), original = f.destination.execute;
    f.destination.confirm = vi.fn();
    f.destination.execute = async request => { const receipt = await original(request); f.snapshot.attachments[0].updatedAt++; return receipt; };
    const result = await f.coordinator.export(plan, f.destination, new AbortController().signal);
    expect(result).toMatchObject({ status: 'failed', error: 'CONFLICT', partialMayRemain: true }); expect(f.destination.confirm).not.toHaveBeenCalled();
  });
  it('aborts requested inaccessible media before selecting a destination', async () => {
    const f = await fixture(); f.deps.validateMedia.mockRejectedValue(new ExportFailure('MEDIA_UNAVAILABLE'));
    await expect(f.prepare()).rejects.toMatchObject({ code: 'MEDIA_UNAVAILABLE' }); expect(f.records.writes).toBe(0);
  });
  it('rejects missing UUID without mutating or materializing one', async () => {
    const f = await fixture(); delete f.snapshot.books[0].uuid;
    await expect(f.prepare()).rejects.toMatchObject({ code: 'INVALID_REFERENCE' }); expect(f.snapshot.books[0].uuid).toBeUndefined();
  });
  it('rejects an invalid parent reference', async () => {
    const f = await fixture(); f.snapshot.attachments[0].bookId = 999;
    await expect(f.prepare()).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
  });
  it('rejects missing media checksum rather than silently omitting a requested file', async () => {
    const f = await fixture(); f.snapshot.attachments[0].checksum = null;
    await expect(f.prepare()).rejects.toMatchObject({ code: 'MEDIA_UNAVAILABLE' });
  });
  it('rejects changed source bytes against snapshot hash', async () => {
    const f = await fixture(), plan = await f.prepare(); f.blobs.set('media/ebooks/proof-epub.epub', new Blob(['different']));
    expect((await f.coordinator.export(plan, f.destination, new AbortController().signal)).status).toBe('failed');
  });
  it('limits the measured byte budget before opening media', async () => {
    const f = await fixture(); await expect(prepareExport(f.snapshot, { includeEbooks: true, includeAudiobooks: true }, f.deps.readCover, 'backup-test', 100)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
  it('cancels before planning', async () => {
    const f = await fixture(), stop = new AbortController(); stop.abort();
    await expect(f.coordinator.prepare({ includeEbooks: true, includeAudiobooks: true }, stop.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  it('cancels after destination selection without starting the writer', async () => {
    const f = await fixture(), plan = await f.prepare(), stop = new AbortController(), writer = vi.spyOn(f.destination, 'execute'); stop.abort();
    expect(await f.coordinator.export(plan, f.destination, stop.signal)).toMatchObject({ status: 'cancelled', partialMayRemain: true }); expect(writer).not.toHaveBeenCalled();
  });
  it('does not report success when cancellation arrives after closed-unverified', async () => {
    const f = await fixture(), plan = await f.prepare(), stop = new AbortController(), original = f.destination.execute;
    f.destination.execute = async request => { const receipt = await original(request); stop.abort(); return receipt; };
    expect((await f.coordinator.export(plan, f.destination, stop.signal)).status).toBe('cancelled');
  });
  it.each(['INSUFFICIENT_SPACE', 'IO_FAILED', 'ARCHIVE_INVALID'] as const)('records %s without mutating catalog or deleting original files', async code => {
    const f = await fixture(), before = await snapshotDigest(f.snapshot), plan = await f.prepare();
    f.destination.execute = async () => { throw new ExportFailure(code); };
    expect(await f.coordinator.export(plan, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', error: code, partialMayRemain: true });
    expect(await snapshotDigest(f.snapshot)).toBe(before);
    expect((await f.records.list<{ stage: string }>('backup-export:'))[0].stage).toBe('failed');
  });
  it('rejects a false verified receipt with missing entries', async () => {
    const f = await fixture(), plan = await f.prepare(), original = f.destination.execute;
    f.destination.execute = async request => ({ ...await original(request), entries: [] });
    expect(await f.coordinator.export(plan, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', error: 'INTEGRITY_MISMATCH' });
  });
  it('rejects a receipt for a different destination instead of confirming it', async () => {
    const f = await fixture(), plan = await f.prepare(), original = f.destination.execute;
    f.destination.confirm = vi.fn();
    f.destination.execute = async request => ({ ...await original(request), destination: 'saf' });
    expect(await f.coordinator.export(plan, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', error: 'INTEGRITY_MISMATCH' });
    expect(f.destination.confirm).not.toHaveBeenCalled();
  });
  it('rejects a false receipt containing duplicate paths', async () => {
    const f = await fixture(), plan = await f.prepare(), original = f.destination.execute;
    f.destination.execute = async request => { const receipt = await original(request); return { ...receipt, entries: receipt.entries.map(() => receipt.entries[0]) }; };
    expect(await f.coordinator.export(plan, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', error: 'INTEGRITY_MISMATCH' });
  });
  it('rejects a false receipt with the right paths and a wrong hash', async () => {
    const f = await fixture(), plan = await f.prepare(), original = f.destination.execute;
    f.destination.execute = async request => { const receipt = await original(request); return { ...receipt, entries: receipt.entries.map(row => ({ ...row, sha256: 'a'.repeat(64) })) }; };
    expect(await f.coordinator.export(plan, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', error: 'INTEGRITY_MISMATCH' });
  });
  it('retains a failed confirmation as unfinished even when the ZIP was verified', async () => {
    const f = await fixture(), plan = await f.prepare(); f.destination.confirm = async () => { throw new ExportFailure('IO_FAILED'); };
    expect(await f.coordinator.export(plan, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', partialMayRemain: true });
    expect(await f.journal.unfinished()).toMatchObject([{ stage: 'failed', outputState: 'closed-unverified' }]);
  });
  it.each(['checkpoint', 'native-receipt'] as const)('distinguishes finished writing from confirmed integrity via %s', async source => {
    const f = await fixture(), plan = await f.prepare();
    f.destination.execute = async request => {
      if (source === 'checkpoint') await request.checkpoint('verifying', 'closed-unverified');
      throw new ExportFailure('IO_FAILED', undefined, source === 'native-receipt');
    };
    expect(await f.coordinator.export(plan, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', outputClosed: true, partialMayRemain: true });
    expect(await f.journal.unfinished()).toMatchObject([{ stage: 'failed', outputState: 'closed-unverified' }]);
  });
  it('cancels during cover planning without writing a journal or changing the catalog', async () => {
    const f = await fixture(), stop = new AbortController(), before = await snapshotDigest(f.snapshot), original = f.deps.readCover;
    f.deps.readCover = async book => { const blob = await original(book); stop.abort(); return blob; };
    await expect(f.coordinator.prepare({ includeEbooks: true, includeAudiobooks: true }, stop.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(f.records.writes).toBe(0); expect(await snapshotDigest(f.snapshot)).toBe(before);
  });
  it('rejects a simultaneous export rather than queueing a stale snapshot', async () => {
    const f = await fixture(), one = await f.prepare(), two = await f.prepare(); let entered!: () => void, release!: () => void;
    const enteredPromise = new Promise<void>(resolve => { entered = resolve; }), releasePromise = new Promise<void>(resolve => { release = resolve; });
    const original = f.destination.execute;
    const holding: ExportDestination = { kind: 'test-opfs', async execute(request) { entered(); await releasePromise; return original(request); } };
    const first = f.coordinator.export(one, holding, new AbortController().signal); await enteredPromise;
    expect(await f.coordinator.export(two, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', error: 'CONFLICT' });
    release(); expect((await first).status).toBe('verified');
  });
  it('does not abandon the first destination when the same operation is submitted twice', async () => {
    const f = await fixture(), plan = await f.prepare(); let entered!: () => void, release!: () => void;
    const enteredPromise = new Promise<void>(resolve => { entered = resolve; }), releasePromise = new Promise<void>(resolve => { release = resolve; });
    const original = f.destination.execute;
    f.destination.abandon = vi.fn(async () => {});
    f.destination.execute = async request => { entered(); await releasePromise; return original(request); };
    const first = f.coordinator.export(plan, f.destination, new AbortController().signal); await enteredPromise;
    expect(await f.coordinator.export(plan, f.destination, new AbortController().signal)).toMatchObject({ status: 'failed', error: 'CONFLICT' });
    expect(f.destination.abandon).not.toHaveBeenCalled();
    release(); expect((await first).status).toBe('verified');
  });
  it('reopens durable unfinished receipts without replaying or changing a destination', async () => {
    const f = await fixture(), plan = await f.prepare(), id = plan.manifest.backupId;
    await f.journal.start(id, plan.snapshotDigest); await f.journal.checkpoint(id, 'transferring', 'incomplete'); const writes = f.records.writes;
    expect(await new BackupExportJournal(f.records).unfinished()).toMatchObject([{ operationId: id, stage: 'transferring', outputState: 'incomplete' }]);
    expect(f.records.writes).toBe(writes);
  });
  it('reads a single persisted domain revision without writing it back', async () => {
    const records = new Records(), db = new WebPersistentDatabaseAdapter(records, async (_name, work) => work()), repo = new BookRepository(db);
    await repo.insert({ origem: 'manual', uuid: 'synthetic-read', titulo: 'Synthetic', autores: [], generos: [], tenho_fisico: false, formato: 'fisico', status_leitura: 'quero_ler', dataCadastro: 1, dataAtualizacao: 1 });
    const writes = records.writes, before = await records.get('domain'), value = await new BackupCatalogRepository(db).read();
    expect(value.books).toHaveLength(1); expect(await records.get('domain')).toEqual(before); expect(records.writes).toBe(writes);
  });
  it('offers all messages in the six supported languages', () => {
    expect(Object.keys(backupExportMessages)).toHaveLength(6);
    for (const values of Object.values(backupExportMessages)) {
      expect(Object.values(values).every(value => value.length > 0)).toBe(true); expect(values.warning).toBeTruthy(); expect(values.unsupported).toBeTruthy();
    }
  });
});
