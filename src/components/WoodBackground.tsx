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
      }}
    >
      {/* 
        Textura de Madeira Realista Nobre:
        1. Juntas e ranhuras chanfradas entre as réguas verticais de madeira maciça
        2. Fibras e estrias orgânicas simulando os veios naturais da madeira
        3. Ondulações suaves de porosidade da madeira
        4. Iluminação cenográfica tridimensional que valoriza o tom escolhido (Escuro ou Carvalho)
      */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `
            /* Chanfro e juntas escuras entre as tábuas de madeira verticais (largura de 96px) */
            repeating-linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.28) 0px,
              rgba(0, 0, 0, 0.18) 1.5px,
              rgba(255, 255, 255, 0.08) 2px,
              rgba(255, 255, 255, 0.03) 3px,
              transparent 4px,
              transparent 94px,
              rgba(0, 0, 0, 0.12) 95px,
              rgba(0, 0, 0, 0.28) 96px
            ),
            /* Estrias finas de veios de madeira (fibras longitudinais naturais) */
            repeating-linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.08) 0px,
              rgba(0, 0, 0, 0.08) 1px,
              transparent 1px,
              transparent 7px,
              rgba(255, 255, 255, 0.06) 7px,
              rgba(255, 255, 255, 0.06) 8px,
              transparent 8px,
              transparent 16px,
              rgba(0, 0, 0, 0.05) 16px,
              rgba(0, 0, 0, 0.05) 18px,
              transparent 18px,
              transparent 29px
            ),
            /* Variações orgânicas de tonalidade ao longo das tábuas */
            repeating-linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.06) 0px,
              transparent 12px,
              rgba(255, 255, 255, 0.05) 24px,
              transparent 40px,
              rgba(0, 0, 0, 0.07) 58px,
              transparent 76px,
              rgba(255, 255, 255, 0.04) 96px
            ),
            /* Textura sutil de nós e ondulações orgânicas */
            radial-gradient(ellipse at 30% 20%, rgba(0, 0, 0, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 75% 65%, rgba(0, 0, 0, 0.07) 0%, transparent 55%),
            radial-gradient(ellipse at 20% 85%, rgba(255, 255, 255, 0.04) 0%, transparent 50%),
            /* Gradiente de iluminação ambiente: foco de luz suave no topo e sombras nas bordas */
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.12) 0%,
              rgba(255, 255, 255, 0.03) 25%,
              rgba(0, 0, 0, 0.05) 70%,
              rgba(0, 0, 0, 0.25) 100%
            )
          `,
        }}
      />

      {/* Brilho dourado aconchegante central que realça a beleza da madeira */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-25"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 20%, ${palette.goldPrimary}40 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 flex flex-col flex-1 pb-24">{children}</div>
    </div>
  );
};
