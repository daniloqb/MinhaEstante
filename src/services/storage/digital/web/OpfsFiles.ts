import { DigitalStorageException } from '../errors';
import { requireStorage } from '../validation';

export interface OpfsFiles {
  initialize(create?: boolean): Promise<void>;
  inventory?(): Promise<{ area: 'staging' | 'committed'; token?: string; sizeBytes?: number }[]>;
  read(area: 'staging' | 'committed', token: string): Promise<Blob>;
  write(area: 'staging' | 'committed', token: string, source: Blob, signal?: AbortSignal,
    progress?: (bytes: number) => Promise<void>): Promise<void>;
}
export const CHUNK_SIZE = 256 * 1024;
export function safeId(id: string): string {
  requireStorage(typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id), 'INVALID_REFERENCE'); return id;
}

/** Async OPFS only; close publishes the complete stream. No rename or fsync guarantee is assumed. */
export class BrowserOpfsFiles implements OpfsFiles {
  constructor(private readonly storage: StorageManager | undefined = globalThis.navigator?.storage, private readonly namespace = 'minhaestante') { safeId(namespace); }
  private async directory(area?: 'staging' | 'committed', create = false) {
    requireStorage(this.storage?.getDirectory, 'PROVIDER_UNAVAILABLE');
    let dir = await this.storage.getDirectory();
    dir = await dir.getDirectoryHandle(this.namespace, { create });
    dir = await dir.getDirectoryHandle('v1', { create });
    return area ? dir.getDirectoryHandle(area, { create }) : dir;
  }
  async initialize(create = false) {
    // A missing marker in an existing namespace is ambiguous: never stamp unknown data as ours.
    const root = await this.storage?.getDirectory(); requireStorage(root, 'PROVIDER_UNAVAILABLE');
    let existing = false;
    try { await root.getDirectoryHandle(this.namespace); existing = true; }
    catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
    if (existing) {
      try {
        const dir = await this.directory();
        const marker = await (await dir.getFileHandle('layout.json')).getFile();
        requireStorage(marker.size < 256 && (await marker.text()) === '{"version":1}', 'RECOVERY_REQUIRED');
      } catch { throw new DigitalStorageException('RECOVERY_REQUIRED'); }
      return;
    }
    requireStorage(create, 'FILE_NOT_FOUND');
    const dir = await this.directory(undefined, true);
    const marker = await (await dir.getFileHandle('layout.json', { create: true })).createWritable();
    try { await marker.write('{"version":1}'); await marker.close(); }
    catch (error) { await marker.abort().catch(() => undefined); throw error; }
    await this.directory('staging', true); await this.directory('committed', true);
  }
  async inventory() {
    const entries: { area: 'staging' | 'committed'; token?: string; sizeBytes?: number }[] = [];
    for (const area of ['staging','committed'] as const) {
      let dir: FileSystemDirectoryHandle;
      try { dir=await this.directory(area); } catch(error) { if(error instanceof DOMException && error.name==='NotFoundError')continue; throw error; }
      const iterable=dir as unknown as { values?: () => AsyncIterable<FileSystemHandle> };
      requireStorage(iterable.values, 'UNSUPPORTED_OPERATION');
      for await(const handle of iterable.values()) {
        if(handle.kind!=='file'){entries.push({area});continue;}
        const token=handle.name.match(/^([a-zA-Z0-9_-]{1,128})\.bin$/)?.[1];
        try { entries.push({area,token,sizeBytes:(await (handle as FileSystemFileHandle).getFile()).size}); }
        catch { entries.push({area,token}); }
      }
    }
    return entries;
  }
  async read(area: 'staging' | 'committed', token: string): Promise<File> {
    const dir = await this.directory(area);
    return (await dir.getFileHandle(`${safeId(token)}.bin`)).getFile();
  }
  async write(area: 'staging' | 'committed', token: string, source: Blob, signal?: AbortSignal,
    progress?: (bytes: number) => Promise<void>) {
    const dir = await this.directory(area, true);
    const handle = await dir.getFileHandle(`${safeId(token)}.bin`, { create: true });
    requireStorage(typeof handle.createWritable === 'function', 'PROVIDER_UNAVAILABLE');
    const output = await handle.createWritable();
    try {
      for (let offset = 0; offset < source.size; offset += CHUNK_SIZE) {
        if (signal?.aborted) throw new DigitalStorageException('OPERATION_CANCELLED');
        const chunk = await source.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
        await output.write(chunk); await progress?.(Math.min(offset + CHUNK_SIZE, source.size));
      }
      if (signal?.aborted) throw new DigitalStorageException('OPERATION_CANCELLED');
      await output.close();
    } catch (error) { await output.abort().catch(() => undefined); throw error; }
  }
}
