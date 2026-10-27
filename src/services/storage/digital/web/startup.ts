import type { LocaleId } from '../../../../i18n/types';
import { IndexedDbStore, type DurableRecordStore } from '../../web/IndexedDbStore';
import { createWebDigitalLibrary } from './index';
import { webStorageMessage } from './messages';
import { normalizeStorageError } from '../errors';

import type { DigitalLibrary } from '../composeDigitalLibrary';
type WebLibrary = DigitalLibrary;
/** Background startup: no selector, no persistence prompt and no namespace creation.
 * A catalog with no OPFS configuration does not initialize a media provider.
 */
export async function recoverConfiguredWebStorage(onMessage: (message: string | null) => void,
  options: { records?: DurableRecordStore; factory?: () => WebLibrary | Promise<WebLibrary>; locale?: LocaleId } = {}): Promise<void> {
  const records = options.records ?? new IndexedDbStore(), factory = options.factory ?? createWebDigitalLibrary;
  const message = (code: Parameters<typeof webStorageMessage>[0]) => webStorageMessage(code, options.locale);
  try {
    if (!await records.get('opfs:configuration')) return;
    const library = await factory();
    const configuration = await library.provider.getConfiguration();
    if (configuration.status !== 'success') {
      onMessage(message(configuration.status === 'error' ? configuration.error.code : 'RECOVERY_REQUIRED')); return;
    }
    const operations = await library.provider.listOperations();
    if (operations.status !== 'success') { onMessage(message('RECOVERY_REQUIRED')); return; }
    if (!operations.value.some(operation => !['COMPLETED','DELETED','DISCARDED'].includes(operation.state))) return;
    onMessage(message('recovering'));
    const outcome = await library.initialize();
    onMessage(outcome.recovery.some(result => result.status !== 'success') ? message('RECOVERY_REQUIRED') : null);
  } catch (error) {
    const code = normalizeStorageError(error).code;
    onMessage(message(code === 'PROVIDER_UNAVAILABLE' ? code : 'RECOVERY_REQUIRED'));
  }
}
