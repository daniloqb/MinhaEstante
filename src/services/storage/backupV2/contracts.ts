import type { AttachmentFormat, BookAttachment, ReaderPosition, ReadingProgress, ReadingSession } from '../../../types/digitalMedia';
import type { FileIntegrity, StoredDigitalFile } from '../digital/contracts';

/** Contract only: importing this module starts no storage, database or ZIP operation. */
export const BACKUP_V2_FORMAT = 'minhaestante-backup' as const;
export interface DigitalBackupOptions {
  readonly includeEbooks: boolean;
  readonly includeAudiobooks: boolean;
}
/** Each new flow receives its own unchecked options. */
export function defaultDigitalBackupOptions(): DigitalBackupOptions {
  return { includeEbooks: false, includeAudiobooks: false };
}
export interface BackupExportOptions extends DigitalBackupOptions {
  readonly failurePolicy: 'abort' | 'allow-acknowledged-partial';
}
export type BackupOmissionReason = 'category-not-selected' | 'temporarily-unavailable' | 'permission-required'
  | 'file-not-found' | 'read-error' | 'integrity-error' | 'insufficient-space';
export type BackupPortableAttachment = Pick<BookAttachment, 'id' | 'type' | 'format' | 'filename' | 'createdAt' | 'updatedAt'> & {
  readonly bookUuid: string;
  /** null is unknown, never zero by substitution. Required for included media. */
  readonly sizeBytes: number | null;
  readonly sha256: string | null;
};
export interface BackupArchiveFile {
  readonly archivePath: string;
  readonly sizeBytes: number;
  /** Lowercase hex SHA-256 of the uncompressed bytes. CRC is insufficient. */
  readonly sha256: string;
}
export type BackupMediaEntry = BackupPortableAttachment & (
  | (BackupArchiveFile & { readonly state: 'included' })
  | { readonly state: 'omitted'; readonly reason: BackupOmissionReason }
);
export interface BackupV2Manifest {
  readonly format: typeof BACKUP_V2_FORMAT;
  readonly backupVersion: 2;
  readonly backupId: string;
  readonly createdAt: string;
  readonly appVersion?: string;
  readonly options: DigitalBackupOptions;
  readonly counts: {
    readonly books: number;
    readonly covers: number;
    /** All attachment slots discovered, including unchecked categories. */
    readonly eligibleMedia: number;
    readonly includedMedia: number;
    readonly omittedMedia: number;
    /** Selected category, but bytes could not be transported. */
    readonly unavailableMedia: number;
  };
  readonly bibliography: BackupArchiveFile & { readonly archivePath: 'books.json' };
  readonly reading: BackupArchiveFile & { readonly archivePath: 'reading.json' };
  readonly covers: readonly BackupArchiveFile[];
  readonly media: readonly BackupMediaEntry[];
  /** Required, empty when there were no failures. Category opt-outs need no second acknowledgement. */
  readonly acknowledgedOmissions: readonly string[];
}

export interface BackupReadingData {
  readonly readerPositions: readonly ReaderPosition[];
  readonly sessions: readonly (Omit<ReadingSession, 'bookId'> & { readonly bookUuid: string })[];
  readonly progress: readonly ReadingProgress[];
}
export type BackupErrorCode = 'INVALID_MANIFEST' | 'UNSUPPORTED_VERSION' | 'INVALID_REFERENCE' | 'NON_PORTABLE_FIELD'
  | 'INVALID_PATH' | 'DUPLICATE_ENTRY' | 'MISSING_ENTRY' | 'UNEXPECTED_ENTRY' | 'UNSUPPORTED_ENTRY'
  | 'INVALID_HASH' | 'INVALID_SIZE' | 'LIMIT_EXCEEDED' | 'INTEGRITY_MISMATCH' | 'ARCHIVE_INVALID'
  | 'MEDIA_UNAVAILABLE' | 'CONFLICT' | 'CAPABILITY_UNAVAILABLE' | 'INSUFFICIENT_SPACE'
  | 'PERMISSION_REQUIRED' | 'IO_FAILED' | 'CANCELLED' | 'RECOVERY_REQUIRED';
export interface BackupIssue {
  readonly code: BackupErrorCode;
  /** Schema location only; never a native path, provider message or URI. */
  readonly at: string;
}
export type BackupValidationResult<T> = { readonly valid: true; readonly value: T }
  | { readonly valid: false; readonly issues: readonly BackupIssue[] };

