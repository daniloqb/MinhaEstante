import { getExpectedLocationTypeForFormat, isValidAttachmentTypeAndFormat, isValidReaderLocation, isValidReadingProgress } from '../../../types/digitalMedia';
import type { AttachmentFormat, AttachmentType, ProgressUnit, ReaderLocationType } from '../../../types/digitalMedia';
import { BACKUP_V2_FORMAT, DEFAULT_BACKUP_LIMITS } from './contracts';
import type { BackupArchiveEntry, BackupArchiveFile, BackupErrorCode, BackupIntegrityObservation, BackupMediaEntry, BackupReadingData, BackupV2Manifest, BackupValidationLimits, BackupValidationResult } from './contracts';

class InvalidBackup extends Error {
  constructor(readonly code: BackupErrorCode, readonly at: string) { super(code); }
}
function requireValue(condition: unknown, code: BackupErrorCode, at: string): asserts condition {
  if (!condition) throw new InvalidBackup(code, at);
}
function checked<T>(work: () => T): BackupValidationResult<T> {
  try { return { valid: true, value: work() }; }
  catch (error) {
    return { valid: false, issues: [{ code: error instanceof InvalidBackup ? error.code : 'INVALID_MANIFEST',
      at: error instanceof InvalidBackup ? error.at : 'manifest' }] };
  }
}
function object(value: unknown, at: string): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_MANIFEST', at);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], at: string) {
  for (const key of Object.keys(value)) {
    requireValue(allowed.includes(key), /storage|reference|provider|uri|token|permission|path/i.test(key)
      ? 'NON_PORTABLE_FIELD' : 'INVALID_MANIFEST', at);
  }
}
export function isBackupLogicalId(value: unknown): value is string {
  // Accepts UUIDs and the existing repositories' fallback IDs; never a storage token field.
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
function id(value: unknown, at: string) { requireValue(isBackupLogicalId(value), 'INVALID_REFERENCE', at); }
function integer(value: unknown, at: string, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  requireValue(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max, 'INVALID_SIZE', at);
}
function hash(value: unknown, at: string) { requireValue(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'INVALID_HASH', at); }
function filename(value: unknown, at: string) {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= 255
    && value.trim() === value && value !== '.' && value !== '..' && !/[\\/:\x00-\x1f\x7f]/.test(value), 'INVALID_PATH', at);
}
function limitsValid(limits: BackupValidationLimits) {
  for (const value of Object.values(limits)) requireValue(Number.isSafeInteger(value) && value > 0, 'LIMIT_EXCEEDED', 'limits');
}
export function isSafeBackupPath(path: unknown, maxDepth = DEFAULT_BACKUP_LIMITS.maxPathDepth): path is string {
  if (typeof path !== 'string' || path.length > 256 || !/^[a-zA-Z0-9_./-]+$/.test(path)) return false;
  const parts = path.split('/');
  return parts.length <= maxDepth && parts.every(part => part.length > 0 && part !== '.' && part !== '..')
    && !path.includes('..');
}
export function backupMediaPath(idValue: string, type: AttachmentType, format: AttachmentFormat): string {
  // Throwing programmer-facing helper; untrusted inputs use the result validators below.
  id(idValue, 'media.id');
  requireValue(isValidAttachmentTypeAndFormat(type, format), 'INVALID_MANIFEST', 'media.format');
  return `media/${type === 'ebook' ? 'ebooks' : 'audiobooks'}/${idValue}.${format}`;
}
function archiveFile(value: unknown, at: string, limits: BackupValidationLimits) {
  const file = object(value, at);
  requireValue(isSafeBackupPath(file.archivePath, limits.maxPathDepth), 'INVALID_PATH', at);
  integer(file.sizeBytes, at);
  requireValue(file.sizeBytes <= limits.maxEntryBytes, 'LIMIT_EXCEEDED', at);
  hash(file.sha256, at);
  return file;
}
function unique(values: readonly string[], at: string) {
  requireValue(new Set(values).size === values.length, 'DUPLICATE_ENTRY', at);
}
const fileKeys = ['archivePath', 'sizeBytes', 'sha256'];
const portableKeys = ['id', 'bookUuid', 'type', 'format', 'filename', 'sizeBytes', 'sha256', 'createdAt', 'updatedAt'];
const failureReasons = ['temporarily-unavailable', 'permission-required', 'file-not-found', 'read-error', 'integrity-error', 'insufficient-space'];

