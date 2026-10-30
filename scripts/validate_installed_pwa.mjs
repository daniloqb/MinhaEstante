/** Isolated Chrome PWA validation via the official CDP pipe (PWA commands require it).
 * Start the cross-platform preview server first. Profiles and test media are retained.
 * stdin commands after initial checks: update, close.
 */
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import assert from 'node:assert/strict';
const origin=new URL(process.argv[2]??'http://127.0.0.1:3214').origin;
// Optional Phase 3 UI validation, using the same installed-PWA lifecycle runner.
const management=process.argv.includes('--attachments');
const backupExport=process.argv.includes('--backup-export');
const externalBackup=backupExport&&process.argv.includes('--external-backup');
const diagnostic=backupExport?'/diagnostics/backup-export.html':management?'/diagnostics/attachments-management.html':'/diagnostics/cross-platform.html';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Only isolated local test origins are allowed');
const profile=mkdtempSync('/tmp/minhaestante-pwa-installed-');
const chrome=spawn(process.env.CHROME_BIN??'/opt/google/chrome/chrome',[...(externalBackup?[]:['--headless=new']),'--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-pipe','about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let serial=0,buffer='',session,appTarget,baseline;
const waiting=new Map(),attachments=[];
chrome.stdio[4].on('data',bytes=>{buffer+=bytes.toString();let end;while((end=buffer.indexOf('\0'))>=0){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(message.method==='Target.attachedToTarget')attachments.push(message);const w=waiting.get(message.id);if(w){waiting.delete(message.id);clearTimeout(w.timer);message.error?w.reject(new Error(message.error.message)):w.resolve(message.result);}}});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{waiting.delete(id);reject(new Error(`Timeout: ${method}`));},120000);waiting.set(id,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true},session);if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(){for(let i=0;i<100;i++){try{if(await evaluate(backupExport?'!!window.backupExportTest':management?'!!window.attachmentManagement':'!!window.opfsDiagnostic')){
 if(management&&baseline)await evaluate(`window.attachmentManagement.start(${JSON.stringify(baseline.snapshot.book.uuid)})`);
 if(backupExport&&baseline)await evaluate('window.backupExportTest.resume()');
 return;
}}catch{}await delay(100);}throw new Error('Diagnostic page unavailable');}
async function launch(){
 const r=await call('PWA.launch',{manifestId:origin+'/',url:origin+diagnostic});appTarget=r.targetId;
 const parent=(await call('Target.attachToTarget',{targetId:appTarget,flatten:true})).sessionId;
 const info=(await call('Target.getTargetInfo',{targetId:appTarget})).targetInfo;
 session=parent;
 if(info.type==='tab'){
   await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},parent);
   let attached;
   for(let i=0;i<100;i++){attached=attachments.find(e=>e.sessionId===parent&&e.params.targetInfo.type==='page');if(attached)break;await delay(50);}
   if(!attached)throw new Error('Installed tab did not expose its page target');session=attached.params.sessionId;
 }
 await call('Page.navigate',{url:origin+diagnostic},session);await ready();
}

