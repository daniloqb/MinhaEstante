import type { Book } from '../../../../types/book';
import type { BookAttachment, ReaderPosition, ReadingProgress, ReadingSession } from '../../../../types/digitalMedia';
import type { BackupArchiveFile, BackupErrorCode, BackupExportPlan, BackupOperationCheckpoint, BackupOperationProgress, BackupV2Manifest } from '../contracts';

export class ExportFailure extends Error {
  constructor(readonly code: BackupErrorCode, readonly file?: { attachmentId: string; filename: string }, readonly outputClosed = false) { super(code); }
}
export function checkCancelled(signal?: AbortSignal) { if (signal?.aborted) throw new ExportFailure('CANCELLED'); }
export interface CatalogSnapshot {
  books: Book[]; attachments: BookAttachment[]; positions: ReaderPosition[]; sessions: ReadingSession[]; progress: ReadingProgress[];
}
/** Bytes stay in provider/Worker. These local references are never serialized in the ZIP or report. */
export interface ExportPayload extends BackupArchiveFile {
  blob?: Blob;
  managed?: BookAttachment;
}
export interface PreparedExport {
  manifest: BackupV2Manifest;
  plan: BackupExportPlan;
  snapshotDigest: string;
  payloads: readonly ExportPayload[];
  totalBytes: number;
}
export interface ExportProgress extends BackupOperationProgress {
  currentPath: string | null;
  outputBytes: number;
}
export interface ExportExecution {
  operationId: string;
  manifest: BackupV2Manifest;
  payloads: readonly ExportPayload[];
  signal: AbortSignal;
  onProgress: (event: ExportProgress) => void;
  checkpoint: (stage: BackupOperationCheckpoint['stage'], state: BackupOperationCheckpoint['outputState']) => Promise<void>;
  revalidate: () => Promise<void>;
}
export interface ExportReceipt {
  status: 'verified'; outputBytes: number; zipSha256: string; entries: readonly BackupArchiveFile[];
  durationMs: number; destination: 'saf' | 'web-external' | 'test-opfs';
}
export interface ExportDestination {
  kind: ExportReceipt['destination'];
  execute(request: ExportExecution): Promise<ExportReceipt>;
  abandon?(): Promise<void>;
  confirm?(): Promise<void>;
}
export interface ExportReport {
  operationId: string;
  status: 'verified' | 'failed' | 'cancelled';
  error?: BackupErrorCode;
  receipt?: ExportReceipt;
  omitted: readonly { attachmentId: string; reason: string; filename: string }[];
  partialMayRemain: boolean;
  outputClosed: boolean;
  requested: { ebooks: number; audiobooks: number };
  includedMedia: number;
  blockedFiles: readonly { attachmentId: string; filename: string }[];
}
