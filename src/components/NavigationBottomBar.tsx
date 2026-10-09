import React from 'react';
import { BookOpen, Handshake, Search, BarChart3, Settings } from 'lucide-react';
import { WoodPalette } from '../theme/woodTheme';
import { useI18n } from '../i18n/I18nContext';

export type MainTab = 'ESTANTE' | 'EMPRESTADOS' | 'BUSCAR' | 'ESTATISTICAS' | 'CONFIG';

interface NavigationBottomBarProps {
  palette: WoodPalette;
  currentTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  totalCount?: number;
  borrowedCount?: number;
}

export const NavigationBottomBar: React.FC<NavigationBottomBarProps> = ({
  palette,
  currentTab,
  onTabChange,
  totalCount,
  borrowedCount,
}) => {
  const { t } = useI18n();

  const tabs: {
    id: MainTab;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    count?: number;
  }[] = [
    { id: 'ESTANTE', label: t.nav.bookshelf, icon: BookOpen, count: totalCount },
    { id: 'EMPRESTADOS', label: t.nav.loans, icon: Handshake, count: borrowedCount },
    { id: 'BUSCAR', label: t.nav.search, icon: Search },
    { id: 'ESTATISTICAS', label: t.nav.stats, icon: BarChart3 },
    { id: 'CONFIG', label: t.nav.settings, icon: Settings },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex flex-col shadow-2xl transition-all"
      style={{
        backgroundColor: palette.woodDark,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Filete de madeira sobre a barra de navegação */}
      <div className="w-full h-[2px]" style={{ backgroundColor: palette.woodBorder }} />

      <div
        className="w-full h-16 flex items-center justify-around px-1 sm:px-2"
        style={{ backgroundColor: palette.woodDark }}
      >
        {tabs.map((tab) => {
          const isSelected = currentTab === tab.id;
          const IconComponent = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex-1 py-1 flex flex-col items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 group relative"
            >
              <div
                className={`relative px-3.5 py-1 rounded-full transition-colors duration-200 flex items-center justify-center ${
                  isSelected ? 'shadow-inner' : ''
                }`}
                style={{
                  backgroundColor: isSelected ? palette.goldPrimary : 'transparent',
                  color: isSelected ? palette.textOnGold : palette.textSecondaryOnWood,
                }}
              >
                <IconComponent size={20} />
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-sans font-bold flex items-center justify-center shadow-md ${
                      isSelected ? 'bg-stone-900 text-amber-300' : 'bg-amber-600 text-white'
                    }`}
                  >
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
              </div>
              <span
                className="font-serif font-semibold text-xs mt-0.5 tracking-wide transition-colors duration-200"
                style={{
                  color: isSelected ? palette.goldPrimary : palette.textSecondaryOnWood,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