/** Future dispatcher only; does not relax or replace the existing legacy importer. */
export function identifyBackupManifest(value: unknown): BackupValidationResult<'legacy' | 'v2'> {
  return checked(() => {
    const v = object(value, 'manifest');
    if ('backupVersion' in v || 'format' in v) {
      requireValue(v.format === BACKUP_V2_FORMAT, 'INVALID_MANIFEST', 'format');
      requireValue(v.backupVersion === 2, 'UNSUPPORTED_VERSION', 'backupVersion');
      return 'v2';
    }
    requireValue(v.version === 1 && typeof v.appId === 'string' && v.appId.length > 0, 'UNSUPPORTED_VERSION', 'version');
    return 'legacy';
  });
}

/** Requires actual bibliographic UUIDs from books.json, not IDs invented from media entries. */
export function validateBackupV2Manifest(value: unknown, bookUuids: readonly string[], limits = DEFAULT_BACKUP_LIMITS): BackupValidationResult<BackupV2Manifest> {
  return checked(() => {
    limitsValid(limits);
    const v = object(value, 'manifest');
    requireValue(v.backupVersion !== undefined, 'INVALID_MANIFEST', 'backupVersion');
    requireValue(v.backupVersion === 2, 'UNSUPPORTED_VERSION', 'backupVersion');
    keys(v, ['format', 'backupVersion', 'backupId', 'createdAt', 'appVersion', 'options', 'counts', 'bibliography', 'reading', 'covers', 'media', 'acknowledgedOmissions'], 'manifest');
    requireValue(v.format === BACKUP_V2_FORMAT, 'INVALID_MANIFEST', 'format');
    id(v.backupId, 'backupId');
    requireValue(typeof v.createdAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v.createdAt)
      && Number.isFinite(Date.parse(v.createdAt))
      && new Date(v.createdAt).toISOString().replace('.000Z', 'Z') === v.createdAt.replace('.000Z', 'Z'), 'INVALID_MANIFEST', 'createdAt');
    requireValue(v.appVersion === undefined || (typeof v.appVersion === 'string' && /^[a-zA-Z0-9.+_-]{1,64}$/.test(v.appVersion)), 'INVALID_MANIFEST', 'appVersion');
    const options = object(v.options, 'options'); keys(options, ['includeEbooks', 'includeAudiobooks'], 'options');
    requireValue(typeof options.includeEbooks === 'boolean' && typeof options.includeAudiobooks === 'boolean', 'INVALID_MANIFEST', 'options');
    requireValue(options.includeEbooks || options.includeAudiobooks, 'INVALID_MANIFEST', 'options');
    const counts = object(v.counts, 'counts');
    const countKeys = ['books', 'covers', 'eligibleMedia', 'includedMedia', 'omittedMedia', 'unavailableMedia'];
    keys(counts, countKeys, 'counts'); countKeys.forEach(key => integer(counts[key], 'counts'));
    requireValue(bookUuids.length <= limits.maxEntries, 'LIMIT_EXCEEDED', 'books');
    bookUuids.forEach(uuid => id(uuid, 'books.uuid')); unique(bookUuids, 'books.uuid');
    const books = new Set(bookUuids);
    requireValue(counts.books === books.size, 'INVALID_REFERENCE', 'counts.books');
    const bibliography = archiveFile(v.bibliography, 'bibliography', limits); keys(bibliography, fileKeys, 'bibliography');
    const reading = archiveFile(v.reading, 'reading', limits); keys(reading, fileKeys, 'reading');
    requireValue(bibliography.archivePath === 'books.json' && reading.archivePath === 'reading.json', 'INVALID_PATH', 'records');
    requireValue(Array.isArray(v.covers) && Array.isArray(v.media) && Array.isArray(v.acknowledgedOmissions), 'INVALID_MANIFEST', 'lists');
    requireValue(v.covers.length + v.media.length + 3 <= limits.maxEntries && v.acknowledgedOmissions.length <= v.media.length, 'LIMIT_EXCEEDED', 'lists');
    const files: Record<string, unknown>[] = [bibliography, reading];
    for (const cover of v.covers) {
      const file = archiveFile(cover, 'covers', limits); keys(file, fileKeys, 'covers');
      requireValue(typeof file.archivePath === 'string' && /^covers\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,180}\.(jpg|jpeg|png|webp)$/.test(file.archivePath), 'INVALID_PATH', 'covers');
      files.push(file);
    }
    const ids: string[] = [], slots: string[] = [], failures: string[] = [];
    let included = 0;
    for (const raw of v.media) {
      const media = object(raw, 'media');
      keys(media, [...portableKeys, 'state', ...(media.state === 'included' ? ['archivePath'] : ['reason'])], 'media');
      id(media.id, 'media.id'); id(media.bookUuid, 'media.bookUuid');
      requireValue(books.has(media.bookUuid as string), 'INVALID_REFERENCE', 'media.bookUuid');
      requireValue(isValidAttachmentTypeAndFormat(media.type as AttachmentType, media.format as AttachmentFormat), 'INVALID_MANIFEST', 'media.format');
      filename(media.filename, 'media.filename'); integer(media.createdAt, 'media.createdAt'); integer(media.updatedAt, 'media.updatedAt');
      requireValue(media.updatedAt >= media.createdAt, 'INVALID_MANIFEST', 'media.updatedAt');
      if (media.sizeBytes !== null) integer(media.sizeBytes, 'media.sizeBytes');
      if (media.sha256 !== null) hash(media.sha256, 'media.sha256');
      ids.push(media.id as string); slots.push(`${media.bookUuid}:${media.type}`);
      const selected = media.type === 'ebook' ? options.includeEbooks : options.includeAudiobooks;
      if (media.state === 'included') {
        requireValue(selected, 'INVALID_MANIFEST', 'media.state');
        archiveFile(media, 'media', limits);
        requireValue((media.sizeBytes as number) > 0, 'INVALID_SIZE', 'media.sizeBytes');
        requireValue(media.archivePath === backupMediaPath(media.id as string, media.type as AttachmentType, media.format as AttachmentFormat), 'INVALID_PATH', 'media.archivePath');
        files.push(media); included++;
      } else {
        requireValue(media.state === 'omitted', 'INVALID_MANIFEST', 'media.state');
        requireValue(selected ? failureReasons.includes(media.reason as string) : media.reason === 'category-not-selected', 'INVALID_MANIFEST', 'media.reason');
        if (selected) failures.push(media.id as string);
      }
    }
    unique(ids, 'media.id'); unique(slots, 'media.slot');
    const acknowledgements = v.acknowledgedOmissions as unknown[];
    acknowledgements.forEach(value => id(value, 'acknowledgedOmissions'));
    unique(acknowledgements as string[], 'acknowledgedOmissions');
    requireValue(acknowledgements.length === failures.length && failures.every(value => acknowledgements.includes(value)), 'MEDIA_UNAVAILABLE', 'acknowledgedOmissions');
    requireValue(counts.covers === v.covers.length && counts.eligibleMedia === v.media.length && counts.includedMedia === included
      && counts.omittedMedia === v.media.length - included && counts.unavailableMedia === failures.length, 'INVALID_MANIFEST', 'counts');
    unique(files.map(file => (file.archivePath as string).toLowerCase()), 'archivePath');
    let total = 0;
    for (const file of files) { total += file.sizeBytes as number; requireValue(Number.isSafeInteger(total) && total <= limits.maxTotalBytes, 'LIMIT_EXCEEDED', 'totalBytes'); }
    return value as BackupV2Manifest;
  });
}

