/** Shared streaming ZIP codec for the DEV exporter and the 4.2A interoperability harness. */
import { BlobReader, ZipReader, ZipWriter, configure } from '@zip.js/zip.js';
import type { Entry } from '@zip.js/zip.js';
import { IncrementalSha256 } from '../../digital/web/sha256';
import { backupManifestFiles, isSafeBackupPath, parseBackupV2Manifest, validateBackupArchiveEntries,
  validateBackupFileIntegrity, validateBackupProcessingBudget, validateBackupReadingData, validateBackupV2Manifest } from '../validation';
import { DEFAULT_BACKUP_LIMITS } from '../contracts';
import type { BackupArchiveEntry, BackupOperationProgress, BackupV2Manifest, BackupValidationLimits } from '../contracts';

export const ZIP_CODEC_LABEL = 'Backup v2 — Streaming ZIP';
export const ZIP_CHUNK_BYTES = 64 * 1024;
export type BackupZipErrorCode = 'SOURCE_UNAVAILABLE' | 'SOURCE_READ' | 'DESTINATION_WRITE' | 'DESTINATION_CLOSE'
  | 'ZIP_FORMAT' | 'MANIFEST' | 'INTEGRITY' | 'CANCELLED' | 'UNSUPPORTED' | 'QUOTA';
export class BackupZipFailure extends Error {
  constructor(readonly code: BackupZipErrorCode) { super(code); }
}
export interface BackupZipSource {
  readonly archivePath: string;
  readonly sizeBytes: number | null;
  readonly open: () => ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>>;
}
export interface BackupZipProgress extends BackupOperationProgress {
  readonly phase: 'prepare' | 'read' | 'write' | 'between-entries' | 'before-finalize' | 'finalize' | 'verify' | 'done' | 'error';
  readonly currentPath: string | null;
  readonly outputBytes: number;
}
export interface BackupZipInput {
  readonly manifest: BackupV2Manifest;
  readonly bookUuids: readonly string[];
  readonly sources: readonly BackupZipSource[];
}
export interface BackupZipWriteOptions {
  readonly beforeFinalize?: () => Promise<void>;
  readonly level?: 0 | 1;
  readonly forceZip64?: boolean;
  readonly signal?: AbortSignal;
  readonly onProgress?: (event: BackupZipProgress) => void;
  readonly limits?: BackupValidationLimits;
}
export interface BackupZipWriteMetrics {
  readonly outputState: 'closed-unverified';
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly maxInputChunk: number;
  readonly maxOutputChunk: number;
  readonly durationMs: number;
  /** Peak concurrent entries sampled while writing; pinned zip.js internals, not public API. */
  readonly bufferedEntries: number;
  readonly directEntries: number;
}
function cancelled(signal?: AbortSignal) { if (signal?.aborted) throw new BackupZipFailure('CANCELLED'); }
function failure(error: unknown, fallback: BackupZipErrorCode): BackupZipFailure {
  if (error instanceof BackupZipFailure) return error;
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return new BackupZipFailure('QUOTA');
  if (error instanceof DOMException && error.name === 'AbortError') return new BackupZipFailure('CANCELLED');
  return new BackupZipFailure(fallback);
}
/** Each read materializes only one bounded slice, including when the Blob is an OPFS File. */
export function boundedBlobStream(blob: Blob, chunkBytes = ZIP_CHUNK_BYTES): ReadableStream<Uint8Array> {
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 256 * 1024) throw new BackupZipFailure('UNSUPPORTED');
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset === blob.size) { controller.close(); return; }
      const bytes = new Uint8Array(await blob.slice(offset, offset + chunkBytes).arrayBuffer());
      offset += bytes.length; controller.enqueue(bytes);
    },
  }, { highWaterMark: 1 });
}

