import type { Book } from '../../types/book';
import type { BookAttachment, ReaderPosition, ReadingSession, ReadingProgress, AttachmentFormat, AttachmentType } from '../../types/digitalMedia';
import type { StorageResult, StoredDigitalFile } from '../../services/storage/digital/contracts';

export interface ConformanceSnapshot {
  book: Book | null; attachments: BookAttachment[]; positions: (ReaderPosition | null)[];
  sessions: ReadingSession[]; progress: (ReadingProgress | null)[];
}
export interface ConformanceHarness {
  createBook(): Promise<unknown>;
  select(format: AttachmentFormat, variant?: 'base' | 'different' | 'invalid', large?: boolean, unknownSize?: boolean): Promise<void>;
  import(id: string, options?: { link?: boolean; replace?: boolean; decision?: 'invalidate-current'; failCommit?: boolean; failFinalize?: boolean; interrupt?: boolean; cancel?: boolean }): Promise<{ imported: StorageResult<StoredDigitalFile>; linked?: StorageResult<BookAttachment> }>;
  snapshot(): Promise<ConformanceSnapshot>;
  seedPosition(type?: AttachmentType): Promise<unknown>;
  seedHistory(): Promise<unknown>;
  detach(type: AttachmentType, decision?: 'remove-current'): Promise<StorageResult<unknown>>;
  recover(id: string): Promise<StorageResult<unknown>>;
  verify(id: string): Promise<StorageResult<unknown>>;
}
const canonical=(value:unknown)=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const sameConformanceValue=(a:unknown,b:unknown)=>canonical(a)===canonical(b);

