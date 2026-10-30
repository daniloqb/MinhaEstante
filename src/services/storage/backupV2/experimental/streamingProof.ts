/** Compatibility harness for 4.2A. The DEV exporter and proof now share one codec. */
import { writeBackupZip, BackupZipFailure } from '../zip/streamingZip';
import type { BackupZipInput, BackupZipWriteOptions } from '../zip/streamingZip';
export const PROOF_LABEL = 'Backup v2 — Streaming Proof of Concept';
export { ZIP_CHUNK_BYTES as PROOF_CHUNK_BYTES, BackupZipFailure as ProofFailure,
  boundedBlobStream, verifyBackupZip as verifyProofZip, checkBackupArchiveEnvelope as checkProofArchiveEnvelope } from '../zip/streamingZip';
export type { BackupZipErrorCode as ProofErrorCode, BackupZipSource as ProofSource, BackupZipProgress as ProofProgress,
  BackupZipInput as ProofInput, BackupZipWriteOptions as ProofWriteOptions, BackupZipWriteMetrics as ProofWriteMetrics,
  BackupZipVerification as ProofVerification } from '../zip/streamingZip';
export function writeProofZip(input: BackupZipInput, destination: WritableStream<Uint8Array>, options: BackupZipWriteOptions = {}) {
  if (!input.manifest.backupId.startsWith('proof-')) return Promise.reject(new BackupZipFailure('MANIFEST'));
  return writeBackupZip(input, destination, options);
}