/** Sequential entries, direct writes, one codec, bounded input. No BlobWriter or result accumulator. */
export async function writeBackupZip(input: BackupZipInput, destination: WritableStream<Uint8Array>, options: BackupZipWriteOptions = {}): Promise<BackupZipWriteMetrics> {
  const limits = options.limits ?? DEFAULT_BACKUP_LIMITS;
  if (!validateBackupV2Manifest(input.manifest, input.bookUuids, limits).valid) throw new BackupZipFailure('MANIFEST');
  const expected = new Map(backupManifestFiles(input.manifest).map(file => [file.archivePath, file]));
  if (input.sources.length !== expected.size || new Set(input.sources.map(source => source.archivePath)).size !== expected.size
    || input.sources.some(source => !expected.has(source.archivePath))) throw new BackupZipFailure('MANIFEST');
  configure({ chunkSize: ZIP_CHUNK_BYTES, maxWorkers: 1, useWebWorkers: false });
  const start = performance.now();
  let inputBytes = 0, outputBytes = 0, files = 0, maxInputChunk = 0, maxOutputChunk = 0, currentPath: string | null = null;
  const totalBytes = input.sources.some(source => source.sizeBytes === null) ? null : input.sources.reduce((sum, source) => sum + source.sizeBytes!, 0);
  const event = (phase: BackupZipProgress['phase'], stage: BackupOperationProgress['stage']) => options.onProgress?.({
    operationId: input.manifest.backupId, direction: 'export', stage, phase, filesProcessed: files,
    totalFiles: input.sources.length + 1, bytesProcessed: inputBytes, totalBytes, outputBytes, currentPath,
    cancellable: stage !== 'completed' && stage !== 'failed' && stage !== 'cancelled',
  });
  if (destination.locked) throw new BackupZipFailure('UNSUPPORTED');
  const sink = destination.getWriter();
  let closing = false, bufferedEntries = 0, directEntries = 0;
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const output = new WritableStream<Uint8Array>({
    async write(chunk) {
      cancelled(options.signal);
      const internals = zip as unknown as { bufferedWrites: number; directWrites: number };
      bufferedEntries = Math.max(bufferedEntries, internals.bufferedWrites);
      directEntries = Math.max(directEntries, internals.directWrites);
      try { await sink.write(chunk); } catch (error) { throw failure(error, 'DESTINATION_WRITE'); }
      outputBytes += chunk.byteLength; maxOutputChunk = Math.max(maxOutputChunk, chunk.byteLength);
      event('write', closing ? 'finalizing' : 'transferring'); cancelled(options.signal);
    },
    async close() { try { await sink.close(); } catch (error) { throw failure(error, 'DESTINATION_CLOSE'); } },
    async abort(reason) { await sink.abort(reason); },
  }, { highWaterMark: 1 });
  const zip = new ZipWriter(output, { bufferedWrite: false, useWebWorkers: false, keepOrder: true });
  try {
    event('prepare', 'preparing'); cancelled(options.signal);
    for (const source of input.sources) {
      currentPath = source.archivePath; cancelled(options.signal);
      const wanted = expected.get(source.archivePath)!;
      let raw: ReadableStream<Uint8Array>;
      try { raw = await source.open(); } catch (error) { throw failure(error, 'SOURCE_UNAVAILABLE'); }
      const reader = raw.getReader(), sha = new IncrementalSha256(); let size = 0;
      activeReader = reader;
      const tracked = new ReadableStream<Uint8Array>({
        async pull(controller) {
          cancelled(options.signal);
          let next: ReadableStreamReadResult<Uint8Array>;
          try { next = await reader.read(); } catch (error) { throw failure(error, 'SOURCE_READ'); }
          if (next.done) { reader.releaseLock(); activeReader = undefined; controller.close(); return; }
          if (next.value.byteLength > 256 * 1024) throw new BackupZipFailure('UNSUPPORTED');
          size += next.value.byteLength; inputBytes += next.value.byteLength;
          if (size > wanted.sizeBytes || inputBytes > limits.maxTotalBytes) throw new BackupZipFailure('INTEGRITY');
          maxInputChunk = Math.max(maxInputChunk, next.value.byteLength); sha.update(next.value);
          event('read', 'transferring'); cancelled(options.signal); controller.enqueue(next.value);
        },
        async cancel(reason) { try { await reader.cancel(reason); } finally { reader.releaseLock(); activeReader = undefined; } },
      }, { highWaterMark: 1 });
      await zip.add(source.archivePath, tracked, { level: options.level ?? 1, bufferedWrite: false, dataDescriptor: true,
        zip64: options.forceZip64 ? true : undefined, signal: options.signal, useWebWorkers: false,
        ...(source.sizeBytes === null ? {} : { uncompressedSize: source.sizeBytes }) });
      if (size !== wanted.sizeBytes || sha.hex() !== wanted.sha256) throw new BackupZipFailure('INTEGRITY');
      files++; event('between-entries', 'transferring'); cancelled(options.signal);
    }
    currentPath = 'manifest.json';
    const manifest = new Blob([JSON.stringify(input.manifest)]);
    await zip.add('manifest.json', boundedBlobStream(manifest), { level: 1, bufferedWrite: false, dataDescriptor: true,
      zip64: options.forceZip64 ? true : undefined, useWebWorkers: false, signal: options.signal });
    files++; event('before-finalize', 'finalizing'); cancelled(options.signal);
    await options.beforeFinalize?.(); cancelled(options.signal);
    closing = true; event('finalize', 'finalizing'); await zip.close();
    // Close only establishes closed-unverified; caller must reopen, hash and validate before completion.
    return { outputState: 'closed-unverified', inputBytes, outputBytes, maxInputChunk, maxOutputChunk, durationMs: performance.now() - start,
      bufferedEntries, directEntries };
  } catch (error) {
    const safe = options.signal?.aborted ? new BackupZipFailure('CANCELLED') : failure(error, 'ZIP_FORMAT');
    event('error', safe.code === 'CANCELLED' ? 'cancelled' : 'failed');
    await sink.abort(safe).catch(() => undefined);
    // Never call zip.close() to salvage an incomplete entry into an apparently completed archive.
    throw safe;
  } finally {
    if (activeReader) { await activeReader.cancel().catch(() => undefined); activeReader.releaseLock(); }
    sink.releaseLock();
  }
}

