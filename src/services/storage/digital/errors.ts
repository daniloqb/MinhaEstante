import { DIGITAL_STORAGE_ERROR_CODES } from './contracts';
import type { DigitalStorageError, DigitalStorageErrorCode, StorageResult } from './contracts';

export class DigitalStorageException extends Error {
  constructor(readonly code: DigitalStorageErrorCode) {
    super(code);
    this.name = 'DigitalStorageException';
  }
}

/** Não propaga message, stack, cause, URI nem payload da bridge para o consumidor. */
export function normalizeStorageError(error: unknown): DigitalStorageError {
  let code: DigitalStorageErrorCode = 'OPERATION_FAILED';
  if (error && typeof error === 'object') {
    const candidate = 'code' in error ? error.code : undefined;
    if (DIGITAL_STORAGE_ERROR_CODES.includes(candidate as DigitalStorageErrorCode)) {
      code = candidate as DigitalStorageErrorCode;
    } else if ('name' in error && error.name === 'AbortError') {
      code = 'OPERATION_CANCELLED';
    }
  }
  return { code, messageKey: `digitalStorage.errors.${code}` };
}

export function storageFailure<T = never>(code: DigitalStorageErrorCode): StorageResult<T> {
  if (code === 'USER_CANCELLED' || code === 'OPERATION_CANCELLED') return { status: 'cancelled', code };
  return { status: 'error', error: { code, messageKey: `digitalStorage.errors.${code}` } };
}

export function storageSuccess<T>(value: T): StorageResult<T> {
  return { status: 'success', value };
}
