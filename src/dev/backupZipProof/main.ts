import { BrowserOpfsFiles } from '../../services/storage/digital/web/OpfsFiles';
import { IndexedDbStore } from '../../services/storage/web/IndexedDbStore';
import { WebOpfsStorageProvider } from '../../services/storage/digital/web/WebOpfsStorageProvider';
import { DigitalFileStorageService } from '../../services/storage/digital/DigitalFileStorageService';
import { syntheticProofInput, describeProofSource } from '../../services/storage/backupV2/experimental/syntheticDataset';
import { boundedBlobStream, ProofFailure, verifyProofZip, writeProofZip } from '../../services/storage/backupV2/experimental/streamingProof';
import type { ProofInput, ProofProgress } from '../../services/storage/backupV2/experimental/streamingProof';
import type { AttachmentFormat } from '../../types/digitalMedia';
import type { StorageResult } from '../../services/storage/digital/contracts';
import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { digestBlob } from '../../services/storage/backupV2/export/prepare';

if (!['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('Local synthetic origin required');
const namespace = 'minhaestante-backup-zip-proof';
const records = new IndexedDbStore(namespace), files = new BrowserOpfsFiles(navigator.storage, namespace);
const provider = new WebOpfsStorageProvider({ records, files });
const service = new DigitalFileStorageService([provider]);
const result = document.querySelector<HTMLPreElement>('#result')!;
function unwrap<T>(value: StorageResult<T>): T { if (value.status !== 'success') throw new Error(value.status === 'error' ? value.error.code : value.code); return value.value; }
const directory = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(`${namespace}-artifacts`, { create: true });
const report = (value: unknown) => { result.textContent = JSON.stringify(value, null, 2); };
const heap = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
let latest: { input: ProofInput; sizes: number[] } | undefined;
let cancelled: AbortController | undefined;
let diagnosticExternal: { handle: FileSystemFileHandle; internal: File } | undefined;

async function artifact(name: string) { return (await directory()).getFileHandle(name, { create: true }); }
async function upload(name: string, file: File | Blob) {
  const response = await fetch(`/__proof/${name}`, { method: 'POST', body: file });
  if (!response.ok) throw new Error('Synthetic artifact transfer failed');
}
async function materializeSource(source: ProofInput['sources'][number]) {
  const handle = await artifact(`source-${source.archivePath.split('/').pop()}`);
  await (await source.open()).pipeTo(await handle.createWritable()); return handle.getFile();
}
async function managedInput(paddingBytes: number) {
  const input = await syntheticProofInput(paddingBytes);
  unwrap(await service.requestConfiguration({ interaction: 'user-initiated' }));
  const sources = [];
  for (const source of input.sources) {
    if (!source.archivePath.startsWith('media/')) { sources.push(source); continue; }
    const file = await materializeSource(source), format = source.archivePath.split('.').pop() as AttachmentFormat;
    const selected = provider.registerSource(file, `synthetic.${format}`);
    const operationId = `proof-${paddingBytes}-${format}`;
    const stored = unwrap(await service.importFile({ operationId, selected, format, type: format === 'mp3' ? 'audiobook' : 'ebook' }));
    unwrap(await service.verifyIntegrity(stored.file, stored.integrity));
    // DEV adapter for an unlinked FILE_READY receipt. Same provider/files/journal, no fake link or second catalog.
    // Production acquireReadAccess requires a confirmed association; 4.2B must expose a deliberate managed-source port.
    sources.push({ archivePath: source.archivePath, sizeBytes: file.size, open: async () => {
      unwrap(await service.verifyIntegrity(stored.file, stored.integrity));
      return boundedBlobStream(await files.read('committed', stored.file.storageReference));
    } });
  }
  return { ...input, sources };
}
async function crossRead(label: string) {
  const names = await (await fetch('/__proof/list')).json() as string[], results = [];
  for (const name of names.filter(name => /^(kotlin-0-|kotlin-saf-|web-node-).*\.zip$/.test(name))) {
    const response = await fetch(`/__proof/${name}`), handle = await artifact(`cross-${name}`);
    if (!response.ok || !response.body) throw new Error('Synthetic source unavailable');
    await response.body.pipeTo(await handle.createWritable());
    const verified = await verifyProofZip(await handle.getFile());
    results.push({ name, bytes: verified.inputBytes, entries: verified.entries });
  }
  // Separate engine-only ZIP64 count test: paths are intentionally outside the v2 backup allowlist.
  if (names.includes('kotlin-count.zip')) {
    const response = await fetch('/__proof/kotlin-count.zip'), handle = await artifact('cross-kotlin-count.zip');
    await response.body!.pipeTo(await handle.createWritable());
    const reader = new ZipReader(new BlobReader(await handle.getFile()), { strictness: 'strict', useWebWorkers: false });
    let count = 0; for await (const _entry of reader.getEntriesGenerator()) count++;
    await reader.close(); if (count !== 65536) throw new Error('ZIP64 count mismatch'); results.push({ name: 'kotlin-count.zip', count });
  }
  await upload(`web-${label}-cross.json`, new Blob([JSON.stringify(results)])); return results;
}

const api = {
  async prepareExternalDiagnostic() {
    const handle = await artifact('external-diagnostic-42b.zip');
    await writeProofZip(await syntheticProofInput(), await handle.createWritable(), { forceZip64: true });
    const file = await handle.getFile(); await verifyProofZip(file);
    await upload('web-android-internal-diagnostic-42b.zip', file);
    return { bytes: file.size, sha256: await digestBlob(file), valid: true };
  },
  async diagnoseExternal() {
    const picker = (window as unknown as { showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
    const promise = picker({ suggestedName: 'minhaestante-synthetic-external-42b.zip', types: [{ description: 'ZIP sintético pequeno', accept: { 'application/zip': ['.zip'] } }] });
    const handle = await promise;
    if (!/^minhaestante-synthetic[a-z0-9._ -]*\.zip$/i.test(handle.name)) throw Error('Only the named synthetic diagnostic output');
    const internalHandle = await artifact('external-diagnostic-42b.zip');
    await writeProofZip(await syntheticProofInput(), await internalHandle.createWritable(), { forceZip64: true });
    const internal = await internalHandle.getFile(); await verifyProofZip(internal);
    diagnosticExternal = { handle, internal };
    // Same already-verified ZIP bytes: isolate external publication from the ZIP codec itself.
    await boundedBlobStream(internal).pipeTo(await handle.createWritable());
    return api.recheckExternalDiagnostic();
  },
  async recheckExternalDiagnostic() {
    if (!diagnosticExternal) throw Error('Select the synthetic diagnostic destination first');
    const { handle, internal } = diagnosticExternal;
    const snapshots = [];
    for (const delay of [0, 500, 1500]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      const external = await handle.getFile();
      if (external.size > 128 * 1024) throw Error('Unexpected diagnostic size');
      let valid = false; try { await verifyProofZip(external); valid = true; } catch { /* preserve evidence */ }
      const tail = new Uint8Array(await external.slice(Math.max(0, external.size - 128)).arrayBuffer());
      snapshots.push({ delayMs: delay, bytes: external.size, sha256: await digestBlob(external), valid,
        hasEocdSignatureInLast128: tail.some((byte, index) => byte === 80 && tail[index + 1] === 75 && tail[index + 2] === 5 && tail[index + 3] === 6) });
      if (!delay) await upload('web-android-external-diagnostic-42b.zip', external);
    }
    await upload('web-android-internal-diagnostic-42b.zip', internal);
    const value = { internal: { bytes: internal.size, sha256: await digestBlob(internal), valid: true }, external: snapshots,
      exactCopyToExternal: true, directStreamPipe: true, externalCloseResolved: true };
    await upload('web-android-external-diagnostic-42b.json', new Blob([JSON.stringify(value)])); report(value); return value;
  },
  capabilities() { return { secureContext: isSecureContext, opfs: !!navigator.storage?.getDirectory,
    externalPicker: typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function',
    userAgent: navigator.userAgent, heap: heap(), serviceWorkerControlled: !!navigator.serviceWorker?.controller }; },
  async run(label = 'chrome', sizes = [1024 ** 2, 16 * 1024 ** 2, 64 * 1024 ** 2, 128 * 1024 ** 2]) {
    if (!/^[a-z-]+$/.test(label)) throw new Error('Invalid synthetic label');
    const quota = await navigator.storage.estimate();
    if ((quota.quota ?? 0) - (quota.usage ?? 0) < 1024 ** 3) throw new Error('Less than 1 GiB estimated proof budget');
    const all = [];
    for (const size of sizes) {
      const before = heap(), prepStart = performance.now(), input = await managedInput(size);
      const preparationMs = performance.now() - prepStart;
      latest = { input, sizes };
      for (const level of [0, 1] as const) {
        cancelled = new AbortController(); let heapPeak = heap() ?? 0, maxTimerDelay = 0, lastTick = performance.now();
        const timer = setInterval(() => { heapPeak = Math.max(heapPeak, heap() ?? 0); const now = performance.now(); maxTimerDelay = Math.max(maxTimerDelay, now - lastTick); lastTick = now; }, 25);
        let lastProgress: ProofProgress | undefined; let events = 0;
        const name = `web-${label}-${size}-${level}.zip`, handle = await artifact(name);
        try {
          const metrics = await writeProofZip(input, await handle.createWritable(), { level, forceZip64: true, signal: cancelled.signal,
            onProgress(event) { lastProgress = event; events++; heapPeak = Math.max(heapPeak, heap() ?? 0); } });
          const verifyStart = performance.now(), file = await handle.getFile(), verified = await verifyProofZip(file);
          const pdf = verified.entries.find(entry => entry.archivePath.endsWith('.pdf'))!;
          const observation = { name, paddingBytes: size, level, preparationMs, metrics, verificationMs: performance.now() - verifyStart,
            heapBefore: before, heapPeak: heap() === null ? null : heapPeak, heapAfter: heap(), maxTimerDelayMs: maxTimerDelay, events,
            lastProgress, pdf, originalSourcePreserved: (await describeProofSource(input.sources.find(source => source.archivePath.endsWith('.pdf'))!)).sha256 === pdf.sha256,
            outputLocation: 'internal-opfs', completedAfterVerification: true };
          if (!observation.originalSourcePreserved) throw new Error('Synthetic source changed');
          all.push(observation); report(observation);
          // Upload only the small case for cross-engine reading. Larger ZIPs remain in this isolated OPFS.
          if (size === sizes[0]) await upload(name, file);
        } finally { clearInterval(timer); }
      }
    }
    const cross = await crossRead(label);
    const summary = { capabilities: api.capabilities(), quota, runs: all, cross };
    await upload(`web-${label}-metrics.json`, new Blob([JSON.stringify(summary)])); report(summary); return summary;
  },
  async reopen(name: string) {
    if (!/^web-[a-z0-9.-]+\.zip$/.test(name)) throw new Error('Invalid synthetic artifact');
    const file = await (await (await directory()).getFileHandle(name)).getFile(); const verified = await verifyProofZip(file);
    return { name, bytes: verified.inputBytes, media: verified.manifest.media.map(media => ({ id: media.id, sha256: media.sha256 })) };
  },
  cancel() { cancelled?.abort(); },
  async verifyExternal() {
    const win = window as unknown as { showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]> };
    if (!win.showOpenFilePicker || !isSecureContext) throw new ProofFailure('UNSUPPORTED');
    const [handle] = await win.showOpenFilePicker({ multiple: false, types: [{ description: 'ZIP sintético da prova', accept: { 'application/zip': ['.zip'] } }] });
    const verified = await verifyProofZip(await handle.getFile());
    if (!verified.manifest.backupId.startsWith('proof-')) throw new ProofFailure('MANIFEST');
    const value = { outputLocation: 'external-user-selected', readOnly: true, verifiedBytes: verified.inputBytes, completedAfterVerification: true };
    report(value); return value;
  },
  async saveExternal() {
    const win = window as unknown as { showSaveFilePicker?: (options: unknown) => Promise<FileSystemFileHandle> };
    if (!win.showSaveFilePicker || !isSecureContext) throw new ProofFailure('UNSUPPORTED');
    // Picker invoked directly in click handler BEFORE an unrelated await.
    const handlePromise = win.showSaveFilePicker({ suggestedName: 'minhaestante-synthetic-proof.zip', types: [{ description: 'ZIP sintético', accept: { 'application/zip': ['.zip'] } }] });
    const handle = await handlePromise;
    const input = latest?.input ?? await syntheticProofInput();
    const metrics = await writeProofZip(input, await handle.createWritable(), { forceZip64: true });
    const verified = await verifyProofZip(await handle.getFile());
    const value = { outputLocation: 'external-user-selected', metrics, verifiedBytes: verified.inputBytes, completedAfterVerification: true };
    report(value); return value;
  },
};
Object.assign(window, { zipProof: api });
document.querySelector('#run')!.addEventListener('click', () => { void api.run().catch(error => report({ error: error instanceof ProofFailure ? error.code : 'PROOF_FAILED' })); });
document.querySelector('#external')!.addEventListener('click', () => { void api.saveExternal().catch(error => report({ error: error instanceof DOMException ? error.name : error instanceof ProofFailure ? error.code : 'PROOF_FAILED' })); });
document.querySelector('#external-diagnostic')!.addEventListener('click', () => {
  void api.diagnoseExternal().catch(error => {
    const value = { error: error instanceof DOMException ? error.name : error instanceof ProofFailure ? error.code : 'PROOF_FAILED' };
    report(value);
    void upload('web-android-external-diagnostic-42b-error.json', new Blob([JSON.stringify(value)])).catch(() => undefined);
  });
});
report(api.capabilities());