/** Bounded EOCD/ZIP64 preflight BEFORE the library may allocate central-directory metadata. */
export async function checkBackupArchiveEnvelope(blob: Blob, limits = DEFAULT_BACKUP_LIMITS) {
  const bytes = new Uint8Array(await blob.slice(Math.max(0, blob.size - 65557)).arrayBuffer());
  const view = new DataView(bytes.buffer); let end = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new BackupZipFailure('ZIP_FORMAT');
  let count = view.getUint16(end + 10, true), centralBytes = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
  let boundary = blob.size - bytes.length + end, zip64 = false;
  if (view.getUint16(end + 8, true) !== count) throw new BackupZipFailure('ZIP_FORMAT');
  const hasLocator = end >= 20 && view.getUint32(end - 20, true) === 0x07064b50;
  const disk = view.getUint16(end + 4, true), directoryDisk = view.getUint16(end + 6, true);
  if ((disk !== 0 && !(hasLocator && disk === 65535)) || (directoryDisk !== 0 && !(hasLocator && directoryDisk === 65535))) throw new BackupZipFailure('ZIP_FORMAT');
  if (hasLocator || count === 65535 || centralBytes === 0xffffffff || offset === 0xffffffff) {
    if (end < 20 || view.getUint32(end - 20, true) !== 0x07064b50 || view.getUint32(end - 16, true) !== 0 || view.getUint32(end - 4, true) !== 1) throw new BackupZipFailure('ZIP_FORMAT');
    const pointer = Number(view.getBigUint64(end - 12, true));
    if (!Number.isSafeInteger(pointer) || pointer + 56 > boundary - 20) throw new BackupZipFailure('ZIP_FORMAT');
    const record = new DataView(await blob.slice(pointer, pointer + 56).arrayBuffer());
    if (record.byteLength !== 56 || record.getUint32(0, true) !== 0x06064b50 || record.getUint32(16, true) !== 0 || record.getUint32(20, true) !== 0
      || pointer + 12 + Number(record.getBigUint64(4, true)) !== boundary - 20) throw new BackupZipFailure('ZIP_FORMAT');
    count = Number(record.getBigUint64(32, true)); centralBytes = Number(record.getBigUint64(40, true)); offset = Number(record.getBigUint64(48, true));
    if (record.getBigUint64(24, true) !== record.getBigUint64(32, true)) throw new BackupZipFailure('ZIP_FORMAT');
    boundary = pointer; zip64 = true;
  }
  const metadataCeiling = Math.min(32 * 1024 ** 2, limits.maxManifestBytes * 2);
  if (![count, centralBytes, offset].every(value => Number.isSafeInteger(value) && value >= 0) || count > limits.maxEntries
    || centralBytes > metadataCeiling || offset + centralBytes !== boundary) throw new BackupZipFailure('ZIP_FORMAT');
  return { entryCount: count, centralBytes, zip64 };
}

