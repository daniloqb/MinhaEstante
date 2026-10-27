import { runDigitalConformance } from '../digital/conformance';
import { webConformanceHarness } from '../digital/webHarness';
import { createWebDigitalLibrary, type OpfsCheckpoint } from '../../services/storage/digital/web';
import { BrowserOpfsFiles } from '../../services/storage/digital/web/OpfsFiles';
import { IndexedDbStore } from '../../services/storage/web/IndexedDbStore';
import { WebPersistentDatabaseAdapter } from '../../services/database/webPersistentDatabaseAdapter';
import { BookRepository } from '../../services/database/bookRepository';
import { BookAttachmentRepository } from '../../services/database/bookAttachmentRepository';
import { ReaderPositionRepository } from '../../services/database/readerPositionRepository';
import { ReadingSessionRepository } from '../../services/database/readingSessionRepository';
import { ReadingProgressRepository } from '../../services/database/readingProgressRepository';
import { getExpectedLocationTypeForFormat, type AttachmentFormat, type AttachmentType } from '../../types/digitalMedia';
import { webStorageMessage } from '../../services/storage/digital/web/messages';
import { storageFailure } from '../../services/storage/digital/errors';
import type { AttachmentChangeRequest, SelectedDigitalFile, StorageResult } from '../../services/storage/digital';

