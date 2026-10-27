import type { AttachmentFormat, AttachmentType } from '../../../types/digitalMedia';

declare const opaqueReference: unique symbol;
/** Strings serializáveis. Apenas o provedor correspondente interpreta seu conteúdo. */
export type OpaqueReference<Kind extends string> = string & { readonly [opaqueReference]: Kind };

export const DIGITAL_STORAGE_PROVIDER_IDS = { android: 'saf_document', web: 'web_digital' } as const;
export type DigitalStoragePlatform = keyof typeof DIGITAL_STORAGE_PROVIDER_IDS;

export interface SourceFileReference {
  readonly kind: 'source';
  readonly storageProvider: string;
  readonly sourceReference: OpaqueReference<'source'>;
}
export interface ManagedFileReference {
  readonly kind: 'managed';
  readonly storageProvider: string;
  readonly storageReference: OpaqueReference<'managed'>;
}
export interface LibraryLocationReference {
  readonly kind: 'library-location';
  readonly storageProvider: string;
  readonly locationReference: OpaqueReference<'library-location'>;
}
export type DigitalFileReference = SourceFileReference | ManagedFileReference;

export const STORAGE_FEATURES = [
  'configure', 'selectDirectory', 'selectFile', 'persistAccess', 'importFile',
  'streamRead', 'streamWrite', 'nativeCopy', 'sha256', 'readAccess',
  'deleteManagedFiles', 'cancelOperations', 'importProgress',
] as const;
export type StorageFeature = typeof STORAGE_FEATURES[number];
export interface StorageCapabilities {
  readonly providerAvailability: 'available' | 'unavailable';
  /** Implementação do provedor, distinta da disponibilidade no ambiente atual. */
  readonly implemented: Readonly<Record<StorageFeature, boolean>>;
  readonly available: Readonly<Record<StorageFeature, boolean>>;
}
export type StoragePermission = 'granted' | 'denied' | 'revoked' | 'unknown';
export type StorageConfiguration =
  | { readonly state: 'not-configured' }
  | { readonly state: 'configured'; readonly location: LibraryLocationReference; readonly permission: StoragePermission };

/** Não contém File/Blob/bytes. Handles Web ficam no registro privado do provedor. */
export interface SelectedDigitalFile {
  readonly state: 'selected';
  readonly source: SourceFileReference;
  readonly filename: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  /** Potencial de duração da concessão; não substitui checkAccess. */
  readonly access: 'session' | 'persistable' | 'persistent';
}
export interface DigitalFileMetadata {
  readonly filename: string;
  readonly mimeType?: string;
  readonly sizeBytes: number;
  readonly format: AttachmentFormat;
}
export interface Sha256Checksum {
  readonly algorithm: 'sha256';
  readonly value: string;
}
export interface FileIntegrity {
  readonly sizeBytes: number;
  readonly checksum: Sha256Checksum;
}
/** Só é emitido após cópia, validação e confirmação recuperável pelo provedor. */
export interface StoredDigitalFile {
  readonly state: 'stored';
  readonly operationId: string;
  readonly file: ManagedFileReference;
  readonly metadata: DigitalFileMetadata;
  readonly integrity: FileIntegrity;
}
export interface StoredFileMetadata {
  readonly file: ManagedFileReference;
  readonly metadata: DigitalFileMetadata;
}

export type DigitalImportStage = 'validating' | 'preparing' | 'copying' | 'verifying' | 'committing';
export interface DigitalImportProgress {
  readonly operationId: string;
  readonly stage: DigitalImportStage;
  readonly bytesProcessed: number;
  readonly totalBytes?: number;
}
export interface StorageOperationContext {
  readonly signal?: AbortSignal;
}
export interface ImportOperationContext extends StorageOperationContext {
  readonly onProgress?: (progress: DigitalImportProgress) => void;
}
export interface ImportDigitalFileRequest {
  /** ID idempotente, registrado antes da cópia para permitir recuperação após reinício. */
  readonly operationId: string;
  readonly selected: SelectedDigitalFile;
  readonly type: AttachmentType;
  readonly format: AttachmentFormat;
}
export interface SourceSelectionRequest {
  readonly interaction: 'user-initiated';
  readonly acceptedFormats: readonly AttachmentFormat[];
}
export interface ConfigurationRequest {
  readonly interaction: 'user-initiated';
}
/** Token efêmero para consumidor nativo ou stream; nunca persisti-lo em BookAttachment. */
export interface DigitalReadAccess {
  readonly file: ManagedFileReference;
  readonly token: OpaqueReference<'read-access'>;
  readonly consumption: 'provider-stream' | 'native-consumer';
}
export interface DeleteManagedFileRequest {
  readonly file: ManagedFileReference;
  readonly intent: 'delete-managed-file';
}

