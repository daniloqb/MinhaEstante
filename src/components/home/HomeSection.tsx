import React from 'react';
import { WoodPalette } from '../../theme/woodTheme';
import { HomeBookItem, HomeBookSection } from '../../features/home-feed/types';
import { Book } from '../../types/book';
import { areBooksDuplicate } from '../../services/storage';
import { BookCarousel } from './BookCarousel';
import { DiscoveryBookCard } from './DiscoveryBookCard';
import { HomeSectionSkeleton } from './HomeSectionSkeleton';
import { ChevronRight, BookOpen, Plus } from 'lucide-react';

interface HomeSectionProps {
  palette: WoodPalette;
  section: HomeBookSection;
  libraryBooks?: Book[];
  userBookIds?: Set<string | number>;
  onSelectBook: (item: HomeBookItem) => void;
  onViewAll?: (section: HomeBookSection) => void;
  onAddFirstBook?: () => void;
}

export const HomeSection: React.FC<HomeSectionProps> = ({
  palette,
  section,
  libraryBooks,
  onSelectBook,
  onViewAll,
  onAddFirstBook,
}) => {
  if (section.state === 'loading') {
    return <HomeSectionSkeleton palette={palette} />;
  }

  // Estado Vazio para "Sua Estante"
  if (section.state === 'empty' && section.type === 'personal-shelf') {
    return (
      <div className="w-full flex flex-col gap-2 py-3 px-1">
        <div className="flex items-center justify-between">
          <h3
            className="font-serif font-bold text-lg sm:text-xl tracking-tight"
            style={{ color: palette.textOnWood }}
          >
            {section.title}
          </h3>
        </div>

        <div
          className="w-full p-4 sm:p-5 rounded-xl border flex flex-col items-center justify-center text-center gap-2.5 shadow-sm"
          style={{
            backgroundColor: `${palette.woodDark}90`,
            borderColor: `${palette.woodBorder}40`,
            color: palette.textOnWood,
          }}
        >
          <BookOpen size={28} style={{ color: palette.goldPrimary }} />
          <p className="font-serif font-semibold text-sm sm:text-base">
            Sua estante ainda não possui livros cadastrados
          </p>
          <p className="font-sans text-xs max-w-sm" style={{ color: palette.textSecondaryOnWood }}>
            Cadastre seu primeiro livro ou explore as obras sugeridas abaixo para começar sua coleção.
          </p>
          {onAddFirstBook && (
            <button
              type="button"
              onClick={onAddFirstBook}
              className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg font-sans font-semibold text-xs border shadow-sm cursor-pointer hover:brightness-110 active:scale-95 transition-all"
              style={{
                backgroundColor: palette.goldPrimary,
                borderColor: palette.woodBorder,
                color: palette.textOnGold,
              }}
            >
              <Plus size={14} />
              <span>Cadastrar Primeiro Livro</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Seção sem livros (e não é estante principal), oculta silenciosamente
  if (section.books.length === 0) {
    if (section.errorMessage) {
      return (
        <div className="w-full py-2 px-1 text-xs opacity-60 font-sans italic" style={{ color: palette.textSecondaryOnWood }}>
          {section.title}: {section.errorMessage}
        </div>
      );
    }
    return null;
  }

  return (
    <section className="w-full flex flex-col gap-2 py-3">
      {/* Cabeçalho da Seção */}
      <div className="flex items-end justify-between px-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h3
              className="font-serif font-bold text-lg sm:text-xl tracking-tight flex items-center gap-1.5"
              style={{ color: palette.textOnWood }}
            >
              {section.title}
            </h3>

            {/* Badge de Fonte ou Referência */}
            {section.source && (
              <span
                className="hidden md:inline text-[10px] font-sans font-medium px-1.5 py-0.5 rounded opacity-80"
                style={{
                  backgroundColor: `${palette.woodBorder}35`,
                  color: palette.textOnWood,
                }}
              >
                {section.source}
              </span>
            )}
          </div>

          {section.subtitle && (
            <p
              className="font-sans text-xs line-clamp-1 mt-0.5"
              style={{ color: palette.textSecondaryOnWood }}
            >
              {section.subtitle}
            </p>
          )}
        </div>

        {/* Link / Botão Ver Todos */}
        {section.canViewAll && onViewAll && (
          <button
            type="button"
            onClick={() => onViewAll(section)}
            className="flex items-center gap-0.5 text-xs font-sans font-semibold cursor-pointer hover:underline pb-0.5 shrink-0"
            style={{ color: palette.goldPrimary }}
          >
            <span>Ver todos</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Carrossel de Livros */}
      <BookCarousel palette={palette}>
        {section.books.map((item) => {
          // Identifica se este livro já existe na biblioteca local (pelo item ou por cruzamento de título/autor/ISBN)
          const matchingBook =
            item.localBook ||
            (libraryBooks
              ? libraryBooks.find((b) =>
                  areBooksDuplicate(b, {
                    titulo: item.titulo,
                    autores: item.autores,
                    isbn13: item.isbn13,
                    isbn10: item.isbn10,
                  })
                )
              : undefined);

          const isLocal = Boolean(item.isLocal || matchingBook);
          const enrichedItem: HomeBookItem = matchingBook
            ? {
                ...item,
                isLocal: true,
                localBook: matchingBook,
                capaUrl: item.capaUrl || matchingBook.capaUrl,
                capaLocalPath: item.capaLocalPath || matchingBook.capaLocalPath,
              }
            : item;

          return (
            <DiscoveryBookCard
              key={item.id}
              palette={palette}
              item={enrichedItem}
              isAlreadyInLibrary={isLocal}
              onClick={onSelectBook}
            />
          );
        })}
      </BookCarousel>
    </section>
  );
};
