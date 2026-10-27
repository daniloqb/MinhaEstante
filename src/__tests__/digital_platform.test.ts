import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../services/database/databaseService';
import { createPlatformDigitalLibrary } from '../services/storage/digital/platform';
import { DigitalStorageTestProvider } from './helpers/DigitalStorageTestProvider';
import { storageFailure, storageSuccess } from '../services/storage/digital/errors';

function provider(id: 'web_digital' | 'saf_document') {
  return Object.assign(new DigitalStorageTestProvider(id), {
    listOperations: vi.fn(async () => storageSuccess([])),
    getOperation: vi.fn(async () => storageFailure('INVALID_REFERENCE')),
    recoverImport: vi.fn(async () => storageFailure('RECOVERY_REQUIRED')),
    beginAttachmentLink: vi.fn(async () => storageFailure('RECOVERY_REQUIRED')),
    completeImportOperation: vi.fn(async () => storageSuccess(undefined)),
  });
}
describe('central platform composition (injected providers, no physical I/O)', () => {
  it.each(['android','web'] as const)('loads only the %s provider, once', async platform => {
    const android = vi.fn(async () => provider('saf_document')), web = vi.fn(async () => provider('web_digital'));
    const detect = vi.fn(() => platform);
    const result = await createPlatformDigitalLibrary({ platform: detect, db: DatabaseService.createTestInstance(), loadAndroid: android, loadWeb: web });
    expect(result.status).toBe('success'); expect(detect).toHaveBeenCalledTimes(1);
    expect(android).toHaveBeenCalledTimes(platform === 'android' ? 1 : 0); expect(web).toHaveBeenCalledTimes(platform === 'web' ? 1 : 0);
  });
  it('does not open configuration or enumerate journal while composing', async () => {
    const injected = provider('web_digital');
    const result = await createPlatformDigitalLibrary({ platform: () => 'web', db: DatabaseService.createTestInstance(), provider: injected });
    expect(result.status).toBe('success'); expect(injected.getConfiguration).not.toHaveBeenCalled(); expect(injected.listOperations).not.toHaveBeenCalled();
  });
  it('does not fall back to Web on unsupported native environments', async () => {
    const web=vi.fn(async()=>provider('web_digital'));
    expect(await createPlatformDigitalLibrary({platform:()=> 'unsupported',loadWeb:web})).toEqual(storageFailure('PROVIDER_UNAVAILABLE'));expect(web).not.toHaveBeenCalled();
  });
  it('rejects a provider from the wrong platform', async () => {
    expect(await createPlatformDigitalLibrary({platform:()=> 'android',provider:provider('web_digital')})).toEqual(storageFailure('PROVIDER_MISMATCH'));
  });
  it('reports missing APIs or plugin instead of selecting another provider', async () => {
    const android=provider('saf_document'); android.capabilities={...android.capabilities,providerAvailability:'unavailable'};
    const web=vi.fn(async()=>provider('web_digital'));
    expect(await createPlatformDigitalLibrary({platform:()=> 'android',provider:android,loadWeb:web})).toEqual(storageFailure('PROVIDER_UNAVAILABLE'));expect(web).not.toHaveBeenCalled();
  });
  it('does not touch files with revoked access', async () => {
    const p = provider('saf_document');
    p.configuration = { state: 'configured', permission: 'revoked', location: { kind: 'library-location', storageProvider: p.id, locationReference: 'location' as any } };
    const result = await createPlatformDigitalLibrary({ platform: () => 'android', db: DatabaseService.createTestInstance(), provider: p });
    if (result.status !== 'success') throw new Error('Synthetic composition failure');
    const outcome = await result.value.initialize(); expect(outcome.recovery).toEqual([]); expect(p.listOperations).not.toHaveBeenCalled();
  });
  it('does not reprocess terminal journal records at startup', async () => {
    const p = provider('saf_document');
    p.listOperations.mockResolvedValue(storageSuccess(['COMPLETED', 'DELETED', 'DISCARDED'].map((state, index) => ({ operationId: `terminal-${index}`, state })) as any));
    const result = await createPlatformDigitalLibrary({ platform: () => 'android', db: DatabaseService.createTestInstance(), provider: p });
    if (result.status !== 'success') throw new Error('Synthetic composition failure');
    expect((await result.value.initialize()).recovery).toEqual([]);
    expect(p.recoverImport).not.toHaveBeenCalled();
  });
  it('normalizes loader failures without leaking private payloads', async () => {
    const result=await createPlatformDigitalLibrary({platform:()=> 'android',loadAndroid:async()=>{throw new Error('private payload');}});
    expect(result).toEqual(storageFailure('OPERATION_FAILED'));expect(JSON.stringify(result)).not.toContain('private payload');
  });
});