export const DIGITAL_STORAGE_ERROR_CODES = [
  'NOT_CONFIGURED', 'USER_CANCELLED', 'PERMISSION_REQUIRED', 'PERMISSION_DENIED', 'PERMISSION_REVOKED',
  'FILE_NOT_FOUND', 'FILE_UNAVAILABLE', 'UNSUPPORTED_FORMAT', 'INVALID_FILE',
  'INSUFFICIENT_SPACE', 'INTEGRITY_MISMATCH', 'OPERATION_CANCELLED',
  'PROVIDER_UNAVAILABLE', 'OPERATION_FAILED', 'UNSUPPORTED_OPERATION',
  'INVALID_REFERENCE', 'PROVIDER_MISMATCH', 'ATTACHMENT_CONFLICT', 'OPERATION_CONFLICT',
  'RECOVERY_REQUIRED', 'LINK_PERSISTENCE_FAILED', 'POSITION_POLICY_REQUIRED',
] as const;
export type DigitalStorageErrorCode = typeof DIGITAL_STORAGE_ERROR_CODES[number];
export interface DigitalStorageError {
  readonly code: DigitalStorageErrorCode;
  readonly messageKey: `digitalStorage.errors.${DigitalStorageErrorCode}`;
}
export type StorageResult<T> =
  | { readonly status: 'success'; readonly value: T }
  | { readonly status: 'cancelled'; readonly code: 'USER_CANCELLED' | 'OPERATION_CANCELLED' }
  | { readonly status: 'error'; readonly error: DigitalStorageError };

/** Métodos interativos devem abrir o seletor antes do primeiro await. */
export interface IDigitalStorageInteraction {
  requestConfiguration(request: ConfigurationRequest): Promise<StorageResult<StorageConfiguration>>;
  selectSource(request: SourceSelectionRequest): Promise<StorageResult<SelectedDigitalFile>>;
}
export type ImportRecoveryState =
  | { readonly operationId: string; readonly stage: 'preparing' | 'copying' | 'verifying'; readonly temporaryReference: OpaqueReference<'incomplete-import'> }
  | { readonly operationId: string; readonly stage: 'stored-unlinked'; readonly file: ManagedFileReference };
/** Extensão para a recuperação futura; apenas operações/arquivos do registro gerenciado. */
export interface IDigitalStorageRecovery {
  listPendingImports(): Promise<StorageResult<readonly ImportRecoveryState[]>>;
  /** Só descarta um provisório; uma operação já confirmada exige fluxo distinto. */
  discardIncompleteImport(operationId: string): Promise<StorageResult<void>>;
  /** Confirma resolução do journal após associação/compensação; não exclui binários. */
  completeImportOperation(operationId: string): Promise<StorageResult<void>>;
}

export interface IDigitalStorageProvider {
  readonly id: string;
  /** Snapshot síncrono: não consumir a ativação do usuário antes de abrir seletores. */
  getCapabilities(): StorageCapabilities;
  getConfiguration(): Promise<StorageResult<StorageConfiguration>>;
  readonly interaction?: IDigitalStorageInteraction;
  readonly recovery?: IDigitalStorageRecovery;
  /** Cópia e SHA-256 incrementais dentro do provedor; sem readAll/Base64 pela bridge. */
  importFile(request: ImportDigitalFileRequest, context?: ImportOperationContext): Promise<StorageResult<StoredDigitalFile>>;
  getMetadata(file: ManagedFileReference): Promise<StorageResult<StoredFileMetadata>>;
  /** Sem seletor ou solicitação implícita de permissão. Inacessibilidade retorna erro tipado. */
  checkAccess(file: DigitalFileReference): Promise<StorageResult<{ readonly accessible: true }>>;
  verifyIntegrity(file: ManagedFileReference, expected: FileIntegrity, context?: StorageOperationContext): Promise<StorageResult<FileIntegrity>>;
  acquireReadAccess(file: ManagedFileReference): Promise<StorageResult<DigitalReadAccess>>;
  releaseReadAccess(access: DigitalReadAccess): Promise<StorageResult<void>>;
  /** Deve comprovar pertencimento à biblioteca no próprio registro; kind/URI não bastam. */
  deleteManagedFile(request: DeleteManagedFileRequest): Promise<StorageResult<void>>;
}

/** API independente de React/Capacitor/OPFS para os consumidores futuros. */
export interface IDigitalFileStorageService {
  getCapabilities(providerId?: string): StorageResult<StorageCapabilities>;
  getConfiguration(providerId?: string): Promise<StorageResult<StorageConfiguration>>;
  requestConfiguration(request: ConfigurationRequest, providerId?: string): Promise<StorageResult<StorageConfiguration>>;
  selectSource(request: SourceSelectionRequest, providerId?: string): Promise<StorageResult<SelectedDigitalFile>>;
  importFile(request: ImportDigitalFileRequest, context?: ImportOperationContext): Promise<StorageResult<StoredDigitalFile>>;
  getMetadata(file: ManagedFileReference): Promise<StorageResult<StoredFileMetadata>>;
  checkAccess(file: DigitalFileReference): Promise<StorageResult<{ readonly accessible: true }>>;
  verifyIntegrity(file: ManagedFileReference, expected: FileIntegrity, context?: StorageOperationContext): Promise<StorageResult<FileIntegrity>>;
  acquireReadAccess(file: ManagedFileReference): Promise<StorageResult<DigitalReadAccess>>;
  releaseReadAccess(access: DigitalReadAccess): Promise<StorageResult<void>>;
  deleteManagedFile(request: DeleteManagedFileRequest): Promise<StorageResult<void>>;
}
