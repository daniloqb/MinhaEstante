import React, { useState } from 'react';
import { WoodPalette } from '../theme/woodTheme';

interface BookCoverViewProps {
  palette: WoodPalette;
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  width?: number | string;
  height?: number | string;
  elevation?: number;
  className?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const VINTAGE_BOOK_COVERS = [
  '#2C3E50', // Azul noite
  '#4A1521', // Borgonha profundo
  '#1E3F20', // Verde floresta clássico
  '#5D4037', // Couro marrom
  '#423144', // Ameixa escura
  '#37474F', // Ardósia
  '#6B3A1C', // Terracota clássico
];

export const BookCoverView: React.FC<BookCoverViewProps> = ({
  palette,
  title,
  author,
  coverUrl,
  width = 100,
  height = 150,
  className = '',
  badge,
  onClick,
  onContextMenu,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  // Hash code for deterministic cover color
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  const coverBgColor = VINTAGE_BOOK_COVERS[Math.abs(hash) % VINTAGE_BOOK_COVERS.length];

  const hasValidImage = coverUrl && coverUrl.trim().length > 0 && !imageFailed;
  const normalizedUrl = coverUrl?.startsWith('http://')
    ? coverUrl.replace('http://', 'https://')
    : coverUrl;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`relative overflow-hidden rounded-r-md rounded-l-xs cursor-pointer select-none transition-transform duration-200 hover:-translate-y-1 hover:brightness-105 active:scale-95 group flex-shrink-0 ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        backgroundColor: coverBgColor,
        boxShadow:
          '0 8px 16px -2px rgba(0, 0, 0, 0.45), 0 3px 6px -1px rgba(0, 0, 0, 0.3), inset -1px 0 2px rgba(0,0,0,0.4)',
      }}
    >
      {/* Imagem real ou Capa Vintage Ornamentada */}
      {hasValidImage && normalizedUrl ? (
        <img
          src={normalizedUrl}
          alt={`Capa do livro ${title}`}
          onError={() => setImageFailed(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full p-2 flex flex-col justify-between"
          style={{ backgroundColor: coverBgColor }}
        >
          {/* Moldura dourada ornamental clássica */}
          <div
            className="w-full h-full p-1.5 flex flex-col justify-between items-center text-center rounded-[2px]"
            style={{
              border: `1px solid ${palette.goldPrimary}90`,
              outline: `0.5px solid ${palette.goldPrimary}50`,
              outlineOffset: '-4px',
            }}
          >
            <div className="pt-2 px-1 w-full">
              <span
                className="font-serif font-bold text-xs sm:text-sm leading-tight block line-clamp-4 drop-shadow"
                style={{ color: palette.goldPrimary }}
              >
                {title}
              </span>
            </div>

            {author && (
              <div className="pb-1 px-1 w-full">
                <span className="font-serif text-[10px] leading-tight block line-clamp-2 text-white/90">
                  {author}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Efeito 3D da Lombada (Spine Shadow) na lateral esquerda */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-3 z-20"
        style={{
          background:
            'linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
        }}
      />

      {/* Brilho sutil na curvatura da lombada */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0.5 w-[1px] z-20"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
        }}
      />

      {/* Sombra de dobra no topo e base */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-4 z-10"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 100%)',
        }}
      />

      {/* Selo / Badge posicionado sobre a capa */}
      {badge && (
        <div className="absolute top-1.5 right-1.5 z-30 pointer-events-none">
          {badge}
        </div>
      )}
    </div>
  );
};
