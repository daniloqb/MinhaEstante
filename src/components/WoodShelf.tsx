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
      {/* Rótulo da Prateleira com tipografia ligeiramente maior como solicitado */}
      {label && (
        <div className="w-full flex items-center justify-between px-5 py-2 select-none">
          <span
            className="font-serif font-bold text-2xl sm:text-3xl tracking-wide drop-shadow-md"
            style={{ color: palette.goldPrimary }}
          >
            {label}
          </span>
          {sublabel && (
            <span
              className="font-serif text-base sm:text-lg italic"
              style={{ color: palette.textSecondaryOnWood }}
            >
              {sublabel}
            </span>
          )}
        </div>
      )}

      {/* Prateleira 3D Realista idêntica à imagem de referência */}
      <div className="w-full flex flex-col relative">
        {/* Superfície superior da tábua onde os livros repousam */}
        <div
          className="w-full h-2.5 shadow-sm"
          style={{
            background: `linear-gradient(to bottom, ${palette.woodShelfHighlight}ee 0%, ${palette.woodShelf} 100%)`,
            borderTop: `1px solid rgba(255, 255, 255, 0.25)`,
          }}
        />

        {/* Borda frontal da tábua de madeira maciça com chanfro e filete dourado */}
        <div
          className="w-full h-4 sm:h-5 relative shadow-md flex items-center"
          style={{
            background: `linear-gradient(to bottom, ${palette.woodShelf} 0%, ${palette.woodDark} 100%)`,
            borderBottom: `1px solid rgba(0, 0, 0, 0.35)`,
          }}
        >
          {/* Filete refinado dourado no topo da borda */}
          <div
            className="w-full h-[1.5px] absolute top-0 inset-x-0"
            style={{
              backgroundColor: `${palette.goldPrimary}80`,
            }}
          />
        </div>

        {/* Sombra projetada realista e profunda sob a prateleira (idêntica à imagem) */}
        <div
          className="w-full h-5 sm:h-6 pointer-events-none"
          style={{
            background: `linear-gradient(to bottom, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.2) 40%, rgba(0, 0, 0, 0.05) 75%, transparent 100%)`,
          }}
        />
      </div>
    </div>
  );
};
