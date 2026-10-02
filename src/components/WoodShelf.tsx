import React from 'react';
import { WoodPalette } from '../theme/woodTheme';

interface WoodShelfProps {
  palette: WoodPalette;
  label?: string | null;
  sublabel?: string | null;
  className?: string;
}

export const WoodShelf: React.FC<WoodShelfProps> = ({ palette, label, sublabel, className = '' }) => {
  return (
    <div className={`w-full flex flex-col ${className}`}>
      {/* Rótulo da Prateleira */}
      {label && (
        <div className="w-full flex items-center justify-between px-4 py-1.5 select-none">
          <span
            className="font-serif font-bold text-lg tracking-wide drop-shadow-sm"
            style={{ color: palette.goldPrimary }}
          >
            {label}
          </span>
          {sublabel && (
            <span
              className="font-serif text-sm italic"
              style={{ color: palette.textSecondaryOnWood }}
            >
              {sublabel}
            </span>
          )}
        </div>
      )}

      {/* Barra de Madeira 3D Chanfrada */}
      <div
        className="w-full h-4 relative shadow-sm"
        style={{
          background: `linear-gradient(to bottom, ${palette.woodShelfHighlight} 0%, ${palette.woodShelf} 40%, ${palette.woodDark} 100%)`,
        }}
      >
        {/* Filete dourado fino no topo chanfrado da prateleira */}
        <div
          className="w-full h-[2px]"
          style={{
            backgroundColor: `${palette.goldPrimary}70`,
          }}
        />
      </div>

      {/* Sombra projetada abaixo da prateleira */}
      <div
        className="w-full h-3"
        style={{
          background: `linear-gradient(to bottom, ${palette.woodShelfShadow}b3 0%, transparent 100%)`,
        }}
      />
    </div>
  );
};
