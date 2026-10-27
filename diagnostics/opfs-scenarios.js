/** Real browser scenarios; use only an isolated diagnostic profile/origin and synthetic data. */
export async function runOpfsBrowserScenarios(base, prefix = `check-${crypto.randomUUID()}`, { requestPersistence = true } = {}) {
const api = { ...base,
  import: (id, options) => base.import(`${prefix}-${id}`, options),
  recover: id => base.recover(`${prefix}-${id}`), read: id => base.read(`${prefix}-${id}`),
}, results=[];
window.opfsResults=results;
const check=(test,passed)=>{results.push({test,passed:!!passed});if(!passed)throw new Error('Synthetic assertion: '+test);};
const ok=r=>r?.status==='success',code=r=>r?.error?.code,same=(a,b)=>JSON.stringify(a,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)===JSON.stringify(b,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
check('OPFS configured',ok(await api.configure()));await api.createBook();
await api.selectFixture('epub');let run=await api.import('browser-r2-epub',{link:true});check('EPUB written and linked',ok(run.imported)&&ok(run.linked));
check('confirmed EPUB readable',(await api.read('browser-r2-epub')).status==='success');
await api.seedPosition();await api.seedHistory();
let before=await api.snapshot();const firstRef=run.imported.value.file.storageReference,firstId=run.linked.value.id;
run=await api.import('browser-r2-epub-identical',{link:true,replace:true});
check('identical bytes reused',ok(run.linked)&&run.imported.value.file.storageReference===firstRef);
check('identical identity and position preserved',run.linked.value.id===firstId&&same(before.positions,(await api.snapshot()).positions));
await api.selectFixture('mp3');run=await api.import('browser-r2-audio',{link:true});check('audio written and linked',ok(run.linked));
await api.seedPosition('audiobook');before=await api.snapshot();
await api.selectFixture('pdf','other edition');run=await api.import('browser-r2-pdf-unconfirmed',{link:true,replace:true});
check('different edition needs explicit decision',code(run.linked)==='POSITION_POLICY_REQUIRED'&&same(before,await api.snapshot()));
api.failNextCommit();run=await api.import('browser-r2-pdf-rollback',{link:true,replace:true,decision:'invalidate-current'});
check('IndexedDB rollback preserves attachment and position',code(run.linked)==='LINK_PERSISTENCE_FAILED'&&same(before,await api.snapshot()));
check('recovery links verified PDF',ok(await api.recover('browser-r2-pdf-rollback')));
let after=await api.snapshot();check('old CFI removed; audio position preserved',after.positions.filter(Boolean).length===1&&same(before.positions.find(p=>p?.locationType==='audio_seconds'),after.positions.find(p=>p?.locationType==='audio_seconds')));
check('sessions progress and bibliography preserved',same(before.book,after.book)&&same(before.sessions,after.sessions)&&same(before.progress,after.progress));
await api.seedPosition();before=await api.snapshot();
await api.selectFixture('epub','next edition');api.setFailure('complete');run=await api.import('browser-r2-finalize',{link:true,replace:true,decision:'invalidate-current'});api.setFailure();
check('metadata commit before journal completion',code(run.linked)==='RECOVERY_REQUIRED');
check('reconcile actual persisted metadata',ok(await api.recover('browser-r2-finalize')));
after=await api.snapshot();check('PDF page not reused on EPUB',after.positions.filter(Boolean).length===1&&same(before.sessions,after.sessions));
const once=await api.snapshot();check('recovery idempotent',ok(await api.recover('browser-r2-finalize'))&&same(once,await api.snapshot()));
await api.seedPosition();check('detach decision required',code(await api.detach('ebook'))==='POSITION_POLICY_REQUIRED');
check('explicit detach keeps bytes',ok(await api.detach('ebook','remove-current'))&&(await api.read('browser-r2-finalize')).status==='success');
check('audio and history preserved after detach',(await api.snapshot()).attachments.length===1&&same(once.sessions,(await api.snapshot()).sessions));
await api.selectFixture('pdf','checkpoint synthetic');
for(const point of ['fingerprint','writing','staged','verified','promoting','ready']){
 const id='browser-r2-fault-'+point;api.setFailure(point);run=await api.import(id);api.setFailure();
 check(point+' interruption reported',run.imported.status==='error');
 const a=await api.recover(id),b=await api.recover(id);
 if(['fingerprint','writing'].includes(point))check(point+' remains protected pending',a.status==='error'&&b.status==='error');
 else check(point+' recovery idempotent',ok(a)&&same(a,b));
}
const snapshot=await api.snapshot();window.opfsBaseline=snapshot;
check('quota diagnostics available',ok(await api.diagnose()));
if (!requestPersistence) return {passed:results.filter(r=>r.passed).length,total:results.length,results};
const persisted=await api.library.provider.requestPersistence({interaction:'user-initiated'});check('persistence result explicit',ok(persisted)&&typeof persisted.value.granted==='boolean');
return {passed:results.filter(r=>r.passed).length,total:results.length,results,persistenceGranted:persisted.value?.granted};
}
