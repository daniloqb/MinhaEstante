import React from 'react';
import { WoodPalette } from '../../theme/woodTheme';
import { BookCoverView } from '../BookCoverView';
import { HomeBookItem } from '../../features/home-feed/types';
import { Check, Star } from 'lucide-react';

interface DiscoveryBookCardProps {
  palette: WoodPalette;
  item: HomeBookItem;
  isAlreadyInLibrary?: boolean;
  onClick: (item: HomeBookItem) => void;
}

export const DiscoveryBookCard: React.FC<DiscoveryBookCardProps> = ({
  palette,
  item,
  isAlreadyInLibrary = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group flex flex-col text-left shrink-0 w-28 sm:w-32 md:w-36 cursor-pointer focus:outline-none focus:ring-2 rounded-xl p-1 transition-all duration-200 hover:-translate-y-1 active:scale-95 select-none snap-start"
      style={{
        outlineColor: palette.goldPrimary,
      }}
      title={`${item.titulo} — ${item.autores.join(', ') || 'Autor Desconhecido'}`}
      aria-label={`Livro: ${item.titulo}, autor: ${item.autores.join(', ') || 'Desconhecido'}`}
    >
      {/* Capa com proporção vertical nobre (2:3) e sombra de papel */}
      <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition-shadow duration-200 bg-stone-900/10">
        <BookCoverView
          palette={palette}
          book={item.localBook}
          coverUrl={
            item.capaUrl ||
            item.localBook?.capaUrl ||
            item.capaLocalPath ||
            item.localBook?.capaLocalPath ||
            undefined
          }
          title={item.titulo}
          author={item.autores[0]}
          width="100%"
          height="100%"
          className="w-full h-full pointer-events-none"
        />

        {/* Badge de Posição de Ranking (#1, #2...) */}
        {typeof item.rankPosition === 'number' && (
          <div
            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-sans font-black shadow-md flex items-center justify-center tracking-tight"
            style={{
              backgroundColor: palette.goldPrimary,
              color: palette.textOnGold,
            }}
          >
            #{item.rankPosition}
          </div>
        )}

        {/* Badge: Já na estante */}
        {isAlreadyInLibrary && (
          <div
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-sans font-bold shadow-md flex items-center gap-0.5 bg-emerald-800 text-emerald-100"
            title="Livro já presente na sua estante pessoal"
          >
            <Check size={10} className="stroke-[3]" />
            <span className="hidden sm:inline">Na estante</span>
          </div>
        )}

        {/* Avaliação por estrelas (se livro local avaliado) */}
        {typeof item.rating === 'number' && item.rating > 0 && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-sans font-bold shadow-md flex items-center gap-0.5 bg-black/75 text-amber-300 backdrop-blur-xs">
            <Star size={10} className="fill-amber-400 text-amber-400" />
            <span>{item.rating}</span>
          </div>
        )}
      </div>

      {/* Informações Bibliográficas */}
      <div className="flex flex-col mt-2 gap-0.5 w-full">
        <h4
          className="font-serif font-bold text-xs sm:text-sm line-clamp-2 leading-tight transition-colors duration-150 group-hover:underline"
          style={{ color: palette.textOnWood }}
        >
          {item.titulo}
        </h4>

        <p
          className="font-sans text-[11px] sm:text-xs truncate"
          style={{ color: palette.textSecondaryOnWood }}
        >
          {item.autores[0] || 'Autor Desconhecido'}
        </p>

        {/* Rótulo de contexto explicável */}
        {item.reason && (
          <span
            className="font-sans text-[10px] truncate mt-0.5 font-medium px-1 py-0.2 rounded w-fit max-w-full"
            style={{
              backgroundColor: `${palette.goldPrimary}20`,
              color: palette.goldPrimary,
            }}
            title={item.reason}
          >
            {item.reason}
          </span>
        )}
      </div>
    </button>
  );
};
