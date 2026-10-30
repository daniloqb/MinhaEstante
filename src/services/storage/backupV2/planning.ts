import type { Book } from '../../../types/book';
import { isValidAttachmentTypeAndFormat } from '../../../types/digitalMedia';
import type { BookAttachment, ReaderPosition } from '../../../types/digitalMedia';
import { normalizeStoredFile } from '../digital/validation';
import type { DigitalStorageErrorCode } from '../digital/contracts';
import type { BackupExportOptions, BackupExportPlan, BackupMediaEntry, BackupOmissionReason, BackupOperationResult,
  BackupErrorCode, BackupPortableAttachment, BackupRestoreConflict, BackupValidationResult, BackupVerifiedMedia, DigitalBackupOptions } from './contracts';
import { defaultDigitalBackupOptions } from './contracts';
import { isBackupLogicalId, validateBackupReadingData } from './validation';
import type { BackupV2Manifest } from './contracts';

/** Explicit projection: source numeric bookId/provider/reference/MIME are not serialized. */
export function portableBackupAttachment(bookUuid: string, attachment: BookAttachment): BackupPortableAttachment {
  return { bookUuid, id: attachment.id, type: attachment.type, format: attachment.format, filename: attachment.filename,
    sizeBytes: attachment.sizeBytes, sha256: attachment.checksum ?? null, createdAt: attachment.createdAt, updatedAt: attachment.updatedAt };
}
export interface BackupExportCandidate {
  readonly attachment: BackupPortableAttachment;
  /** Result of future capability/access checks. No filesystem access by this planner. */
  readonly availability: 'accessible' | Exclude<BackupOmissionReason, 'category-not-selected'>;
}
export function planBackupExport(input: {
  readonly bookUuids: readonly string[];
  readonly coversCount: number;
  readonly attachments: readonly BackupExportCandidate[];
  readonly options?: DigitalBackupOptions;
}): BackupValidationResult<BackupExportPlan> {
  const options = input.options ?? defaultDigitalBackupOptions();
  const invalid = (at: string): BackupValidationResult<BackupExportPlan> => ({ valid: false, issues: [{ code: 'INVALID_REFERENCE', at }] });
  if (typeof options.includeEbooks !== 'boolean' || typeof options.includeAudiobooks !== 'boolean'
    || !Number.isSafeInteger(input.coversCount) || input.coversCount < 0) return invalid('plan');
  const books = new Set(input.bookUuids), ids = new Set<string>(), slots = new Set<string>();
  if (books.size !== input.bookUuids.length || input.bookUuids.some(uuid => !isBackupLogicalId(uuid))) return invalid('books.uuid');
  const candidates: BackupPortableAttachment[] = [], omitted: { attachmentId: string; reason: BackupOmissionReason }[] = [];
  let knownMediaBytes = 0, unknownMediaSizes = 0;
  for (const { attachment, availability } of input.attachments) {
    const slot = `${attachment.bookUuid}:${attachment.type}`;
    if (!books.has(attachment.bookUuid) || !isBackupLogicalId(attachment.id) || ids.has(attachment.id) || slots.has(slot)
      || !isValidAttachmentTypeAndFormat(attachment.type, attachment.format)
      || (attachment.sizeBytes !== null && (!Number.isSafeInteger(attachment.sizeBytes) || attachment.sizeBytes < 0))) return invalid('attachments');
    ids.add(attachment.id); slots.add(slot);
    const selected = attachment.type === 'ebook' ? options.includeEbooks : options.includeAudiobooks;
    if (!selected) omitted.push({ attachmentId: attachment.id, reason: 'category-not-selected' });
    else if (availability !== 'accessible') omitted.push({ attachmentId: attachment.id, reason: availability });
    else {
      // Copy only portable fields even if a caller passes a richer object at runtime.
      candidates.push({ id: attachment.id, bookUuid: attachment.bookUuid, type: attachment.type, format: attachment.format,
        filename: attachment.filename, sizeBytes: attachment.sizeBytes, sha256: attachment.sha256,
        createdAt: attachment.createdAt, updatedAt: attachment.updatedAt });
      if (attachment.sizeBytes === null) unknownMediaSizes++;
      else knownMediaBytes += attachment.sizeBytes;
    }
  }
  if (!Number.isSafeInteger(knownMediaBytes)) return invalid('space');
  return { valid: true, value: {
    format: options.includeEbooks || options.includeAudiobooks ? 'v2' : 'legacy',
    options: { includeEbooks: options.includeEbooks, includeAudiobooks: options.includeAudiobooks },
    booksCount: books.size, coversCount: input.coversCount,
    ebooksCount: input.attachments.filter(item => item.attachment.type === 'ebook').length,
    audiobooksCount: input.attachments.filter(item => item.attachment.type === 'audiobook').length,
    candidates, omitted,
    space: { knownMediaBytes, unknownMediaSizes, estimatedAdditionalBytes: null, availableBytes: null, assurance: 'estimate-only' },
    warnings: omitted.filter(item => item.reason !== 'category-not-selected').map(() => ({ code: 'MEDIA_UNAVAILABLE', at: 'plan.media' })),
  } };
}