const proof=backupExport?`(async()=>{const a=window.backupExportTest;await a.prepare();const r=await a.export(false);return {snapshot:await a.stateDigest(),verified:r.report.status,preserved:r.preserved,standalone:matchMedia('(display-mode: standalone)').matches,offline:!navigator.onLine}})()`:management?`(async()=>{const a=window.attachmentManagement;return {snapshot:await a.snapshot(),verified:await a.verifyAll(),standalone:matchMedia('(display-mode: standalone)').matches,offline:!navigator.onLine}})()`:`(async()=>{const a=window.opfsDiagnostic,s=await a.snapshot(),ebook=s.attachments.find(a=>a.type==='ebook');const listed=await a.list(),op=listed.value.find(o=>o.stored?.file.storageReference===ebook.storageReference);const verified=await a.library.service.verifyIntegrity(op.stored.file,op.stored.integrity);return {snapshot:s,verified:verified.status,standalone:matchMedia('(display-mode: standalone)').matches,offline:!navigator.onLine,build:document.querySelector('meta[name="digital-test-build"]')?.content};})()`;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function assertProof(value, expected) {
 assert.equal(value.standalone,true,'Installed window must be standalone');
 assert.ok(backupExport?value.verified==='verified'&&value.preserved:management?value.verified.length===2&&value.verified.every(r=>r.status==='success'):value.verified==='success','File integrity must pass');
 if(expected)assert.ok(same(expected.snapshot,value.snapshot),'Persisted snapshot changed');
}
async function online(value){await call('Network.enable',{},session);await call('Network.emulateNetworkConditions',{offline:!value,latency:0,downloadThroughput:-1,uploadThroughput:-1},session);}
async function close(){try{await call('Browser.close');}catch{}process.stdin.pause();process.exitCode??=0;}
try{
 const first=await call('Target.createTarget',{url:origin+'/'});session=(await call('Target.attachToTarget',{targetId:first.targetId,flatten:true})).sessionId;
 await delay(700);
 await call('PWA.install',{manifestId:origin+'/',installUrlOrBundleUrl:origin+'/'});
 await call('PWA.changeAppUserSettings',{manifestId:origin+'/',displayMode:'standalone'});
 await call('PWA.getOsAppState',{manifestId:origin+'/'});
 await launch();
 const configured=await evaluate("(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;return {standalone:matchMedia('(display-mode: standalone)').matches};})()");
 if(!configured.standalone)throw new Error('Installed app did not open standalone');
 const conformance=await evaluate(backupExport?'window.backupExportTest.seed()':management?'window.attachmentManagement.run()':'window.runDigitalConformance()');
 if(management){
  await evaluate(`(async()=>{await window.attachmentManagement.choose('epub');[...document.querySelectorAll('button')].find(b=>b.textContent==='Adicionar e-book').click();await new Promise(r=>setTimeout(r,80));await window.attachmentManagement.idle();await window.attachmentManagement.seedPosition('ebook');await window.attachmentManagement.seedPosition('audiobook');})()`);
 }
 baseline=await evaluate(proof);
 assertProof(baseline);
 console.log(JSON.stringify({stage:'installed',passed:conformance.passed,total:conformance.total??conformance.passed,standalone:baseline.standalone,verified:baseline.verified,profile}));
 if(externalBackup) {
   await evaluate('window.backupExportTest.prepare()');
   const external=await evaluate('window.backupExportTest.export(true)');
   assert.equal(external.report.status,'verified');assert.equal(external.preserved,true);
   console.log(JSON.stringify({stage:'external-backup',standalone:baseline.standalone,preserved:external.preserved,receipt:external.report.receipt}));
 }
 await call('Target.closeTarget',{targetId:appTarget});await launch();const reopened=await evaluate(proof);
 assertProof(reopened,baseline);
 console.log(JSON.stringify({stage:'reopened-installed-app',sameMetadata:same(baseline.snapshot,reopened.snapshot),verified:reopened.verified,standalone:reopened.standalone}));
 await online(false);await call('Page.reload',{ignoreCache:false},session);await ready();const offline=await evaluate(proof);
 assertProof(offline,baseline);assert.equal(offline.offline,true);
 console.log(JSON.stringify({stage:'offline-reload',sameMetadata:same(baseline.snapshot,offline.snapshot),verified:offline.verified,offline:offline.offline,standalone:offline.standalone}));
 if(process.argv.includes('--once')) { await close(); }
 else {
 process.stdin.setEncoding('utf8');process.stdin.on('data',async input=>{try{if(input.trim()==='close'){await close();return;}if(input.trim()==='update'){
   await online(true);await evaluate("(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();for(let i=0;i<80&&(r.installing||r.waiting);i++){r.waiting?.postMessage({type:'SKIP_WAITING'});await new Promise(v=>setTimeout(v,100));}return true;})()");
   await call('Page.reload',{ignoreCache:true},session);await ready();const updated=await evaluate(proof);
   assertProof(updated,baseline);
   console.log(JSON.stringify({stage:'service-worker-update',sameMetadata:same(baseline.snapshot,updated.snapshot),verified:updated.verified,build:updated.build}));
 }}catch(error){console.log(JSON.stringify({error:error.message}));process.exitCode=1;}});
 console.log(JSON.stringify({awaiting:'update or close'}));
 }
}catch(error){console.error(JSON.stringify({error:error.message}));await close();process.exitCode=1;}
