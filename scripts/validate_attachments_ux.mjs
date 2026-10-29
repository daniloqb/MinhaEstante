/** DEV only, dedicated synthetic profile/origin. Requires the packaged management diagnostic.
 * node scripts/validate_attachments_ux.mjs 9383 http://127.0.0.1:3383
 * Native DEV: forward only its WebView socket, use https://localhost and --native.
 * Picker completion is injected. Keyboard uses protocol events; storage/DB are real.
 */
import assert from 'node:assert/strict';
const port = Number(process.argv[2] ?? 9383), origin = new URL(process.argv[3] ?? 'http://127.0.0.1:3383').origin;
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw Error('Local synthetic origins only');
const native = process.argv.includes('--native');
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab = tabs.find(t => t.type === 'page' && t.url.startsWith(origin + '/diagnostics/attachments-management.html'));
if (!tab) throw Error('Open the isolated DEV management diagnostic first');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let serial = 0;
const waiting = new Map();
ws.onmessage = event => {
  const m = JSON.parse(event.data), w = waiting.get(m.id);
  if (w) { waiting.delete(m.id); clearTimeout(w.timer); m.error ? w.reject(Error(m.error.message)) : w.resolve(m.result); }
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial, timer = setTimeout(() => { waiting.delete(id); reject(Error('Timeout: ' + method)); }, 60000);
  waiting.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const wait = condition => evaluate(`(async()=>{for(let i=0;i<300;i++){if(${condition})return true;await new Promise(r=>setTimeout(r,50));}throw Error('UI condition timed out')})()`);
const click = (text, scope = 'document', prefix = false) => evaluate(`(()=>{const b=[...${scope}.querySelectorAll('button')].find(b=>b.textContent${prefix ? '.startsWith' : '==='}${prefix ? '(' : ''}${JSON.stringify(text)}${prefix ? ')' : ''}&&!b.disabled);if(!b)throw Error('Missing synthetic action: '+${JSON.stringify(text)});b.closest('details')?.setAttribute('open','');b.focus();b.click()})()`);
const idle = async () => { await evaluate('new Promise(r=>setTimeout(r,80))'); await evaluate('window.attachmentManagement.idle()'); };
const snapshot = () => evaluate('window.attachmentManagement.snapshot()');
const key = async (value, shift = false) => {
  const windowsVirtualKeyCode = { Tab: 9, Escape: 27, Enter: 13, ' ': 32 }[value];
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value === ' ' ? 'Space' : value, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers: shift ? 8 : 0, ...(value === 'Enter' ? { text: '\r' } : value === ' ' ? { text: ' ' } : {}) });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: value === ' ' ? 'Space' : value, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers: 0 });
};
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const slot = type => `document.querySelector('[data-attachment-slot=${type}]')`;
const dialogOpen = () => wait("document.querySelector('dialog[open]')");
const geometry = () => evaluate(`(()=>{const d=document.querySelector('dialog[open]'),s=d??document.querySelector('section:has([data-attachment-slot])'),r=s.getBoundingClientRect();return {overflow:[s,...s.querySelectorAll('*')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>({tag:e.tagName,width:e.clientWidth,scroll:e.scrollWidth})),bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},width:innerWidth,height:innerHeight,controls:[...s.querySelectorAll('button,summary')].filter(e=>e.getClientRects().length).map(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width})),scrollable:!d||d.scrollHeight<=d.clientHeight||getComputedStyle(d).overflowY==='auto'}})()`);
async function layouts(label) {
  let count = 0;
  for (const width of [320, 360, 392, 430, 768, 1280]) for (const scale of [100, 130, 150, 200]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
    await evaluate(`document.documentElement.style.fontSize='${scale}%'`);
    const g = await geometry();
    assert.deepEqual(g.overflow, [], `${label} ${width}px ${scale}% overflow`);
    assert.ok(g.scrollable && g.bounds.left >= -1 && g.bounds.right <= g.width + 1, `${label} bounds`);
    if (label.includes('dialog')) assert.ok(g.bounds.top >= -1 && g.bounds.bottom <= g.height + 1, 'Modal fits viewport');
    assert.ok(g.controls.every(c => c.height >= 43 && c.width > 0), `${label} control size`);
    count++;
  }
  await evaluate('document.documentElement.style.fontSize="100%"');
  await call('Emulation.clearDeviceMetricsOverride');
  return count;
}
try {
  await call('Page.bringToFront');
  // Keep the real worker lifecycle, but do not validate a stale cached UI after a rebuild.
  await evaluate(`(async()=>{const r=await navigator.serviceWorker?.getRegistration();if(!r)return;
    await r.update();for(let i=0;i<100;i++){r.waiting?.postMessage({type:'SKIP_WAITING'});
      await new Promise(resolve=>setTimeout(resolve,50));if(!r.installing&&!r.waiting)return;}
    throw Error('Test build worker did not activate');})()`);
  await call('Page.reload', { ignoreCache: true });
  await wait('window.attachmentManagement');
  const suite = await evaluate('window.attachmentManagement.run()');
  assert.equal(suite.provider, native ? 'saf_document' : 'web_digital', 'Runtime provider must match the declared environment');
  console.log(JSON.stringify({ stage: 'management', ...suite }));
  await evaluate("window.attachmentManagement.choose('epub','long')"); await click('Adicionar e-book'); await idle();
  await evaluate('window.attachmentManagement.seedPosition()');
  await evaluate("window.attachmentManagement.seedPosition('audiobook')");
  const baseline = await snapshot();
  let layoutCount = 0;
  for (const locale of ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT']) {
    const t = await evaluate(`window.attachmentManagement.render('${locale}')`);
    await evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)");
    layoutCount += await layouts(locale + ' section');
    await evaluate("window.attachmentManagement.choose('epub','long')"); await click(t.replace, slot('ebook')); await dialogOpen();
    check(locale + ' safe initial focus', await evaluate(`document.activeElement?.textContent===${JSON.stringify(t.cancelAction)}`));
    layoutCount += await layouts(locale + ' replace dialog');
    const ax = await call('Accessibility.getFullAXTree');
    check(locale + ' named dialog in accessibility tree', ax.nodes.some(n => !n.ignored && n.role?.value === 'dialog' && n.name?.value === t.confirmReplace));
    for (let i = 0; i < 8; i++) { await key('Tab', i % 3 === 0); check(locale + ' focus trapped ' + i, await evaluate("!!document.activeElement?.closest('dialog[open]')")); }
    await key('Escape'); await idle();
    check(locale + ' escape returns focus', await evaluate(`document.activeElement?.textContent===${JSON.stringify(t.replace)}`));
    assert.deepEqual(await snapshot(), baseline, 'Escape preserves all domain data');
    await click(t.detach, slot('ebook')); await dialogOpen();
    layoutCount += await layouts(locale + ' detach dialog');
    await key('Enter'); await idle();
    check(locale + ' Enter on Cancel preserves state', !await evaluate("!!document.querySelector('dialog[open]')"));
    assert.deepEqual(await snapshot(), baseline);
    await click(t.detach, slot('ebook')); await dialogOpen(); await key(' '); await idle();
    check(locale + ' Space on Cancel closes dialog', !await evaluate("!!document.querySelector('dialog[open]')"));
    assert.deepEqual(await snapshot(), baseline);
    console.log(JSON.stringify({ stage: 'layout-and-keyboard', locale, combinations: 72 }));
  }
  check('432 layout combinations', layoutCount === 432);
  await evaluate("window.attachmentManagement.render('pt-BR')");
  const companion = await evaluate('window.attachmentManagement.navigationFixture()');
  await evaluate("window.attachmentManagement.render('pt-BR','app')");
  const openBook = async (book, activation = 'Enter') => {
    const label = JSON.stringify(`Livro: ${book.titulo}, autor: Synthetic`);
    const cover = JSON.stringify(`${book.titulo} — Synthetic`);
    await wait(`[...document.querySelectorAll('button,[role=button]')].some(b=>[${label},${cover}].includes(b.getAttribute('aria-label')))`);
    await evaluate(`[...document.querySelectorAll('button,[role=button]')].find(b=>[${label},${cover}].includes(b.getAttribute('aria-label'))).focus()`);
    await key(activation);
    await wait("document.querySelector('[data-attachment-slot]')"); await idle();
  };
  const back = async () => { await evaluate("document.querySelector('button[title=Voltar]').click()"); await wait("!document.querySelector('[data-attachment-slot]')"); };
  await openBook(baseline.book);
  assert.deepEqual(await snapshot(), baseline);
  check('Home opens correct attachments', await evaluate(`document.querySelector('[data-attachment-slot=ebook]').textContent.includes(${JSON.stringify(baseline.attachments.find(a => a.type === 'ebook').filename)})`));
  await click('Desassociar arquivo', slot('ebook')); await dialogOpen();
  await evaluate('window.onAndroidBackPressed()'); await idle();
  check('Back cancels modal before leaving details (actual app callback)', await evaluate("!document.querySelector('dialog[open]')&&!!document.querySelector('[data-attachment-slot]')"));
  assert.deepEqual(await snapshot(), baseline);
  await evaluate("document.querySelector('button[title=\"Editar dados\"]').click()");
  await wait("document.querySelector('button[aria-label=Fechar]')");
  await evaluate("document.querySelector('button[aria-label=Fechar]').click()"); await idle();
  assert.deepEqual(await snapshot(), baseline); check('Edit and return preserve domain', true);
  await back();
  await click('Meus Livros', 'document', true).catch(async () => { await evaluate("[...document.querySelectorAll('nav button')].find(b=>b.textContent.endsWith('Estante')).click()"); });
  for (const filter of ['Meus Livros', 'Lido', 'Emprestados']) {
    await click(filter, 'document', true); await openBook(companion);
    check(filter + ' opens companion without mixing attachments', await evaluate("!document.querySelector('[data-attachment-slot] details')"));
    await back();
  }
  await click('Quero Ler', 'document', true); await openBook(baseline.book);
  assert.deepEqual(await snapshot(), baseline); check('Shelf return preserves UUID, links, positions and history', true);
  await back(); await evaluate("document.querySelector('button[title=Lista]').click()");
  await openBook(baseline.book, ' '); assert.deepEqual(await snapshot(), baseline);
  check('List title opens details with Space', true);
  await back(); await evaluate("document.querySelector('button[title=Capas]').click()");
  await openBook(baseline.book, ' '); assert.deepEqual(await snapshot(), baseline);
  check('Cover opens details with Space', true);
  await back(); await evaluate("[...document.querySelectorAll('nav button')].find(b=>b.textContent==='Explorar').click()");
  await wait("document.querySelector('input')");
  await evaluate("[...document.querySelectorAll('nav button')].find(b=>b.textContent.endsWith('Estante')).click()");
  await click('Quero Ler', 'document', true); await openBook(baseline.book); assert.deepEqual(await snapshot(), baseline);
  check('Explore and return preserve attachments', true);
  await evaluate("window.attachmentManagement.render('pt-BR')");
  const before = await snapshot();
  await call('Page.reload'); await wait('window.attachmentManagement'); await evaluate(`window.attachmentManagement.start('${suite.bookUuid}')`);
  assert.deepEqual(await snapshot(), before);
  check('reload preserves complete snapshot', true);
  check('both SHA hashes pass', (await evaluate('window.attachmentManagement.verifyAll()')).every(r => r.status === 'success'));
  console.log(JSON.stringify({ stage: 'ux-complete', passed: checks.length, checks, layoutCombinations: layoutCount, bookUuid: suite.bookUuid,
    native, keyboard: 'CDP protocol; no screen reader', back: 'application callback; hardware Back requires separate test', picker: 'injected completion' }));
} finally { await call('Emulation.clearDeviceMetricsOverride').catch(() => {}); ws.close(); }