/** Identical domain assertions on real native and browser harnesses, or explicitly labelled doubles. */
export async function runDigitalConformance(h: ConformanceHarness, prefix=`dev-conformance-${crypto.randomUUID()}`) {
  const checks: { scenario: string; passed: boolean }[]=[];
  const check=(scenario:string,passed:unknown)=>{checks.push({scenario,passed:!!passed});if(!passed)throw new Error(`Conformance failed: ${scenario}`);};
  const ok=(r?:StorageResult<unknown>)=>r?.status==='success';
  const error=(r?:StorageResult<unknown>)=>r?.status==='error'?r.error.code:undefined;
  const id=(name:string)=>`${prefix}-${name}`;
  await h.createBook(); const baseline=(await h.snapshot()).book;
  for(const format of ['epub','pdf','mp3','m4a','m4b'] as const) {
    await h.select(format);const imported=await h.import(id(format));
    check(`${format}: verified managed file`,ok(imported.imported));
    check(`${format}: reopened SHA-256`,ok(await h.verify(id(format))));
    check(`${format}: repeated recovery`,ok(await h.recover(id(format)))&&ok(await h.recover(id(format))));
  }
  await h.select('epub','invalid');check('invalid file rejected without link',!ok((await h.import(id('invalid'),{link:true})).imported)&&(await h.snapshot()).attachments.length===0);
  await h.select('pdf','base',false,true);check('unknown declared size is safe',ok((await h.import(id('unknown'))).imported));
  await h.select('epub');let result=await h.import(id('ebook'),{link:true});check('ebook attached',ok(result.linked));
  await h.select('mp3');result=await h.import(id('audio'),{link:true});check('ebook and audio coexist',ok(result.linked)&&(await h.snapshot()).attachments.length===2);
  await h.seedHistory();
  for(const format of ['epub','pdf','mp3'] as const) {
    const type:AttachmentType=format==='mp3'?'audiobook':'ebook';
    if(format==='pdf') {await h.select('pdf');result=await h.import(id('switch-pdf'),{link:true,replace:true,decision:'invalidate-current'});check('PDF preparation',ok(result.linked));}
    await h.seedPosition(type); const before=await h.snapshot(); const previous=before.attachments.find(a=>a.type===type)!;
    await h.select(format);
    result=await h.import(id(`same-${format}`),{link:true,replace:true});
    const identical=await h.snapshot();
    check(`${format}: identical replacement preserves identity and position`,ok(result.linked)&&identical.attachments.find(a=>a.type===type)?.id===previous.id&&sameConformanceValue(before.positions,identical.positions));
    await h.select(format,'different');
    result=await h.import(id(`guard-${format}`),{link:true,replace:true});check(`${format}: incompatible position requires confirmation`,error(result.linked)==='POSITION_POLICY_REQUIRED');
    const beforeRollback=await h.snapshot();
    result=await h.import(id(`rollback-${format}`),{link:true,replace:true,decision:'invalidate-current',failCommit:true});
    check(`${format}: rollback preserves link and position`,error(result.linked)==='LINK_PERSISTENCE_FAILED'&&sameConformanceValue(beforeRollback,await h.snapshot()));
    check(`${format}: recovery after metadata failure`,ok(await h.recover(id(`rollback-${format}`))));
    const next=await h.snapshot();
    check(`${format}: incompatible position invalidated after commit`,next.positions.filter(Boolean).every(p=>p!.attachmentId!==previous.id&&p!.attachmentId!==next.attachments.find(a=>a.type===type)!.id));
    check(`${format}: other attachment and deliberate history preserved`,sameConformanceValue(beforeRollback.attachments.filter(a=>a.type!==type),next.attachments.filter(a=>a.type!==type))&&sameConformanceValue(before.sessions,next.sessions)&&sameConformanceValue(before.progress,next.progress));
  }
  await h.select('pdf','different');result=await h.import(id('finalization'),{link:true,replace:true,decision:'invalidate-current',failFinalize:true});
  check('SQLite/IndexedDB commit before final journal',error(result.linked)==='RECOVERY_REQUIRED');
  check('reconcile persisted link without duplication',ok(await h.recover(id('finalization')))&&(await h.snapshot()).attachments.length===2);
  const beforeDetach=await h.snapshot();check('detach only audio',ok(await h.detach('audiobook','remove-current')));
  const detached=await h.snapshot();check('ebook survives detach',detached.attachments.length===1&&sameConformanceValue(detached.attachments[0],beforeDetach.attachments.find(a=>a.type==='ebook')));
  check('bibliography and history unchanged',sameConformanceValue(baseline,detached.book)&&sameConformanceValue(beforeDetach.sessions,detached.sessions)&&sameConformanceValue(beforeDetach.progress,detached.progress));
  await h.select('pdf','different');result=await h.import(id('interrupted'),{interrupt:true});check('interrupted write never links incomplete bytes',!ok(result.imported)&&(await h.snapshot()).attachments.length===1);
  const recoveredOnce=await h.recover(id('interrupted')), recoveredTwice=await h.recover(id('interrupted'));
  check('interrupted recovery repeat remains safe',recoveredOnce.status===recoveredTwice.status&&(!ok(recoveredOnce)||sameConformanceValue(recoveredOnce,recoveredTwice))&&(await h.snapshot()).attachments.length===1);
  await h.select('pdf');const parallel=await Promise.all([h.import(id('parallel-one')),h.import(id('parallel-two'))]);
  check('concurrent imports keep separate identities',parallel.every(r=>ok(r.imported))&&parallel[0].imported.status==='success'&&parallel[1].imported.status==='success'&&parallel[0].imported.value.operationId!==parallel[1].imported.value.operationId);
  check('concurrent recovery does not duplicate links', (await Promise.all([h.recover(id('parallel-one')),h.recover(id('parallel-two'))])).every(ok)&&(await h.snapshot()).attachments.length===1);
  await h.select('pdf','base',true);result=await h.import(id('cancelled'),{cancel:true});check('cancellation never confirms partial bytes',result.imported.status==='cancelled'&&(await h.snapshot()).attachments.length===1);
  return { passed:checks.filter(c=>c.passed).length,total:checks.length,checks,bookUuid:baseline?.uuid };
}
