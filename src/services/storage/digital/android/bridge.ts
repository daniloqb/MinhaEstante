import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ConfigurationRequest, SelectedDigitalFile, SourceSelectionRequest, StorageConfiguration, StorageResult } from '../contracts';
import type { PluginListenerHandle } from '@capacitor/core';
import type { DigitalImportProgress, FileIntegrity, StoredDigitalFile, StoredFileMetadata } from '../contracts';
import type { AttachmentLinkIntent, StorageOperationSnapshot } from '../operations';

export const SAF_STATES = ['not-configured', 'accessible', 'read-only', 'permission-revoked', 'permission-required',
  'permission-denied', 'missing', 'provider-unavailable', 'unavailable'] as const;
export interface AndroidSafStatus {
  readonly configuration: StorageConfiguration;
  readonly state: typeof SAF_STATES[number];
  readonly read: boolean;
  readonly write: boolean;
  readonly persistedRead: boolean;
  readonly persistedWrite: boolean;
  readonly canCreate: boolean;
  readonly needsReconfiguration: boolean;
}
export interface SafDiagnosticResult {
  readonly writeVerified: boolean;
  readonly readVerified: boolean;
  readonly cleanupSucceeded: boolean;
  readonly errorCode?: string;
  readonly cleanupError?: 'DIAGNOSTIC_CLEANUP_FAILED';
}
export interface AndroidSafBridge {
  getDevelopmentEnvironment(): Promise<StorageResult<{ enabled: boolean }>>;
  getConfiguration(): Promise<StorageResult<AndroidSafStatus>>;
  selectDirectory(request: ConfigurationRequest & { diagnosticOperationId?: string }): Promise<StorageResult<AndroidSafStatus>>;
  selectDocument(request: SourceSelectionRequest): Promise<StorageResult<SelectedDigitalFile>>;
  getSelectedMetadata(request: { sourceReference: string }): Promise<StorageResult<SelectedDigitalFile>>;
  checkSourceAccess(request: { sourceReference: string }): Promise<StorageResult<{ accessible: true }>>;
  runDiagnostics(request: ConfigurationRequest): Promise<StorageResult<SafDiagnosticResult>>;
}

export interface AndroidManagedStorageBridge {
  importFile(request: { operationId: string; sourceReference: string; type: string; format: string }): Promise<StorageResult<StoredDigitalFile>>;
  getManagedMetadata(request: { storageReference: string }): Promise<StorageResult<StoredFileMetadata>>;
  checkManagedAccess(request: { storageReference: string }): Promise<StorageResult<{ accessible: true }>>;
  verifyManagedFile(request: { storageReference: string; verificationId: string }): Promise<StorageResult<FileIntegrity>>;
  deleteManagedFile(request: { storageReference: string; intent: 'delete-managed-file' }): Promise<StorageResult<{ done: true }>>;
  cancelOperation(request: { operationId: string }): Promise<StorageResult<{ done: true }>>;
  listOperations(): Promise<StorageResult<{ operations: readonly StorageOperationSnapshot[] }>>;
  getOperation(request: { operationId: string }): Promise<StorageResult<StorageOperationSnapshot>>;
  recoverImport(request: { operationId: string }): Promise<StorageResult<StoredDigitalFile>>;
  beginAttachmentLink(request: { operationId: string; linkContext: AttachmentLinkIntent }): Promise<StorageResult<StorageOperationSnapshot>>;
  completeImportOperation(request: { operationId: string }): Promise<StorageResult<{ done: true }>>;
  discardIncompleteImport(request: { operationId: string }): Promise<StorageResult<{ done: true }>>;
  addListener(event: 'importProgress', callback: (value: DigitalImportProgress) => void): Promise<PluginListenerHandle>;
  setDiagnosticFault(request: { interaction: 'user-initiated'; operationId: string; mode: string; afterBytes?: number }): Promise<StorageResult<{ done: true }>>;
  revokeDiagnosticDirectoryGrant?(request: { interaction: 'user-initiated'; intent: 'revoke-dev-directory-grant' }): Promise<StorageResult<AndroidSafStatus>>;
  getDiagnosticRetention?(): Promise<StorageResult<{ journalRecords: number; knownDocuments: number; readableBytes: number; inaccessibleOrUnknownSize: number; protectedReceipts: number; physicalDeletionAuthorized: false }>>;
  getDiagnosticMemory(): Promise<StorageResult<{ totalPssKiB: number; javaHeapUsedBytes: number }>>;
  createDiagnosticSources(request: { interaction: 'user-initiated'; intent: 'create-synthetic-fixtures-in-dev-library'; includeLarge: boolean; variant?: 'base' | 'different' }): Promise<StorageResult<{ sources: readonly DiagnosticSource[] }>>;
}
export interface DiagnosticSource {
  readonly selected: SelectedDigitalFile;
  readonly expectedIntegrity: FileIntegrity;
  readonly fixture: 'valid' | 'invalid' | 'wrong-extension' | 'large';
}
export const AndroidSafPlugin = registerPlugin<AndroidSafBridge & AndroidManagedStorageBridge>('DigitalLibraryStorage');
export function isAndroidSafAvailable(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()
    && Capacitor.isPluginAvailable('DigitalLibraryStorage');
}
