import React from 'react';
import { WoodPalette } from '../theme/woodTheme';

interface WoodBackgroundProps {
  palette: WoodPalette;
  children: React.ReactNode;
  className?: string;
}

export const WoodBackground: React.FC<WoodBackgroundProps> = ({ palette, children, className = '' }) => {
  return (
    <div
      className={`min-h-screen w-full relative flex flex-col transition-colors duration-300 ${className}`}
      style={{
        backgroundColor: palette.woodMedium,
        backgroundImage: `
          linear-gradient(to bottom, ${palette.woodMedium} 0%, ${palette.woodDark}cc 50%, ${palette.woodMedium} 100%),
          repeating-linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.05) 0px,
            rgba(0, 0, 0, 0.05) 30px,
            rgba(0, 0, 0, 0.02) 30px,
            rgba(0, 0, 0, 0.02) 60px
          )
        `,
      }}
    >
      {/* Sutil textura de veios de madeira sobreposta */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 30%, ${palette.goldPrimary}15 0%, transparent 70%)`,
        }}
      />
      <div className="relative z-10 flex flex-col flex-1 pb-20">{children}</div>
    </div>
  );
};
