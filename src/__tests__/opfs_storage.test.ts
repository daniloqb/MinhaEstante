import { webStorageMessage } from '../services/storage/digital/web/messages';
import { DigitalStorageException } from '../services/storage/digital/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { IncrementalSha256 } from '../services/storage/digital/web/sha256';
import { WebOpfsStorageProvider, type OpfsCheckpoint } from '../services/storage/digital/web';
import { createWebDigitalLibrary } from '../services/storage/digital/web';
import { DatabaseService } from '../services/database/databaseService';
import { BookStorage } from '../services/storage';
import { WebPersistentDatabaseAdapter, hasPersistedWebCatalog } from '../services/database/webPersistentDatabaseAdapter';
import { BookRepository } from '../services/database/bookRepository';
import { BookAttachmentRepository } from '../services/database/bookAttachmentRepository';
import { ReaderPositionRepository } from '../services/database/readerPositionRepository';
import { ReadingSessionRepository } from '../services/database/readingSessionRepository';
import { ReadingProgressRepository } from '../services/database/readingProgressRepository';
import { TestFiles, TestRecords, testLocks } from './helpers/OpfsTestBackend';
import type { StorageResult, StoredDigitalFile } from '../services/storage/digital';
import { recoverConfiguredWebStorage } from '../services/storage/digital/web/startup';
import { storageFailure } from '../services/storage/digital/errors';

function value<T>(r: StorageResult<T>): T { expect(r.status).toBe('success'); if (r.status !== 'success') throw new Error('Synthetic test failure'); return r.value; }
const pdf = (text = 'synthetic'.repeat(20)) => new Blob([`%PDF-1.4\n${text}\n%%EOF\n`], { type: 'application/pdf' });

describe('incremental SHA-256', () => {
  it.each([0,1,55,56,63,64,65,127,1024,1_000_000])('matches an independent digest at %i bytes', (length) => {
    const bytes = new Uint8Array(length).fill(97), sha = new IncrementalSha256();
    for (let n = 0; n < bytes.length; n += 17) sha.update(bytes.subarray(n,n+17));
    expect(sha.hex()).toBe(createHash('sha256').update(bytes).digest('hex'));
  });
});

