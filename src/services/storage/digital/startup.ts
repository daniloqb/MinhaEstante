import type { LocaleId } from '../../../i18n/types';
import { digitalRuntimePlatform, getPlatformDigitalLibrary } from './platform';
import { DigitalStorageException } from './errors';
import { webStorageMessage } from './web/messages';

/** Platform routing is centralized here, never repeated in presentation components. */
export async function recoverConfiguredDigitalStorage(onMessage: (message: string | null) => void, options: { locale?: LocaleId } = {}): Promise<void> {
  if (digitalRuntimePlatform() === 'web') {
    const { recoverConfiguredWebStorage } = await import('./web/startup');
    return recoverConfiguredWebStorage(onMessage, { ...options, factory: async () => {
      const result = await getPlatformDigitalLibrary();
      if (result.status !== 'success') throw new DigitalStorageException(result.status === 'error' ? result.error.code : 'PROVIDER_UNAVAILABLE');
      return result.value;
    } });
  }
  const result = await getPlatformDigitalLibrary();
  if (result.status !== 'success') { onMessage(webStorageMessage('PROVIDER_UNAVAILABLE', options.locale)); return; }
  const outcome = await result.value.initialize();
  if (outcome.configuration.status === 'success' && outcome.configuration.value.state === 'configured' && outcome.configuration.value.permission !== 'granted') { onMessage(webStorageMessage('PERMISSION_REVOKED', options.locale)); return; }
  if (outcome.configuration.status !== 'success' || outcome.recovery.some(r => r.status !== 'success')) onMessage(webStorageMessage('RECOVERY_REQUIRED', options.locale));
}
