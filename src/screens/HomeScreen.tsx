import React, { useState, useMemo } from 'react';
import { Book, BookStatus, ViewMode, GroupByMode, SortOption } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodShelf } from '../components/WoodShelf';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { StarRatingBar } from '../components/StarRatingBar';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import {
  Search,
  Filter as FilterIcon,
  Plus,
  LayoutGrid,
  List as ListIcon,
  X,
  BookOpen,
} from 'lucide-react';

interface HomeScreenProps {
  palette: WoodPalette;
  books: Book[];
  statusTab: BookStatus;
  onStatusTabChange: (status: BookStatus) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  groupBy: GroupByMode;
  onGroupByChange: (mode: GroupByMode) => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  selectedYear: number | null;
  onYearFilterChange: (year: number | null) => void;
  selectedGenre: string | null;
  onGenreFilterChange: (genre: string | null) => void;
  selectedRatingMin: number | null;
  onRatingFilterChange: (min: number | null) => void;
  onClearFilters: () => void;
  onSelectBook: (book: Book) => void;
  onOpenQuickAction: (book: Book) => void;
  onOpenFiltersModal: () => void;
  onAddBookClick: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  palette,
  books,
  statusTab,
  onStatusTabChange,
  viewMode,
  onViewModeChange,
  groupBy,
  sortOption: _sortOption,
  searchQuery,
  onSearchQueryChange,
  selectedYear,
  onYearFilterChange,
  selectedGenre,
  onGenreFilterChange,
  selectedRatingMin,
  onRatingFilterChange,
  onClearFilters,
  onSelectBook,
  onOpenQuickAction,
  onOpenFiltersModal,
  onAddBookClick,
}) => {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Group books for Shelves View
  const groupedShelves = useMemo(() => {
    if (groupBy === 'ANO') {
      const map = new Map<number | null, Book[]>();
      books.forEach((book) => {
        const year = book.anoLeitura ?? null;
        if (!map.has(year)) map.set(year, []);
        map.get(year)!.push(book);
      });
      // Sort years descending, null (Sem data) at the end
      return Array.from(map.entries()).sort((a, b) => {
        if (a[0] == null) return 1;
        if (b[0] == null) return -1;
        return b[0] - a[0];
      });
    }

    if (groupBy === 'AUTOR') {
      const map = new Map<string, Book[]>();
      books.forEach((book) => {
        const author = book.autores[0] || 'Autor desconhecido';
        if (!map.has(author)) map.set(author, []);
        map.get(author)!.push(book);
      });
      return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }

    // GENERO
    const map = new Map<string, Book[]>();
    books.forEach((book) => {
      const genre = book.generos[0] || 'Geral';
      if (!map.has(genre)) map.set(genre, []);
      map.get(genre)!.push(book);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [books, groupBy]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedYear != null ||
    Boolean(selectedGenre) ||
    selectedRatingMin != null;

  return (
    <div className="flex flex-col w-full flex-1">
      {/* Top Bar */}
      <WoodTopAppBar
        palette={palette}
        title="Minha Estante"
        actions={
          <>
            <button
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Pesquisar na estante"
            >
              {isSearchExpanded ? (
                <X size={20} color={palette.goldPrimary} />
              ) : (
                <Search size={20} color={palette.goldPrimary} />
              )}
            </button>
            <button
              onClick={onOpenFiltersModal}
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer relative"
              title="Filtros da estante"
            >
              <FilterIcon size={20} color={palette.goldPrimary} />
              {hasActiveFilters && (
                <span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: palette.goldPrimary }}
                />
              )}
            </button>
          </>
        }
      />

      {/* Busca Interna Expansível */}
      {isSearchExpanded && (
        <div
          className="w-full px-4 py-2.5 transition-all shadow-inner"
          style={{ backgroundColor: palette.woodDark }}
        >
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Pesquisar título, autor ou notas..."
              autoFocus
              className="w-full pl-9 pr-8 py-2 rounded-xl text-sm focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurface,
                color: palette.textOnPaper,
                borderColor: palette.woodBorder,
              }}
            />
            <Search
              size={16}
              className="absolute left-3 top-3 text-stone-500"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Barra de Controles: "Lidos | Quero Ler" e "Capas | Lista" */}
      <div
        className="w-full px-4 py-2 flex items-center justify-between border-b"
        style={{
          backgroundColor: `${palette.woodDark}cc`,
          borderColor: `${palette.woodBorder}30`,
        }}
      >
        {/* Segmented Button: Lidos | Quero Ler */}
        <div
          className="flex items-center p-0.5 rounded-lg border"
          style={{
            backgroundColor: palette.woodDark,
            borderColor: `${palette.woodBorder}60`,
          }}
        >
          <button
            type="button"
            onClick={() => onStatusTabChange('lido')}
            className="px-3.5 py-1.5 rounded-md font-serif font-bold text-xs sm:text-sm transition-all cursor-pointer"
            style={{
              backgroundColor: statusTab === 'lido' ? palette.goldPrimary : 'transparent',
              color: statusTab === 'lido' ? palette.textOnGold : palette.textOnWood,
            }}
          >
            Lidos
          </button>
          <button
            type="button"
            onClick={() => onStatusTabChange('quero_ler')}
            className="px-3.5 py-1.5 rounded-md font-serif font-bold text-xs sm:text-sm transition-all cursor-pointer"
            style={{
              backgroundColor: statusTab === 'quero_ler' ? palette.goldPrimary : 'transparent',
              color: statusTab === 'quero_ler' ? palette.textOnGold : palette.textOnWood,
            }}
          >
            Quero Ler
          </button>
        </div>

        {/* Alternar Modo: Capas | Lista */}
        <div
          className="flex items-center p-0.5 rounded-lg border"
          style={{
            backgroundColor: palette.woodDark,
            borderColor: `${palette.woodBorder}60`,
          }}
        >
          <button
            type="button"
            onClick={() => onViewModeChange('CAPAS')}
            className="p-1.5 rounded-md transition-all cursor-pointer"
            style={{
              backgroundColor: viewMode === 'CAPAS' ? `${palette.goldPrimary}25` : 'transparent',
              color: viewMode === 'CAPAS' ? palette.goldPrimary : palette.textSecondaryOnWood,
            }}
            title="Prateleiras de Capas"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('LISTA')}
            className="p-1.5 rounded-md transition-all cursor-pointer"
            style={{
              backgroundColor: viewMode === 'LISTA' ? `${palette.goldPrimary}25` : 'transparent',
              color: viewMode === 'LISTA' ? palette.goldPrimary : palette.textSecondaryOnWood,
            }}
            title="Lista de Cartões"
          >
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {/* Chips de Filtros Ativos */}
      {hasActiveFilters && (
        <div
          className="w-full px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto text-xs"
          style={{ backgroundColor: `${palette.woodDark}80` }}
        >
          <span className="font-serif text-xs opacity-75" style={{ color: palette.textSecondaryOnWood }}>
            Filtros:
          </span>

          {searchQuery && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px]"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              &ldquo;{searchQuery}&rdquo;
              <button onClick={() => onSearchQueryChange('')} className="cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {selectedYear != null && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px]"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              Ano: {selectedYear === -1 ? 'Sem data' : selectedYear}
              <button onClick={() => onYearFilterChange(null)} className="cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {selectedGenre && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px]"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              Gênero: {selectedGenre}
              <button onClick={() => onGenreFilterChange(null)} className="cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {selectedRatingMin != null && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px]"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              ★ {selectedRatingMin}+
              <button onClick={() => onRatingFilterChange(null)} className="cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          <button
            onClick={onClearFilters}
            className="text-[11px] font-serif font-bold underline cursor-pointer ml-auto whitespace-nowrap"
            style={{ color: palette.goldPrimary }}
          >
            Limpar
          </button>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 w-full pb-8">
        {books.length === 0 ? (
          /* Estado Vazio */
          <div className="flex flex-col items-center justify-center p-8 mt-12 text-center max-w-md mx-auto">
            <div
              className="p-4 rounded-full mb-4 shadow-lg border"
              style={{
                backgroundColor: `${palette.goldPrimary}15`,
                borderColor: `${palette.goldPrimary}40`,
                color: palette.goldPrimary,
              }}
            >
              <BookOpen size={48} />
            </div>

            <p
              className="font-serif text-lg leading-relaxed mb-6"
              style={{ color: palette.textOnWood }}
            >
              {statusTab === 'lido'
                ? 'Sua estante de livros lidos está aguardando as primeiras obras.'
                : 'Sua lista de interesse está vazia. Adicione livros que planeja ler.'}
            </p>

            <WoodShelf palette={palette} className="mb-6" />

            <button
              type="button"
              onClick={onAddBookClick}
              className="px-6 py-3 rounded-xl font-serif font-bold text-base shadow-xl flex items-center gap-2 cursor-pointer hover:brightness-105 active:scale-95 transition-transform"
              style={{
                backgroundColor: palette.goldPrimary,
                color: palette.textOnGold,
              }}
            >
              <Plus size={20} />
              Adicionar meu primeiro livro
            </button>
          </div>
        ) : viewMode === 'CAPAS' ? (
          /* Visualização de Prateleiras com Rolagem Horizontal */
          <div className="flex flex-col gap-8 pt-4">
            {groupedShelves.map(([groupKey, shelfBooks]) => {
              const label =
                groupBy === 'ANO'
                  ? groupKey == null
                    ? 'Sem data de leitura'
                    : String(groupKey)
                  : String(groupKey);

              const sublabel =
                shelfBooks.length === 1 ? '1 livro' : `${shelfBooks.length} livros`;

              return (
                <div key={label} className="w-full flex flex-col">
                  {/* Livros em pé sobre a prateleira */}
                  <div className="w-full overflow-x-auto px-6 flex items-end gap-5 pb-0 pt-3 scrollbar-thin">
                    {shelfBooks.map((book) => {
                      // Altura ligeiramente orgânica para efeito de biblioteca real (140 a 164px)
                      let hash = 0;
                      for (let i = 0; i < book.titulo.length; i++) {
                        hash = (hash << 5) - hash + book.titulo.charCodeAt(i);
                        hash |= 0;
                      }
                      const dynamicHeight = 142 + (Math.abs(hash) % 5) * 6;

                      return (
                        <div
                          key={book.id}
                          className="flex flex-col items-center flex-shrink-0 group"
                        >
                          <BookCoverView
                            palette={palette}
                            title={book.titulo}
                            author={book.autores[0]}
                            coverUrl={book.capaUrl}
                            width={100}
                            height={dynamicHeight}
                            onClick={() => onSelectBook(book)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              onOpenQuickAction(book);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Prateleira de madeira 3D sob os livros */}
                  <WoodShelf palette={palette} label={label} sublabel={sublabel} />
                </div>
              );
            })}
          </div>
        ) : (
          /* Visualização em Lista (Cartões de Papel Envelhecido) */
          <div className="px-4 py-4 flex flex-col gap-3 max-w-3xl mx-auto w-full">
            {books.map((book) => (
              <PaperCard
                key={book.id}
                palette={palette}
                onClick={() => onSelectBook(book)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenQuickAction(book);
                }}
              >
                <div className="flex items-center gap-3.5">
                  <BookCoverView
                    palette={palette}
                    title={book.titulo}
                    author={book.autores[0]}
                    coverUrl={book.capaUrl}
                    width={56}
                    height={84}
                  />

                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-serif font-bold text-base sm:text-lg leading-tight line-clamp-2"
                      style={{ color: palette.textOnPaper }}
                    >
                      {book.titulo}
                    </h3>
                    <p
                      className="text-xs truncate mt-0.5"
                      style={{ color: palette.textSecondaryOnPaper }}
                    >
                      {book.autores.join(', ') || 'Autor desconhecido'} ·{' '}
                      {book.generos[0] || 'Geral'}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5">
                      {book.status === 'lido' ? (
                        <>
                          <StarRatingBar
                            palette={palette}
                            rating={book.nota}
                            starSize={14}
                            showLabel={true}
                          />
                          <span
                            className="font-serif font-bold text-xs"
                            style={{ color: palette.woodBorder }}
                          >
                            {book.anoLeitura != null
                              ? `${book.mesLeitura ? book.mesLeitura + '/' : ''}${book.anoLeitura}`
                              : 'Sem data'}
                          </span>
                        </>
                      ) : (
                        <span
                          className="font-serif font-semibold text-xs px-2 py-0.5 rounded-full border"
                          style={{
                            borderColor: palette.woodBorder,
                            color: palette.woodBorder,
                          }}
                        >
                          Quero Ler
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </PaperCard>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (+) */}
      <button
        type="button"
        onClick={onAddBookClick}
        className="fixed right-5 bottom-20 z-40 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl cursor-pointer hover:scale-105 active:scale-95 transition-transform"
        style={{
          backgroundColor: palette.goldPrimary,
          color: palette.textOnGold,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}
        title="Adicionar livro"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>
    </div>
  );
};
