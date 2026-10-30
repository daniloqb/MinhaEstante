import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebExportDestination, webExportCapability } from '../services/storage/backupV2/web/WebExportDestination';
import { syntheticProofInput } from '../services/storage/backupV2/experimental/syntheticDataset';
import type { ExportExecution, ExportReceipt } from '../services/storage/backupV2/export/types';
import { ExportFailure } from '../services/storage/backupV2/export/types';
import type { WebOpfsStorageProvider } from '../services/storage/digital/web/WebOpfsStorageProvider';
import type { WorkerReply, WorkerRequest } from '../services/storage/backupV2/web/messages';

class WorkerDouble {
  onmessage?: (event: { data: WorkerReply }) => void; onerror?: () => void; onmessageerror?: () => void;
  messages: WorkerRequest[] = []; terminated = false; action: (value: WorkerRequest) => void = () => {};
  postMessage(value: WorkerRequest) { this.messages.push(value); this.action(value); }
  terminate() { this.terminated = true; }
  send(value: WorkerReply) { if (!this.terminated) this.onmessage?.({ data: value }); }
}
async function setup() {
  const input = await syntheticProofInput(), stop = new AbortController(), worker = new WorkerDouble();
  const payloads = [];
  for (const source of input.sources) { const blob = await new Response(await source.open()).blob(); payloads.push({ archivePath: source.archivePath, sizeBytes: blob.size, sha256: 'a'.repeat(64), blob }); }
  const request: ExportExecution = { operationId: input.manifest.backupId, manifest: input.manifest, payloads, signal: stop.signal,
    checkpoint: vi.fn(async () => {}), revalidate: vi.fn(async () => {}), onProgress: vi.fn() };
  const receipt: ExportReceipt = { status: 'verified', outputBytes: 1000, zipSha256: 'b'.repeat(64), entries: [], durationMs: 1, destination: 'test-opfs' };
  const destination = new WebExportDestination({} as FileSystemFileHandle, {} as WebOpfsStorageProvider, 'test-opfs', () => worker as unknown as Worker);
  return { request, stop, worker, destination, receipt };
}
afterEach(() => vi.useRealTimers());
describe('4.2B Worker protocol doubles (real responsiveness is measured separately in browsers)', () => {
  it('sends file snapshots and handles, never a list of all media chunks', async () => {
    const f = await setup(); f.worker.action = message => { if (message.type === 'start') queueMicrotask(() => f.worker.send({ type: 'complete', receipt: f.receipt })); };
    await f.destination.execute(f.request);
    const start = f.worker.messages[0]; expect(start.type).toBe('start');
    if (start.type === 'start') expect(start.request.payloads.every(row => row.blob instanceof Blob)).toBe(true);
    expect(f.worker.terminated).toBe(true);
  });
  it('awaits durable checkpoint and revalidation before acknowledging the Worker', async () => {
    const f = await setup(), order: string[] = [];
    f.request.checkpoint = async () => { order.push('durable'); }; f.request.revalidate = async () => { order.push('snapshot'); };
    f.worker.action = message => {
      if (message.type === 'start') queueMicrotask(() => f.worker.send({ type: 'checkpoint', token: 1, stage: 'finalizing', outputState: 'incomplete', revalidate: true }));
      if (message.type === 'ack') { expect(message.ok).toBe(true); order.push('ack'); queueMicrotask(() => f.worker.send({ type: 'complete', receipt: f.receipt })); }
    };
    await f.destination.execute(f.request); expect(order).toEqual(['durable', 'snapshot', 'ack']);
  });
  it('rejects stale snapshot acknowledgement and terminates the Worker', async () => {
    const f = await setup(); f.request.revalidate = async () => { throw new ExportFailure('CONFLICT'); };
    f.worker.action = message => { if (message.type === 'start') queueMicrotask(() => f.worker.send({ type: 'checkpoint', token: 1, stage: 'reconciling', outputState: 'closed-unverified', revalidate: true })); };
    await expect(f.destination.execute(f.request)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(f.worker.messages).toContainEqual({ type: 'ack', token: 1, ok: false }); expect(f.worker.terminated).toBe(true);
  });
  it('cancels cooperatively and settles the promise', async () => {
    const f = await setup(); f.worker.action = message => {
      if (message.type === 'start') queueMicrotask(() => f.stop.abort());
      if (message.type === 'cancel') queueMicrotask(() => f.worker.send({ type: 'failed', code: 'CANCELLED' }));
    };
    await expect(f.destination.execute(f.request)).rejects.toMatchObject({ code: 'CANCELLED' }); expect(f.worker.terminated).toBe(true);
  });
  it('terminates an unresponsive Worker after a bounded cancellation wait', async () => {
    const f = await setup(); vi.useFakeTimers(); f.worker.action = message => { if (message.type === 'start') f.stop.abort(); };
    const execution = f.destination.execute(f.request); const assertion = expect(execution).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.advanceTimersByTimeAsync(5001); await assertion; expect(f.worker.terminated).toBe(true);
  });
  it('rejects a destination handle that cannot be cloned without buffering a fallback', async () => {
    const f = await setup(); f.worker.postMessage = () => { throw new DOMException('synthetic clone rejection', 'DataCloneError'); };
    await expect(f.destination.execute(f.request)).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' }); expect(f.worker.terminated).toBe(true);
  });
  it('settles cancellation even when postMessage itself fails', async () => {
    const f = await setup();
    f.worker.action = message => {
      if (message.type === 'start') queueMicrotask(() => f.stop.abort());
      if (message.type === 'cancel') throw new DOMException('synthetic detached Worker', 'InvalidStateError');
    };
    await expect(f.destination.execute(f.request)).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(f.worker.terminated).toBe(true);
  });
  it('settles a rejected checkpoint even when sending the acknowledgement fails', async () => {
    const f = await setup(); f.request.revalidate = async () => { throw new ExportFailure('CONFLICT'); };
    f.worker.action = message => {
      if (message.type === 'start') queueMicrotask(() => f.worker.send({ type: 'checkpoint', token: 1, stage: 'finalizing', outputState: 'incomplete', revalidate: true }));
      if (message.type === 'ack') throw new DOMException('synthetic detached Worker', 'InvalidStateError');
    };
    await expect(f.destination.execute(f.request)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(f.worker.terminated).toBe(true);
  });
  it('settles a Worker runtime crash and releases its resources', async () => {
    const f = await setup(); f.worker.action = message => { if (message.type === 'start') queueMicrotask(() => f.worker.onerror?.()); };
    await expect(f.destination.execute(f.request)).rejects.toMatchObject({ code: 'IO_FAILED' });
    expect(f.worker.terminated).toBe(true);
  });
  it.each(['QUOTA','INTEGRITY','ZIP_FORMAT','DESTINATION_WRITE'])('maps Worker failure %s without declaring completion', async code => {
    const f = await setup(); f.worker.action = message => { if (message.type === 'start') queueMicrotask(() => f.worker.send({ type: 'failed', code })); };
    await expect(f.destination.execute(f.request)).rejects.toBeInstanceOf(ExportFailure); expect(f.worker.terminated).toBe(true);
  });
  it('keeps mobile external delivery blocked independently of File System Access feature presence', () => {
    expect(webExportCapability('Mozilla/5.0 (Linux; Android 14) Chrome/156 Mobile').supported).toBe(false);
  });
});
