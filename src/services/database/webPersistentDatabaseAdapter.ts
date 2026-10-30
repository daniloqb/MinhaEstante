import type { IDatabaseService } from './types';
import { WebInMemoryDatabaseAdapter, type WebDatabaseSnapshot } from './databaseService';
import { IndexedDbStore, browserExclusiveLock, type DurableRecordStore, type ExclusiveLock, type Revisioned } from '../storage/web/IndexedDbStore';
import { DigitalStorageException } from '../storage/digital/errors';

const domainExclusiveLock: ExclusiveLock = (name, work) => globalThis.navigator?.locks
  ? browserExclusiveLock(name, work) : work(); // CAS still rejects stale commits when Web Locks are unavailable.

/** Reuses the existing row interpreter/repositories. IndexedDB snapshot is the only Web domain truth.
 * Work happens in a private snapshot; one CAS commits ALL rows, including attachment + position cascades.
 */
export class WebPersistentDatabaseAdapter implements IDatabaseService {
  constructor(private readonly records: DurableRecordStore = new IndexedDbStore(),
    private readonly lock: ExclusiveLock = domainExclusiveLock) {}
  async initialize(): Promise<void> { await this.load(); }
  private async load() {
    const record = await this.records.get<Revisioned<WebDatabaseSnapshot>>('domain');
    if (record && (record.version !== 1 || !Number.isSafeInteger(record.revision) || record.revision <= 0)) throw new DigitalStorageException('RECOVERY_REQUIRED');
    const rows = new WebInMemoryDatabaseAdapter(); await rows.initialize();
    if (record) rows.restoreSnapshot(record.value);
    return { rows, revision: record?.revision ?? 0 };
  }
  async query<T>(sql: string, params?: any[]): Promise<T[]> { return (await this.load()).rows.query(sql, params); }
  async readInSnapshot<T>(fn: (tx: IDatabaseService) => Promise<T>): Promise<T> {
    // A single persisted revision; unlike a write transaction, this never commits/CASes domain.
    const { rows } = await this.load();
    return fn(rows);
  }
  execute(sql: string, params?: any[]): Promise<any> { return this.runIsolatedInTransaction((tx) => tx!.execute(sql, params)); }
  runInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T> { return this.runIsolatedInTransaction(fn); }
  runIsolatedInTransaction<T>(fn: (tx?: IDatabaseService) => Promise<T>): Promise<T> {
    return this.lock('domain', async () => {
      const { rows, revision } = await this.load();
      // Scoped nested transactions cannot enter a different top-level transaction.
      const result = await fn(rows);
      await this.records.compareAndSet('domain', revision, rows.exportSnapshot());
      return result;
    });
  }
  async close(): Promise<void> { /* connections are closed after every IndexedDB transaction; never clear data */ }
}

/** Empty persisted catalogs are deliberate state too; legacy fallback is only for first migration. */
export async function hasPersistedWebCatalog(records: DurableRecordStore = new IndexedDbStore()): Promise<boolean> {
  return (await records.get('domain')) !== undefined;
}
