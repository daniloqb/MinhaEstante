import { DigitalStorageException } from '../digital/errors';

export interface DurableRecordStore {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  list<T>(prefix: string): Promise<T[]>;
  compareAndSet<T>(key: string, revision: number, value: T): Promise<void>;
}
export interface Revisioned<T> { version: 1; revision: number; value: T }

/** Small structured metadata only. Resolve on transaction complete, never on request success. */
export class IndexedDbStore implements DurableRecordStore {
  constructor(readonly name = 'minhaestante-durable-v1', private readonly factory: IDBFactory | undefined = globalThis.indexedDB) {}
  private open(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(new DigitalStorageException('PROVIDER_UNAVAILABLE'));
    return new Promise((resolve, reject) => {
      const request = this.factory!.open(this.name, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('records'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new DigitalStorageException('OPERATION_CONFLICT'));
    });
  }
  private async transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (value: T) => void, abort: (error: unknown) => void) => void): Promise<T> {
    const db = await this.open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction('records', mode, { durability: 'strict' });
        let result: T; let failure: unknown;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure ?? tx.error ?? new DigitalStorageException('OPERATION_FAILED'));
        tx.onerror = () => { /* onabort owns the final failure */ };
        const abort = (error: unknown) => { failure = error; tx.abort(); };
        try { action(tx.objectStore('records'), (value) => { result = value; }, abort); }
        catch (error) { abort(error); }
      });
    } finally { db.close(); }
  }
  get<T>(key: string): Promise<T | undefined> {
    return this.transaction('readonly', (store, done) => { const r = store.get(key); r.onsuccess = () => done(r.result); });
  }
  put<T>(key: string, value: T): Promise<void> {
    return this.transaction('readwrite', (store, done) => { store.put(value, key); done(undefined); });
  }
  list<T>(prefix: string): Promise<T[]> {
    return this.transaction('readonly', (store, done) => {
      const r = store.getAll(IDBKeyRange.bound(prefix, `${prefix}\uffff`)); r.onsuccess = () => done(r.result);
    });
  }
  compareAndSet<T>(key: string, revision: number, value: T): Promise<void> {
    return this.transaction('readwrite', (store, done, abort) => {
      const read = store.get(key);
      read.onsuccess = () => {
        if ((read.result?.revision ?? 0) !== revision) { abort(new DigitalStorageException('OPERATION_CONFLICT')); return; }
        store.put({ version: 1, revision: revision + 1, value } satisfies Revisioned<T>, key); done(undefined);
      };
    });
  }
}

export type ExclusiveLock = <T>(name: string, work: () => Promise<T>) => Promise<T>;
/** No in-memory fallback: Web Locks are scoped to all contexts in this origin. */
export const browserExclusiveLock: ExclusiveLock = async (name, work) => {
  if (!globalThis.navigator?.locks) throw new DigitalStorageException('PROVIDER_UNAVAILABLE');
  return navigator.locks.request(`minhaestante:v1:${name}`, { mode: 'exclusive' }, work);
};
