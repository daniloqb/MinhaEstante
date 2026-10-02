import React from 'react';
import { BookOpen, Search, BarChart3, Settings } from 'lucide-react';
import { WoodPalette } from '../theme/woodTheme';

export type MainTab = 'ESTANTE' | 'BUSCAR' | 'ESTATISTICAS' | 'CONFIG';

interface NavigationBottomBarProps {
  palette: WoodPalette;
  currentTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export const NavigationBottomBar: React.FC<NavigationBottomBarProps> = ({
  palette,
  currentTab,
  onTabChange,
}) => {
  const tabs: { id: MainTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'ESTANTE', label: 'Estante', icon: BookOpen },
    { id: 'BUSCAR', label: 'Buscar', icon: Search },
    { id: 'ESTATISTICAS', label: 'Estatísticas', icon: BarChart3 },
    { id: 'CONFIG', label: 'Backup', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex flex-col shadow-2xl">
      {/* Filete de madeira sobre a barra de navegação */}
      <div className="w-full h-[2px]" style={{ backgroundColor: palette.woodBorder }} />

      <div
        className="w-full h-16 flex items-center justify-around px-2"
        style={{ backgroundColor: palette.woodDark }}
      >
        {tabs.map((tab) => {
          const isSelected = currentTab === tab.id;
          const IconComponent = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex-1 py-1.5 flex flex-col items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 group"
            >
              <div
                className={`px-4 py-1 rounded-full transition-colors duration-200 flex items-center justify-center ${
                  isSelected ? 'shadow-inner' : ''
                }`}
                style={{
                  backgroundColor: isSelected ? palette.goldPrimary : 'transparent',
                  color: isSelected ? palette.textOnGold : palette.textSecondaryOnWood,
                }}
              >
                <IconComponent size={20} />
              </div>
              <span
                className="font-serif font-semibold text-xs mt-0.5 tracking-wider transition-colors duration-200"
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
