import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { BackupService } from '../services/storage/backupService';
import { syntheticLegacyBackup } from './helpers/syntheticLegacyBackup';
import { managedFileReference } from '../services/storage/digital/validation';
import {
  assessBackupExportResult, backupManifestFiles, backupMediaPath, classifyBackupStorageError, DEFAULT_BACKUP_LIMITS,
  defaultDigitalBackupOptions, findBackupBookConflicts, identifyBackupManifest, isSafeBackupPath,
  parseBackupV2Manifest, planBackupExport, planBackupReaderPosition, planVerifiedBackupBinding, portableBackupAttachment,
  validateBackupArchiveEntries, validateBackupFileIntegrity, validateBackupProcessingBudget, validateBackupReadingData, validateBackupV2Manifest,
} from '../services/storage/backupV2';
import type { BackupArchiveEntry, BackupMediaEntry, BackupPortableAttachment, BackupReadingData, BackupV2Manifest, BackupVerifiedMedia, BackupValidationResult } from '../services/storage/backupV2';
import type { Book, BookAttachment, ReaderPosition } from '../types/book';

const bookUuid = '10000000-0000-4000-8000-000000000001';
const hash = 'a'.repeat(64);
function media(type: 'ebook' | 'audiobook' = 'ebook'): Extract<BackupMediaEntry, { state: 'included' }> {
  const id = type === 'ebook' ? 'attachment-ebook' : 'attachment-audio';
  const format = type === 'ebook' ? 'epub' : 'm4b';
  return { id, bookUuid, type, format, filename: type === 'ebook' ? 'Obra sintética.epub' : 'Áudio sintético.m4b',
    sizeBytes: 100, sha256: hash, createdAt: 1, updatedAt: 2, state: 'included', archivePath: backupMediaPath(id, type, format) };
}
function manifest(): BackupV2Manifest {
  return { format: 'minhaestante-backup', backupVersion: 2, backupId: 'backup-synthetic', createdAt: '2026-10-29T18:00:00Z',
    options: { includeEbooks: true, includeAudiobooks: true },
    counts: { books: 1, covers: 1, eligibleMedia: 2, includedMedia: 2, omittedMedia: 0, unavailableMedia: 0 },
    bibliography: { archivePath: 'books.json', sizeBytes: 20, sha256: hash },
    reading: { archivePath: 'reading.json', sizeBytes: 20, sha256: hash },
    covers: [{ archivePath: 'covers/synthetic.jpg', sizeBytes: 20, sha256: hash }],
    media: [media(), media('audiobook')], acknowledgedOmissions: [] };
}
function omitted(type: 'ebook' | 'audiobook', reason: 'category-not-selected' | 'permission-required' = 'category-not-selected'): Extract<BackupMediaEntry, { state: 'omitted' }> {
  const { archivePath: _path, ...rest } = media(type);
  return { ...rest, state: 'omitted', reason };
}
function archive(m = manifest()): BackupArchiveEntry[] {
  return [{ archivePath: 'manifest.json', sizeBytes: 1000 }, ...backupManifestFiles(m)].map(file => ({
    rawPath: file.archivePath, kind: 'file', uncompressedBytes: file.sizeBytes, compressedBytes: file.sizeBytes, encrypted: false, compression: 'store',
  }));
}
function evidence(type: 'ebook' | 'audiobook' = 'ebook'): BackupVerifiedMedia {
  const entry = media(type);
  return { attachmentId: entry.id, bookUuid, format: entry.format, stored: { state: 'stored', operationId: 'child-import',
    file: managedFileReference('web_digital', 'new-local-reference'), metadata: { filename: entry.filename, sizeBytes: 100, format: entry.format },
    integrity: { sizeBytes: 100, checksum: { algorithm: 'sha256', value: hash } } } };
}
function errorCode(result: BackupValidationResult<unknown>): string {
  expect(result.valid).toBe(false);
  if (result.valid) throw new Error('Expected rejection');
  return result.issues[0].code;
}
const position: ReaderPosition = { id: 'position-1', attachmentId: 'attachment-ebook', locationType: 'epub_cfi', location: 'epubcfi(/6/4)', updatedAt: 4 };
const reading: BackupReadingData = { readerPositions: [position],
  sessions: [{ id: 'session-1', bookUuid, status: 'completed', startedAt: 1, completedAt: 3, updatedAt: 3 }],
  progress: [{ id: 'progress-1', sessionId: 'session-1', unit: 'pages', currentValue: 20, totalValue: 20, source: 'manual', updatedAt: 3 }] };

