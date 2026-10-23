import React from 'react';
import { WoodPalette } from '../../theme/woodTheme';
import { MaShelfLogo } from '../MaShelfLogo';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface HomeHeaderProps {
  palette: WoodPalette;
  onNavigateToSearch: () => void;
  onOpenPreferences?: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  palette,
  onNavigateToSearch,
  onOpenPreferences,
}) => {
  const { t } = useI18n();

  return (
    <header className="w-full flex flex-col gap-3.5 pb-2">
      {/* Barra Superior com Logotipo e Ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MaShelfLogo size={32} />
          <div className="flex flex-col">
            <h1
              className="font-serif font-black text-xl sm:text-2xl tracking-tight leading-none"
              style={{ color: palette.goldPrimary }}
            >
              {t.common.appName}
            </h1>
            <span
              className="text-[11px] font-sans font-medium tracking-wide opacity-80"
              style={{ color: palette.textSecondaryOnWood }}
            >
              Descoberta & Acervo Pessoal
            </span>
          </div>
        </div>

        {onOpenPreferences && (
          <button
            type="button"
            onClick={onOpenPreferences}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-sans font-semibold cursor-pointer shadow-sm hover:brightness-110 active:scale-95 transition-all select-none"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
            title="Personalizar preferências de leitura"
            aria-label="Personalizar preferências de leitura"
          >
            <SlidersHorizontal size={14} style={{ color: palette.woodBorder }} />
            <span className="hidden sm:inline">Gêneros & Recomendações</span>
          </button>
        )}
      </div>

      {/* Saudação calorosa e convite à leitura */}
      <div className="flex flex-col">
        <h2
          className="font-serif font-bold text-base sm:text-lg leading-snug"
          style={{ color: palette.textOnWood }}
        >
          O que vamos ler hoje?
        </h2>
        <p
          className="text-xs sm:text-sm font-sans"
          style={{ color: palette.textSecondaryOnWood }}
        >
          Explore sua coleção pessoal, confira lançamentos e descubra novos livros.
        </p>
      </div>

      {/* Barra de Busca Visual que abre Explorar */}
      <button
        type="button"
        onClick={onNavigateToSearch}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-sans shadow-sm cursor-pointer hover:border-amber-500/60 active:scale-[0.99] transition-all text-left"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textSecondaryOnPaper,
        }}
        title="Buscar livros por título, autor ou ISBN"
      >
        <div className="flex items-center gap-2.5">
          <Search size={16} style={{ color: palette.woodBorder }} />
          <span>Pesquisar no catálogo mundial por título, autor ou ISBN...</span>
        </div>
        <span
          className="text-[11px] font-sans font-semibold px-2 py-0.5 rounded shadow-2xs hidden xs:inline"
          style={{
            backgroundColor: palette.goldPrimary,
            color: palette.textOnGold,
          }}
        >
          Explorar
        </span>
      </button>
    </header>
  );
};
