import { DatabaseService } from '../../../database/databaseService';
import type { IDatabaseService } from '../../../database/types';
import { composeDigitalLibrary } from '../composeDigitalLibrary';
import { WebOpfsStorageProvider, type WebOpfsOptions } from './WebOpfsStorageProvider';
export { WebOpfsStorageProvider } from './WebOpfsStorageProvider';
export type { WebOpfsOptions, OpfsCheckpoint } from './WebOpfsStorageProvider';

/** Explicit Web composition. Does not request storage persistence or open file pickers implicitly. */
export function createWebDigitalLibrary(db: IDatabaseService = DatabaseService.getInstance(), options: WebOpfsOptions = {}) {
  return composeDigitalLibrary(db, new WebOpfsStorageProvider(options));
}
