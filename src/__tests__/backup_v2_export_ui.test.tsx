import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LocaleId } from '../i18n/types';
import { DarkWalnutPalette } from '../theme/woodTheme';
import { backupExportMessages } from '../services/storage/backupV2/i18n/messages';
let locale: LocaleId = 'pt-BR';
vi.mock('../i18n/I18nContext', () => ({ useI18n: () => ({ locale }) }));
import BackupExportSection from '../components/BackupExportSection';

describe('4.2B accessible DEV export view', () => {
  it.each(Object.keys(backupExportMessages) as LocaleId[])('starts unchecked and exposes a readable warning in %s', language => {
    locale = language;
    const html = renderToStaticMarkup(<BackupExportSection palette={DarkWalnutPalette} legacyExport={async () => {}} />);
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).not.toContain('checked=""');
    expect(html).toContain(backupExportMessages[language].ebooks);
    expect(html).toContain(backupExportMessages[language].audio);
    expect(html).toContain(backupExportMessages[language].warning.replaceAll('’', '&#x27;'));
    expect(html).toContain('aria-live="polite"'); expect(html).toContain('aria-busy="false"');
    expect(html).toContain(backupExportMessages[language].standard);
  });
});