describe('OPFS provider + existing coordinator (simulated I/O, real row contracts)', () => {
  let records: TestRecords; let files: TestFiles; let locks: ReturnType<typeof testLocks>;
  let db: WebPersistentDatabaseAdapter; let library: ReturnType<typeof createWebDigitalLibrary>;
  let fail: OpfsCheckpoint | undefined; let bookId: number;
  const recreate = () => createWebDigitalLibrary(db, { records, files, lock: locks, available: () => true,
    checkpoint: async (point) => { if (point === fail) throw new Error('synthetic interruption'); } });
  beforeEach(async () => {
    records = new TestRecords(); files = new TestFiles(); locks = testLocks(); db = new WebPersistentDatabaseAdapter(records, locks);
    library = recreate(); fail = undefined;
    value(await library.service.requestConfiguration({ interaction: 'user-initiated' }));
    const book = await new BookRepository(db).insert({ origem: 'manual', titulo: 'Synthetic OPFS book', autores: [], generos: [],
      tenho_fisico: false, formato: 'fisico', formatos: ['fisico'], status_leitura: 'quero_ler', nota: 8, dataCadastro: 1, dataAtualizacao: 1 });
    bookId = book.id;
  });
  async function imported(id: string, text = 'synthetic'.repeat(20)) {
    const selected = library.provider.registerSource(pdf(text), 'synthetic.pdf', 'application/pdf');
    return library.service.importFile({ operationId: id, selected, type: 'ebook', format: 'pdf' });
  }
  async function attach(stored: StoredDigitalFile, old?: string, decision?: 'invalidate-current') {
    return library.coordinator.applyChange({ bookId, type: 'ebook', imported: stored, intent: old ? 'replace' : 'attach',
      expectedAttachmentId: old, positionDecision: decision });
  }
  it('persists import, commits domain, reads and verifies after recreation', async () => {
    const stored = value(await imported('one')); const row = value(await attach(stored));
    library = recreate();
    expect(await new BookAttachmentRepository(new WebPersistentDatabaseAdapter(records, locks)).getById(row.id)).toEqual(row);
    value(await library.service.verifyIntegrity(stored.file, stored.integrity));
    const access = value(await library.service.acquireReadAccess(stored.file));
    expect(await value(library.provider.resolveReadAccess(access)).text()).toBe(await pdf().text());
    value(await library.service.releaseReadAccess(access)); expect(library.provider.resolveReadAccess(access).status).toBe('error');
  });
  it('does not expose an unlinked prepared file as normal read access', async () => {
    const stored = value(await imported('prepared')); expect(await library.service.acquireReadAccess(stored.file)).toEqual(storageFailure('RECOVERY_REQUIRED'));
  });
  it('same operation is idempotent and a confirmed duplicate reuses bytes and IDs/position', async () => {
    const first = value(await imported('one')); const row = value(await attach(first));
    const positions = new ReaderPositionRepository(db); const position = await positions.savePosition({ attachmentId: row.id, locationType: 'pdf_page', location: '12' });
    const writes = files.writes; expect(value(await imported('one')).file).toEqual(first.file); expect(files.writes).toBe(writes);
    const second = value(await imported('two')); expect(second.file).toEqual(first.file); expect(files.writes).toBe(writes);
    expect(value(await attach(second,row.id)).id).toBe(row.id); expect(await positions.getByAttachmentId(row.id)).toEqual(position);
  });
  it('different content needs position decision; failed domain commit rolls back the position and link', async () => {
    const first = value(await imported('one')); const row = value(await attach(first));
    const positions = new ReaderPositionRepository(db); const pos = await positions.savePosition({ attachmentId: row.id, locationType: 'pdf_page', location: '12' });
    const sessions = new ReadingSessionRepository(db); const session = await sessions.create({ bookId });
    const progressRepo = new ReadingProgressRepository(db); const progress = await progressRepo.saveProgress({ sessionId: session.id, unit: 'pages', currentValue: 10, totalValue: 100, source: 'manual' });
    const before = await new BookRepository(db).getById(bookId);
    const second = value(await imported('two','different edition'));
    expect(await attach(second,row.id)).toEqual(storageFailure('POSITION_POLICY_REQUIRED'));
    records.failCommit = true;
    expect(await attach(second,row.id,'invalidate-current')).toEqual(storageFailure('LINK_PERSISTENCE_FAILED'));
    expect(await positions.getByAttachmentId(row.id)).toEqual(pos); expect(await new BookAttachmentRepository(db).getById(row.id)).toEqual(row);
    records.failCommit = false; library = recreate(); const next = value(await library.coordinator.recover('two'));
    expect('id' in next && next.id).not.toBe(row.id); expect(await positions.getByAttachmentId(row.id)).toBeNull();
    expect(await sessions.getById(session.id)).toEqual(session); expect(await progressRepo.getBySessionId(session.id)).toEqual(progress);
    expect(await new BookRepository(db).getById(bookId)).toEqual(before);
    expect(files.data.has(`committed/${first.file.storageReference}`)).toBe(true);
  });
  it('production startup discovers a configured unfinished receipt without choosing a book implicitly', async () => {
    const stored = value(await imported('startup')); const messages: (string | null)[] = [];
    await recoverConfiguredWebStorage(message => messages.push(message), { records, factory: () => library });
    expect(messages[0]).toContain('Verificando'); expect(messages.at(-1)).toBeNull();
    expect(await new BookAttachmentRepository(db).count()).toBe(0);
    expect(value(await library.provider.getOperation('startup')).stored?.file).toEqual(stored.file);
  });
  it('startup reports unavailable provider APIs explicitly', async () => {
    const messages = vi.fn();
    await recoverConfiguredWebStorage(messages, { records, factory: () => { throw new DigitalStorageException('PROVIDER_UNAVAILABLE'); } });
    expect(messages).toHaveBeenCalledWith(webStorageMessage('PROVIDER_UNAVAILABLE'));
  });
  it('startup does not initialize OPFS when no media library was configured', async () => {
    const factory = vi.fn(() => library), messages = vi.fn();
    await recoverConfiguredWebStorage(messages, { records: new TestRecords(), factory });
    expect(factory).not.toHaveBeenCalled(); expect(messages).not.toHaveBeenCalled();
  });
  it('explicit detach removes the current position but retains bytes and book', async () => {
    const stored = value(await imported('one')); const row = value(await attach(stored));
    await new ReaderPositionRepository(db).savePosition({ attachmentId: row.id, locationType: 'pdf_page', location: '2' });
    expect(await library.coordinator.detach({ attachmentId: row.id, intent: 'detach-only' })).toEqual(storageFailure('POSITION_POLICY_REQUIRED'));
    value(await library.coordinator.detach({ attachmentId: row.id, intent: 'detach-only', positionDecision: 'remove-current' }));
    expect(await new BookAttachmentRepository(db).count()).toBe(0); expect(files.data.has(`committed/${stored.file.storageReference}`)).toBe(true);
    expect(await new BookRepository(db).getById(bookId)).not.toBeNull();
  });
  it.each(['intent','fingerprint','created','writing','staged','verified','promoting','ready'] as const)('preserves interrupted %s state and repeated recovery', async point => {
    fail = point; expect((await imported('broken')).status).toBe('error'); fail = undefined;
    library = recreate(); const first = await library.coordinator.recover('broken'); const second = await library.coordinator.recover('broken');
    const completeStage = ['staged','verified','promoting','ready'].includes(point);
    if (completeStage) { expect(first.status).toBe('success'); expect(second).toEqual(first);
      expect(value(await library.provider.getOperation('broken')).state).toBe('FILE_READY'); }
    else { expect(first.status).toBe('error'); expect(second.status).toBe('error'); }
    expect(await new BookAttachmentRepository(db).count()).toBe(0);
    expect(value(await library.provider.listOperations())).toHaveLength(1);
  });
  it('recovers metadata committed before journal completion and initializes from persisted intent', async () => {
    const stored = value(await imported('one')); fail = 'complete';
    expect(await attach(stored)).toEqual(storageFailure('RECOVERY_REQUIRED'));
    expect(await new BookAttachmentRepository(db).count()).toBe(1);
    fail = undefined; library = recreate(); const boot = await library.initialize(); expect(boot.recovery).toHaveLength(1);
    expect(boot.recovery[0].status).toBe('success'); expect(await new BookAttachmentRepository(db).count()).toBe(1);
    expect(value(await library.provider.getOperation('one')).state).toBe('COMPLETED');
  });
  it('protects a partial file, allows explicit retry from same fingerprint, then accepts another operation', async () => {
    files.failWrite = true; expect((await imported('partial')).status).toBe('error'); files.failWrite = false;
    expect((await recreate().provider.recoverImport('partial')).status).toBe('error');
    const stored = value(await imported('partial')); value(await attach(stored)); value(await imported('next','next edition'));
  });
  it('does not overwrite committed bytes with a divergent hash', async () => {
    const stored = value(await imported('one')); value(await attach(stored));
    const corrupt = pdf('corrupt'); files.data.set(`committed/${stored.file.storageReference}`,corrupt);
    expect(await library.service.verifyIntegrity(stored.file,stored.integrity)).toEqual(storageFailure('INTEGRITY_MISMATCH'));
    expect((await library.coordinator.recover('one')).status).toBe('error');
    expect(files.data.get(`committed/${stored.file.storageReference}`)).toBe(corrupt);
    expect(await new BookAttachmentRepository(db).count()).toBe(1);
  });
  it('quota failure preserves old attachment and position and records recovery information', async () => {
    const row = value(await attach(value(await imported('one'))));
    const pos = await new ReaderPositionRepository(db).savePosition({ attachmentId: row.id, locationType: 'pdf_page', location: '9' });
    files.quota = true; expect(await imported('quota','another edition')).toEqual(storageFailure('INSUFFICIENT_SPACE'));
    expect(await new BookAttachmentRepository(db).getById(row.id)).toEqual(row); expect(await new ReaderPositionRepository(db).getByAttachmentId(row.id)).toEqual(pos);
    expect(value(await library.provider.getOperation('quota')).errorCode).toBe('INSUFFICIENT_SPACE');
  });
  it('Web batch updates preserve attachment IDs, positions and unlisted books', async () => {
    const row = value(await attach(value(await imported('one'))));
    const pos = await new ReaderPositionRepository(db).savePosition({ attachmentId: row.id, locationType: 'pdf_page', location: '9' });
    const repo = new BookRepository(db), before = (await repo.getById(bookId))!;
    const other = await repo.insert({ ...before, id: undefined, uuid: 'another-synthetic-book' });
    const spy = vi.spyOn(DatabaseService, 'getInstance').mockReturnValue(db as unknown as DatabaseService);
    try { await BookStorage.saveAllBooksToDatabase([{ ...before, nota: 9 }]); }
    finally { spy.mockRestore(); }
    expect((await repo.getById(bookId))?.nota).toBe(9); expect(await repo.getById(other.id)).not.toBeNull();
    expect(await new BookAttachmentRepository(db).getById(row.id)).toEqual(row);
    expect(await new ReaderPositionRepository(db).getByAttachmentId(row.id)).toEqual(pos);
  });
  it('journal write failure before intent prevents any byte write', async () => {
    records.failJournal = true; expect(await imported('journal-failure')).toEqual(storageFailure('INSUFFICIENT_SPACE')); expect(files.writes).toBe(0);
  });
  it('concurrent imports serialize without losing journal records', async () => {
    const other = recreate(), a = library.provider.registerSource(pdf('a'),'a.pdf'), b = other.provider.registerSource(pdf('b'),'b.pdf');
    const results = await Promise.all([library.provider.importFile({ operationId:'parallel-a',selected:a,type:'ebook',format:'pdf' }),other.provider.importFile({ operationId:'parallel-b',selected:b,type:'ebook',format:'pdf' })]);
    expect(results.every(r => r.status==='success')).toBe(true); expect(value(await library.provider.listOperations())).toHaveLength(2);
    const recovery = await Promise.all([library.provider.recoverImport('parallel-a'),other.provider.recoverImport('parallel-a')]); expect(recovery.every(r=>r.status==='success')).toBe(true);
  });
  it('rejects invalid tokens, unknown journal versions and unknown namespace versions without deletion', async () => {
    expect(await library.provider.getOperation('../escape')).toEqual(storageFailure('INVALID_REFERENCE'));
    const stored = value(await imported('one')); records.data.get('opfs:operation:one').version = 99;
    expect(await library.provider.getOperation('one')).toEqual(storageFailure('RECOVERY_REQUIRED'));
    expect(files.data.has(`committed/${stored.file.storageReference}`)).toBe(true);
    files.unknownVersion = true; expect(await library.provider.getConfiguration()).toEqual(storageFailure('RECOVERY_REQUIRED'));
  });
  it('keeps unknown files protected, with no adoption or deletion capability', async () => {
    files.data.set('committed/unknown',pdf('unknown'));
    expect(await library.provider.getMetadata({kind:'managed',storageProvider:'web_digital',storageReference:'unknown' as any})).toEqual(storageFailure('INVALID_REFERENCE'));
    expect(await library.provider.deleteManagedFile({file:{kind:'managed',storageProvider:'web_digital',storageReference:'unknown' as any},intent:'delete-managed-file'})).toEqual(storageFailure('UNSUPPORTED_OPERATION'));
    expect(files.data.has('committed/unknown')).toBe(true);
  });
  it('fails explicitly when a required browser API is absent', async () => {
    const unavailable = new WebOpfsStorageProvider({ available: () => false }); expect(await unavailable.getConfiguration()).toEqual(storageFailure('PROVIDER_UNAVAILABLE'));
  });
  it('handles persistence denial and unsupported diagnostics explicitly', async () => {
    const provider = new WebOpfsStorageProvider({records,files,lock:locks,available:()=>true,
      storage:{persist:async()=>false,persisted:async()=>false,estimate:async()=>({usage:10,quota:100})} as StorageManager});
    expect(value(await provider.requestPersistence({interaction:'user-initiated'}))).toEqual({granted:false});
    expect(value(await provider.diagnose())).toMatchObject({persisted:false,estimate:{usage:10,quota:100}});
  });
});

