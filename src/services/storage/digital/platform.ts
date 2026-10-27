import { Capacitor } from '@capacitor/core';
import type { IDatabaseService } from '../../database/types';
import type { IDigitalStorageProvider, StorageResult } from './contracts';
import type { IDigitalStorageJournal } from './operations';
import { composeDigitalLibrary, type DigitalLibrary } from './composeDigitalLibrary';
import { normalizeStorageError, storageFailure, storageSuccess } from './errors';

export type DigitalRuntimePlatform = 'android' | 'web' | 'unsupported';
export function digitalRuntimePlatform(): DigitalRuntimePlatform {
  if (!Capacitor.isNativePlatform()) return 'web';
  return Capacitor.getPlatform() === 'android' ? 'android' : 'unsupported';
}
export interface DigitalLibraryOptions {
  platform?: () => DigitalRuntimePlatform;
  db?: IDatabaseService;
  /** Test injection is explicit and must match the selected platform. */
  provider?: IDigitalStorageProvider & IDigitalStorageJournal;
  loadAndroid?: () => Promise<IDigitalStorageProvider & IDigitalStorageJournal>;
  loadWeb?: () => Promise<IDigitalStorageProvider & IDigitalStorageJournal>;
}
export async function createPlatformDigitalLibrary(options: DigitalLibraryOptions = {}): Promise<StorageResult<DigitalLibrary>> {
  try {
    const platform = (options.platform ?? digitalRuntimePlatform)();
    if (platform === 'unsupported') return storageFailure('PROVIDER_UNAVAILABLE');
    const provider = options.provider ?? (platform === 'android'
      ? await (options.loadAndroid ?? (async () => { const { AndroidSafStorageProvider } = await import('./android/AndroidSafStorageProvider'); return new AndroidSafStorageProvider(); }))()
      : await (options.loadWeb ?? (async () => { const { WebOpfsStorageProvider } = await import('./web/WebOpfsStorageProvider'); return new WebOpfsStorageProvider(); }))());
    if (provider.id !== (platform === 'android' ? 'saf_document' : 'web_digital')) return storageFailure('PROVIDER_MISMATCH');
    if (provider.getCapabilities().providerAvailability !== 'available') return storageFailure('PROVIDER_UNAVAILABLE');
    const db = options.db ?? (await import('../../database/databaseService')).DatabaseService.getInstance();
    return storageSuccess(composeDigitalLibrary(db, provider));
  } catch (error) { return storageFailure(normalizeStorageError(error).code); }
}

let sharedLibrary: Promise<StorageResult<DigitalLibrary>> | undefined;
/** Lazy singleton: importing this module neither registers the native plugin nor opens storage. */
export function getPlatformDigitalLibrary(): Promise<StorageResult<DigitalLibrary>> {
  return sharedLibrary ??= createPlatformDigitalLibrary().then(result => {
    if (result.status !== 'success') sharedLibrary = undefined; // environment may regain availability
    return result;
  });
}