// Explicit diagnostic entry only, never imported by production navigation.
const appCatalog = import.meta.env.VITE_DIGITAL_TEST_CATALOG === 'true';
const records = new IndexedDbStore(appCatalog ? 'minhaestante-durable-v1' : 'minhaestante-opfs-diagnostic-v1');
const db = new WebPersistentDatabaseAdapter(records);
let fail: OpfsCheckpoint | undefined, pause: OpfsCheckpoint | undefined, failCommit = false;
let paused = false; let release: (() => void) | undefined;
const observed: string[] = [];
const diagnosticDb = {
  initialize: () => db.initialize(), query: <T>(sql: string, params?: any[]) => db.query<T>(sql, params), execute: (sql: string, params?: any[]) => db.execute(sql, params),
  close: () => db.close(), runInTransaction: <T>(fn: Parameters<typeof db.runInTransaction<T>>[0]) => db.runInTransaction(fn),
  runIsolatedInTransaction: <T>(fn: Parameters<typeof db.runInTransaction<T>>[0]) => db.runIsolatedInTransaction(async tx => {
    const result = await fn(tx); if (failCommit) { failCommit = false; throw new Error('Synthetic metadata failure'); } return result;
  }),
};
const library = createWebDigitalLibrary(diagnosticDb, { records, files: new BrowserOpfsFiles(navigator.storage, appCatalog ? 'minhaestante' : 'minhaestante-opfs-diagnostic'), checkpoint: async point => {
  observed.push(point);
  if (point === pause) { paused = true; await new Promise<void>(resolve => { release = resolve; }); paused = false; }
  if (point === fail) throw new Error('Synthetic interruption');
} });
const books = new BookRepository(db), attachments = new BookAttachmentRepository(db), positions = new ReaderPositionRepository(db);
let selected: SelectedDigitalFile | undefined;
const fixtureSelections = new Map<string, SelectedDigitalFile>();
const unwrap = <T>(r: StorageResult<T>): T => { if (r.status !== 'success') throw new Error(r.status === 'error' ? r.error.code : r.code); return r.value; };
async function book() {
  const all = (await books.getAll()).filter(b => b.observacoes === 'opfs-synthetic-v1');
  if (!all.length) throw new Error('Synthetic book unavailable'); return all.sort((a,b)=>b.id-a.id)[0];
}
const api = {
  library, records, db, observed,
  get state() { return { paused, fail, pause }; },
  configure: () => library.service.requestConfiguration({ interaction:'user-initiated' }),
  diagnose: () => library.provider.diagnose(),
  async createBook() { return books.insert({ origem:'manual',titulo:'OPFS synthetic',autores:[],generos:[],tenho_fisico:false,formato:'fisico',formatos:['fisico'],status_leitura:'quero_ler',nota:8,observacoes:'opfs-synthetic-v1',dataCadastro:Date.now(),dataAtualizacao:Date.now() }); },
  async selectFixture(format: AttachmentFormat, content = 'synthetic', size = 0, unknownSize = false) {
    const key=JSON.stringify([format,content,size]);const cached=fixtureSelections.get(key);
    if(cached){selected=unknownSize?{...cached,sizeBytes:undefined}:cached;return {size:cached.sizeBytes!};}
    let bytes: Blob;
    if (format === 'pdf') bytes = new Blob(['%PDF-1.4\n',content,new Uint8Array(size),'\n%%EOF\n'],{type:'application/pdf'});
    else if (format === 'epub') {
      const {default:JSZip} = await import('jszip');const zip=new JSZip();
      zip.file('mimetype','application/epub+zip',{compression:'STORE'});zip.file('META-INF/container.xml','<container/>');zip.file('synthetic.txt',content);
      bytes=await zip.generateAsync({type:'blob',compression:'STORE'});
    } else if (format === 'mp3') bytes=new Blob(['ID3',new Uint8Array(256),content],{type:'audio/mpeg'});
    else { const head = new Uint8Array([0,0,0,24,102,116,121,112,77,52,65,32,0,0,0,0,105,115,111,109,109,112,52,50]);bytes=new Blob([head,content],{type:'audio/mp4'}); }
    selected=library.provider.registerSource(bytes,`synthetic.${format}`);fixtureSelections.set(key,selected);if(unknownSize)selected={...selected,sizeBytes:undefined};return {size:bytes.size};
  },
  selectInvalid() { selected=library.provider.registerSource(new Blob(['invalid synthetic']),'invalid.epub'); },
  retention: () => library.provider.retentionDiagnostics(),
  async import(id: string, options: { link?:boolean; replace?:boolean; decision?:'invalidate-current'; cancel?:boolean } = {}) {
    if(!selected)throw new Error('Select synthetic fixture first');
    const format=selected.filename.split('.').pop() as AttachmentFormat, type:AttachmentType=['pdf','epub'].includes(format)?'ebook':'audiobook';
    const abort=new AbortController();
    const imported=await library.service.importFile({operationId:id,selected,type,format},{signal:abort.signal,onProgress:p=>{if(options.cancel&&p.stage==='copying'&&p.bytesProcessed>0)abort.abort();}});
    if(imported.status!=='success'||!options.link)return {imported};
    const target=await book(), old=await attachments.getByBookAndType(target.id,type);
    const request: AttachmentChangeRequest={bookId:target.id,type,imported:imported.value,intent:options.replace?'replace':'attach',expectedAttachmentId:options.replace?old?.id:undefined,positionDecision:options.decision};
    return {imported,linked:await library.coordinator.applyChange(request)};
  },
  async seedPosition(type:AttachmentType='ebook') { const row=await attachments.getByBookAndType((await book()).id,type);if(!row)throw new Error('No synthetic attachment');return positions.savePosition({attachmentId:row.id,locationType:getExpectedLocationTypeForFormat(row.format),location:row.format==='epub'?'epubcfi(/6/2)':'12'}); },
  async seedHistory() { const session=await new ReadingSessionRepository(db).create({bookId:(await book()).id});await new ReadingProgressRepository(db).saveProgress({sessionId:session.id,unit:'pages',currentValue:10,totalValue:100,source:'manual'});return session.id; },
  async snapshot() { const target=await book(),rows=await attachments.getByBookId(target.id),sessions=await new ReadingSessionRepository(db).getHistoryByBookId(target.id);return {book:target,attachments:rows,positions:await Promise.all(rows.map(r=>positions.getByAttachmentId(r.id))),sessions,progress:await Promise.all(sessions.map(s=>new ReadingProgressRepository(db).getBySessionId(s.id)))}; },
  async detach(type:AttachmentType, decision?:'remove-current') { const row=await attachments.getByBookAndType((await book()).id,type);return row?library.coordinator.detach({attachmentId:row.id,intent:'detach-only',positionDecision:decision}):storageFailure('INVALID_REFERENCE'); },
  async read(id:string) { const r=unwrap(await library.provider.getOperation(id));if(!r.stored)throw new Error('No stored file');const access=await library.service.acquireReadAccess(r.stored.file);if(access.status!=='success')return access;const bytes=unwrap(library.provider.resolveReadAccess(access.value));await library.service.releaseReadAccess(access.value);return {status:'success',size:bytes.size}; },
  setFailure(point?:OpfsCheckpoint) { fail=point; }, setPause(point?:OpfsCheckpoint) {pause=point;}, release() {release?.();}, failNextCommit() {failCommit=true;},
  recover: (id:string)=>library.coordinator.recover(id), list:()=>library.provider.listOperations(),
};
export type OpfsDiagnostic = typeof api;
(globalThis as any).opfsDiagnostic=api;
(globalThis as any).runDigitalConformance=()=>runDigitalConformance(webConformanceHarness(api));
const output=(value:unknown)=>{document.getElementById('results')!.textContent=JSON.stringify(value,null,2);};
document.getElementById('configure')!.onclick=()=>{void api.configure().then(output);};
document.getElementById('persist')!.onclick=()=>{void library.provider.requestPersistence({interaction:'user-initiated'}).then(result=>{
 document.getElementById('message')!.textContent=result.status==='success'&&!result.value.granted?webStorageMessage('persistence-denied'):result.status==='error'?webStorageMessage(result.error.code):'Solicitação concluída.';output(result);
});};
document.getElementById('recover')!.onclick=()=>{document.getElementById('message')!.textContent=webStorageMessage('recovering');void library.initialize().then(output);};