describe('durable Web domain metadata', () => {
  it('distinguishes first migration from an intentionally empty persisted catalog', async () => {
    const records = new TestRecords(); expect(await hasPersistedWebCatalog(records)).toBe(false);
    const db = new WebPersistentDatabaseAdapter(records, testLocks());
    await db.runIsolatedInTransaction(async () => undefined);
    expect(await hasPersistedWebCatalog(records)).toBe(true);
    expect(await new BookRepository(db).count()).toBe(0);
  });
  it('rolls back a failed transaction and keeps data after close/reopen', async () => {
    const records=new TestRecords(),locks=testLocks(),db=new WebPersistentDatabaseAdapter(records,locks);
    const repo=new BookRepository(db);const row=await repo.insert({origem:'manual',titulo:'Synthetic persisted',autores:[],generos:[],formato:'fisico',tenho_fisico:false,status_leitura:'nenhum',dataCadastro:1,dataAtualizacao:1});
    await expect(db.runIsolatedInTransaction(async tx=>{await new BookRepository(tx).update({...row,titulo:'must roll back'});throw new Error('synthetic');})).rejects.toThrow('synthetic');
    await db.close();expect((await new BookRepository(new WebPersistentDatabaseAdapter(records,locks)).getById(row.id))?.titulo).toBe(row.titulo);
  });
  it('serializes updates across two adapter instances without lost rows', async () => {
    const records=new TestRecords(),locks=testLocks();
    const make=(db:WebPersistentDatabaseAdapter,title:string)=>new BookRepository(db).insert({origem:'manual',titulo:title,autores:[],generos:[],formato:'fisico',tenho_fisico:false,status_leitura:'nenhum',dataCadastro:1,dataAtualizacao:1});
    const a=new WebPersistentDatabaseAdapter(records,locks),b=new WebPersistentDatabaseAdapter(records,locks);
    await Promise.all([make(a,'Synthetic A'),make(b,'Synthetic B')]);expect(await new BookRepository(a).count()).toBe(2);
  });
  it('rejects unknown versions and orphan metadata instead of silently dropping rows', async () => {
    const records=new TestRecords(),db=new WebPersistentDatabaseAdapter(records,testLocks());
    records.data.set('domain',{version:1,revision:1,value:{version:99}});
    await expect(db.initialize()).rejects.toThrow('RECOVERY_REQUIRED');
    records.data.set('domain',{version:1,revision:2,value:{version:1,books:[],attachments:[['unknown',{id:'unknown',book_id:5}]],positions:[],sessions:[],progress:[],migrations:[[1,1],[2,1]],autoIncrementId:1}});
    await expect(db.initialize()).rejects.toThrow('RECOVERY_REQUIRED');expect(records.data.get('domain').value.attachments).toHaveLength(1);
  });
  it('without Web Locks, optimistic CAS rejects concurrent stale writes without overwriting data', async () => {
    const records = new TestRecords(); const optimistic = async <T>(_name: string, work: () => Promise<T>) => work();
    const a = new WebPersistentDatabaseAdapter(records, optimistic), b = new WebPersistentDatabaseAdapter(records, optimistic);
    const input = { origem: 'manual' as const, titulo: 'Synthetic CAS', autores: [], generos: [], formato: 'fisico' as const, tenho_fisico: false, status_leitura: 'nenhum' as const, dataCadastro: 1, dataAtualizacao: 1 };
    const results = await Promise.allSettled([new BookRepository(a).insert(input), new BookRepository(b).insert(input)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await new BookRepository(a).count()).toBe(1);
  });
  it('CAS detects a lost cross-context lock instead of overwriting a concurrent commit', async () => {
    const records=new TestRecords();await records.compareAndSet('domain',0,{synthetic:1});
    await expect(records.compareAndSet('domain',0,{synthetic:2})).rejects.toThrow('OPERATION_CONFLICT');
    expect(records.data.get('domain').value).toEqual({synthetic:1});
  });
});
