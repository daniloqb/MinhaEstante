import React from 'react';
import { WoodPalette } from '../theme/woodTheme';

interface WoodTopAppBarProps {
  palette: WoodPalette;
  title: string;
  navigationIcon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const WoodTopAppBar: React.FC<WoodTopAppBarProps> = ({
  palette,
  title,
  navigationIcon,
  actions,
}) => {
  return (
    <header
      className="w-full sticky top-0 z-30 flex flex-col shadow-md"
      style={{
        backgroundColor: palette.woodDark,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div
        className="w-full px-4 h-14 flex items-center justify-between"
        style={{ backgroundColor: palette.woodDark }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {navigationIcon}
          <h1
            className="font-serif font-bold text-xl sm:text-2xl tracking-wide select-none drop-shadow-sm truncate"
            style={{ color: palette.goldPrimary }}
          >
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
      </div>

      {/* Filete inferior de 3px em madeira nobre e latão dourado */}
      <div
        className="w-full h-[3px]"
        style={{
          background: `linear-gradient(to right, ${palette.woodBorder} 0%, ${palette.goldPrimary}cc 50%, ${palette.woodBorder} 100%)`,
        }}
      />
    </header>
  );
};
