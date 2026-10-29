/** DEV only. Use a dedicated synthetic profile/origin and open diagnostics/attachments-management.html.
 * node scripts/validate_attachments_management.mjs 9282 http://127.0.0.1:3282
 * Native DEV WebView: forward its socket, then use 9327 https://localhost.
 * Picker completion is explicitly injected; UI, hashing, storage and DB transactions are real.
 */
import assert from 'node:assert/strict';
const port=Number(process.argv[2]??9282),origin=new URL(process.argv[3]??'http://127.0.0.1:3282').origin;
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Only local synthetic diagnostic origins');
const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab=tabs.find(t=>t.type==='page'&&t.url.startsWith(origin+'/diagnostics/attachments-management.html'));
if(!tab)throw Error('Open the isolated DEV management diagnostic first');
async function connect(url){
 const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const waiting=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data),w=waiting.get(m.id);if(w){waiting.delete(m.id);clearTimeout(w.timer);m.error?w.reject(Error(m.error.message)):w.resolve(m.result);}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const next=++id,timer=setTimeout(()=>{waiting.delete(next);reject(Error('Timed out: '+method));},120000);waiting.set(next,{resolve,reject,timer});ws.send(JSON.stringify({id:next,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??'Diagnostic failed');return r.result.value;};
 const ready=()=>evaluate(`(async()=>{for(let i=0;i<200;i++){if(window.attachmentManagement)return true;await new Promise(r=>setTimeout(r,100));}throw Error('DEV management unavailable');})()`);
 return {call,evaluate,ready,close:()=>ws.close()};
}
const c=await connect(tab.webSocketDebuggerUrl);let other;
const uiClick=label=>`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)}&&!b.disabled);if(!b)throw Error('Missing action');const d=b.closest('details');if(d)d.open=true;b.focus();b.click();})()`;
const dialogReady=`(async()=>{for(let i=0;i<300;i++){if(document.querySelector('dialog[open]'))return true;await new Promise(r=>setTimeout(r,50));}throw Error('Confirmation unavailable');})()`;
const settled=`(async()=>{await new Promise(r=>setTimeout(r,80));await window.attachmentManagement.idle();return true;})()`;
try{
 await c.call('Page.bringToFront');
 await c.call('Network.enable');await c.call('Network.setCacheDisabled',{cacheDisabled:true});await c.call('Network.setBypassServiceWorker',{bypass:true});
 await c.call('Page.reload',{ignoreCache:true});await c.ready();const suite=await c.evaluate('window.attachmentManagement.run()');assert.ok(suite.passed>0);
 console.log(JSON.stringify({stage:'management',...suite}));
 if(suite.provider==='web_digital'){
  await c.evaluate(`window.attachmentManagement.choose('mp3')`);await c.evaluate(uiClick('Substituir arquivo'));await c.evaluate(dialogReady);
  const created=await c.call('Target.createTarget',{url:origin+'/diagnostics/attachments-management.html'});
  const list=await(await fetch(`http://127.0.0.1:${port}/json`)).json();const target=list.find(t=>t.id===created.targetId);
  other=await connect(target.webSocketDebuggerUrl);await other.ready();
  await other.evaluate(`window.attachmentManagement.start(${JSON.stringify(suite.bookUuid)})`);
  await other.evaluate(`window.attachmentManagement.choose('mp3','different')`);await other.evaluate(uiClick('Substituir arquivo'));await other.evaluate(dialogReady);
  await other.evaluate(uiClick('Confirmar substituição'));await other.evaluate(settled);await other.evaluate(`window.attachmentManagement.seedPosition('audiobook')`);
  const winner=await other.evaluate('window.attachmentManagement.snapshot()');
  await c.call('Page.bringToFront');
  await c.evaluate(uiClick('Confirmar substituição'));await c.evaluate(settled);
  assert.deepEqual(await c.evaluate('window.attachmentManagement.snapshot()'),winner);
  assert.ok(await c.evaluate(`document.querySelector('section')?.textContent.includes('já foi ocupada')`));
  console.log(JSON.stringify({stage:'two-real-tabs',winnerAndPositionPreserved:true}));
  other.close();other=undefined;await c.call('Target.closeTarget',{targetId:created.targetId});
 }
 const before=await c.evaluate('window.attachmentManagement.snapshot()');
 await c.call('Page.reload');await c.ready();await c.evaluate(`window.attachmentManagement.start(${JSON.stringify(suite.bookUuid)})`);
 assert.deepEqual(await c.evaluate('window.attachmentManagement.snapshot()'),before);
 const verified=await c.evaluate('window.attachmentManagement.verifyAll()');assert.ok(verified.every(r=>r.status==='success'));
 console.log(JSON.stringify({stage:'reload',identicalSnapshot:true,verified}));
 console.log(JSON.stringify({stage:'responsive',...await c.evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth})`)}));
}finally{other?.close();c.close();}
