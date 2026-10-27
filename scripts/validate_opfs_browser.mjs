/** Node 22+ CDP runner. Start the diagnostic server and an isolated Chromium profile first.
 * node scripts/validate_opfs_browser.mjs 9333 http://127.0.0.1:3211
 * Use 9444/http://localhost:3211 for the explicitly forwarded Android diagnostic tab.
 */
const port = Number(process.argv[2] ?? 9333);
const origin = new URL(process.argv[3] ?? 'http://127.0.0.1:3211');
if (!['localhost','127.0.0.1'].includes(origin.hostname)) throw new Error('Only a local diagnostic origin is allowed.');
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab = tabs.find(t => t.url === `${origin.origin}/diagnostics/opfs.html`);
if (!tab) throw new Error('Open the diagnostic page in an isolated test profile first.');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject) => { ws.onopen=resolve; ws.onerror=reject; });
try {
  const result = await new Promise((resolve,reject) => {
    const timeout = setTimeout(() => reject(new Error('Browser test timed out; inspect the isolated diagnostic page.')),120000);
    ws.onmessage = event => { const message=JSON.parse(event.data); if(message.id===1) {clearTimeout(timeout);resolve(message.result);} };
    ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{awaitPromise:true,returnByValue:true,userGesture:true,
      expression:"(async()=>{const {runOpfsBrowserScenarios}=await import('/diagnostics/opfs-scenarios.js');return runOpfsBrowserScenarios(window.opfsDiagnostic)})()"}}));
  });
  if(result.exceptionDetails) throw new Error('Synthetic browser scenario failed; inspect window.opfsResults.');
  console.log(JSON.stringify(result.result.value,null,2));
  if(result.result.value.passed !== result.result.value.total) process.exitCode=1;
} finally {ws.close();}
