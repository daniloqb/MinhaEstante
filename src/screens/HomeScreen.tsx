import React, { useState, useMemo } from 'react';
import { Book, ShelfTab, ViewMode, GroupByMode, SortOption } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodShelf } from '../components/WoodShelf';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { StarRatingBar } from '../components/StarRatingBar';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { MaShelfLogo } from '../components/MaShelfLogo';
import { useI18n } from '../i18n/I18nContext';
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
  Tablet,
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
  selectedFormat?: 'fisico' | 'ebook' | null;
  onFormatFilterChange?: (format: 'fisico' | 'ebook' | null) => void;
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
  selectedFormat = null,
  onFormatFilterChange,
  onClearFilters,
  onSelectBook,
  onOpenQuickAction,
  onOpenFiltersModal,
  onAddBookClick,
}) => {
  const { t } = useI18n();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Contadores reais de cada aba da estante unificada
  const tabCounts = useMemo(() => {
    return {
      todos: allBooks.filter((b) => Boolean(b.tenho_fisico) || b.formato === 'ebook').length,
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
    selectedRatingMin != null ||
    Boolean(selectedFormat);

  return (
    <div className="flex flex-col w-full flex-1">
      {/* Top Bar */}
      <WoodTopAppBar
        palette={palette}
        title={t.home.title}
        navigationIcon={<MaShelfLogo size={32} />}
        actions={
          <>
            <button
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title={t.common.search}
            >
              {isSearchExpanded ? (
                <X size={22} color={palette.goldPrimary} />
              ) : (
                <Search size={22} color={palette.goldPrimary} />
              )}
            </button>
            <button
              onClick={onOpenFiltersModal}
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer relative"
              title={t.common.filter}
            >
              <FilterIcon size={22} color={palette.goldPrimary} />
              {hasActiveFilters && (
                <span
                  className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full ring-2 ring-stone-900"
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
              placeholder={t.home.searchPlaceholder}
              autoFocus
              className="w-full pl-10 pr-9 py-2.5 rounded-xl text-base focus:outline-none focus:ring-2"
              style={{
                backgroundColor: palette.paperSurface,
                color: palette.textOnPaper,
                borderColor: palette.woodBorder,
              }}
            />
            <Search
              size={18}
              className="absolute left-3 top-3 text-stone-500"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="absolute right-2.5 top-2.5 p-1 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Barra de Controles: Abas com contadores e alternador Capas | Lista */}
      <div
        className="w-full px-3 sm:px-4 py-2 flex items-center justify-between border-b gap-2 overflow-x-auto"
        style={{
          backgroundColor: `${palette.woodDark}ee`,
          borderColor: `${palette.woodBorder}40`,
        }}
      >
        {/* Segmented Button com contadores: Todos (Físicos + E-books) | Lidos | Quero Ler */}
        <div
          className="flex items-center p-0.5 rounded-xl border overflow-x-auto scrollbar-none gap-0.5"
          style={{
            backgroundColor: palette.woodDark,
            borderColor: `${palette.woodBorder}70`,
          }}
        >
          {/* Aba 1: Todos os Livros (Estante Unificada: Físicos e E-books) */}
          <button
            type="button"
            onClick={() => onStatusTabChange('todos')}
            className="px-3.5 sm:px-4 py-2 rounded-lg font-serif font-bold text-sm sm:text-base transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            style={{
              backgroundColor:
                statusTab === 'todos' || statusTab === 'meus_livros'
                  ? palette.goldPrimary
                  : 'transparent',
              color:
                statusTab === 'todos' || statusTab === 'meus_livros'
                  ? palette.textOnGold
                  : palette.textOnWood,
            }}
          >
            <BookOpen size={16} />
            <span>{t.home.filterFormatAll}</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-sans font-bold"
              style={{
                backgroundColor:
                  statusTab === 'todos' || statusTab === 'meus_livros'
                    ? 'rgba(0,0,0,0.25)'
                    : 'rgba(255,255,255,0.18)',
                color:
                  statusTab === 'todos' || statusTab === 'meus_livros'
                    ? palette.textOnGold
                    : palette.textOnWood,
              }}
            >
              {tabCounts.todos}
            </span>
          </button>

          {/* Aba 2: Lidos */}
          <button
            type="button"
            onClick={() => onStatusTabChange('lido')}
            className="px-3.5 sm:px-4 py-2 rounded-lg font-serif font-bold text-sm sm:text-base transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            style={{
              backgroundColor: statusTab === 'lido' ? palette.goldPrimary : 'transparent',
              color: statusTab === 'lido' ? palette.textOnGold : palette.textOnWood,
            }}
          >
            <Check size={16} />
            <span>{t.status.read}</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-sans font-bold"
              style={{
                backgroundColor: statusTab === 'lido' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.18)',
                color: statusTab === 'lido' ? palette.textOnGold : palette.textOnWood,
              }}
            >
              {tabCounts.lido}
            </span>
          </button>

          {/* Aba 3: Quero Ler */}
          <button
            type="button"
            onClick={() => onStatusTabChange('quero_ler')}
            className="px-3.5 sm:px-4 py-2 rounded-lg font-serif font-bold text-sm sm:text-base transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            style={{
              backgroundColor: statusTab === 'quero_ler' ? palette.goldPrimary : 'transparent',
              color: statusTab === 'quero_ler' ? palette.textOnGold : palette.textOnWood,
            }}
          >
            <Bookmark size={16} />
            <span>{t.status.wantToRead}</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-sans font-bold"
              style={{
                backgroundColor: statusTab === 'quero_ler' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.18)',
                color: statusTab === 'quero_ler' ? palette.textOnGold : palette.textOnWood,
              }}
            >
              {tabCounts.quero_ler}
            </span>
          </button>
        </div>

        {/* Alternar Modo: Capas | Lista */}
        <div
          className="flex items-center p-0.5 rounded-xl border shrink-0"
          style={{
            backgroundColor: palette.woodDark,
            borderColor: `${palette.woodBorder}70`,
          }}
        >
          <button
            type="button"
            onClick={() => onViewModeChange('CAPAS')}
            className="p-2 rounded-lg transition-all cursor-pointer"
            style={{
              backgroundColor: viewMode === 'CAPAS' ? `${palette.goldPrimary}30` : 'transparent',
              color: viewMode === 'CAPAS' ? palette.goldPrimary : palette.textSecondaryOnWood,
            }}
            title={t.home.viewCovers}
          >
            <LayoutGrid size={20} />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('LISTA')}
            className="p-2 rounded-lg transition-all cursor-pointer"
            style={{
              backgroundColor: viewMode === 'LISTA' ? `${palette.goldPrimary}30` : 'transparent',
              color: viewMode === 'LISTA' ? palette.goldPrimary : palette.textSecondaryOnWood,
            }}
            title={t.home.viewList}
          >
            <ListIcon size={20} />
          </button>
        </div>
      </div>

      {/* Chips de Filtros Ativos */}
      {hasActiveFilters && (
        <div
          className="w-full px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs"
          style={{ backgroundColor: `${palette.woodDark}90` }}
        >
          <span className="font-serif text-sm font-semibold opacity-85 shrink-0" style={{ color: palette.textSecondaryOnWood }}>
            Filtros:
          </span>

          {searchQuery && (
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs shrink-0 font-medium"
              style={{
                backgroundColor: `${palette.goldPrimary}25`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              &ldquo;{searchQuery}&rdquo;
              <button onClick={() => onSearchQueryChange('')} className="cursor-pointer ml-1">
                <X size={14} />
              </button>
            </span>
          )}

          {/* Chip de Ano de Leitura */}
          {selectedYear != null && (
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-sans font-semibold shrink-0"
              style={{
                backgroundColor: `${palette.goldPrimary}25`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              Ano: {selectedYear}
              <button
                onClick={() => onYearFilterChange(null)}
                className="cursor-pointer hover:opacity-80 p-0.5 ml-1"
                title="Remover filtro de ano"
              >
                <X size={14} />
              </button>
            </span>
          )}

          {selectedGenre && (
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs shrink-0 font-medium"
              style={{
                backgroundColor: `${palette.goldPrimary}25`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              Gênero: {selectedGenre}
              <button onClick={() => onGenreFilterChange(null)} className="cursor-pointer ml-1">
                <X size={14} />
              </button>
            </span>
          )}

          {selectedRatingMin != null && (
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs shrink-0 font-medium"
              style={{
                backgroundColor: `${palette.goldPrimary}25`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              ★ {selectedRatingMin}+
              <button onClick={() => onRatingFilterChange(null)} className="cursor-pointer ml-1">
                <X size={14} />
              </button>
            </span>
          )}

          {/* Chip de Formato (Físicos vs E-books) */}
          {selectedFormat && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs shrink-0 font-medium"
              style={{
                backgroundColor: selectedFormat === 'ebook' ? '#7c3aed25' : `${palette.goldPrimary}25`,
                borderColor: selectedFormat === 'ebook' ? '#7c3aed80' : palette.goldPrimary,
                color: selectedFormat === 'ebook' ? '#7c3aed' : palette.goldPrimary,
              }}
            >
              {selectedFormat === 'ebook' ? <Tablet size={13} /> : <BookOpen size={13} />}
              <span>Formato: {selectedFormat === 'ebook' ? 'E-books' : 'Físicos'}</span>
              {onFormatFilterChange && (
                <button
                  type="button"
                  onClick={() => onFormatFilterChange(null)}
                  className="cursor-pointer hover:opacity-80 p-0.5 ml-1"
                  title="Remover filtro de formato"
                >
                  <X size={14} />
                </button>
              )}
            </span>
          )}

          <button
            onClick={onClearFilters}
            className="text-xs font-serif font-bold underline cursor-pointer ml-auto whitespace-nowrap hover:opacity-80 px-2 py-0.5"
            style={{ color: palette.goldPrimary }}
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 w-full pb-10">
        {books.length === 0 ? (
          /* Estado Vazio */
          <div className="flex flex-col items-center justify-center p-8 mt-10 text-center max-w-lg mx-auto">
            <div
              className="p-5 rounded-full mb-4 shadow-xl border"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                borderColor: `${palette.goldPrimary}50`,
                color: palette.goldPrimary,
              }}
            >
              <BookOpen size={52} />
            </div>

            <h3
              className="font-serif font-bold text-2xl leading-relaxed mb-2"
              style={{ color: palette.textOnWood }}
            >
              {statusTab === 'todos' || statusTab === 'meus_livros'
                ? 'Nenhum livro nesta estante'
                : statusTab === 'lido'
                ? 'Nenhum livro lido correspondente aos filtros'
                : 'Nenhum livro na lista Quero Ler'}
            </h3>

            <p
              className="font-serif text-base leading-relaxed mb-6 opacity-85"
              style={{ color: palette.textSecondaryOnWood }}
            >
              {statusTab === 'todos' || statusTab === 'meus_livros'
                ? 'Sua estante reúne seus livros físicos e e-books digitais em um só lugar.'
                : statusTab === 'lido'
                ? 'Registre suas leituras finalizadas com avaliação e data.'
                : 'Adicione livros que você deseja ler em breve.'}
            </p>

            <WoodShelf palette={palette} className="mb-6 w-full" />

            <button
              type="button"
              onClick={onAddBookClick}
              className="px-6 py-3.5 rounded-xl font-serif font-bold text-base shadow-xl flex items-center gap-2 cursor-pointer hover:brightness-105 active:scale-95 transition-transform"
              style={{
                backgroundColor: palette.goldPrimary,
                color: palette.textOnGold,
              }}
            >
              <Plus size={22} />
              {statusTab === 'todos' || statusTab === 'meus_livros'
                ? 'Adicionar livro'
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
                shelfBooks.length === 1 ? '1 título' : `${shelfBooks.length} títulos`;

              return (
                <div key={label} className="w-full flex flex-col">
                  {/* Livros em pé sobre a prateleira */}
                  <div className="w-full overflow-x-auto px-6 flex items-end gap-6 pb-0 pt-3 scrollbar-thin">
                    {shelfBooks.map((book) => {
                      return (
                        <div
                          key={book.id}
                          className="flex flex-col items-center flex-shrink-0 group"
                        >
                          <BookCoverView
                            palette={palette}
                            book={book}
                            title={book.titulo}
                            author={book.autores[0]}
                            coverUrl={book.capaUrl}
                            width={108}
                            height={160}
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
          /* Visualização em Lista (Cartões de Papel Envelhecido com Letras Maiores) */
          <div className="px-4 py-4 flex flex-col gap-3.5 max-w-3xl mx-auto w-full">
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
                <div className="flex items-center gap-4">
                  <BookCoverView
                    palette={palette}
                    book={book}
                    compact={true}
                    title={book.titulo}
                    author={book.autores[0]}
                    coverUrl={book.capaUrl}
                    width={64}
                    height={96}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="font-serif font-bold text-lg sm:text-xl leading-snug line-clamp-2"
                        style={{ color: palette.textOnPaper }}
                      >
                        {book.titulo}
                      </h3>

                      {/* Selo de formato e posse */}
                      <div className="flex items-center gap-1 shrink-0">
                        {book.formato === 'ebook' ? (
                          <span
                            className="text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 bg-blue-50 text-blue-800 border-blue-300"
                            title="Formato E-book digital"
                          >
                            <Tablet size={12} />
                            E-book
                          </span>
                        ) : book.tenho_fisico ? (
                          <span
                            className="text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1"
                            style={{
                              backgroundColor: `${palette.goldPrimary}25`,
                              borderColor: palette.goldPrimary,
                              color: palette.woodBorder,
                            }}
                            title="Exemplar físico em casa"
                          >
                            <Library size={12} />
                            Físico
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p
                      className="text-sm truncate mt-1 font-serif font-medium"
                      style={{ color: palette.textSecondaryOnPaper }}
                    >
                      {book.autores.join(', ') || 'Autor desconhecido'} ·{' '}
                      {book.generos[0] || 'Geral'}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-1.5 border-t border-black/10">
                      {statusTab === 'lido' || book.status_leitura === 'lido' ? (
                        <>
                          <StarRatingBar
                            palette={palette}
                            rating={book.nota}
                            starSize={16}
                            showLabel={true}
                          />
                          <span
                            className="font-serif font-bold text-sm"
                            style={{ color: palette.woodBorder }}
                          >
                            {book.anoLeitura != null
                              ? `${book.mesLeitura ? book.mesLeitura + '/' : ''}${book.anoLeitura}`
                              : 'Sem data'}
                          </span>
                        </>
                      ) : (
                        <div className="w-full flex items-center justify-between">
                          <span
                            className="font-serif font-bold text-xs sm:text-sm px-3 py-1 rounded-full border flex items-center gap-1.5"
                            style={{
                              backgroundColor:
                                book.status_leitura === 'quero_ler'
                                  ? '#3b82f615'
                                  : `${palette.goldPrimary}15`,
                              borderColor:
                                book.status_leitura === 'quero_ler'
                                  ? '#3b82f660'
                                  : `${palette.goldPrimary}60`,
                              color:
                                book.status_leitura === 'quero_ler'
                                  ? '#1e40af'
                                  : palette.woodBorder,
                            }}
                          >
                            {book.status_leitura === 'quero_ler' ? (
                              <>
                                <Bookmark size={13} /> Quero Ler
                              </>
                            ) : (
                              'No acervo pessoal'
                            )}
                          </span>

                          <button
                            type="button"
                            className="font-serif font-bold text-xs sm:text-sm hover:underline cursor-pointer"
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
        className="fixed right-5 bottom-20 z-40 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl cursor-pointer hover:scale-105 active:scale-95 transition-transform"
        style={{
          backgroundColor: palette.goldPrimary,
          color: palette.textOnGold,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}
        title="Adicionar livro à estante"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>
    </div>
  );
};
