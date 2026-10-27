import type { AttachmentType } from '../../../types/digitalMedia';
import type { StorageResult, StoredDigitalFile } from './contracts';
import { normalizeStoredFile, requireStorage } from './validation';
import { normalizeStorageError } from './errors';

export const STORAGE_OPERATION_STATES = ['PREPARING', 'CREATING', 'COPYING', 'VERIFYING', 'FILE_READY', 'LINKING',
  'COMPLETED', 'RECOVERY_REQUIRED', 'DELETING', 'DELETED', 'DISCARDED'] as const;
/** Technical routing receipt only; native code never applies bibliographic rules. */
export interface AttachmentLinkIntent {
  readonly version: 1;
  readonly bookId: number;
  readonly bookUuid: string;
  readonly type: AttachmentType;
  readonly intent: 'attach' | 'replace';
  readonly attachmentId: string;
  readonly expectedAttachmentId?: string;
  readonly expectedStorageReference?: string;
  readonly expectedProvider?: string;
  readonly expectedUpdatedAt?: number;
  readonly positionPolicy?: 'preserve-identical' | 'invalidate-current';
}
export interface StorageOperationSnapshot {
  readonly operationId: string;
  readonly state: typeof STORAGE_OPERATION_STATES[number];
  readonly format: string;
  readonly type: AttachmentType;
  readonly bytesProcessed: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly errorCode?: string;
  readonly stored?: StoredDigitalFile;
  readonly linkContext?: AttachmentLinkIntent;
}
export interface IDigitalStorageJournal {
  listOperations(): Promise<StorageResult<readonly StorageOperationSnapshot[]>>;
  getOperation(operationId: string): Promise<StorageResult<StorageOperationSnapshot>>;
  beginAttachmentLink(operationId: string, context: AttachmentLinkIntent): Promise<StorageResult<StorageOperationSnapshot>>;
  completeImportOperation(operationId: string): Promise<StorageResult<void>>;
  recoverImport(operationId: string): Promise<StorageResult<StoredDigitalFile>>;
}
function nonempty(value: unknown): string {
  requireStorage(typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\0\r\n]/.test(value), 'RECOVERY_REQUIRED');
  return value;
}
export function normalizeLinkIntent(value: unknown): AttachmentLinkIntent {
  requireStorage(value && typeof value === 'object', 'RECOVERY_REQUIRED');
  const v = value as Record<string, unknown>;
  requireStorage(v.version === 1 && Number.isSafeInteger(v.bookId) && (v.bookId as number) > 0, 'RECOVERY_REQUIRED');
  requireStorage(v.type === 'ebook' || v.type === 'audiobook', 'RECOVERY_REQUIRED');
  requireStorage(v.intent === 'attach' || v.intent === 'replace', 'RECOVERY_REQUIRED');
  const common: AttachmentLinkIntent = { version: 1, bookId: v.bookId as number, bookUuid: nonempty(v.bookUuid),
    type: v.type, intent: v.intent, attachmentId: nonempty(v.attachmentId) };
  if (v.intent === 'attach') return common;
  requireStorage(v.positionPolicy === undefined || v.positionPolicy === 'preserve-identical' || v.positionPolicy === 'invalidate-current', 'RECOVERY_REQUIRED');
  requireStorage(Number.isSafeInteger(v.expectedUpdatedAt), 'RECOVERY_REQUIRED');
  return { ...common, expectedAttachmentId: nonempty(v.expectedAttachmentId), expectedStorageReference: nonempty(v.expectedStorageReference),
    expectedProvider: nonempty(v.expectedProvider), expectedUpdatedAt: v.expectedUpdatedAt as number,
    ...(v.positionPolicy ? { positionPolicy: v.positionPolicy as AttachmentLinkIntent['positionPolicy'] } : {}) };
}
export function normalizeOperation(value: unknown): StorageOperationSnapshot {
  requireStorage(value && typeof value === 'object', 'RECOVERY_REQUIRED');
  const v = value as StorageOperationSnapshot;
  requireStorage(STORAGE_OPERATION_STATES.includes(v.state), 'RECOVERY_REQUIRED');
  requireStorage(v.type === 'ebook' || v.type === 'audiobook', 'RECOVERY_REQUIRED');
  for (const n of [v.bytesProcessed, v.createdAt, v.updatedAt]) requireStorage(Number.isSafeInteger(n) && n >= 0, 'RECOVERY_REQUIRED');
  const stored = v.stored === undefined ? undefined : normalizeStoredFile(v.stored);
  requireStorage(!stored || stored.operationId === v.operationId, 'RECOVERY_REQUIRED');
  return { operationId: nonempty(v.operationId), state: v.state, type: v.type, format: nonempty(v.format),
    bytesProcessed: v.bytesProcessed, createdAt: v.createdAt, updatedAt: v.updatedAt,
    stored, linkContext: v.linkContext === undefined ? undefined : normalizeLinkIntent(v.linkContext),
    errorCode: v.errorCode ? normalizeStorageError({ code: v.errorCode }).code : undefined };
}
