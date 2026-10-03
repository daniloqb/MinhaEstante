import React, { useState, useMemo } from 'react';
import { Book, ShelfTab, ViewMode, GroupByMode, SortOption } from '../types/book';
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
  Library,
  Check,
  Bookmark,
} from 'lucide-react';

interface HomeScreenProps {
  palette: WoodPalette;
  books: Book[];
  allBooks: Book[];
  statusTab: ShelfTab;
  onStatusTabChange: (status: ShelfTab) => void;
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
  allBooks,
  statusTab,
  onStatusTabChange,
  viewMode,
  onViewModeChange,
  groupBy,
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

  // Contadores reais de cada aba segundo a consulta independente
  const tabCounts = useMemo(() => {
    return {
      meus_livros: allBooks.filter((b) => b.tenho_fisico).length,
      lido: allBooks.filter((b) => b.status_leitura === 'lido').length,
      quero_ler: allBooks.filter((b) => b.status_leitura === 'quero_ler').length,
    };
  }, [allBooks]);

  // Agrupamento para a estante de capas
  const groupedShelves = useMemo(() => {
    if (groupBy === 'ANO') {
      const map = new Map<number | null, Book[]>();
      books.forEach((book) => {
        const year =
          statusTab === 'lido'
            ? book.anoLeitura ?? null
            : (book.anoLeitura || book.anoPublicacao) ?? null;
        if (!map.has(year)) map.set(year, []);
        map.get(year)!.push(book);
      });

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
  }, [books, groupBy, statusTab]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedYear != null ||
    Boolean(selectedGenre) ||
    selectedRatingMin != null;

  /**
   * Renderiza o selo adequado para a capa na visualização de prateleiras
   */
  const renderCoverBadge = (book: Book) => {
    // Nas abas Lidos e Quero ler: selo dourado de posse caso o livro esteja em casa
    if (statusTab === 'lido' || statusTab === 'quero_ler') {
      if (book.tenho_fisico) {
        return (
          <span
            className="p-1 rounded-full shadow-lg flex items-center justify-center border"
            style={{
              backgroundColor: palette.goldPrimary,
              color: palette.textOnGold,
              borderColor: '#FFFFFF60',
            }}
            title="Tenho este exemplar em casa"
          >
            <Library size={12} />
          </span>
        );
      }
      return null;
    }

    // Na aba Meus Livros: selo de leitura se estiver Lido ou Quero Ler; sem selo quando nenhum
    if (statusTab === 'meus_livros') {
      if (book.status_leitura === 'lido') {
        return (
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-serif font-bold shadow-lg flex items-center gap-0.5 border"
            style={{
              backgroundColor: '#10b981',
              color: '#FFFFFF',
              borderColor: '#FFFFFF60',
            }}
            title={`Lido ${book.nota != null ? `(★ ${book.nota})` : ''}`}
          >
            <Check size={10} strokeWidth={3} />
            {book.nota != null ? `★${book.nota}` : 'Lido'}
          </span>
        );
      }

      if (book.status_leitura === 'quero_ler') {
        return (
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-serif font-bold shadow-lg flex items-center gap-0.5 border"
            style={{
              backgroundColor: '#3b82f6',
              color: '#FFFFFF',
              borderColor: '#FFFFFF60',
            }}
            title="Na lista Quero Ler"
          >
            <Bookmark size={10} />
            Quero
          </span>
        );
      }
    }

    return null;
  };

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
                  className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-stone-900"
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

      {/* Barra de Controles: Abas com contadores e alternador Capas | Lista */}
      <div
        className="w-full px-4 py-2 flex items-center justify-between border-b gap-2"
        style={{
          backgroundColor: `${palette.woodDark}cc`,
          borderColor: `${palette.woodBorder}30`,
        }}
      >
        {/* Segmented Button com contadores: Meus Livros | Lidos | Quero Ler */}
        <div
          className="flex items-center p-0.5 rounded-lg border overflow-x-auto scrollbar-none"
          style={{
            backgroundColor: palette.woodDark,
            borderColor: `${palette.woodBorder}60`,
          }}
        >
          <button
            type="button"
            onClick={() => onStatusTabChange('meus_livros')}
            className="px-2.5 sm:px-4 py-1.5 rounded-md font-serif font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            style={{
              backgroundColor: statusTab === 'meus_livros' ? palette.goldPrimary : 'transparent',
              color: statusTab === 'meus_livros' ? palette.textOnGold : palette.textOnWood,
            }}
          >
            Meus Livros
            <span
              className="px-1.5 py-0.2 rounded-full text-[10px] font-sans"
              style={{
                backgroundColor: statusTab === 'meus_livros' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)',
                color: statusTab === 'meus_livros' ? palette.textOnGold : palette.textOnWood,
              }}
            >
              {tabCounts.meus_livros}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onStatusTabChange('lido')}
            className="px-2.5 sm:px-4 py-1.5 rounded-md font-serif font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            style={{
              backgroundColor: statusTab === 'lido' ? palette.goldPrimary : 'transparent',
              color: statusTab === 'lido' ? palette.textOnGold : palette.textOnWood,
            }}
          >
            Lidos
            <span
              className="px-1.5 py-0.2 rounded-full text-[10px] font-sans"
              style={{
                backgroundColor: statusTab === 'lido' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)',
                color: statusTab === 'lido' ? palette.textOnGold : palette.textOnWood,
              }}
            >
              {tabCounts.lido}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onStatusTabChange('quero_ler')}
            className="px-2.5 sm:px-4 py-1.5 rounded-md font-serif font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            style={{
              backgroundColor: statusTab === 'quero_ler' ? palette.goldPrimary : 'transparent',
              color: statusTab === 'quero_ler' ? palette.textOnGold : palette.textOnWood,
            }}
          >
            Quero Ler
            <span
              className="px-1.5 py-0.2 rounded-full text-[10px] font-sans"
              style={{
                backgroundColor: statusTab === 'quero_ler' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)',
                color: statusTab === 'quero_ler' ? palette.textOnGold : palette.textOnWood,
              }}
            >
              {tabCounts.quero_ler}
            </span>
          </button>
        </div>

        {/* Alternar Modo: Capas | Lista */}
        <div
          className="flex items-center p-0.5 rounded-lg border shrink-0"
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
          <span className="font-serif text-xs opacity-75 shrink-0" style={{ color: palette.textSecondaryOnWood }}>
            Filtros ativos:
          </span>

          {searchQuery && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] shrink-0"
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

          {/* Chip de Ano de Leitura */}
          {selectedYear != null && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-sans font-semibold shrink-0"
              style={{
                backgroundColor: `${palette.goldPrimary}25`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              Ano: {selectedYear}
              <button
                onClick={() => onYearFilterChange(null)}
                className="cursor-pointer hover:opacity-80 p-0.5"
                title="Remover filtro de ano"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {selectedGenre && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] shrink-0"
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
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] shrink-0"
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
            className="text-[11px] font-serif font-bold underline cursor-pointer ml-auto whitespace-nowrap hover:opacity-80"
            style={{ color: palette.goldPrimary }}
          >
            Limpar filtros
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
              {statusTab === 'meus_livros'
                ? 'Nenhum livro físico registrado em casa com os filtros atuais.'
                : statusTab === 'lido'
                ? 'Nenhum livro lido correspondente aos filtros atuais.'
                : 'Nenhum livro na lista Quero Ler com os filtros atuais.'}
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
              {statusTab === 'meus_livros'
                ? 'Adicionar livro que tenho em casa'
                : statusTab === 'lido'
                ? 'Adicionar livro lido'
                : 'Adicionar à lista Quero Ler'}
            </button>
          </div>
        ) : viewMode === 'CAPAS' ? (
          /* Visualização de Prateleiras com Rolagem Horizontal */
          <div className="flex flex-col gap-8 pt-4">
            {groupedShelves.map(([groupKey, shelfBooks]) => {
              const label =
                groupBy === 'ANO'
                  ? groupKey == null
                    ? 'Sem data registrada'
                    : String(groupKey)
                  : String(groupKey);

              const sublabel =
                shelfBooks.length === 1 ? '1 livro' : `${shelfBooks.length} livros`;

              return (
                <div key={label} className="w-full flex flex-col">
                  {/* Livros em pé sobre a prateleira */}
                  <div className="w-full overflow-x-auto px-6 flex items-end gap-5 pb-0 pt-3 scrollbar-thin">
                    {shelfBooks.map((book) => {
                      // Altura orgânica simulando biblioteca real (140 a 164px)
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
                            badge={renderCoverBadge(book)}
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
                    badge={renderCoverBadge(book)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="font-serif font-bold text-base sm:text-lg leading-tight line-clamp-2"
                        style={{ color: palette.textOnPaper }}
                      >
                        {book.titulo}
                      </h3>

                      {/* Selo de posse em abas externas */}
                      {(statusTab === 'lido' || statusTab === 'quero_ler') && book.tenho_fisico && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1"
                          style={{
                            backgroundColor: `${palette.goldPrimary}20`,
                            borderColor: palette.goldPrimary,
                            color: palette.woodBorder,
                          }}
                          title="Exemplar físico em casa"
                        >
                          <Library size={10} />
                          Tenho
                        </span>
                      )}
                    </div>

                    <p
                      className="text-xs truncate mt-0.5"
                      style={{ color: palette.textSecondaryOnPaper }}
                    >
                      {book.autores.join(', ') || 'Autor desconhecido'} ·{' '}
                      {book.generos[0] || 'Geral'}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5">
                      {statusTab === 'lido' ? (
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
                      ) : statusTab === 'meus_livros' ? (
                        <div className="w-full flex items-center justify-between">
                          <span
                            className="font-serif font-semibold text-xs px-2.5 py-0.5 rounded-full border flex items-center gap-1"
                            style={{
                              backgroundColor:
                                book.status_leitura === 'lido'
                                  ? '#10b98115'
                                  : book.status_leitura === 'quero_ler'
                                  ? '#3b82f615'
                                  : `${palette.goldPrimary}15`,
                              borderColor:
                                book.status_leitura === 'lido'
                                  ? '#10b98160'
                                  : book.status_leitura === 'quero_ler'
                                  ? '#3b82f660'
                                  : `${palette.goldPrimary}60`,
                              color:
                                book.status_leitura === 'lido'
                                  ? '#065f46'
                                  : book.status_leitura === 'quero_ler'
                                  ? '#1e40af'
                                  : palette.woodBorder,
                            }}
                          >
                            {book.status_leitura === 'lido' ? (
                              <>
                                <Check size={11} /> Lido {book.nota != null ? `(★ ${book.nota})` : ''}
                              </>
                            ) : book.status_leitura === 'quero_ler' ? (
                              <>
                                <Bookmark size={11} /> Quero Ler
                              </>
                            ) : (
                              'No acervo (sem leitura)'
                            )}
                          </span>

                          <button
                            type="button"
                            className="font-serif font-bold text-xs hover:underline cursor-pointer"
                            style={{ color: palette.woodBorder }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenQuickAction(book);
                            }}
                          >
                            Ações →
                          </button>
                        </div>
                      ) : (
                        <div className="w-full flex items-center justify-between">
                          <span
                            className="font-serif font-semibold text-xs px-2 py-0.5 rounded-full border flex items-center gap-1"
                            style={{
                              borderColor: `${palette.woodBorder}60`,
                              color: palette.woodBorder,
                            }}
                          >
                            <Bookmark size={11} />
                            Quero Ler
                          </span>
                          <button
                            type="button"
                            className="font-serif font-bold text-xs hover:underline cursor-pointer"
                            style={{ color: palette.woodBorder }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenQuickAction(book);
                            }}
                          >
                            Ações →
                          </button>
                        </div>
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