/** No completion until output close/finalization AND all selected omissions are acknowledged. */
export function assessBackupExportResult(input: {
  readonly operationId: string;
  readonly options: BackupExportOptions;
  readonly media: readonly BackupMediaEntry[];
  readonly finalized: boolean;
  readonly acknowledgedOmissions: readonly string[];
  readonly cancelled?: boolean;
  readonly error?: { readonly code: 'IO_FAILED' | 'INSUFFICIENT_SPACE' | 'INTEGRITY_MISMATCH'; readonly at: string };
}): BackupOperationResult {
  const omitted = input.media.filter(media => media.state === 'omitted');
  const failures = omitted.filter(media => media.state === 'omitted' && media.reason !== 'category-not-selected').map(media => media.id);
  const base = { operationId: input.operationId, committed: { bookUuids: [], attachmentIds: [], sessionIds: [], progressIds: [] },
    omittedAttachmentIds: omitted.map(media => media.id) };
  if (input.cancelled) return { ...base, status: 'cancelled', recoveryRequired: !input.finalized };
  if (input.error) return { ...base, status: 'failed', error: input.error, recoveryRequired: true };
  if (failures.length && input.options.failurePolicy === 'abort') return { ...base, status: 'failed', error: { code: 'MEDIA_UNAVAILABLE', at: 'media' }, recoveryRequired: true };
  if (!input.finalized || failures.some(id => !input.acknowledgedOmissions.includes(id))) return {
    ...base, status: 'attention-required', issues: [{ code: !input.finalized ? 'RECOVERY_REQUIRED' : 'MEDIA_UNAVAILABLE', at: 'export' }], recoveryRequired: !input.finalized,
  };
  return failures.length ? { ...base, status: 'partial', finalized: true, acknowledgedOmissions: failures }
    : { ...base, status: 'complete', finalized: true };
}

/** Conservative proposal: every identity match is reviewable; title/author never deduplicates. */
export function findBackupBookConflicts(incoming: readonly Pick<Book, 'uuid' | 'isbn13' | 'origem' | 'idExterno'>[], existing: readonly Book[]): readonly BackupRestoreConflict[] {
  const conflicts: BackupRestoreConflict[] = [];
  for (const book of incoming) for (const current of existing) {
    const kind = book.uuid && book.uuid === current.uuid ? 'book-uuid'
      : book.isbn13 && book.isbn13 === current.isbn13 ? 'isbn-different-uuid'
      : book.idExterno && book.idExterno === current.idExterno && book.origem === current.origem ? 'external-id' : null;
    if (kind && book.uuid) conflicts.push({ kind, bookUuid: book.uuid, incomingId: book.uuid,
      existingId: current.uuid ?? String(current.id), resolution: 'pending' });
  }
  return conflicts;
}

/** Returns a FUTURE repository argument only. No I/O, mutation or implicit association. */
export function planVerifiedBackupBinding(media: BackupMediaEntry, evidence: BackupVerifiedMedia, target: { readonly bookId: number; readonly attachmentId: string }): BackupValidationResult<Omit<BookAttachment, 'createdAt' | 'updatedAt'>> {
  const invalid = (): BackupValidationResult<never> => ({ valid: false, issues: [{ code: 'INTEGRITY_MISMATCH', at: 'binding' }] });
  if (media.state !== 'included' || evidence.attachmentId !== media.id || evidence.bookUuid !== media.bookUuid || evidence.format !== media.format
    || !Number.isSafeInteger(target.bookId) || target.bookId < 1 || !isBackupLogicalId(target.attachmentId)) return invalid();
  try {
    const stored = normalizeStoredFile(evidence.stored);
    if (stored.integrity.sizeBytes !== media.sizeBytes || stored.integrity.checksum.value !== media.sha256 || stored.metadata.format !== media.format) return invalid();
    return { valid: true, value: { id: target.attachmentId, bookId: target.bookId, type: media.type, format: media.format,
      filename: media.filename, sizeBytes: stored.integrity.sizeBytes, checksum: stored.integrity.checksum.value,
      storageProvider: stored.file.storageProvider, storageReference: stored.file.storageReference } };
  } catch { return invalid(); }
}

/** Caller must first obtain a verified binding. Absent media/format mismatch never creates a position. */
export function planBackupReaderPosition(position: ReaderPosition, manifest: BackupV2Manifest, bookUuids: readonly string[], evidence: BackupVerifiedMedia, target: { readonly bookId: number; readonly attachmentId: string }): BackupValidationResult<ReaderPosition> {
  const validated = validateBackupReadingData({ readerPositions: [position], sessions: [], progress: [] }, manifest, bookUuids);
  if (!validated.valid) return validated;
  const media = manifest.media.find(media => media.id === position.attachmentId);
  if (!media) return { valid: false, issues: [{ code: 'INVALID_REFERENCE', at: 'position.binding' }] };
  const binding = planVerifiedBackupBinding(media, evidence, target);
  if (!binding.valid) return binding;
  return { valid: true, value: { ...position, attachmentId: binding.value.id } };
}

/** Fixed codes only. Provider exception messages must never become portable reports. */
export function classifyBackupStorageError(code: DigitalStorageErrorCode): BackupErrorCode {
  switch (code) {
    case 'USER_CANCELLED': case 'OPERATION_CANCELLED': return 'CANCELLED';
    case 'PERMISSION_REQUIRED': case 'PERMISSION_DENIED': case 'PERMISSION_REVOKED': return 'PERMISSION_REQUIRED';
    case 'FILE_NOT_FOUND': case 'FILE_UNAVAILABLE': return 'MEDIA_UNAVAILABLE';
    case 'INSUFFICIENT_SPACE': return 'INSUFFICIENT_SPACE';
    case 'INTEGRITY_MISMATCH': return 'INTEGRITY_MISMATCH';
    case 'ATTACHMENT_CONFLICT': case 'OPERATION_CONFLICT': return 'CONFLICT';
    case 'RECOVERY_REQUIRED': case 'LINK_PERSISTENCE_FAILED': return 'RECOVERY_REQUIRED';
    case 'PROVIDER_UNAVAILABLE': case 'UNSUPPORTED_OPERATION': case 'NOT_CONFIGURED': return 'CAPABILITY_UNAVAILABLE';
    default: return 'IO_FAILED';
  }
}
