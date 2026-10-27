/** Isolated Chrome PWA validation via the official CDP pipe (PWA commands require it).
 * Start the cross-platform preview server first. Profiles and test media are retained.
 * stdin commands after initial checks: update, close.
 */
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
const origin=new URL(process.argv[2]??'http://127.0.0.1:3214').origin;
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Only isolated local test origins are allowed');
const profile=mkdtempSync('/tmp/minhaestante-pwa-installed-');
const chrome=spawn(process.env.CHROME_BIN??'/opt/google/chrome/chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-pipe','about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let serial=0,buffer='',session,appTarget,baseline;
const waiting=new Map(),attachments=[];
chrome.stdio[4].on('data',bytes=>{buffer+=bytes.toString();let end;while((end=buffer.indexOf('\0'))>=0){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(message.method==='Target.attachedToTarget')attachments.push(message);const w=waiting.get(message.id);if(w){waiting.delete(message.id);clearTimeout(w.timer);message.error?w.reject(new Error(message.error.message)):w.resolve(message.result);}}});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{waiting.delete(id);reject(new Error(`Timeout: ${method}`));},120000);waiting.set(id,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true},session);if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(){for(let i=0;i<100;i++){try{if(await evaluate('!!window.opfsDiagnostic'))return;}catch{}await delay(100);}console.log(JSON.stringify({diagnostic:await evaluate('({url:location.href,title:document.title,ready:document.readyState,api:!!window.opfsDiagnostic})')}));throw new Error('Diagnostic page unavailable');}
async function launch(){
 const r=await call('PWA.launch',{manifestId:origin+'/',url:origin+'/diagnostics/cross-platform.html'});appTarget=r.targetId;
 const parent=(await call('Target.attachToTarget',{targetId:appTarget,flatten:true})).sessionId;
 const info=(await call('Target.getTargetInfo',{targetId:appTarget})).targetInfo;
 session=parent;
 if(info.type==='tab'){
   await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},parent);
   let attached;
   for(let i=0;i<100;i++){attached=attachments.find(e=>e.sessionId===parent&&e.params.targetInfo.type==='page');if(attached)break;await delay(50);}
   if(!attached)throw new Error('Installed tab did not expose its page target');session=attached.params.sessionId;
 }
 await call('Page.navigate',{url:origin+'/diagnostics/cross-platform.html'},session);await ready();
}

const proof=`(async()=>{const a=window.opfsDiagnostic,s=await a.snapshot(),ebook=s.attachments.find(a=>a.type==='ebook');const listed=await a.list(),op=listed.value.find(o=>o.stored?.file.storageReference===ebook.storageReference);const verified=await a.library.service.verifyIntegrity(op.stored.file,op.stored.integrity);return {snapshot:s,verified:verified.status,standalone:matchMedia('(display-mode: standalone)').matches,offline:!navigator.onLine,build:document.querySelector('meta[name="digital-test-build"]')?.content};})()`;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function online(value){await call('Network.enable',{},session);await call('Network.emulateNetworkConditions',{offline:!value,latency:0,downloadThroughput:-1,uploadThroughput:-1},session);}
async function close(){try{await call('Browser.close');}catch{}process.stdin.pause();process.exitCode=0;}
try{
 const first=await call('Target.createTarget',{url:origin+'/'});session=(await call('Target.attachToTarget',{targetId:first.targetId,flatten:true})).sessionId;
 await delay(700);
 await call('PWA.install',{manifestId:origin+'/',installUrlOrBundleUrl:origin+'/'});
 await call('PWA.changeAppUserSettings',{manifestId:origin+'/',displayMode:'standalone'});
 await call('PWA.getOsAppState',{manifestId:origin+'/'});
 await launch();
 const configured=await evaluate("(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;return {standalone:matchMedia('(display-mode: standalone)').matches};})()");
 if(!configured.standalone)throw new Error('Installed app did not open standalone');
 const conformance=await evaluate('window.runDigitalConformance()');baseline=await evaluate(proof);
 console.log(JSON.stringify({stage:'installed',passed:conformance.passed,total:conformance.total,standalone:baseline.standalone,verified:baseline.verified}));
 await call('Target.closeTarget',{targetId:appTarget});await launch();const reopened=await evaluate(proof);
 console.log(JSON.stringify({stage:'reopened-installed-app',sameMetadata:same(baseline.snapshot,reopened.snapshot),verified:reopened.verified,standalone:reopened.standalone}));
 await online(false);await call('Page.reload',{ignoreCache:false},session);await ready();const offline=await evaluate(proof);
 console.log(JSON.stringify({stage:'offline-reload',sameMetadata:same(baseline.snapshot,offline.snapshot),verified:offline.verified,offline:offline.offline,standalone:offline.standalone}));
 process.stdin.setEncoding('utf8');process.stdin.on('data',async input=>{try{if(input.trim()==='close'){await close();return;}if(input.trim()==='update'){
   await online(true);await evaluate("(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();for(let i=0;i<80&&(r.installing||r.waiting);i++){r.waiting?.postMessage({type:'SKIP_WAITING'});await new Promise(v=>setTimeout(v,100));}return true;})()");
   await call('Page.reload',{ignoreCache:true},session);await ready();const updated=await evaluate(proof);
   console.log(JSON.stringify({stage:'service-worker-update',sameMetadata:same(baseline.snapshot,updated.snapshot),verified:updated.verified,build:updated.build}));
 }}catch(error){console.log(JSON.stringify({error:error.message}));}});
 console.log(JSON.stringify({awaiting:'update or close'}));
}catch(error){console.error(JSON.stringify({error:error.message}));await close();process.exitCode=1;}