describe('Backup v2: versioned portable manifest', () => {
  it('accepts valid v2 with both categories and bounded JSON parser', () => {
    expect(validateBackupV2Manifest(manifest(), [bookUuid]).valid).toBe(true);
    expect(parseBackupV2Manifest(JSON.stringify(manifest()), [bookUuid]).valid).toBe(true);
    expect(identifyBackupManifest(manifest())).toEqual({ valid: true, value: 'v2' });
  });
  it.each([
    ['backupVersion', undefined, 'INVALID_MANIFEST'], ['backupVersion', 3, 'UNSUPPORTED_VERSION'],
    ['backupVersion', '2', 'UNSUPPORTED_VERSION'], ['format', 'other', 'INVALID_MANIFEST'],
    ['backupId', undefined, 'INVALID_REFERENCE'], ['createdAt', '2026-02-30T18:00:00Z', 'INVALID_MANIFEST'],
    ['options', undefined, 'INVALID_MANIFEST'], ['bibliography', undefined, 'INVALID_MANIFEST'],
    ['reading', undefined, 'INVALID_MANIFEST'], ['media', undefined, 'INVALID_MANIFEST'],
    ['covers', undefined, 'INVALID_MANIFEST'], ['acknowledgedOmissions', undefined, 'INVALID_MANIFEST'],
  ])('rejects missing/invalid %s (%s)', (key, value, expected) => {
    expect(errorCode(validateBackupV2Manifest({ ...manifest(), [key]: value }, [bookUuid]))).toBe(expected);
  });
  it.each([
    ['type', 'audio', 'INVALID_MANIFEST'], ['format', 'mp3', 'INVALID_MANIFEST'], ['bookUuid', 'missing-book', 'INVALID_REFERENCE'],
    ['id', 'content://private/token', 'INVALID_REFERENCE'], ['filename', '/device/private.epub', 'INVALID_PATH'],
    ['filename', 'bad\nname.epub', 'INVALID_PATH'], ['sha256', 'crc32', 'INVALID_HASH'], ['sha256', null, 'INVALID_HASH'],
    ['sizeBytes', -1, 'INVALID_SIZE'], ['sizeBytes', null, 'INVALID_SIZE'], ['sizeBytes', Number.MAX_SAFE_INTEGER + 1, 'INVALID_SIZE'],
    ['sizeBytes', Infinity, 'INVALID_SIZE'], ['archivePath', '/media/ebooks/attachment-ebook.epub', 'INVALID_PATH'],
    ['archivePath', 'media/ebooks/../attachment-ebook.epub', 'INVALID_PATH'], ['archivePath', 'media/ebooks/wrong-id.epub', 'INVALID_PATH'],
  ])('rejects invalid media field %s (%s)', (key, value, expected) => {
    const m = manifest();
    expect(errorCode(validateBackupV2Manifest({ ...m, media: [{ ...m.media[0], [key]: value }, m.media[1]] }, [bookUuid]))).toBe(expected);
  });
  it.each(['storageReference', 'storageProvider', 'sourceReference', 'uri', 'permission', 'token'])('rejects nonportable field %s even when opaque', key => {
    const m = manifest();
    expect(errorCode(validateBackupV2Manifest({ ...m, media: [{ ...m.media[0], [key]: 'opaque-local-value' }, m.media[1]] }, [bookUuid]))).toBe('NON_PORTABLE_FIELD');
  });
  it('rejects duplicate IDs, slots and source book identities', () => {
    const m = manifest();
    expect(errorCode(validateBackupV2Manifest({ ...m, media: [m.media[0], m.media[0]] }, [bookUuid]))).toBe('DUPLICATE_ENTRY');
    expect(errorCode(validateBackupV2Manifest({ ...m, media: [m.media[0], { ...m.media[0], id: 'other', archivePath: 'media/ebooks/other.epub' }] }, [bookUuid]))).toBe('DUPLICATE_ENTRY');
    expect(errorCode(validateBackupV2Manifest(m, [bookUuid, bookUuid]))).toBe('DUPLICATE_ENTRY');
  });
  it('rejects inconsistent counts, duplicate cover names and unknown future fields', () => {
    const m = manifest();
    expect(errorCode(validateBackupV2Manifest({ ...m, counts: { ...m.counts, includedMedia: 0 } }, [bookUuid]))).toBe('INVALID_MANIFEST');
    expect(errorCode(validateBackupV2Manifest({ ...m, covers: [m.covers[0], m.covers[0]], counts: { ...m.counts, covers: 2 } }, [bookUuid]))).toBe('DUPLICATE_ENTRY');
    expect(errorCode(validateBackupV2Manifest({ ...m, futureData: {} }, [bookUuid]))).toBe('INVALID_MANIFEST');
  });
  it.each(['ebook', 'audiobook'] as const)('supports only %s, explicitly omitting other category with unknown size', selected => {
    const m = manifest(), other = selected === 'ebook' ? 'audiobook' : 'ebook';
    const v = { ...m, options: { includeEbooks: selected === 'ebook', includeAudiobooks: selected === 'audiobook' },
      counts: { ...m.counts, includedMedia: 1, omittedMedia: 1 },
      media: [media(selected), { ...omitted(other), sizeBytes: null, sha256: null }] };
    expect(validateBackupV2Manifest(v, [bookUuid]).valid).toBe(true);
    expect(backupManifestFiles(v).filter(file => file.archivePath.startsWith('media/'))).toHaveLength(1);
  });
  it('requires explicit acknowledgment of selected unavailable file', () => {
    const m = manifest(), v = { ...m, media: [omitted('ebook', 'permission-required'), m.media[1]],
      counts: { ...m.counts, includedMedia: 1, omittedMedia: 1, unavailableMedia: 1 } };
    expect(errorCode(validateBackupV2Manifest(v, [bookUuid]))).toBe('MEDIA_UNAVAILABLE');
    expect(validateBackupV2Manifest({ ...v, acknowledgedOmissions: ['attachment-ebook'] }, [bookUuid]).valid).toBe(true);
  });
  it.each(['temporarily-unavailable', 'permission-required', 'file-not-found', 'read-error', 'integrity-error', 'insufficient-space'] as const)('retains distinct selected omission reason %s', reason => {
    const m = manifest();
    const v = { ...m, media: [{ ...omitted('ebook'), reason }, m.media[1]], acknowledgedOmissions: ['attachment-ebook'],
      counts: { ...m.counts, includedMedia: 1, omittedMedia: 1, unavailableMedia: 1 } };
    expect(validateBackupV2Manifest(v, [bookUuid]).valid).toBe(true);
    expect(validateBackupV2Manifest({ ...v, acknowledgedOmissions: ['attachment-ebook', 'not-an-omission'] }, [bookUuid]).valid).toBe(false);
  });
  it.each([['ebook', 'epub'], ['ebook', 'pdf'], ['audiobook', 'mp3'], ['audiobook', 'm4a'], ['audiobook', 'm4b']] as const)('accepts canonical format %s/%s', (type, format) => {
    const m = manifest(), entry = media(type), other = type === 'ebook' ? media('audiobook') : media();
    expect(validateBackupV2Manifest({ ...m, media: [{ ...entry, format, archivePath: backupMediaPath(entry.id, type, format) }, other] }, [bookUuid]).valid).toBe(true);
  });
  it('rejects zero-byte included media and unavailable reason for an unchecked category', () => {
    const m = manifest();
    expect(validateBackupV2Manifest({ ...m, media: [{ ...m.media[0], sizeBytes: 0 }, m.media[1]] }, [bookUuid]).valid).toBe(false);
    expect(validateBackupV2Manifest({ ...m, options: { includeEbooks: false, includeAudiobooks: true }, media: [omitted('ebook', 'permission-required'), m.media[1]] }, [bookUuid]).valid).toBe(false);
  });
  it('never includes an unchecked category or emits v2 for default options', () => {
    const m = manifest();
    expect(validateBackupV2Manifest({ ...m, options: defaultDigitalBackupOptions() }, [bookUuid]).valid).toBe(false);
    expect(validateBackupV2Manifest({ ...m, options: { includeEbooks: true, includeAudiobooks: false } }, [bookUuid]).valid).toBe(false);
  });
  it('limits UTF-8 manifest bytes, invalid JSON, entries, entry sizes, total and configuration', () => {
    expect(errorCode(parseBackupV2Manifest('{', [bookUuid]))).toBe('INVALID_MANIFEST');
    expect(errorCode(parseBackupV2Manifest('"éé"', [], { ...DEFAULT_BACKUP_LIMITS, maxManifestBytes: 5 }))).toBe('LIMIT_EXCEEDED');
    expect(errorCode(validateBackupV2Manifest(manifest(), [bookUuid], { ...DEFAULT_BACKUP_LIMITS, maxEntries: 4 }))).toBe('LIMIT_EXCEEDED');
    expect(errorCode(validateBackupV2Manifest(manifest(), [bookUuid], { ...DEFAULT_BACKUP_LIMITS, maxEntryBytes: 50 }))).toBe('LIMIT_EXCEEDED');
    expect(errorCode(validateBackupV2Manifest(manifest(), [bookUuid], { ...DEFAULT_BACKUP_LIMITS, maxTotalBytes: 100 }))).toBe('LIMIT_EXCEEDED');
    expect(errorCode(validateBackupV2Manifest(manifest(), [bookUuid], { ...DEFAULT_BACKUP_LIMITS, maxEntryBytes: NaN }))).toBe('LIMIT_EXCEEDED');
  });
  it('accepts multi-GiB metadata without allocating binary files', () => {
    const m = manifest(), large = 8 * 1024 ** 3;
    expect(validateBackupV2Manifest({ ...m, media: [m.media[0], { ...m.media[1], sizeBytes: large }] }, [bookUuid]).valid).toBe(true);
  });
});

