import type { DurableRecordStore, ExclusiveLock, Revisioned } from '../../services/storage/web/IndexedDbStore';
import type { OpfsFiles } from '../../services/storage/digital/web/OpfsFiles';
import { DigitalStorageException } from '../../services/storage/digital/errors';

/** Test doubles; do not count as real OPFS/IndexedDB evidence. */
export class TestRecords implements DurableRecordStore {
  data = new Map<string, any>(); failCommit = false; failJournal = false;
  async get<T>(key: string): Promise<T | undefined> { return structuredClone(this.data.get(key)); }
  async put<T>(key: string, value: T) {
    if (this.failJournal) throw new DOMException('synthetic', 'QuotaExceededError');
    this.data.set(key, structuredClone(value));
  }
  async list<T>(prefix: string): Promise<T[]> { return structuredClone([...this.data].filter(([k]) => k.startsWith(prefix)).map(([,v]) => v)); }
  async compareAndSet<T>(key: string, revision: number, value: T) {
    if (this.failCommit) throw new Error('synthetic domain commit failure');
    if ((this.data.get(key)?.revision ?? 0) !== revision) throw new DigitalStorageException('OPERATION_CONFLICT');
    this.data.set(key, structuredClone({ version: 1, revision: revision + 1, value } satisfies Revisioned<T>));
  }
}
export class TestFiles implements OpfsFiles {
  data = new Map<string, Blob>(); configured = false; writes = 0; failWrite = false; quota = false; unknownVersion = false;
  async initialize(create = false) {
    if (this.unknownVersion) throw new DigitalStorageException('RECOVERY_REQUIRED');
    if (create) this.configured = true;
    if (!this.configured) throw new DOMException('synthetic', 'NotFoundError');
  }
  async read(area: string, token: string) { const blob = this.data.get(`${area}/${token}`); if (!blob) throw new DOMException('synthetic','NotFoundError'); return blob; }
  async write(area: string, token: string, source: Blob, signal?: AbortSignal, progress?: (bytes: number) => Promise<void>) {
    this.writes++;
    const key = `${area}/${token}`; this.data.set(key, new Blob());
    for (let offset = 0; offset < source.size; offset += 32) {
      if (signal?.aborted) throw new DigitalStorageException('OPERATION_CANCELLED');
      const end = Math.min(offset+32, source.size); this.data.set(key, source.slice(0,end));
      if (this.quota) throw new DOMException('synthetic','QuotaExceededError');
      if (this.failWrite) throw new Error('synthetic write failure');
      await progress?.(end);
    }
  }
}
export function testLocks(): ExclusiveLock {
  const queues = new Map<string, Promise<unknown>>();
  return async (name, work) => {
    const previous = queues.get(name) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work); queues.set(name, next);
    try { return await next; } finally { if (queues.get(name) === next) queues.delete(name); }
  };
}
