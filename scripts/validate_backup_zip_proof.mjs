/** Isolated CDP / Firefox BiDi runner. Does not inspect personal browser targets. */
import { writeFile } from 'node:fs/promises';
const [engine = 'chrome', portArg = '9422', label = engine, mode = 'small'] = process.argv.slice(2);
const port = Number(portArg), origin = process.env.ZIP_PROOF_ORIGIN ?? 'http://127.0.0.1:3422';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname) || !/^[a-z-]+$/.test(label)) throw new Error('Only isolated local proof targets');
let socket, target;
if (engine === 'firefox') socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
else {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const tab = targets.find(tab => tab.url === origin + '/');
  if (!tab) throw new Error('Open only the synthetic proof origin in the exclusive browser profile');
  socket = new WebSocket(tab.webSocketDebuggerUrl);
}
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; const pending = new Map();
socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id !== undefined) {
  const callback = pending.get(message.id); if (callback) { pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message))) : callback.resolve(message.result); }
} };
function call(method, params = {}) { return new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); }); }
async function evaluate(expression) {
  if (engine === 'firefox') {
    const result = await call('script.evaluate', { expression: `(async()=>JSON.stringify(await (${expression})))()`, target: { context: target }, awaitPromise: true, userActivation: true });
    if (result.type === 'exception') throw new Error(JSON.stringify(result.exceptionDetails));
    return JSON.parse(result.result.value);
  }
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
let timer; const samples = [], responsiveness = [];
try {
  if (engine === 'firefox') {
    await call('session.new', { capabilities: {} });
    target = (await call('browsingContext.create', { type: 'tab' })).context;
    await call('browsingContext.navigate', { context: target, url: origin + '/', wait: 'complete' });
  } else await call('Performance.enable');
  // Poll until Vite's module loading completes; failures remain visible rather than faked capabilities.
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate('!!window.zipProof')) break;
    await new Promise(resolve => setTimeout(resolve, 250));
    if (attempt === 79) throw new Error('Proof entry did not load');
  }
  const capabilities = await evaluate('window.zipProof.capabilities()'); console.log(JSON.stringify({ capabilities }));
  if (mode === 'capabilities') process.exitCode = 0;
  else if (mode.startsWith('reopen:')) console.log(JSON.stringify(await evaluate(`window.zipProof.reopen(${JSON.stringify(mode.slice(7))})`)));
  else if (mode === 'external') console.log(JSON.stringify(await evaluate('window.zipProof.saveExternal()')));
  else if (mode === 'verify-external') console.log(JSON.stringify(await evaluate('window.zipProof.verifyExternal()')));
  else if (mode === 'diagnose-external') console.log(JSON.stringify(await evaluate('window.zipProof.diagnoseExternal()')));
  else if (mode === 'internal-diagnostic') console.log(JSON.stringify(await evaluate('window.zipProof.prepareExternalDiagnostic()')));
  else {
    let busy = false;
    timer = setInterval(async () => {
      if (busy) return; busy = true;
      try {
        const start = performance.now(); await evaluate('1'); responsiveness.push(performance.now() - start);
        if (engine !== 'firefox') samples.push(await call('Performance.getMetrics'));
      } finally { busy = false; }
    }, 1000);
    const sizes = mode === 'full' ? '[1048576,16777216,67108864,134217728]' : '[1048576]';
    const result = await evaluate(`window.zipProof.run(${JSON.stringify(label)}, ${sizes})`);
    await writeFile(`/tmp/minhaestante-4-2a-${label}-runtime.json`, JSON.stringify({ result, samples, responsivenessMs: responsiveness }, null, 2));
    console.log(JSON.stringify({ completed: true, runs: result.runs.length, crossReads: result.cross.length, maxResponsivenessMs: Math.max(0, ...responsiveness),
      runs: result.runs.map(run => ({ name: run.name, metrics: run.metrics, heapPeak: run.heapPeak, verificationMs: run.verificationMs, pdf: run.pdf })) }));
    // Run a second page load to prove persisted OPFS output is reopened, not just an in-memory Blob.
    if (engine === 'firefox') await call('browsingContext.reload', { context: target, wait: 'complete' });
    else { await call('Page.reload'); await new Promise(resolve => setTimeout(resolve, 1500)); }
    const name = result.runs[0].name;
    const reopened = await evaluate(`window.zipProof.reopen(${JSON.stringify(name)})`);
    await writeFile(`/tmp/minhaestante-4-2a-${label}-reopen.json`, JSON.stringify(reopened)); console.log(JSON.stringify({ reopened }));
  }
} finally { clearInterval(timer); if (engine === 'firefox') await call('session.end').catch(() => undefined); socket.close(); }