/** Bound UTF-8 manifest text BEFORE JSON.parse; no archive bytes are loaded here. */
export function parseBackupV2Manifest(text: string, bookUuids: readonly string[], limits = DEFAULT_BACKUP_LIMITS): BackupValidationResult<BackupV2Manifest> {
  const parsed = checked(() => {
    limitsValid(limits);
    requireValue(text.length <= limits.maxManifestBytes && new TextEncoder().encode(text).length <= limits.maxManifestBytes, 'LIMIT_EXCEEDED', 'manifestBytes');
    return JSON.parse(text) as unknown;
  });
  return parsed.valid ? validateBackupV2Manifest(parsed.value, bookUuids, limits) : parsed;
}

export function backupManifestFiles(manifest: BackupV2Manifest): readonly BackupArchiveFile[] {
  return [manifest.bibliography, manifest.reading, ...manifest.covers,
    ...manifest.media.filter((media): media is BackupMediaEntry & BackupArchiveFile => media.state === 'included')];
}
/** Pure metadata walk; iterable can be fed by a future bounded central-directory reader. */
export function validateBackupArchiveEntries(manifest: BackupV2Manifest, entries: Iterable<BackupArchiveEntry>, limits = DEFAULT_BACKUP_LIMITS): BackupValidationResult<true> {
  return checked(() => {
    limitsValid(limits);
    const expected = new Map(backupManifestFiles(manifest).map(file => [file.archivePath, file.sizeBytes]));
    const seen = new Set<string>(), found = new Set<string>();
    const directories = new Set(['covers/', 'media/', 'media/ebooks/', 'media/audiobooks/']);
    let count = 0, total = 0;
    for (const entry of entries) {
      requireValue(++count <= limits.maxEntries, 'LIMIT_EXCEEDED', 'archive.entries');
      const path = entry.rawPath;
      requireValue(entry.kind === 'file' || entry.kind === 'directory', 'UNSUPPORTED_ENTRY', 'archive.kind');
      requireValue(isSafeBackupPath(entry.kind === 'directory' && typeof path === 'string' ? path.slice(0, -1) : path, limits.maxPathDepth), 'INVALID_PATH', 'archive.path');
      const key = path.replace(/\/$/, '').toLowerCase();
      requireValue(!seen.has(key), 'DUPLICATE_ENTRY', 'archive.entries'); seen.add(key);
      integer(entry.uncompressedBytes, 'archive.size'); integer(entry.compressedBytes, 'archive.compressedSize');
      requireValue(entry.encrypted === false && ['store', 'deflate'].includes(entry.compression), 'UNSUPPORTED_ENTRY', 'archive.encoding');
      if (entry.kind === 'directory') {
        requireValue(directories.has(path) && entry.uncompressedBytes === 0 && entry.compressedBytes === 0, 'UNEXPECTED_ENTRY', 'archive.directory');
        continue;
      }
      requireValue(path === 'manifest.json' || expected.has(path), 'UNEXPECTED_ENTRY', 'archive.path');
      const max = path === 'manifest.json' ? Math.min(limits.maxEntryBytes, limits.maxManifestBytes) : limits.maxEntryBytes;
      requireValue(entry.uncompressedBytes <= max, 'LIMIT_EXCEEDED', 'archive.size');
      requireValue(entry.uncompressedBytes / Math.max(1, entry.compressedBytes) <= limits.maxExpansionRatio, 'LIMIT_EXCEEDED', 'archive.expansion');
      requireValue(path === 'manifest.json' || expected.get(path) === entry.uncompressedBytes, 'INVALID_SIZE', 'archive.declaredSize');
      total += entry.uncompressedBytes;
      requireValue(Number.isSafeInteger(total) && total <= limits.maxTotalBytes, 'LIMIT_EXCEEDED', 'archive.totalBytes');
      found.add(path);
    }
    requireValue(found.has('manifest.json') && [...expected.keys()].every(path => found.has(path)), 'MISSING_ENTRY', 'archive.entries');
    return true;
  });
}
/** Actual counters must also be enforced WHILE inflating, before buffers are allocated/written. */
export function validateBackupProcessingBudget(observed: { entryBytes: number; totalBytes: number; compressedBytes: number; elapsedMs: number }, limits = DEFAULT_BACKUP_LIMITS): BackupValidationResult<true> {
  return checked(() => {
    limitsValid(limits); Object.values(observed).forEach(value => integer(value, 'processing'));
    requireValue(observed.entryBytes <= observed.totalBytes && observed.entryBytes <= limits.maxEntryBytes && observed.totalBytes <= limits.maxTotalBytes
      && observed.entryBytes / Math.max(1, observed.compressedBytes) <= limits.maxExpansionRatio
      && observed.elapsedMs <= limits.maxProcessingMs, 'LIMIT_EXCEEDED', 'processing');
    return true;
  });
}
export function validateBackupFileIntegrity(expected: BackupArchiveFile, actual: BackupIntegrityObservation): BackupValidationResult<true> {
  return checked(() => {
    integer(actual.sizeBytes, 'integrity.size'); hash(actual.checksum.value, 'integrity.hash');
    requireValue(actual.checksum.algorithm === 'sha256' && actual.archivePath === expected.archivePath
      && actual.sizeBytes === expected.sizeBytes && actual.checksum.value === expected.sha256, 'INTEGRITY_MISMATCH', 'integrity');
    return true;
  });
}