describe('Backup v2: raw ZIP metadata and observed integrity', () => {
  it.each(['/absolute', 'C:/absolute', 'content://token', '../books.json', 'covers/../x.jpg', 'covers\\x.jpg', 'covers//x.jpg', './books.json', 'covers/%2e%2e/x.jpg', 'covers/a\0.jpg', 'covers/a/./b.jpg', 'media/ebooks/a/b.epub'])('rejects unsafe path %s', path => {
    expect(isSafeBackupPath(path)).toBe(false);
  });
  it('accepts known files and optional standard directories', () => {
    expect(validateBackupArchiveEntries(manifest(), [...archive(), { rawPath: 'media/ebooks/', kind: 'directory', uncompressedBytes: 0, compressedBytes: 0, encrypted: false, compression: 'store' }]).valid).toBe(true);
  });
  it.each([
    ['duplicate', 'DUPLICATE_ENTRY'], ['case-collision', 'DUPLICATE_ENTRY'], ['unknown', 'UNEXPECTED_ENTRY'],
    ['symlink', 'UNSUPPORTED_ENTRY'], ['special', 'UNSUPPORTED_ENTRY'], ['encrypted', 'UNSUPPORTED_ENTRY'],
    ['codec', 'UNSUPPORTED_ENTRY'], ['missing', 'MISSING_ENTRY'], ['wrong-size', 'INVALID_SIZE'], ['expansion', 'LIMIT_EXCEEDED'],
    ['absolute', 'INVALID_PATH'], ['traversal', 'INVALID_PATH'], ['unknown-directory', 'UNEXPECTED_ENTRY'],
  ])('rejects %s ZIP metadata', (scenario, expected) => {
    const entries = archive();
    if (scenario === 'duplicate') entries.push(entries[1]);
    if (scenario === 'case-collision') entries.push({ ...entries[1], rawPath: 'BOOKS.JSON' });
    if (scenario === 'unknown') entries.push({ ...entries[1], rawPath: 'extra.json' });
    if (scenario === 'symlink' || scenario === 'special') entries[1] = { ...entries[1], kind: scenario };
    if (scenario === 'encrypted') entries[1] = { ...entries[1], encrypted: true };
    if (scenario === 'codec') entries[1] = { ...entries[1], compression: 'unsupported' };
    if (scenario === 'missing') entries.pop();
    if (scenario === 'wrong-size') entries[1] = { ...entries[1], uncompressedBytes: 21 };
    if (scenario === 'expansion') entries[0] = { ...entries[0], uncompressedBytes: 1001, compressedBytes: 1 };
    if (scenario === 'absolute') entries[1] = { ...entries[1], rawPath: '/books.json' };
    if (scenario === 'traversal') entries[1] = { ...entries[1], rawPath: 'covers/../books.json' };
    if (scenario === 'unknown-directory') entries.push({ ...entries[1], rawPath: 'unknown/', kind: 'directory', uncompressedBytes: 0, compressedBytes: 0 });
    expect(errorCode(validateBackupArchiveEntries(manifest(), entries))).toBe(expected);
  });
  it('enforces entry count incrementally and does not consume an unbounded iterator', () => {
    let consumed = 0;
    function* entries(): Generator<BackupArchiveEntry> { for (const item of archive()) { consumed++; yield item; } }
    expect(errorCode(validateBackupArchiveEntries(manifest(), entries(), { ...DEFAULT_BACKUP_LIMITS, maxEntries: 2 }))).toBe('LIMIT_EXCEEDED');
    expect(consumed).toBe(3);
  });
  it('limits actual processing bytes, ratio and time independently from declarations', () => {
    const observation = { entryBytes: 20, totalBytes: 100, compressedBytes: 10, elapsedMs: 1 };
    expect(validateBackupProcessingBudget(observation).valid).toBe(true);
    for (const limit of [{ maxEntryBytes: 10 }, { maxTotalBytes: 50 }, { maxExpansionRatio: 1 }, { maxProcessingMs: 1 }]) {
      expect(errorCode(validateBackupProcessingBudget({ ...observation, elapsedMs: 2 }, { ...DEFAULT_BACKUP_LIMITS, ...limit }))).toBe('LIMIT_EXCEEDED');
    }
  });
  it('checks actual size and SHA-256, not CRC, before linking', () => {
    const expected = manifest().bibliography;
    const actual = { archivePath: 'books.json', sizeBytes: 20, checksum: { algorithm: 'sha256' as const, value: hash } };
    expect(validateBackupFileIntegrity(expected, actual).valid).toBe(true);
    expect(errorCode(validateBackupFileIntegrity(expected, { ...actual, sizeBytes: 21 }))).toBe('INTEGRITY_MISMATCH');
    expect(errorCode(validateBackupFileIntegrity(expected, { ...actual, checksum: { algorithm: 'sha256', value: 'b'.repeat(64) } }))).toBe('INTEGRITY_MISMATCH');
  });
});

