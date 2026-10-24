import React, { useMemo } from 'react';
import { WoodPalette } from '../../theme/woodTheme';
import { MaShelfLogo } from '../MaShelfLogo';
import { Search, SlidersHorizontal, RotateCw } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface HomeHeaderProps {
  palette: WoodPalette;
  onNavigateToSearch: () => void;
  onOpenPreferences?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: number;
  isCached?: boolean;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  palette,
  onNavigateToSearch,
  onOpenPreferences,
  onRefresh,
  isRefreshing,
  lastUpdated,
  isCached,
}) => {
  const { t } = useI18n();

  const formattedTime = useMemo(() => {
    if (!lastUpdated) return null;
    const diffSec = Math.floor((Date.now() - lastUpdated) / 1000);
    if (diffSec < 60) return 'Atualizado agora';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Atualizado há ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Atualizado há ${diffH}h`;
    return `Atualizado em ${new Date(lastUpdated).toLocaleDateString()}`;
  }, [lastUpdated, isRefreshing]);

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
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="text-[11px] font-sans font-medium tracking-wide opacity-80"
                style={{ color: palette.textSecondaryOnWood }}
              >
                Descoberta & Acervo Pessoal
              </span>
              {formattedTime && (
                <>
                  <span className="text-[9px] opacity-40">•</span>
                  <span
                    className="text-[10px] font-sans opacity-70"
                    style={{ color: palette.textSecondaryOnWood }}
                  >
                    {formattedTime} {isCached ? '(em cache)' : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg border text-xs font-sans font-semibold cursor-pointer shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all select-none"
              style={{
                backgroundColor: palette.paperSurface,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
              title="Atualizar feed de livros"
              aria-label="Atualizar feed de livros"
            >
              <RotateCw
                size={14}
                className={isRefreshing ? 'animate-spin' : ''}
                style={{ color: palette.goldPrimary }}
              />
            </button>
          )}

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
      </div>

      {/* Saudação calorosa e convite à leitura */}
      <div className="flex flex-col">
        <h2
          className="font-serif font-bold text-base sm:text-lg leading-snug"
          style={{ color: palette.textOnWood }}
        >
          {t.landingHome?.welcome || 'O que vamos ler hoje?'}
        </h2>
        <p
          className="text-xs sm:text-sm font-sans"
          style={{ color: palette.textSecondaryOnWood }}
        >
          {t.landingHome?.welcomeSubtitle || 'Explore sua coleção pessoal, confira lançamentos e descubra novos livros.'}
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
          <span>{t.landingHome?.searchPrompt || 'Pesquisar no catálogo mundial por título, autor ou ISBN...'}</span>
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
