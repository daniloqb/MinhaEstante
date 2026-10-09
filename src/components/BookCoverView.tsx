import React, { useState } from 'react';
import { WoodPalette } from '../theme/woodTheme';
import { Book, isBookBorrowed } from '../types/book';
import { Check, Bookmark, Tablet, BookOpen, Handshake } from 'lucide-react';

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
  book?: Book;
  compact?: boolean;
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
  width = 108,
  height = 160,
  className = '',
  badge,
  book,
  compact = false,
  onClick,
  onContextMenu,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  // Marcadores ordenados solicitados: 1. Lido, 2. Físico/Digital, 3. Emprestado
  const renderBadges = () => {
    if (badge) return badge;
    if (!book) return null;

    const items: React.ReactNode[] = [];

    // 1. Lido / Status de Leitura
    if (book.status_leitura === 'lido') {
      items.push(
        <span
          key="lido"
          className={`${
            compact ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
          } rounded-full font-serif font-bold shadow-md flex items-center gap-0.5 border bg-emerald-600 text-white border-white/70 backdrop-blur-xs`}
          title={`Lido ${book.nota != null ? `(★ ${book.nota})` : ''}`}
        >
          <Check size={compact ? 8 : 10} strokeWidth={3} />
          <span>{book.nota != null ? `★${book.nota}` : 'Lido'}</span>
        </span>
      );
    } else if (book.status_leitura === 'quero_ler') {
      items.push(
        <span
          key="quero"
          className={`${
            compact ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
          } rounded-full font-serif font-bold shadow-md flex items-center gap-0.5 border bg-blue-600 text-white border-white/70 backdrop-blur-xs`}
          title="Na lista Quero Ler"
        >
          <Bookmark size={compact ? 8 : 10} />
          <span>Quero</span>
        </span>
      );
    }

    // 2. Físico / Digital
    if (book.formato === 'ebook') {
      items.push(
        <span
          key="digital"
          className={`${
            compact ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
          } rounded-full font-sans font-bold shadow-md flex items-center gap-0.5 border bg-purple-900/90 text-purple-100 border-purple-300/50 backdrop-blur-xs`}
          title="E-book Digital"
        >
          <Tablet size={compact ? 8 : 10} />
          <span>E-book</span>
        </span>
      );
    } else {
      items.push(
        <span
          key="fisico"
          className={`${
            compact ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
          } rounded-full font-serif font-bold shadow-md flex items-center gap-0.5 border bg-amber-950/90 text-amber-100 border-amber-300/50 backdrop-blur-xs`}
          title={book.tenho_fisico ? 'Livro Físico (tenho em casa)' : 'Livro Físico'}
        >
          <BookOpen size={compact ? 8 : 10} />
          <span>Físico</span>
        </span>
      );
    }

    // 3. Emprestado
    if (isBookBorrowed(book)) {
      items.push(
        <span
          key="emprestado"
          className={`${
            compact ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
          } rounded-full font-serif font-bold shadow-lg flex items-center gap-0.5 border bg-amber-500 text-stone-950 border-amber-200 backdrop-blur-xs animate-pulse`}
          title={`Emprestado para ${book.emprestimo?.nomePessoa}`}
        >
          <Handshake size={compact ? 8 : 10} strokeWidth={2.5} />
          <span>Emprestado</span>
        </span>
      );
    }

    if (items.length === 0) return null;
    return <>{items}</>;
  };

  const renderedBadges = renderBadges();

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

      {/* Selos / Badges posicionados sobre a capa (Lido, Físico/Digital, Emprestado) */}
      {renderedBadges && (
        <div className="absolute top-1 right-1 z-30 pointer-events-none max-w-[92%] flex flex-col items-end gap-1">
          {renderedBadges}
        </div>
      )}
    </div>
  );
};