describe('Backup v2: planning, outcomes and portability', () => {
  const attachments = [media(), media('audiobook')].map(attachment => ({ attachment, availability: 'accessible' as const }));
  it.each([[false, false, 0, 'legacy'], [true, false, 1, 'v2'], [false, true, 1, 'v2'], [true, true, 2, 'v2']] as const)(
    'plans independent options ebook=%s audio=%s', (includeEbooks, includeAudiobooks, count, format) => {
      const result = planBackupExport({ bookUuids: [bookUuid], coversCount: 1, attachments, options: { includeEbooks, includeAudiobooks } });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value.format).toBe(format); expect(result.value.candidates).toHaveLength(count);
        expect(result.value.omitted).toHaveLength(2 - count); expect(result.value.space.knownMediaBytes).toBe(count * 100);
      }
    });
  it('resets options for every flow and never selects media from catalog modalities', () => {
    const first = defaultDigitalBackupOptions(); Object.assign(first, { includeEbooks: true });
    expect(defaultDigitalBackupOptions()).toEqual({ includeEbooks: false, includeAudiobooks: false });
    const result = planBackupExport({ bookUuids: [bookUuid], coversCount: 0, attachments });
    expect(result.valid && result.value.candidates).toEqual([]);
  });
  it('distinguishes unknown size and selected unavailability without declaring success', () => {
    const result = planBackupExport({ bookUuids: [bookUuid], coversCount: 1, options: { includeEbooks: true, includeAudiobooks: true },
      attachments: [{ attachment: { ...media(), sizeBytes: null } as BackupPortableAttachment, availability: 'accessible' },
        { attachment: media('audiobook'), availability: 'permission-required' }] });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.space.unknownMediaSizes).toBe(1); expect(result.value.space.estimatedAdditionalBytes).toBeNull();
      expect(result.value.omitted[0].reason).toBe('permission-required'); expect(result.value.warnings[0].code).toBe('MEDIA_UNAVAILABLE');
    }
  });
  it('rejects duplicate identities/slots and missing books in planning', () => {
    expect(planBackupExport({ bookUuids: [], coversCount: 1, attachments }).valid).toBe(false);
    expect(planBackupExport({ bookUuids: [bookUuid], coversCount: 1, attachments: [attachments[0], attachments[0]] }).valid).toBe(false);
  });
  const resultInput = { operationId: 'export-1', options: { includeEbooks: true, includeAudiobooks: true, failurePolicy: 'allow-acknowledged-partial' as const },
    media: [omitted('ebook', 'permission-required'), media('audiobook')], finalized: true, acknowledgedOmissions: [] };
  it('requires acknowledged omissions and finalization for partial result', () => {
    expect(assessBackupExportResult(resultInput).status).toBe('attention-required');
    expect(assessBackupExportResult({ ...resultInput, acknowledgedOmissions: ['attachment-ebook'] }).status).toBe('partial');
    expect(assessBackupExportResult({ ...resultInput, acknowledgedOmissions: ['attachment-ebook'], finalized: false }).status).toBe('attention-required');
  });
  it('reports failure, cancellation and full completion separately', () => {
    expect(assessBackupExportResult({ ...resultInput, error: { code: 'IO_FAILED', at: 'output' } }).status).toBe('failed');
    expect(assessBackupExportResult({ ...resultInput, options: { ...resultInput.options, failurePolicy: 'abort' } }).status).toBe('failed');
    expect(assessBackupExportResult({ ...resultInput, cancelled: true }).status).toBe('cancelled');
    expect(assessBackupExportResult({ ...resultInput, media: manifest().media }).status).toBe('complete');
    expect(assessBackupExportResult({ ...resultInput, media: [omitted('ebook')], options: { ...resultInput.options, includeEbooks: false } }).status).toBe('complete');
  });
  it.each(['saf_document', 'web_digital'])('projects %s attachment without copying physical references', storageProvider => {
    const source: BookAttachment = { id: 'attachment-ebook', bookId: 45, type: 'ebook', format: 'epub', filename: 'synthetic.epub',
      sizeBytes: 100, checksum: hash, storageProvider, storageReference: 'installation-private-token', createdAt: 1, updatedAt: 2 };
    const portable = portableBackupAttachment(bookUuid, source);
    expect(portable.bookUuid).toBe(bookUuid); expect(portable).not.toHaveProperty('storageReference'); expect(portable).not.toHaveProperty('bookId');
    expect(JSON.stringify(portable)).not.toContain('installation-private-token');
  });
  it('constructs future binding only with verified destination bytes and a new local reference', () => {
    const target = { bookId: 987, attachmentId: 'destination-attachment' };
    const result = planVerifiedBackupBinding(media(), evidence(), target);
    expect(result.valid && result.value.storageReference).toBe('new-local-reference');
    expect(result.valid && result.value.bookId).toBe(987);
    const bad = evidence();
    expect(planVerifiedBackupBinding(media(), { ...bad, bookUuid: 'another-book' }, target).valid).toBe(false);
    expect(planVerifiedBackupBinding(media(), { ...bad, stored: { ...bad.stored, integrity: { sizeBytes: 100, checksum: { algorithm: 'sha256', value: 'b'.repeat(64) } } } }, target).valid).toBe(false);
    expect(planVerifiedBackupBinding(omitted('ebook'), evidence(), target).valid).toBe(false);
  });
  it('flags UUID and ISBN conflicts without title-based deduplication', () => {
    const existing = { id: 1, uuid: bookUuid, isbn13: 'synthetic-isbn', titulo: 'Same title', autores: ['Same author'], origem: 'manual' } as Book;
    expect(findBackupBookConflicts([{ uuid: bookUuid, origem: 'manual' }], [existing])[0]).toMatchObject({ kind: 'book-uuid', resolution: 'pending' });
    expect(findBackupBookConflicts([{ uuid: 'different', origem: 'manual', isbn13: 'synthetic-isbn' }], [existing])[0].kind).toBe('isbn-different-uuid');
    expect(findBackupBookConflicts([{ uuid: 'different', origem: 'manual' }], [existing])).toEqual([]);
  });
  it.each([['PERMISSION_REVOKED', 'PERMISSION_REQUIRED'], ['INSUFFICIENT_SPACE', 'INSUFFICIENT_SPACE'], ['RECOVERY_REQUIRED', 'RECOVERY_REQUIRED'], ['FILE_NOT_FOUND', 'MEDIA_UNAVAILABLE'], ['OPERATION_CANCELLED', 'CANCELLED']] as const)('classifies storage %s without exception messages', (code, expected) => {
    expect(classifyBackupStorageError(code)).toBe(expected);
  });
});