export function validateBackupReadingData(value: unknown, manifest: BackupV2Manifest, bookUuids: readonly string[], limits = DEFAULT_BACKUP_LIMITS): BackupValidationResult<BackupReadingData> {
  return checked(() => {
    limitsValid(limits);
    const v = object(value, 'reading'); keys(v, ['readerPositions', 'sessions', 'progress'], 'reading');
    requireValue(Array.isArray(v.readerPositions) && Array.isArray(v.sessions) && Array.isArray(v.progress), 'INVALID_MANIFEST', 'reading');
    requireValue(v.readerPositions.length + v.sessions.length + v.progress.length <= limits.maxEntries, 'LIMIT_EXCEEDED', 'reading');
    const media = new Map(manifest.media.filter(file => file.state === 'included').map(file => [file.id, file]));
    const positionIds: string[] = [], attachmentIds: string[] = [], sessionIds: string[] = [], active: string[] = [], progressIds: string[] = [], progressSessions: string[] = [];
    for (const raw of v.readerPositions) {
      const p = object(raw, 'positions'); keys(p, ['id', 'attachmentId', 'locationType', 'location', 'updatedAt'], 'positions');
      id(p.id, 'positions.id'); id(p.attachmentId, 'positions.attachmentId'); integer(p.updatedAt, 'positions.updatedAt');
      const attachment = media.get(p.attachmentId as string);
      requireValue(attachment && p.locationType === getExpectedLocationTypeForFormat(attachment.format), 'INVALID_REFERENCE', 'positions.attachmentId');
      requireValue(typeof p.location === 'string' && p.location.length <= 8192 && isValidReaderLocation(p.locationType as ReaderLocationType, p.location)
        && (p.locationType === 'epub_cfi' || Number.isFinite(Number(p.location))), 'INVALID_MANIFEST', 'positions.location');
      positionIds.push(p.id as string); attachmentIds.push(p.attachmentId as string);
    }
    for (const raw of v.sessions) {
      const s = object(raw, 'sessions'); keys(s, ['id', 'bookUuid', 'status', 'startedAt', 'completedAt', 'abandonedAt', 'updatedAt'], 'sessions');
      id(s.id, 'sessions.id'); id(s.bookUuid, 'sessions.bookUuid');
      requireValue(bookUuids.includes(s.bookUuid as string), 'INVALID_REFERENCE', 'sessions.bookUuid');
      requireValue(['active', 'completed', 'abandoned'].includes(s.status as string), 'INVALID_MANIFEST', 'sessions.status');
      integer(s.startedAt, 'sessions.startedAt'); integer(s.updatedAt, 'sessions.updatedAt');
      for (const key of ['completedAt', 'abandonedAt']) if (s[key] != null) integer(s[key], 'sessions.date');
      requireValue(s.status !== 'completed' || s.completedAt != null, 'INVALID_MANIFEST', 'sessions.completedAt');
      requireValue(s.status !== 'abandoned' || s.abandonedAt != null, 'INVALID_MANIFEST', 'sessions.abandonedAt');
      sessionIds.push(s.id as string); if (s.status === 'active') active.push(s.bookUuid as string);
    }
    const sessions = new Set(sessionIds);
    for (const raw of v.progress) {
      const p = object(raw, 'progress'); keys(p, ['id', 'sessionId', 'unit', 'currentValue', 'totalValue', 'source', 'updatedAt'], 'progress');
      id(p.id, 'progress.id'); id(p.sessionId, 'progress.sessionId'); integer(p.updatedAt, 'progress.updatedAt');
      requireValue(sessions.has(p.sessionId as string), 'INVALID_REFERENCE', 'progress.sessionId');
      requireValue(['pages', 'percentage', 'seconds'].includes(p.unit as string) && ['manual', 'reader_device'].includes(p.source as string)
        && Number.isFinite(p.currentValue) && (p.totalValue == null || Number.isFinite(p.totalValue))
        && isValidReadingProgress(p.unit as ProgressUnit, p.currentValue as number, p.totalValue as number | null | undefined), 'INVALID_MANIFEST', 'progress.value');
      progressIds.push(p.id as string); progressSessions.push(p.sessionId as string);
    }
    [positionIds, attachmentIds, sessionIds, active, progressIds, progressSessions].forEach(values => unique(values, 'reading.identity'));
    return value as BackupReadingData;
  });
}
