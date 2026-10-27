import type { LocaleId } from '../../../../i18n/types';
import { TRANSLATIONS } from '../../../../i18n/translations';
import type { DigitalStorageErrorCode } from '../contracts';
/** Consumer-facing messages; raw journal states and exception payloads stay in diagnostics. */
export function webStorageMessage(code: DigitalStorageErrorCode | 'persistence-denied' | 'recovering', locale: LocaleId = 'pt-BR'): string {
  const text = TRANSLATIONS[locale].digitalStorage;
  switch (code) {
    case 'FILE_NOT_FOUND': case 'FILE_UNAVAILABLE': case 'PERMISSION_DENIED': case 'PERMISSION_REVOKED': return text.fileUnavailable;
    case 'PROVIDER_UNAVAILABLE': return text.unavailable;
    case 'INSUFFICIENT_SPACE': return text.quota;
    case 'INTEGRITY_MISMATCH': return text.integrity;
    case 'RECOVERY_REQUIRED': return text.review;
    case 'persistence-denied': return text.persistenceDenied;
    case 'recovering': return text.recovering;
    default: return text.failed;
  }
}