/** Security policy, separate from proven limits of a future engine/environment. */
export interface BackupValidationLimits {
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxTotalBytes: number;
  readonly maxPathDepth: number;
  readonly maxManifestBytes: number;
  readonly maxExpansionRatio: number;
  readonly maxProcessingMs: number;
}
/** Provisional configurable ceilings: 16 GiB/entry, 256 GiB total, not a ZIP64 support promise. */
export const DEFAULT_BACKUP_LIMITS: Readonly<BackupValidationLimits> = Object.freeze({
  maxEntries: 100_000, maxEntryBytes: 16 * 1024 ** 3, maxTotalBytes: 256 * 1024 ** 3,
  maxPathDepth: 3, maxManifestBytes: 16 * 1024 ** 2, maxExpansionRatio: 1000, maxProcessingMs: 24 * 60 * 60 * 1000,
});
/** Must preserve raw central-directory names/duplicates BEFORE any ZIP library normalizes them. */
export interface BackupArchiveEntry {
  readonly rawPath: string;
  readonly kind: 'file' | 'directory' | 'symlink' | 'special';
  readonly uncompressedBytes: number;
  readonly compressedBytes: number;
  readonly encrypted: boolean;
  readonly compression: 'store' | 'deflate' | 'unsupported';
}
export interface BackupSpaceEstimate {
  readonly knownMediaBytes: number;
  readonly unknownMediaSizes: number;
  readonly estimatedAdditionalBytes: number | null;
  readonly availableBytes: number | null;
  readonly assurance: 'estimate-only';
}
export interface BackupExportPlan {
  readonly format: 'legacy' | 'v2';
  readonly options: DigitalBackupOptions;
  readonly booksCount: number;
  readonly coversCount: number;
  readonly ebooksCount: number;
  readonly audiobooksCount: number;
  readonly candidates: readonly BackupPortableAttachment[];
  readonly omitted: readonly { readonly attachmentId: string; readonly reason: BackupOmissionReason }[];
  readonly space: BackupSpaceEstimate;
  readonly warnings: readonly BackupIssue[];
}
export type BackupRestoreMode = 'empty-library' | 'merge' | 'replace-explicit';
export interface BackupRestoreConflict {
  readonly kind: 'book-uuid' | 'isbn-different-uuid' | 'external-id' | 'attachment-id' | 'attachment-slot'
    | 'identical-content' | 'different-content' | 'reader-position' | 'session-id' | 'active-session';
  readonly bookUuid: string;
  readonly incomingId: string;
  readonly existingId: string;
  readonly resolution: 'pending' | 'keep-existing' | 'reuse-verified' | 'replace-explicit' | 'import-separately';
}
export interface BackupRestorePlan {
  readonly operationId: string;
  readonly backupId: string;
  readonly mode: BackupRestoreMode;
  readonly bookIds: Readonly<Record<string, number>>;
  readonly attachmentIds: Readonly<Record<string, string>>;
  readonly sessionIds: Readonly<Record<string, string>>;
  readonly conflicts: readonly BackupRestoreConflict[];
  readonly mediaToStage: readonly string[];
  readonly positionsToSkip: readonly string[];
  readonly space: BackupSpaceEstimate;
  readonly warnings: readonly BackupIssue[];
  readonly readyToCommit: boolean;
}
export type BackupOperationStage = 'planning' | 'validating' | 'preparing' | 'transferring' | 'verifying'
  | 'linking' | 'finalizing' | 'reconciling' | 'completed' | 'cancelled' | 'failed' | 'recovery-required';
export interface BackupOperationProgress {
  readonly operationId: string;
  readonly direction: 'export' | 'restore';
  readonly stage: BackupOperationStage;
  readonly filesProcessed: number;
  readonly totalFiles: number | null;
  readonly bytesProcessed: number;
  readonly totalBytes: number | null;
  readonly cancellable: boolean;
}
export interface BackupCommittedData {
  readonly bookUuids: readonly string[];
  readonly attachmentIds: readonly string[];
  readonly sessionIds: readonly string[];
  readonly progressIds: readonly string[];
}
export type BackupOperationResult = {
  readonly operationId: string;
  readonly committed: BackupCommittedData;
  readonly omittedAttachmentIds: readonly string[];
} & (
  | { readonly status: 'complete'; readonly finalized: true }
  | { readonly status: 'partial'; readonly finalized: true; readonly acknowledgedOmissions: readonly string[] }
  | { readonly status: 'cancelled'; readonly recoveryRequired: boolean }
  | { readonly status: 'failed'; readonly error: BackupIssue; readonly recoveryRequired: boolean }
  | { readonly status: 'attention-required'; readonly issues: readonly BackupIssue[]; readonly recoveryRequired: boolean }
);
/** Future composite journal; not a new implementation or extension of import states. */
export interface BackupOperationCheckpoint {
  readonly version: 1;
  readonly operationId: string;
  readonly backupId: string;
  readonly direction: 'export' | 'restore';
  readonly stage: BackupOperationStage;
  readonly planDigest: string;
  readonly childImportOperationIds: readonly string[];
  readonly verifiedEntryPaths: readonly string[];
  readonly committed: BackupCommittedData;
  readonly outputState: 'not-created' | 'incomplete' | 'closed-unverified' | 'finalized';
  readonly cancelRequested: boolean;
}
export interface BackupOperationContext {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: BackupOperationProgress) => void;
}
/** Evidence from the destination provider; no binding may be committed from a manifest alone. */
export interface BackupVerifiedMedia {
  readonly attachmentId: string;
  readonly bookUuid: string;
  readonly format: AttachmentFormat;
  readonly stored: StoredDigitalFile;
}
export interface BackupIntegrityObservation extends FileIntegrity {
  readonly archivePath: string;
}
