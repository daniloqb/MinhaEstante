import type { Book } from '../../../../types/book';
import type { BackupArchiveFile, BackupMediaEntry, BackupReadingData, DigitalBackupOptions } from '../contracts';
import { backupMediaPath, validateBackupReadingData, validateBackupV2Manifest } from '../validation';
import { planBackupExport, portableBackupAttachment } from '../planning';
import { IncrementalSha256 } from '../../digital/web/sha256';
import { checkCancelled, ExportFailure } from './types';
import type { CatalogSnapshot, ExportPayload, PreparedExport } from './types';

/** Measured media ceilings plus 1 MiB budget for the integrated catalog/reading/cover metadata. */
export const WEB_EXPORT_MAX_BYTES = 129 * 1024 ** 2;
export const ANDROID_EXPORT_MAX_BYTES = 101 * 1024 ** 2;
export const WEB_EXPORT_MAX_ENTRY_BYTES = 134218405;
export const ANDROID_EXPORT_MAX_ENTRY_BYTES = 104858276;
export const EXPORT_JSON_MAX_BYTES = 1024 * 1024;
function immutable<T>(value: T): T {
  if (value && typeof value === 'object' && !(value instanceof Blob)) {
    Object.values(value).forEach(immutable); Object.freeze(value);
  }
  return value;
}
export async function digestBlob(blob: Blob, signal?: AbortSignal): Promise<string> {
  const sha = new IncrementalSha256();
  for (let offset = 0; offset < blob.size; offset += 65536) { checkCancelled(signal); sha.update(new Uint8Array(await blob.slice(offset, offset + 65536).arrayBuffer())); }
  return sha.hex();
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function snapshotDigest(value: CatalogSnapshot) {
  const ordered = Object.fromEntries(Object.entries(value).map(([key, rows]) => [key, [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)))]));
  return digestBlob(new Blob([canonical(ordered)]));
}
async function payload(archivePath: string, blob: Blob, signal?: AbortSignal): Promise<ExportPayload> {
  if (blob.size > EXPORT_JSON_MAX_BYTES && archivePath.endsWith('.json')) throw new ExportFailure('LIMIT_EXCEEDED');
  return { archivePath, sizeBytes: blob.size, sha256: await digestBlob(blob, signal), blob };
}
export async function prepareExport(snapshot: CatalogSnapshot, options: DigitalBackupOptions, readCover: (book: Book) => Promise<Blob | null>,
  operationId: string, maxBytes = WEB_EXPORT_MAX_BYTES, signal?: AbortSignal): Promise<PreparedExport> {
  checkCancelled(signal);
  snapshot = structuredClone(snapshot);
  const uuids = snapshot.books.map(book => book.uuid ?? '');
  const byId = new Map(snapshot.books.map(book => [book.id, book.uuid!]));
  const planned = planBackupExport({ bookUuids: uuids, coversCount: 0, options, attachments: snapshot.attachments.map(row => ({
    attachment: portableBackupAttachment(byId.get(row.bookId) ?? '', row), availability: 'accessible',
  })) });
  if (!planned.valid) throw new ExportFailure(planned.issues[0].code);
  if (planned.value.format !== 'v2') throw new ExportFailure('CAPABILITY_UNAVAILABLE');
  const media: BackupMediaEntry[] = snapshot.attachments.map(row => {
    const portable = portableBackupAttachment(byId.get(row.bookId)!, row), selected = row.type === 'ebook' ? options.includeEbooks : options.includeAudiobooks;
    if (!selected) return { ...portable, state: 'omitted', reason: 'category-not-selected' };
    if (!Number.isSafeInteger(row.sizeBytes) || row.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(row.checksum ?? '')) throw new ExportFailure('MEDIA_UNAVAILABLE', { attachmentId: row.id, filename: row.filename });
    if (row.sizeBytes > (maxBytes === ANDROID_EXPORT_MAX_BYTES ? ANDROID_EXPORT_MAX_ENTRY_BYTES : WEB_EXPORT_MAX_ENTRY_BYTES)) throw new ExportFailure('LIMIT_EXCEEDED');
    return { ...portable, sizeBytes: row.sizeBytes, sha256: row.checksum!, state: 'included', archivePath: backupMediaPath(row.id, row.type, row.format) };
  });
  const included = new Set(media.filter(row => row.state === 'included').map(row => row.id));
  const mediaBytes = media.reduce((sum, row) => sum + (row.state === 'included' ? row.sizeBytes : 0), 0);
  if (!Number.isSafeInteger(mediaBytes) || mediaBytes > maxBytes) throw new ExportFailure('LIMIT_EXCEEDED');
  const reading: BackupReadingData = {
    readerPositions: snapshot.positions.filter(row => included.has(row.attachmentId)),
    sessions: snapshot.sessions.map(({ bookId, ...row }) => ({ ...row, bookUuid: byId.get(bookId) ?? '' })),
    progress: snapshot.progress,
  };
  const covers: ExportPayload[] = [], books: Book[] = []; let coverBytes = 0;
  for (const book of snapshot.books) {
    checkCancelled(signal);
    const bytes = await readCover(book);
    let path: string | null = null;
    if (bytes) {
      if (bytes.size > 2 * 1024 ** 2) throw new ExportFailure('LIMIT_EXCEEDED');
      coverBytes += bytes.size;
      if (mediaBytes + coverBytes > maxBytes) throw new ExportFailure('LIMIT_EXCEEDED');
      const header = new Uint8Array(await bytes.slice(0, 12).arrayBuffer());
      const ext = header[0] === 137 && header[1] === 80 ? 'png' : header[0] === 255 && header[1] === 216 ? 'jpg'
        : header[0] === 82 && header[8] === 87 ? 'webp' : null;
      if (!ext) throw new ExportFailure('INTEGRITY_MISMATCH');
      path = `covers/${book.uuid}.${ext}`; covers.push(await payload(path, bytes, signal));
    }
    // Never export a platform display URI or embedded image alongside its archive payload.
    books.push({ ...book, capaLocalPath: path, capaUrl: book.capaUrl?.startsWith('https://') ? book.capaUrl : null });
  }
  const bibliography = await payload('books.json', new Blob([JSON.stringify(books)]), signal);
  const readingFile = await payload('reading.json', new Blob([JSON.stringify(reading)]), signal);
  const descriptor = ({ archivePath, sizeBytes, sha256 }: BackupArchiveFile) => ({ archivePath, sizeBytes, sha256 });
  const manifest = { format: 'minhaestante-backup' as const, backupVersion: 2 as const, backupId: operationId, createdAt: new Date().toISOString(), options: { ...options },
    counts: { books: books.length, covers: covers.length, eligibleMedia: media.length, includedMedia: included.size, omittedMedia: media.length - included.size, unavailableMedia: 0 },
    bibliography: { ...descriptor(bibliography), archivePath: 'books.json' as const }, reading: { ...descriptor(readingFile), archivePath: 'reading.json' as const },
    covers: covers.map(descriptor), media, acknowledgedOmissions: [] };
  const valid = validateBackupV2Manifest(manifest, uuids), validReading = validateBackupReadingData(reading, manifest, uuids);
  if (!valid.valid) throw new ExportFailure(valid.issues[0].code);
  if (!validReading.valid) throw new ExportFailure(validReading.issues[0].code);
  const payloads: ExportPayload[] = [bibliography, readingFile, ...covers, ...media.flatMap(row => row.state === 'included'
    ? [{ archivePath: row.archivePath, sizeBytes: row.sizeBytes, sha256: row.sha256, managed: snapshot.attachments.find(value => value.id === row.id)! }] : [])];
  const totalBytes = payloads.reduce((sum, row) => sum + row.sizeBytes, new Blob([JSON.stringify(manifest)]).size);
  if (totalBytes > maxBytes || payloads.length + 1 > 10000) throw new ExportFailure('LIMIT_EXCEEDED');
  return immutable({ manifest, plan: { ...planned.value, coversCount: covers.length }, payloads, snapshotDigest: await snapshotDigest(snapshot), totalBytes });
}
