import { describe, expect, it, vi } from 'vitest';
import { AndroidSafStorageProvider } from '../services/storage/digital/android';
import type { AndroidSafBridge, AndroidManagedStorageBridge } from '../services/storage/digital/android/bridge';
import type { DigitalImportProgress } from '../services/storage/digital/contracts';
import { sourceFileReference } from '../services/storage/digital/validation';
import { storageFailure, storageSuccess } from '../services/storage/digital/errors';
import { storedFile } from './helpers/DigitalStorageTestProvider';

// Bridge fakes exercise adapter contracts, not Android streams or persisted permissions.
function setup() {
  const stored = storedFile('saf_document', 'managed-operation');
  const request = { operationId: stored.operationId, selected: { state: 'selected' as const,
    source: sourceFileReference('saf_document', 'source-token'), filename: 'synthetic.epub', access: 'persistent' as const },
  type: 'ebook' as const, format: 'epub' as const };
  let callback: (event: DigitalImportProgress) => void = () => {};
  const remove = vi.fn().mockResolvedValue(undefined);
  const bridge = {
    importFile: vi.fn().mockResolvedValue(storageSuccess(stored)),
    cancelOperation: vi.fn().mockResolvedValue(storageSuccess({ done: true })),
    addListener: vi.fn().mockImplementation(async (_event, fn) => { callback = fn; return { remove }; }),
    verifyManagedFile: vi.fn().mockResolvedValue(storageSuccess(stored.integrity)),
    deleteManagedFile: vi.fn().mockResolvedValue(storageSuccess({ done: true })),
  } as unknown as AndroidSafBridge & AndroidManagedStorageBridge;
  const provider = new AndroidSafStorageProvider(bridge, () => true);
  return { provider, bridge, stored, request, remove, emit: (event: DigitalImportProgress) => callback(event) };
}
describe('managed Android adapter, simulated bridge only', () => {
  it('sends only opaque source and technical metadata to native copy', async () => {
    const s = setup();
    expect((await s.provider.importFile(s.request)).status).toBe('success');
    expect(s.bridge.importFile).toHaveBeenCalledWith({ operationId: s.request.operationId,
      sourceReference: 'source-token', type: 'ebook', format: 'epub' });
    expect(s.provider.getCapabilities().implemented).toMatchObject({ nativeCopy: true, sha256: true,
      importFile: true, readAccess: false, streamRead: false });
  });
  it('subscribes before invoking native and removes the listener on success', async () => {
    const s = setup(); const progress = vi.fn();
    vi.mocked(s.bridge.importFile).mockImplementation(async () => {
      expect(s.bridge.addListener).toHaveBeenCalledOnce();
      s.emit({ operationId: s.request.operationId, stage: 'copying', bytesProcessed: 42 });
      return storageSuccess(s.stored);
    });
    await s.provider.importFile(s.request, { onProgress: progress });
    expect(progress).toHaveBeenCalledWith({ operationId: s.request.operationId, stage: 'copying', bytesProcessed: 42, totalBytes: undefined });
    expect(s.remove).toHaveBeenCalledOnce();
  });
  it('filters foreign operations and malformed progress without inventing a total', async () => {
    const s = setup(); const progress = vi.fn();
    vi.mocked(s.bridge.importFile).mockImplementation(async () => {
      for (const event of [
        { operationId: 'other', stage: 'copying', bytesProcessed: 1 },
        { operationId: s.request.operationId, stage: 'reading', bytesProcessed: 1 },
        { operationId: s.request.operationId, stage: 'copying', bytesProcessed: -1 },
        { operationId: s.request.operationId, stage: 'copying', bytesProcessed: 1, totalBytes: 0 },
      ]) s.emit(event as DigitalImportProgress);
      return storageSuccess(s.stored);
    });
    await s.provider.importFile(s.request, { onProgress: progress });
    expect(progress).not.toHaveBeenCalled();
  });
  it('does not start an already cancelled copy', async () => {
    const s = setup(); const abort = new AbortController(); abort.abort();
    expect(await s.provider.importFile(s.request, { signal: abort.signal })).toEqual(storageFailure('OPERATION_CANCELLED'));
    expect(s.bridge.importFile).not.toHaveBeenCalled();
  });
  it('forwards cooperative abort to native instead of only dropping the JS promise', async () => {
    const s = setup(); const abort = new AbortController();
    vi.mocked(s.bridge.importFile).mockImplementation(async () => { abort.abort(); return storageFailure('OPERATION_CANCELLED'); });
    expect(await s.provider.importFile(s.request, { signal: abort.signal, onProgress: vi.fn() }))
      .toEqual(storageFailure('OPERATION_CANCELLED'));
    expect(s.bridge.cancelOperation).toHaveBeenCalledWith({ operationId: s.request.operationId });
    expect(s.remove).toHaveBeenCalledOnce();
  });
  it('listener cleanup failure cannot mask a physically confirmed file', async () => {
    const s = setup(); s.remove.mockRejectedValue(new Error('listener cleanup'));
    expect((await s.provider.importFile(s.request, { onProgress: vi.fn() })).status).toBe('success');
  });
  it('consumer progress exceptions cannot stop native copy', async () => {
    const s = setup();
    vi.mocked(s.bridge.importFile).mockImplementation(async () => {
      s.emit({ operationId: s.request.operationId, stage: 'copying', bytesProcessed: 1 });
      return storageSuccess(s.stored);
    });
    expect((await s.provider.importFile(s.request, { onProgress: () => { throw new Error('UI'); } })).status).toBe('success');
  });
  it('removes subscription and strips private native exception messages on failure', async () => {
    const s = setup(); vi.mocked(s.bridge.importFile).mockRejectedValue({ code: 'FILE_NOT_FOUND', message: 'content://private' });
    expect(await s.provider.importFile(s.request, { onProgress: vi.fn() })).toEqual(storageFailure('FILE_NOT_FOUND'));
    expect(s.remove).toHaveBeenCalledOnce();
  });
  it('compares both destination checksum and observed size', async () => {
    const s = setup();
    expect((await s.provider.verifyIntegrity(s.stored.file, s.stored.integrity)).status).toBe('success');
    expect(await s.provider.verifyIntegrity(s.stored.file, { ...s.stored.integrity, sizeBytes: s.stored.integrity.sizeBytes + 1 }))
      .toEqual(storageFailure('INTEGRITY_MISMATCH'));
    expect(await s.provider.verifyIntegrity(s.stored.file, { ...s.stored.integrity, checksum: { algorithm: 'sha256', value: 'f'.repeat(64) } }))
      .toEqual(storageFailure('INTEGRITY_MISMATCH'));
  });
  it('requires explicit delete intent and refuses another provider before invoking native', async () => {
    const s = setup();
    expect(await s.provider.deleteManagedFile({ file: s.stored.file, intent: 'automatic' as 'delete-managed-file' }))
      .toEqual(storageFailure('UNSUPPORTED_OPERATION'));
    expect(await s.provider.deleteManagedFile({ file: { ...s.stored.file, storageProvider: 'web_digital' }, intent: 'delete-managed-file' }))
      .toEqual(storageFailure('PROVIDER_MISMATCH'));
    expect(s.bridge.deleteManagedFile).not.toHaveBeenCalled();
  });
});