describe('Backup v2: independent deliberate history and content-specific positions', () => {
  it('validates complete reading data and remaps position only after verified binding', () => {
    expect(validateBackupReadingData(reading, manifest(), [bookUuid]).valid).toBe(true);
    expect(planBackupReaderPosition(position, manifest(), [bookUuid], evidence(), { bookId: 44, attachmentId: 'restored-ebook' })).toEqual({ valid: true, value: { ...position, attachmentId: 'restored-ebook' } });
  });
  it('rejects a position without media, format mismatch, duplicate positions and invalid audio seconds', () => {
    expect(validateBackupReadingData(reading, { ...manifest(), media: [omitted('ebook')] }, [bookUuid]).valid).toBe(false);
    expect(validateBackupReadingData({ ...reading, readerPositions: [{ ...position, locationType: 'pdf_page', location: '1' }] }, manifest(), [bookUuid]).valid).toBe(false);
    expect(validateBackupReadingData({ ...reading, readerPositions: [position, position] }, manifest(), [bookUuid]).valid).toBe(false);
    expect(validateBackupReadingData({ ...reading, readerPositions: [{ ...position, attachmentId: 'attachment-audio', locationType: 'audio_seconds', location: 'Infinity' }] }, manifest(), [bookUuid]).valid).toBe(false);
  });
  it('does not transfer position when the destination hash is different', () => {
    const bad = evidence();
    expect(planBackupReaderPosition(position, manifest(), [bookUuid], { ...bad, format: 'pdf' }, { bookId: 44, attachmentId: 'restored-ebook' }).valid).toBe(false);
  });
  it('preserves session/progress with no transported media', () => {
    expect(validateBackupReadingData({ ...reading, readerPositions: [] }, { ...manifest(), media: [omitted('ebook'), omitted('audiobook')] }, [bookUuid]).valid).toBe(true);
  });
  it('rejects orphan progress, nonexistent books, nonfinite values and competing active sessions', () => {
    expect(validateBackupReadingData({ ...reading, sessions: [] }, manifest(), [bookUuid]).valid).toBe(false);
    expect(validateBackupReadingData(reading, manifest(), []).valid).toBe(false);
    expect(validateBackupReadingData({ ...reading, progress: [{ ...reading.progress[0], currentValue: Infinity }] }, manifest(), [bookUuid]).valid).toBe(false);
    const active = { ...reading.sessions[0], status: 'active', completedAt: null };
    expect(validateBackupReadingData({ ...reading, sessions: [active, { ...active, id: 'session-2' }] }, manifest(), [bookUuid]).valid).toBe(false);
  });
});

