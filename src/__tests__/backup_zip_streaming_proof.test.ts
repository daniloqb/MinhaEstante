import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { boundedBlobStream, checkProofArchiveEnvelope, ProofFailure, verifyProofZip, writeProofZip } from '../services/storage/backupV2/experimental/streamingProof';
import type { ProofInput, ProofProgress } from '../services/storage/backupV2/experimental/streamingProof';
import { blobProofSource, describeProofSource, syntheticProofInput, syntheticPdfSource } from '../services/storage/backupV2/experimental/syntheticDataset';
import { defaultDigitalBackupOptions } from '../services/storage/backupV2/contracts';
import { planBackupExport } from '../services/storage/backupV2/planning';

function sink() {
  const chunks: Uint8Array[] = []; let closed = false, aborted = false;
  return { stream: new WritableStream<Uint8Array>({ write(chunk) { chunks.push(chunk); }, close() { closed = true; }, abort() { aborted = true; } }),
    blob: () => new Blob(chunks as BlobPart[]), state: () => ({ closed, aborted }) };
}
async function write(input: ProofInput, options: Parameters<typeof writeProofZip>[2] = {}) {
  const output = sink(), metrics = await writeProofZip(input, output.stream, options);
  return { output, metrics, verified: await verifyProofZip(output.blob()) };
}
describe('Backup v2 — Streaming Proof of Concept (small in-memory integration, not OPFS/SAF)', () => {
  it('writes/reopens v2 EPUB, PDF and MP3 together, preserving Unicode metadata and reading data', async () => {
    const input = await syntheticProofInput(), result = await write(input);
    expect(result.output.state()).toEqual({ closed: true, aborted: false });
    expect(result.metrics.outputState).toBe('closed-unverified');
    expect(result.metrics.bufferedEntries).toBe(0); expect(result.metrics.directEntries).toBe(1);
    expect(result.verified.manifest.media.map(media => media.format)).toEqual(['epub', 'pdf', 'mp3']);
    expect(result.verified.manifest.media[0].filename).toContain('日本語');
    expect(result.metrics.maxInputChunk).toBeLessThanOrEqual(65536);
    expect(result.verified.entries).toHaveLength(6);
  });
  it.each([0, 1] as const)('uses incremental direct output with compression level %i', async level => {
    const input = await syntheticProofInput(1024 ** 2), result = await write(input, { level });
    const pdf = result.verified.entries.find(entry => entry.archivePath.endsWith('.pdf'))!;
    expect(pdf.method).toBe(level === 0 ? 0 : 8); expect(pdf.sizeBytes).toBeGreaterThan(1024 ** 2);
    expect(result.metrics.maxOutputChunk).toBeLessThanOrEqual(65536);
  });
  it('forces ZIP64 structure on a small archive without claiming a physical >4 GiB test', async () => {
    const result = await write(await syntheticProofInput(), { forceZip64: true });
    expect(result.verified.entries.some(entry => entry.zip64)).toBe(true);
  });
  it('handles unknown source size without inventing a progress total', async () => {
    const input = await syntheticProofInput(), events: ProofProgress[] = [];
    await write({ ...input, sources: input.sources.map(source => ({ ...source, sizeBytes: null })) }, { onProgress: event => events.push(event) });
    expect(events.every(event => event.totalBytes === null)).toBe(true);
    expect(events.some(event => event.bytesProcessed > 0 && event.outputBytes > 0)).toBe(true);
  });
  it.each([{ includeEbooks: true, includeAudiobooks: false }, { includeEbooks: false, includeAudiobooks: true }])('honors independent category opt-outs %o', async options => {
    const result = await write(await syntheticProofInput(0, options));
    expect(result.verified.manifest.media.filter(media => media.state === 'omitted').every(media => media.state === 'omitted' && media.reason === 'category-not-selected')).toBe(true);
  });
  it('routes both unchecked to legacy, without opening a media source', async () => {
    expect(planBackupExport({ bookUuids: [], coversCount: 0, attachments: [], options: defaultDigitalBackupOptions() })).toMatchObject({ valid: true, value: { format: 'legacy', candidates: [] } });
    await expect(syntheticProofInput(0, defaultDigitalBackupOptions())).rejects.toThrow('legacy');
  });
  it('never emits physical storage fields from the synthetic portable manifest', async () => {
    const result = await write(await syntheticProofInput());
    const text = JSON.stringify(result.verified.manifest);
    for (const prohibited of ['storageReference', 'storageProvider', 'content://', 'opfs:', 'permission', '/data/user']) expect(text).not.toContain(prohibited);
  });
  it('fails requested unavailable media unless the omission is explicitly acknowledged', async () => {
    const input = await syntheticProofInput(), first = input.manifest.media[0];
    const reading = await new Response(await input.sources.find(source => source.archivePath === 'reading.json')!.open()).json();
    reading.readerPositions = [];
    const readingSource = blobProofSource('reading.json', new Blob([JSON.stringify(reading)]));
    const { archivePath: _path, ...portable } = first as typeof first & { archivePath: string };
    const manifest = { ...input.manifest, reading: { ...await describeProofSource(readingSource), archivePath: 'reading.json' },
      media: [{ ...portable, state: 'omitted', reason: 'temporarily-unavailable' }, ...input.manifest.media.slice(1)],
      counts: { ...input.manifest.counts, includedMedia: 2, omittedMedia: 1, unavailableMedia: 1 } };
    const partial = { ...input, manifest, sources: input.sources.filter(source => !source.archivePath.endsWith('.epub')).map(source => source.archivePath === 'reading.json' ? readingSource : source) } as ProofInput;
    await expect(write(partial)).rejects.toMatchObject({ code: 'MANIFEST' });
    const result = await write({ ...partial, manifest: { ...partial.manifest, acknowledgedOmissions: [first.id] } });
    expect(result.verified.manifest.counts.unavailableMedia).toBe(1);
  });
  it.each(['prepare', 'read', 'write', 'between-entries', 'before-finalize', 'finalize'] as const)('cancels at %s and never closes a completed output', async phase => {
    const input = await syntheticProofInput(), output = sink(), controller = new AbortController();
    await expect(writeProofZip(input, output.stream, { signal: controller.signal, onProgress(event) { if (event.phase === phase) controller.abort(); } })).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(output.state().closed).toBe(false); expect(output.state().aborted).toBe(true);
  });
  it('cannot retroactively cancel an already closed and verified ZIP', async () => {
    const controller = new AbortController(), input = await syntheticProofInput();
    const result = await write(input, { signal: controller.signal }); controller.abort();
    expect(result.output.state().closed).toBe(true); expect(result.verified.manifest.backupVersion).toBe(2);
  });
  it.each(['SOURCE_UNAVAILABLE', 'SOURCE_READ'] as const)('classifies %s without retaining a source handle', async code => {
    const input = await syntheticProofInput();
    const sources = input.sources.map((source, i) => i ? source : { ...source, open() {
      if (code === 'SOURCE_UNAVAILABLE') throw new ProofFailure(code);
      return new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error('synthetic read failure')); } });
    } });
    await expect(write({ ...input, sources })).rejects.toMatchObject({ code });
  });
  it.each(['DESTINATION_WRITE', 'QUOTA'] as const)('classifies %s and retains incomplete state', async code => {
    const input = await syntheticProofInput();
    const output = new WritableStream<Uint8Array>({ write() { if (code === 'QUOTA') throw new DOMException('synthetic quota', 'QuotaExceededError'); throw new Error('synthetic write'); } });
    await expect(writeProofZip(input, output)).rejects.toMatchObject({ code });
  });
  it('classifies closed/unsupported output and failure to finalize the sink', async () => {
    const input = await syntheticProofInput(), premature = new WritableStream<Uint8Array>(); await premature.close();
    await expect(writeProofZip(input, premature)).rejects.toMatchObject({ code: 'DESTINATION_WRITE' });
    await expect(writeProofZip(input, new WritableStream<Uint8Array>({ close() { throw new Error('synthetic close'); } }))).rejects.toMatchObject({ code: 'DESTINATION_CLOSE' });
  });
  it('reports a failure while writing the central directory instead of completing a partial ZIP', async () => {
    const input = await syntheticProofInput(); let finalizing = false;
    const output = new WritableStream<Uint8Array>({ write() { if (finalizing) throw new Error('synthetic finalize'); } });
    await expect(writeProofZip(input, output, { onProgress(event) { if (event.phase === 'before-finalize') finalizing = true; } })).rejects.toMatchObject({ code: 'DESTINATION_WRITE' });
  });
  it('detects changed source SHA before emitting the manifest', async () => {
    const input = await syntheticProofInput(), output = sink();
    const sources = input.sources.map((source, i) => i ? source : { ...source, open: () => boundedBlobStream(new Blob(['changed'])) });
    await expect(writeProofZip({ ...input, sources }, output.stream)).rejects.toMatchObject({ code: 'INTEGRITY' });
    await expect(verifyProofZip(output.blob())).rejects.toBeInstanceOf(ProofFailure);
  });
  it.each(['duplicate', 'absolute', 'traversal', 'invalid-manifest'] as const)('rejects %s before opening the output', async scenario => {
    const input = await syntheticProofInput(); let writes = 0;
    const malformed = scenario === 'invalid-manifest' ? { ...input, manifest: { ...input.manifest, backupVersion: 3 } } as unknown as ProofInput
      : { ...input, sources: scenario === 'duplicate' ? [...input.sources, input.sources[0]] : [{ ...input.sources[0], archivePath: scenario === 'absolute' ? '/absolute' : '../outside' }, ...input.sources.slice(1)] };
    await expect(writeProofZip(malformed, new WritableStream<Uint8Array>({ write() { writes++; } }))).rejects.toMatchObject({ code: 'MANIFEST' });
    expect(writes).toBe(0);
  });
  it.each(['truncated', 'unexpected', 'wrong-hash', 'oversized-manifest', 'absolute', 'traversal'] as const)('rejects a real ZIP with %s content', async scenario => {
    const result = await write(await syntheticProofInput());
    if (scenario === 'truncated') { await expect(verifyProofZip(result.output.blob().slice(0, -20))).rejects.toBeInstanceOf(ProofFailure); return; }
    const zip = await JSZip.loadAsync(await result.output.blob().arrayBuffer()); // Small malicious-fixture construction only.
    if (scenario === 'unexpected') zip.file('unexpected.txt', 'synthetic');
    if (scenario === 'absolute') zip.file('/absolute.txt', 'synthetic');
    if (scenario === 'traversal') zip.file('../outside.txt', 'synthetic');
    if (scenario === 'oversized-manifest') zip.file('manifest.json', ' '.repeat(1024 * 1024 + 1));
    if (scenario === 'wrong-hash') { const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')); manifest.media[0].sha256 = '0'.repeat(64); zip.file('manifest.json', JSON.stringify(manifest)); }
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await expect(verifyProofZip(new Blob([bytes as BlobPart]))).rejects.toBeInstanceOf(ProofFailure);
  });
  it('reads generic empty ZIP entries but keeps empty media invalid under v2', async () => {
    const zip = new JSZip(); zip.file('empty.txt', ''); const bytes = await zip.generateAsync({ type: 'uint8array' });
    const reader = new ZipReader(new BlobReader(new Blob([bytes as BlobPart]))); const entries = await reader.getEntries();
    expect(entries[0].uncompressedSize).toBe(0); await reader.close();
    await expect(verifyProofZip(new Blob([bytes as BlobPart]))).rejects.toBeInstanceOf(ProofFailure);
  });
  it('generates large PDF source chunks with valid xref offsets without a full-sized allocation', async () => {
    const source = syntheticPdfSource(16 * 1024 ** 2), reader = (await source.open()).getReader(); let size = 0, max = 0;
    while (true) { const value = await reader.read(); if (value.done) break; size += value.value.length; max = Math.max(max, value.value.length); }
    reader.releaseLock(); expect(size).toBe(source.sizeBytes); expect(max).toBeLessThanOrEqual(65536);
  });
  it('rejects oversized central-directory metadata before the ZIP library opens it', async () => {
    const result = await write(await syntheticProofInput());
    const bytes = new Uint8Array(await result.output.blob().arrayBuffer());
    const view = new DataView(bytes.buffer); let end = bytes.length - 22;
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
    expect(end).toBeGreaterThan(0); view.setUint32(end + 12, 40 * 1024 ** 2, true);
    await expect(checkProofArchiveEnvelope(new Blob([bytes]))).rejects.toMatchObject({ code: 'ZIP_FORMAT' });
  });
  it('emits completion only from reopened integrity verification', async () => {
    const result = await write(await syntheticProofInput()), events: ProofProgress[] = [];
    await verifyProofZip(result.output.blob(), undefined, undefined, event => events.push(event));
    expect(events.some(event => event.stage === 'verifying')).toBe(true);
    expect(events.at(-1)).toMatchObject({ phase: 'done', stage: 'completed', cancellable: false });
  });
  it('rejects a locked sink without disturbing its owner', async () => {
    const stream = new WritableStream<Uint8Array>(), owner = stream.getWriter();
    await expect(writeProofZip(await syntheticProofInput(), stream)).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    owner.releaseLock();
  });
});
