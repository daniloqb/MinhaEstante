import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { AndroidSafStorageProvider, isAndroidSafAvailable } from '../services/storage/digital/android';
import type { AndroidSafBridge, AndroidSafStatus } from '../services/storage/digital/android';
import { DigitalFileStorageService } from '../services/storage/digital/DigitalFileStorageService';
import { libraryLocationReference, managedFileReference, sourceFileReference } from '../services/storage/digital/validation';
import { storageFailure, storageSuccess } from '../services/storage/digital/errors';
import type { SelectedDigitalFile } from '../services/storage/digital/contracts';

describe('Android SAF provider: typed bridge simulation, not a native SAF test', () => {
  let bridge: AndroidSafBridge;
  let provider: AndroidSafStorageProvider;
  let service: DigitalFileStorageService;
  const source = sourceFileReference('saf_document', 'eea9bd4e-f0ee-4c1c-9b46-49b941293175');
  const selected: SelectedDigitalFile = { state: 'selected', source, filename: 'synthetic.EPUB', access: 'persistent' };
  const initial: AndroidSafStatus = { state: 'not-configured', configuration: { state: 'not-configured' },
    read: false, write: false, persistedRead: false, persistedWrite: false, canCreate: false, needsReconfiguration: true };
  beforeEach(() => {
    vi.restoreAllMocks();
    bridge = {
      getDevelopmentEnvironment: vi.fn().mockResolvedValue(storageSuccess({ enabled: true })),
      getConfiguration: vi.fn().mockResolvedValue(storageSuccess(initial)),
      selectDirectory: vi.fn().mockResolvedValue(storageSuccess(initial)),
      selectDocument: vi.fn().mockResolvedValue(storageSuccess(selected)),
      getSelectedMetadata: vi.fn().mockResolvedValue(storageSuccess(selected)),
      checkSourceAccess: vi.fn().mockResolvedValue(storageSuccess({ accessible: true })),
      runDiagnostics: vi.fn().mockResolvedValue(storageSuccess({ writeVerified: true, readVerified: true, cleanupSucceeded: true })),
    };
    provider = new AndroidSafStorageProvider(bridge, () => true);
    service = new DigitalFileStorageService([provider]);
  });
  it('constructing provider does not open selectors or request permissions', () => {
    provider.getCapabilities();
    for (const method of Object.values(bridge)) expect(method).not.toHaveBeenCalled();
  });
  it('capabilities advertise only implemented configuration, selection and grant persistence', () => {
    expect(provider.getCapabilities()).toMatchObject({ providerAvailability: 'available', implemented: {
      configure: true, selectDirectory: true, selectFile: true, persistAccess: true,
      nativeCopy: false, streamRead: false, streamWrite: false, sha256: false, importFile: false,
      readAccess: false, deleteManagedFiles: false, cancelOperations: false, importProgress: false } });
  });
  it('Web does not silently initialize a fake provider', async () => {
    provider = new AndroidSafStorageProvider(bridge, () => false);
    expect(provider.getCapabilities().providerAvailability).toBe('unavailable');
    expect(Object.values(provider.getCapabilities().available).every((v) => !v)).toBe(true);
    expect(await provider.getConfiguration()).toEqual(storageFailure('PROVIDER_UNAVAILABLE'));
    expect(bridge.getConfiguration).not.toHaveBeenCalled();
  });
  it('detects actual Capacitor platform and native plugin availability', () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
    expect(isAndroidSafAvailable()).toBe(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    expect(isAndroidSafAvailable()).toBe(true);
    expect(Capacitor.isPluginAvailable).toHaveBeenCalledWith('DigitalLibraryStorage');
    vi.mocked(Capacitor.isPluginAvailable).mockReturnValue(false);
    expect(isAndroidSafAvailable()).toBe(false);
  });
  it('queries native configuration without invoking a selector', async () => {
    expect(await service.getConfiguration()).toEqual(storageSuccess({ state: 'not-configured' }));
    expect(bridge.getConfiguration).toHaveBeenCalledOnce();
    expect(bridge.selectDirectory).not.toHaveBeenCalled();
  });
  it.each([
    ['accessible', 'granted', true, true, true],
    ['read-only', 'denied', true, false, true],
    ['read-only', 'denied', true, true, false],
    ['permission-revoked', 'revoked', false, false, false],
    ['permission-required', 'unknown', false, false, false],
    ['missing', 'unknown', false, false, false],
    ['provider-unavailable', 'unknown', false, false, false],
    ['unavailable', 'unknown', false, false, false],
  ] as const)('keeps native state %s and generic permission %s distinct', async (state, permission, read, write, canCreate) => {
    const configuration = { state: 'configured', permission, location: libraryLocationReference(provider.id, 'tree-token') } as const;
    vi.mocked(bridge.getConfiguration).mockResolvedValue(storageSuccess({ ...initial, state, configuration, read, write, canCreate }));
    expect(await provider.getSafStatus()).toMatchObject({ status: 'success', value: { state, canCreate } });
    expect(await service.getConfiguration()).toEqual(storageSuccess(configuration));
  });
  it('forwards explicit folder selection before yielding and preserves cancellation', async () => {
    vi.mocked(bridge.selectDirectory).mockResolvedValue(storageFailure('USER_CANCELLED'));
    const result = service.requestConfiguration({ interaction: 'user-initiated' });
    expect(bridge.selectDirectory).toHaveBeenCalledWith({ interaction: 'user-initiated' });
    expect(await result).toEqual(storageFailure('USER_CANCELLED'));
  });
  it('refuses implicit folder/document selection and diagnostic execution', async () => {
    const bad = { interaction: 'automatic' } as unknown as { interaction: 'user-initiated' };
    expect(await provider.interaction.requestConfiguration(bad)).toEqual(storageFailure('PERMISSION_REQUIRED'));
    expect(await provider.interaction.selectSource({ ...bad, acceptedFormats: ['pdf'] })).toEqual(storageFailure('PERMISSION_REQUIRED'));
    expect(await provider.runDiagnostics(bad)).toEqual(storageFailure('PERMISSION_REQUIRED'));
    expect(bridge.selectDirectory).not.toHaveBeenCalled();
    expect(bridge.selectDocument).not.toHaveBeenCalled();
    expect(bridge.runDiagnostics).not.toHaveBeenCalled();
  });
  it.each(['epub', 'pdf', 'mp3', 'm4a', 'm4b'] as const)('forwards accepted %s format with no document bytes', async (format) => {
    vi.mocked(bridge.selectDocument).mockResolvedValue(storageSuccess({ ...selected, filename: `synthetic.${format}` }));
    const result = await service.selectSource({ interaction: 'user-initiated', acceptedFormats: [format] });
    expect(bridge.selectDocument).toHaveBeenCalledWith({ interaction: 'user-initiated', acceptedFormats: [format] });
    expect(result).toMatchObject({ status: 'success', value: { filename: `synthetic.${format}`, source } });
    expect(JSON.stringify(result)).not.toMatch(/base64|arrayBuffer|content:\/\//i);
  });
  it('preserves unknown MIME and size, accepts zero-size selection without claiming valid content', async () => {
    expect(await provider.interaction.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub'] }))
      .toEqual(storageSuccess({ ...selected, mimeType: undefined, sizeBytes: undefined }));
    vi.mocked(bridge.getSelectedMetadata).mockResolvedValue(storageSuccess({ ...selected, sizeBytes: 0 }));
    expect(await provider.getSelectedMetadata(source)).toMatchObject({ status: 'success', value: { sizeBytes: 0 } });
  });
  it('strips extra payload and private URI properties from native results', async () => {
    vi.mocked(bridge.selectDocument).mockResolvedValue(storageSuccess({ ...selected, uri: 'content://private', rawBytes: 'private' } as SelectedDigitalFile));
    expect(await service.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub'] }))
      .toEqual(storageSuccess({ ...selected, mimeType: undefined, sizeBytes: undefined }));
  });
  it.each(['PERMISSION_REVOKED', 'FILE_NOT_FOUND', 'PROVIDER_UNAVAILABLE', 'PERMISSION_DENIED', 'FILE_UNAVAILABLE'] as const)(
    'keeps native error %s distinct without its private message', async (code) => {
      vi.mocked(bridge.checkSourceAccess).mockRejectedValue({ code, message: 'content://private/path', stack: 'private' });
      expect(await service.checkAccess(source)).toEqual(storageFailure(code));
    });
  it('cancelling a document is separate from error and does not replace configuration', async () => {
    vi.mocked(bridge.selectDocument).mockResolvedValue(storageFailure('USER_CANCELLED'));
    expect(await service.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub'] })).toEqual(storageFailure('USER_CANCELLED'));
    expect(bridge.selectDirectory).not.toHaveBeenCalled();
  });
  it('refuses provider mismatch or managed references for source endpoints', async () => {
    expect(await provider.checkAccess(sourceFileReference('web_digital', 'token'))).toEqual(storageFailure('PROVIDER_MISMATCH'));
    expect(await provider.checkAccess(managedFileReference(provider.id, 'token'))).toEqual(storageFailure('UNSUPPORTED_OPERATION'));
    expect(bridge.checkSourceAccess).not.toHaveBeenCalled();
  });
  it('queries metadata and read access using just the native source token', async () => {
    expect((await provider.getSelectedMetadata(source)).status).toBe('success');
    expect(await service.checkAccess(source)).toEqual(storageSuccess({ accessible: true }));
    expect(bridge.getSelectedMetadata).toHaveBeenCalledWith({ sourceReference: source.sourceReference });
    expect(bridge.checkSourceAccess).toHaveBeenCalledWith({ sourceReference: source.sourceReference });
  });
  it('rejects native metadata returned for a different source', async () => {
    vi.mocked(bridge.getSelectedMetadata).mockResolvedValue(storageSuccess({ ...selected, source: sourceFileReference(provider.id, 'other') }));
    expect(await provider.getSelectedMetadata(source)).toEqual(storageFailure('INVALID_REFERENCE'));
  });
  it('shows diagnostic cleanup failure independently of read/write success', async () => {
    vi.mocked(bridge.runDiagnostics).mockResolvedValue(storageSuccess({ writeVerified: true, readVerified: true, cleanupSucceeded: false }));
    expect(await provider.runDiagnostics({ interaction: 'user-initiated' })).toMatchObject({ status: 'success', value: {
      writeVerified: true, readVerified: true, cleanupSucceeded: false, cleanupError: 'DIAGNOSTIC_CLEANUP_FAILED' } });
  });
  it('preserves native production diagnostic gate errors', async () => {
    vi.mocked(bridge.runDiagnostics).mockResolvedValue(storageFailure('UNSUPPORTED_OPERATION'));
    expect(await provider.runDiagnostics({ interaction: 'user-initiated' })).toEqual(storageFailure('UNSUPPORTED_OPERATION'));
  });
  it('rejects malformed native state instead of displaying successful configuration', async () => {
    vi.mocked(bridge.getConfiguration).mockResolvedValue(storageSuccess({ ...initial, state: 'invented' } as unknown as AndroidSafStatus));
    expect(await provider.getConfiguration()).toEqual(storageFailure('OPERATION_FAILED'));
  });
  it('never claims future import, SHA256, readers or managed deletion succeeded', async () => {
    const file = managedFileReference(provider.id, 'managed-token');
    const request = { operationId: 'operation', selected, type: 'ebook', format: 'epub' } as const;
    const integrity = { sizeBytes: 1, checksum: { algorithm: 'sha256', value: 'a'.repeat(64) } } as const;
    for (const result of await Promise.all([
      provider.importFile(request), service.importFile(request), provider.getMetadata(file),
      provider.verifyIntegrity(file, integrity), provider.acquireReadAccess(file),
      provider.deleteManagedFile({ file, intent: 'delete-managed-file' }),
    ])) expect(result).toEqual(storageFailure('UNSUPPORTED_OPERATION'));
    expect(bridge.selectDocument).not.toHaveBeenCalled();
    expect(bridge.selectDirectory).not.toHaveBeenCalled();
  });
});