describe('Legacy structure remains independent of v2', () => {
  it('recognizes existing version-1 manifest without changing its shape', async () => {
    const bytes = await syntheticLegacyBackup();
    const zip = await JSZip.loadAsync(bytes);
    const raw = JSON.parse(await zip.file('manifest.json')!.async('string'));
    const snapshot = JSON.stringify(raw);
    expect(identifyBackupManifest(raw)).toEqual({ valid: true, value: 'legacy' });
    expect(JSON.stringify(raw)).toBe(snapshot);
    const extracted = await BackupService.validateAndExtractZip(bytes);
    expect(extracted.books).toHaveLength(215); expect(extracted.coverFiles.size).toBe(207);
    expect(extracted.books.filter(book => book.tenho_fisico)).toHaveLength(141);
    expect(extracted.books.filter(book => book.status_leitura === 'lido')).toHaveLength(97);
    expect(extracted.manifest).not.toHaveProperty('backupVersion');
  });
  it('does not route future or ambiguous v2 as legacy', () => {
    expect(identifyBackupManifest({ appId: 'com.booknookapp', version: 1, format: 'minhaestante-backup', backupVersion: 3 }).valid).toBe(false);
    expect(identifyBackupManifest({ version: 7, appId: 'com.booknookapp' }).valid).toBe(false);
  });
});
