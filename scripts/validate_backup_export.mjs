/** Exclusive synthetic DEV profiles/targets only. Artifacts stay in /tmp or their owned OPFS. */
import { writeFile } from 'node:fs/promises';
const [portArg = '9442', label = 'chrome', mode = 'full', paddingArg = '1048576'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label)) throw Error('Invalid diagnostic label');
const origin = process.env.BACKUP_EXPORT_ORIGIN ?? 'http://127.0.0.1:3423', path = '/diagnostics/backup-export.html';
if (!['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw Error('Exclusive local origin required');
const firefox = process.env.BACKUP_EXPORT_ENGINE === 'firefox';
let socket, target;
if (firefox) socket = new WebSocket(`ws://127.0.0.1:${Number(portArg)}/session`);
else {
  const targets = await (await fetch(`http://127.0.0.1:${Number(portArg)}/json`)).json(), tab = targets.find(tab => (tab.url === origin + path || mode==='open' && tab.url.startsWith(origin+'/'))
    && (!process.env.BACKUP_EXPORT_TARGET_ID || tab.id === process.env.BACKUP_EXPORT_TARGET_ID));
  if (!tab) throw Error('Open the DEV backup export diagnostic in its exclusive profile');
  socket = new WebSocket(tab.webSocketDebuggerUrl);
}
await new Promise((resolve,reject) => { socket.onopen=resolve;socket.onerror=reject; });
let sequence = 0; const pending = new Map();
socket.onmessage = event => { const message=JSON.parse(event.data); if(message.id!==undefined){const next=pending.get(message.id);pending.delete(message.id);if(next){if(message.error)next.reject(Error(JSON.stringify(message.error)));else next.resolve(message.result);}} };
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
async function evaluate(expression) {
  if(firefox){const value=await call('script.evaluate',{expression:`(async()=>JSON.stringify(await (${expression})))()`,target:{context:target},awaitPromise:true,userActivation:true});if(value.type==='exception')throw Error(JSON.stringify(value.exceptionDetails));return JSON.parse(value.result.value);}
  const value = await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(value.exceptionDetails)throw Error(JSON.stringify(value.exceptionDetails));return value.result.value;
}
let timer;
try {
  if(firefox){await call('session.new',{capabilities:{}});target=(await call('browsingContext.create',{type:'tab'})).context;await call('browsingContext.navigate',{context:target,url:origin+path,wait:'complete'});}
  else if(mode==='open') { await call('Page.navigate',{url:origin+path}); }
  else if(mode==='seed'||mode==='full'||mode==='ui') { await evaluate('delete window.backupExportTest'); await call('Page.reload'); }
  for(let i=0;i<100;i++){if(await evaluate('!!window.backupExportTest'))break;await new Promise(resolve=>setTimeout(resolve,100));}
  const api='window.backupExportTest';
  if(mode==='open'){console.log(JSON.stringify({diagnosticReady:await evaluate(`!!${api}`)}));}
  else if(mode==='seed'){console.log(JSON.stringify(await evaluate(`${api}.seed(${Number(paddingArg)})`)));}
  else if(mode==='prepare'){console.log(JSON.stringify(await evaluate(`${api}.prepare()`)));}
  else if(mode==='external'){console.log(JSON.stringify(await evaluate(`${api}.export(true)`)));}
  else if(mode==='recovery'){console.log(JSON.stringify(await evaluate(`${api}.recovery()`)));}
  else if(mode==='transaction'){console.log(JSON.stringify(await evaluate(`${api}.transactionProbe()`)));}
  else if(mode==='snapshot'){console.log(JSON.stringify(await evaluate(`${api}.snapshotIsolationProbe()`)));}
  else if(mode==='ui') {
    if(firefox) throw Error('Keyboard/layout runner requires CDP; Firefox streaming has a separate real run');
    await evaluate(`${api}.resume()`);await evaluate(`${api}.useUiTestDestination()`);
    const waitFor = async expression => {
      for(let i=0;i<600;i++) { if(await evaluate(expression))return; await new Promise(resolve=>setTimeout(resolve,50)); }
      throw Error('UI state did not settle');
    };
    const section='document.querySelector("[data-backup-v2-dev]")';
    await waitFor(`${section} && !${section}.querySelector('button').disabled`);
    const initial=await evaluate(`({checked:[...${section}.querySelectorAll('input')].some(x=>x.checked),calls:${api}.legacyCalls()})`);
    if(initial.checked)throw Error('Media options must start unchecked');
    await evaluate(`${section}.querySelector('button').click()`);
    await waitFor(`${api}.legacyCalls()===${initial.calls+1}`);
    const layouts=[];
    for(const locale of ['pt-BR','en-US','es-ES','fr-FR','de-DE','it-IT']) {
      await evaluate(`${api}.render(${JSON.stringify(locale)})`);
      for(const width of [320,768])for(const scale of [100,200]) {
        await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
        await evaluate(`document.documentElement.style.fontSize='${scale}%'`);
        const value=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,checkboxes:${section}.querySelectorAll('input[type=checkbox]').length,live:!!${section}.querySelector('[aria-live=polite]')})`);
        if(value.scroll>value.width+1||value.checkboxes!==2||!value.live)throw Error('Layout/accessibility regression');
        layouts.push({locale,width,scale});
      }
    }
    await call('Emulation.clearDeviceMetricsOverride');await evaluate("document.documentElement.style.fontSize='100%'");
    await evaluate(`${api}.render('en-US')`);
    await waitFor(`${section} && !${section}.querySelector('button').disabled`);
    await evaluate(`${section}.querySelector('input').focus()`);
    for(const type of ['keyDown','keyUp'])await call('Input.dispatchKeyEvent',{type,key:' ',code:'Space',windowsVirtualKeyCode:32,...(type==='keyDown'?{text:' '}:{})});
    if(!await evaluate(`${section}.querySelector('input').checked`))throw Error('Keyboard checkbox toggle failed');
    await evaluate(`${section}.querySelector('button').click()`);
    await waitFor(`!!document.querySelector('[data-backup-preview]') && ${section}.getAttribute('aria-busy')==='false'`);
    await evaluate(`[...${section}.querySelectorAll('button')].find(x=>x.textContent==='Select destination and export').click()`);
    await waitFor(`${section}.getAttribute('aria-busy')==='true' && [...${section}.querySelectorAll('button')].some(x=>x.textContent==='Cancel')`);
    await evaluate(`[...${section}.querySelectorAll('button')].find(x=>x.textContent==='Cancel').click()`);
    await waitFor(`${section}.getAttribute('aria-busy')==='false' && ${section}.textContent.includes('Export cancelled.')`);
    const result=await evaluate(`(async()=>({unchecked:[...${section}.querySelectorAll('input')].every(x=>!x.checked),focus:${section}.querySelector('button')===document.activeElement,preserved:await ${api}.preserved(),cancelled:${section}.textContent.includes('Export cancelled.')}))()`);
    await writeFile(`/tmp/minhaestante-4-2b-${label}-ui.json`,JSON.stringify({initial,layouts,result,destination:'test-opfs; no external picker claim'},null,2));
    if(!result.unchecked||!result.focus||!result.preserved||!result.cancelled)throw Error('Cancel/focus/catalog regression: '+JSON.stringify(result));
    console.log(JSON.stringify({passed:true,layouts:layouts.length,...result}));
  }
  else if(mode==='fault'){
    const fault=['write','finalize','verify'].includes(paddingArg)?paddingArg:'write';
    await evaluate(`${api}.prepare()`);const result=await evaluate(`${api}.export(true,null,${JSON.stringify(fault)})`);
    if(result.report.status!=='failed'||!result.preserved)throw Error('Controlled fault did not preserve catalog');
    await writeFile(`/tmp/minhaestante-4-2b-${label}-fault.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }
  else {
    const seed=await evaluate(`${api}.seed(${Number(paddingArg)})`);console.log(JSON.stringify({seed}));
    const legacy=await evaluate(`${api}.legacy()`);const observations=[],pings=[];let pingPending=false;
    timer=setInterval(async()=>{if(pingPending)return;pingPending=true;const start=performance.now();try{await evaluate('1');pings.push(performance.now()-start);}finally{pingPending=false;}},100);
    for(const [includeEbooks,includeAudiobooks] of [[true,false],[false,true],[true,true]]){
      const plan=await evaluate(`${api}.prepare(${JSON.stringify({includeEbooks,includeAudiobooks})})`);
      const start=performance.now(),outcome=await evaluate(`${api}.export(false)`);
      if(outcome.report.status!=='verified'||!outcome.preserved){
        await writeFile(`/tmp/minhaestante-4-2b-${label}-failed.json`,JSON.stringify({plan,outcome},null,2));
        console.log(JSON.stringify({failed:outcome}));throw Error('Export did not verify');
      }
      if(seed.provider==='web_digital' && process.env.BACKUP_EXPORT_TRANSFER==='true') await evaluate(`${api}.transfer(${JSON.stringify(outcome.report.operationId)})`);
      observations.push({plan,outcome,wallMs:performance.now()-start});
    }
    await evaluate(`${api}.prepare()`);const cancelled=await evaluate(`${api}.export(false,1)`);
    if(cancelled.report.status!=='cancelled'||!cancelled.preserved)throw Error('Cancellation did not preserve data');
    const result={seed,legacy,observations,cancelled,pingsMs:pings,maxPingMs:Math.max(0,...pings)};
    await writeFile(`/tmp/minhaestante-4-2b-${label}.json`,JSON.stringify(result,null,2));
    console.log(JSON.stringify({complete:true,runs:observations.length,cancelled:cancelled.report.status,maxPingMs:result.maxPingMs,
      results:observations.map(row=>({counts:row.plan.counts,receipt:row.outcome.report.receipt}))}));
  }
} finally {clearInterval(timer);if(firefox)await call('session.end').catch(()=>{});socket.close();}
