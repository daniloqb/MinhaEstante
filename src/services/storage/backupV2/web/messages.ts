import type { BackupV2Manifest, BackupOperationCheckpoint } from '../contracts';
import type { ExportPayload, ExportProgress, ExportReceipt } from '../export/types';
export interface WorkerExportRequest {
  operationId: string; manifest: BackupV2Manifest;
  payloads: readonly (Pick<ExportPayload, 'archivePath' | 'sizeBytes' | 'sha256'> & { blob: Blob })[];
  destination: FileSystemFileHandle; kind: ExportReceipt['destination'];
}
export type WorkerRequest = { type: 'start'; request: WorkerExportRequest } | { type: 'cancel' }
  | { type: 'ack'; token: number; ok: boolean };
export type WorkerReply = { type: 'progress'; progress: ExportProgress }
  | { type: 'checkpoint'; token: number; stage: BackupOperationCheckpoint['stage']; outputState: BackupOperationCheckpoint['outputState']; revalidate: boolean }
  | { type: 'complete'; receipt: ExportReceipt }
  | { type: 'failed'; code: string };
