import type { BookAttachment, AttachmentType } from '../../../types/digitalMedia';
import { isValidAttachmentTypeAndFormat } from '../../../types/digitalMedia';
import type { IBookAttachmentRepository } from '../../database/types';
import type { ManagedFileReference, StorageResult, StoredDigitalFile } from './contracts';
import { normalizeStorageError, storageFailure, storageSuccess } from './errors';
import { managedFileReference, normalizeStoredFile, requireStorage } from './validation';

/** Reutiliza o contrato da Fase 1; não cria outra entidade persistida. */
export type BookAttachmentCreateInput = Parameters<IBookAttachmentRepository['create']>[0];
export interface AttachmentChangeRequest {
  readonly bookId: number;
  readonly expectedBookUuid?: string;
  readonly type: AttachmentType;
  readonly imported: StoredDigitalFile;
  readonly intent: 'attach' | 'replace';
  readonly expectedAttachmentId?: string;
  readonly expectedStorageReference?: string;
  readonly expectedProvider?: string;
  readonly expectedUpdatedAt?: number;
  readonly positionDecision?: 'invalidate-current';
}
export interface AttachmentChangePlan {
  readonly action: 'create' | 'replace';
  readonly operationId: string;
  readonly next: BookAttachmentCreateInput;
  readonly previousFile?: ManagedFileReference;
  readonly expectedAttachmentId?: string;
  readonly readerPositionPolicy: 'requires-integration-decision';
  readonly onMetadataFailure: 'retain-unlinked-import-for-recovery';
  readonly oldFilePolicy: 'retain-until-committed-and-unreferenced';
}
export interface DetachAttachmentRequest {
  readonly attachmentId: string;
  readonly intent: 'detach-only';
  readonly expectedBookUuid?: string;
  readonly expectedType?: AttachmentType;
  readonly expectedStorageReference?: string;
  readonly expectedProvider?: string;
  readonly expectedUpdatedAt?: number;
  /** Explicit acknowledgement: the current position is removed with the link, never sessions. */
  readonly positionDecision?: 'remove-current';
}
/** Metadata coordination; ReaderPosition is a current location, not reading history. */
export interface IDigitalAttachmentCoordinator {
  /** Reconsulta o slot, verifica concorrência e só associa importações confirmadas. */
  applyChange(request: AttachmentChangeRequest): Promise<StorageResult<BookAttachment>>;
  /** Desassociação lógica nunca chama deleteManagedFile automaticamente. */
  detach(request: DetachAttachmentRequest): Promise<StorageResult<void>>;
}

/** Plano puro sobre o slot retornado por getByBookAndType; não grava ou exclui nada. */
export function planAttachmentChange(request: AttachmentChangeRequest, current: BookAttachment | null): StorageResult<AttachmentChangePlan> {
  try {
    requireStorage(Number.isSafeInteger(request.bookId) && request.bookId > 0, 'INVALID_FILE');
    const imported = normalizeStoredFile(request.imported);
    requireStorage(isValidAttachmentTypeAndFormat(request.type, imported.metadata.format), 'UNSUPPORTED_FORMAT');
    requireStorage(request.intent === 'attach' || request.intent === 'replace', 'ATTACHMENT_CONFLICT');
    if (current) {
      requireStorage(current.bookId === request.bookId && current.type === request.type, 'ATTACHMENT_CONFLICT');
      requireStorage(request.intent === 'replace' && request.expectedAttachmentId === current.id, 'ATTACHMENT_CONFLICT');
    } else {
      requireStorage(request.intent === 'attach' && request.expectedAttachmentId === undefined, 'ATTACHMENT_CONFLICT');
    }
    return storageSuccess({
      action: current ? 'replace' : 'create', operationId: imported.operationId,
      next: {
        bookId: request.bookId, type: request.type, format: imported.metadata.format,
        filename: imported.metadata.filename, mimeType: imported.metadata.mimeType,
        sizeBytes: imported.metadata.sizeBytes, checksum: imported.integrity.checksum.value,
        storageProvider: imported.file.storageProvider, storageReference: imported.file.storageReference,
      },
      previousFile: current ? managedFileReference(current.storageProvider, current.storageReference) : undefined,
      expectedAttachmentId: current?.id,
      readerPositionPolicy: 'requires-integration-decision',
      onMetadataFailure: 'retain-unlinked-import-for-recovery',
      oldFilePolicy: 'retain-until-committed-and-unreferenced',
    });
  } catch (error) {
    return storageFailure(normalizeStorageError(error).code);
  }
}
