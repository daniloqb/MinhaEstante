import React from 'react';
import { WoodPalette } from '../theme/woodTheme';
import { useI18n } from '../i18n/I18nContext';
import { Library } from 'lucide-react';

interface BookOwnershipToggleProps {
  palette: WoodPalette;
  owned: boolean;
  onChange: () => void;
}

/** Controle de posse compartilhado por cadastro, edição e detalhes. */
export const BookOwnershipToggle: React.FC<BookOwnershipToggleProps> = ({ palette, owned, onChange }) => {
  const { t } = useI18n();
  return (
    <div
      className="p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors"
      style={{
        backgroundColor: owned ? `${palette.goldPrimary}15` : palette.paperSurfaceElevated,
        borderColor: owned ? palette.goldPrimary : palette.paperBorder,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{
          backgroundColor: owned ? palette.goldPrimary : `${palette.woodBorder}20`,
          color: owned ? palette.textOnGold : palette.woodBorder,
        }}>
          <Library size={20} />
        </div>
        <div>
          <span className="font-serif font-bold text-base block" style={{ color: palette.textOnPaper }}>
            {t.ownership.label}
          </span>
          <span className="text-xs font-sans" style={{ color: palette.textSecondaryOnPaper }}>
            {t.ownership.description}
          </span>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={t.ownership.label}
        aria-checked={owned}
        onClick={onChange}
        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
        style={{ backgroundColor: owned ? palette.goldPrimary : '#9ca3af' }}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${owned ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
};
