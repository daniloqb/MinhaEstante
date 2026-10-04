import React from 'react';
import { BookOpen, Tablet, Search, BarChart3, Settings } from 'lucide-react';
import { WoodPalette } from '../theme/woodTheme';

export type MainTab = 'ESTANTE' | 'EBOOKS' | 'BUSCAR' | 'ESTATISTICAS' | 'CONFIG';

interface NavigationBottomBarProps {
  palette: WoodPalette;
  currentTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  ebookCount?: number;
  physicalCount?: number;
}

export const NavigationBottomBar: React.FC<NavigationBottomBarProps> = ({
  palette,
  currentTab,
  onTabChange,
  ebookCount,
  physicalCount,
}) => {
  const tabs: {
    id: MainTab;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    count?: number;
  }[] = [
    { id: 'ESTANTE', label: 'Físicos', icon: BookOpen, count: physicalCount },
    { id: 'EBOOKS', label: 'E-books', icon: Tablet, count: ebookCount },
    { id: 'BUSCAR', label: 'Buscar', icon: Search },
    { id: 'ESTATISTICAS', label: 'Estatísticas', icon: BarChart3 },
    { id: 'CONFIG', label: 'Backup', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex flex-col shadow-2xl">
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
