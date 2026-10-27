import type { IDatabaseService } from '../../database/types';
import type { IDigitalStorageProvider } from './contracts';
import type { IDigitalStorageJournal } from './operations';
import { DigitalFileStorageService } from './DigitalFileStorageService';
import { DigitalAttachmentCoordinator } from './DigitalAttachmentCoordinator';

/** One domain coordinator and one provider instance; no I/O happens during composition. */
export function composeDigitalLibrary<P extends IDigitalStorageProvider & IDigitalStorageJournal>(db: IDatabaseService, provider: P) {
  const service = new DigitalFileStorageService([provider], provider.id);
  const coordinator = new DigitalAttachmentCoordinator(db, service, provider);
  return {
    provider, service, coordinator,
    async initialize() {
      const configuration = await provider.getConfiguration();
      if (configuration.status !== 'success' || configuration.value.state === 'not-configured' || configuration.value.permission !== 'granted') return { configuration, recovery: [] };
      const operations = await provider.listOperations();
      if (operations.status !== 'success') return { configuration, recovery: [operations] };
      const recovery = [];
      for (const operation of operations.value) {
        if (!['COMPLETED', 'DELETED', 'DISCARDED'].includes(operation.state)) recovery.push(await coordinator.recover(operation.operationId));
      }
      return { configuration, recovery };
    },
  };
}
export type DigitalLibrary = ReturnType<typeof composeDigitalLibrary<IDigitalStorageProvider & IDigitalStorageJournal>>;