export interface BackupZipVerification {
  readonly manifest: BackupV2Manifest;
  readonly entries: readonly { archivePath: string; sizeBytes: number; sha256: string; compressedBytes: number; method: number; dataDescriptor: boolean; zip64: boolean }[];
  readonly inputBytes: number;
  readonly maxChunk: number;
}
/** Reopens ZIP without extracting paths. Metadata is bounded; payloads are hashed into a discard sink. */
export async function verifyBackupZip(blob: Blob, limits = DEFAULT_BACKUP_LIMITS, signal?: AbortSignal,
  onProgress?: (event: BackupZipProgress) => void): Promise<BackupZipVerification> {
  const envelope = await checkBackupArchiveEnvelope(blob, limits);
  const reader = new ZipReader(new BlobReader(blob), { useWebWorkers: false, strictness: 'strict', filenameValidation: 'strict', checkSignature: true });
  const start = performance.now(); let total = 0, maxChunk = 0, files = 0;
  const progress = (path: string | null, done = false) => onProgress?.({ operationId: 'proof-verification', direction: 'export',
    stage: done ? 'completed' : 'verifying', phase: done ? 'done' : 'verify', currentPath: path, bytesProcessed: total, totalBytes: null,
    outputBytes: blob.size, filesProcessed: files, totalFiles: envelope.entryCount, cancellable: !done });
  try {
    const entries: Entry[] = [], inventory: BackupArchiveEntry[] = [];
    const names = new Set<string>();
    for await (const entry of reader.getEntriesGenerator()) {
      cancelled(signal);
      const raw = new TextDecoder('utf-8', { fatal: true }).decode(entry.rawFilename);
      if (raw !== entry.filename || !isSafeBackupPath(raw) || names.has(raw.toLowerCase())) throw new BackupZipFailure('MANIFEST');
      names.add(raw.toLowerCase());
      if (entries.length >= limits.maxEntries || entry.uncompressedSize > limits.maxEntryBytes) throw new BackupZipFailure('MANIFEST');
      entries.push(entry);
      inventory.push({ rawPath: raw, kind: entry.symlink ? 'symlink' : entry.directory ? 'directory' : entry.unixMode && (entry.unixMode & 0xf000) !== 0x8000 ? 'special' : 'file',
        uncompressedBytes: entry.uncompressedSize, compressedBytes: entry.compressedSize, encrypted: entry.encrypted,
        compression: entry.compressionMethod === 0 ? 'store' : entry.compressionMethod === 8 ? 'deflate' : 'unsupported' });
    }
    const read = async (entry: Entry, json = false) => {
      if (entry.directory || !entry.getData) throw new BackupZipFailure('MANIFEST');
      const bound = json ? Math.min(limits.maxManifestBytes, 1024 * 1024) : limits.maxEntryBytes;
      if (entry.uncompressedSize > bound) throw new BackupZipFailure('MANIFEST');
      const sha = new IncrementalSha256(), text: Uint8Array[] = []; let size = 0;
      await entry.getData(new WritableStream<Uint8Array>({ write(chunk) {
        cancelled(signal); size += chunk.length; total += chunk.length; maxChunk = Math.max(maxChunk, chunk.length);
        if (size > bound || size > entry.uncompressedSize || !validateBackupProcessingBudget({ entryBytes: size, totalBytes: total,
          compressedBytes: entry.compressedSize, elapsedMs: Math.ceil(performance.now() - start) }, limits).valid) throw new BackupZipFailure('MANIFEST');
        sha.update(chunk); if (json) text.push(chunk); progress(entry.filename);
      } }), { signal, checkSignature: true, useWebWorkers: false, strictness: 'strict' });
      if (size !== entry.uncompressedSize) throw new BackupZipFailure('INTEGRITY');
      files++;
      return { archivePath: entry.filename, sizeBytes: size, sha256: sha.hex(),
        text: json ? await new Blob(text as BlobPart[]).text() : '', compressedBytes: entry.compressedSize,
        method: entry.compressionMethod, dataDescriptor: !!entry.bitFlag?.dataDescriptor, zip64: !!entry.extraFieldZip64 };
    };
    const named = (name: string) => { const entry = entries.find(entry => entry.filename === name); if (!entry) throw new BackupZipFailure('MANIFEST'); return entry; };
    const manifestEntry = named('manifest.json');
    if (manifestEntry.uncompressedSize > limits.maxManifestBytes) throw new BackupZipFailure('MANIFEST');
    const m = await read(manifestEntry, true), b = await read(named('books.json'), true), r = await read(named('reading.json'), true);
    const books = JSON.parse(b.text) as { uuid: string }[];
    if (!Array.isArray(books)) throw new BackupZipFailure('MANIFEST');
    const uuids = books.map(book => book.uuid);
    const validated = parseBackupV2Manifest(m.text, uuids, limits);
    if (!validated.valid || !validateBackupArchiveEntries(validated.value, inventory, limits).valid
      || !validateBackupReadingData(JSON.parse(r.text), validated.value, uuids, limits).valid) throw new BackupZipFailure('MANIFEST');
    const cache = new Map([['books.json', b], ['reading.json', r]]);
    const observed = [];
    for (const expected of backupManifestFiles(validated.value)) {
      const actual = cache.get(expected.archivePath) ?? await read(named(expected.archivePath));
      if (!validateBackupFileIntegrity(expected, { archivePath: actual.archivePath, sizeBytes: actual.sizeBytes,
        checksum: { algorithm: 'sha256', value: actual.sha256 } }).valid) throw new BackupZipFailure('INTEGRITY');
      observed.push({ archivePath: actual.archivePath, sizeBytes: actual.sizeBytes, sha256: actual.sha256,
        compressedBytes: actual.compressedBytes, method: actual.method, dataDescriptor: actual.dataDescriptor, zip64: actual.zip64 });
    }
    progress(null, true); return { manifest: validated.value, entries: observed, inputBytes: total, maxChunk };
  } catch (error) { throw optionsCancelled(error, signal); }
  finally { await reader.close(); }
}
function optionsCancelled(error: unknown, signal?: AbortSignal) { return signal?.aborted ? new BackupZipFailure('CANCELLED') : failure(error, 'ZIP_FORMAT'); }
