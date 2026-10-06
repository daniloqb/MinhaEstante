import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Book,
  ShelfTab,
  ReadingStatus,
  ViewMode,
  GroupByMode,
  SortOption,
  SearchResultBook,
  isBookInTab,
} from './types/book';
import { getPalette } from './theme/woodTheme';
import { BookStorage } from './services/storage';
import { BookSearchService } from './services/bookSearch';

// Layout & Components
import { WoodBackground } from './components/WoodBackground';
import { NavigationBottomBar, MainTab } from './components/NavigationBottomBar';
import { QuickActionModal } from './components/QuickActionModal';
import { FilterModal } from './components/FilterModal';
import { BookEditModal } from './components/BookEditModal';
import { DuplicateConflictModal } from './components/DuplicateConflictModal';
import { OfflineIndicator } from './components/OfflineIndicator';

// Screens
import { HomeScreen } from './screens/HomeScreen';
import { BookDetailScreen } from './screens/BookDetailScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ManualBookScreen } from './screens/ManualBookScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsBackupScreen } from './screens/SettingsBackupScreen';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  // App Persistent State
  const [books, setBooks] = useState<Book[]>(() => BookStorage.loadBooks());
  const [isLightOak, setIsLightOak] = useState<boolean>(() => BookStorage.loadTheme());
  const [viewMode, setViewMode] = useState<ViewMode>(() => BookStorage.loadViewMode());
  const [groupBy, setGroupBy] = useState<GroupByMode>(() => BookStorage.loadGroupBy());
  const [googleApiKey, setGoogleApiKey] = useState<string>(() => BookStorage.loadApiKey());

  // Navigation State
  const [currentTab, setCurrentTab] = useState<MainTab>('ESTANTE');
  const [selectedBookDetail, setSelectedBookDetail] = useState<Book | null>(null);
  const [isManualRegisterOpen, setIsManualRegisterOpen] = useState(false);

  // Modals & Sheets
  const [editingBookInModal, setEditingBookInModal] = useState<Book | null>(null);
  const [quickActionBook, setQuickActionBook] = useState<Book | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState<{
    newBook: SearchResultBook;
    existingBook: Book;
  } | null>(null);

  // Livro que ficou sem posse e sem status de leitura
  const [orphanConflictBook, setOrphanConflictBook] = useState<Book | null>(null);

  // Shelf Filtering State - Abas independentes: meus_livros | lido | quero_ler
  const [statusTab, setStatusTab] = useState<ShelfTab>('meus_livros');
  const [sortBy, setSortBy] = useState<SortOption>('TITULO');
  const [textQuery, setTextQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedRatingMin, setSelectedRatingMin] = useState<number | null>(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Online Search State
  const [searchInput, setSearchInput] = useState('');
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultBook[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Palette
  const palette = useMemo(() => getPalette(isLightOak), [isLightOak]);

  // Sync theme changes
  const toggleTheme = () => {
    const next = !isLightOak;
    setIsLightOak(next);
    BookStorage.saveTheme(next);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    BookStorage.saveViewMode(mode);
  };

  const handleGroupByChange = (group: GroupByMode) => {
    setGroupBy(group);
    BookStorage.saveGroupBy(group);
  };

  const handleApiKeyChange = (key: string) => {
    setGoogleApiKey(key);
    BookStorage.saveApiKey(key);
  };

  // CRUD
  const handleSaveBook = useCallback(
    (book: Book) => {
      const { updatedBooks, savedId } = BookStorage.saveBook(book, books);
      setBooks(updatedBooks);

      // If currently viewing details of this book, update it
      if (selectedBookDetail && (selectedBookDetail.id === book.id || selectedBookDetail.id === savedId)) {
        const found = updatedBooks.find((b) => b.id === savedId);
        if (found) setSelectedBookDetail(found);
      }

      setEditingBookInModal(null);
    },
    [books, selectedBookDetail]
  );

  const handleDeleteBook = useCallback(
    (book: Book) => {
      const updated = BookStorage.deleteBook(book.id, books);
      setBooks(updated);
      if (selectedBookDetail?.id === book.id) {
        setSelectedBookDetail(null);
      }
      setQuickActionBook(null);
      setOrphanConflictBook(null);
      setToastMessage(`"${book.titulo}" removido da estante.`);
    },
    [books, selectedBookDetail]
  );

  // Alternar formato: Físico vs E-book
  const handleToggleFormato = useCallback(
    (book: Book) => {
      const nextFormat = book.formato === 'ebook' ? 'fisico' : 'ebook';
      const updated: Book = {
        ...book,
        formato: nextFormat,
        tenho_fisico: nextFormat === 'fisico' ? (book.tenho_fisico ?? true) : false,
        dataAtualizacao: Date.now(),
      };
      handleSaveBook(updated);
      if (selectedBookDetail && selectedBookDetail.id === book.id) {
        setSelectedBookDetail(updated);
      }
      setQuickActionBook(null);
      setToastMessage(
        nextFormat === 'ebook'
          ? `"${book.titulo}" movido para a estante de E-books!`
          : `"${book.titulo}" movido para Livros Físicos!`
      );
    },
    [handleSaveBook, selectedBookDetail]
  );

  // Regra de negócio: Posse independente
  const handleTogglePosse = useCallback(
    (book: Book) => {
      const nextTenho = !book.tenho_fisico;

      // Se desmarcar posse e não tem status de leitura e não é ebook: alerta de livro órfão
      if (!nextTenho && book.status_leitura === 'nenhum' && book.formato !== 'ebook') {
        setOrphanConflictBook(book);
        return;
      }

      const updated: Book = {
        ...book,
        tenho_fisico: nextTenho,
        dataAtualizacao: Date.now(),
      };
      handleSaveBook(updated);

      if (selectedBookDetail && selectedBookDetail.id === book.id) {
        setSelectedBookDetail(updated);
      }

      setQuickActionBook(null);
      setToastMessage(
        nextTenho
          ? `"${book.titulo}" adicionado a Livros Físicos (tenho em casa)!`
          : `"${book.titulo}" removido de Livros Físicos!`
      );
    },
    [handleSaveBook, selectedBookDetail]
  );

  // Regra de negócio: Status de leitura independente
  const handleSetStatusLeitura = useCallback(
    (book: Book, targetStatus: ReadingStatus) => {
      // Se remover status de leitura e não tiver posse física: alerta de livro órfão
      if (targetStatus === 'nenhum' && !book.tenho_fisico) {
        setOrphanConflictBook(book);
        return;
      }

      const isNowLido = targetStatus === 'lido';
      const updated: Book = {
        ...book,
        status_leitura: targetStatus,
        anoLeitura: isNowLido ? (book.anoLeitura || new Date().getFullYear()) : book.anoLeitura,
        mesLeitura: isNowLido ? (book.mesLeitura || new Date().getMonth() + 1) : book.mesLeitura,
        dataAtualizacao: Date.now(),
      };
      handleSaveBook(updated);

      if (selectedBookDetail && selectedBookDetail.id === book.id) {
        setSelectedBookDetail(updated);
      }

      setQuickActionBook(null);

      if (targetStatus === 'lido') {
        setToastMessage(`"${book.titulo}" marcado como Lido!`);
      } else if (targetStatus === 'quero_ler') {
        setToastMessage(`"${book.titulo}" marcado como Quero Ler!`);
      } else {
        setToastMessage(`Status de leitura removido de "${book.titulo}".`);
      }
    },
    [handleSaveBook, selectedBookDetail]
  );

  // Search logic
  const performSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      setIsSearchLoading(true);
      setSearchError(null);

      try {
        const res = await BookSearchService.search(trimmed, googleApiKey);
        setSearchResults(res);
        if (res.length === 0) {
          setSearchError(`Nenhum livro encontrado para "${trimmed}"`);
        }
      } catch {
        setSearchError('Erro ao buscar livros na internet. Verifique sua conexão e tente novamente.');
      } finally {
        setIsSearchLoading(false);
      }
    },
    [googleApiKey]
  );

  // Add searched book with duplicate detection and independent status
  const handleSelectBookToAdd = useCallback(
    (searchedBook: SearchResultBook, targetAction: ShelfTab = 'meus_livros') => {
      const existing = BookStorage.findPotentialDuplicate(
        searchedBook.isbn13,
        searchedBook.isbn10,
        searchedBook.titulo,
        searchedBook.autores,
        books
      );

      if (existing) {
        // Já existe: atualiza a posse ou o status sem duplicar!
        if (targetAction === 'meus_livros') {
          const updated: Book = {
            ...existing,
            formato: 'fisico',
            tenho_fisico: true,
            dataAtualizacao: Date.now(),
          };
          handleSaveBook(updated);
          setToastMessage(`"${existing.titulo}" já constava na biblioteca e foi marcado como posse física (Livros Físicos)!`);
          return;
        }

        if (targetAction === 'ebook') {
          const updated: Book = {
            ...existing,
            formato: 'ebook',
            dataAtualizacao: Date.now(),
          };
          handleSaveBook(updated);
          setToastMessage(`"${existing.titulo}" atualizado na estante de E-books!`);
          return;
        }

        if (targetAction === 'lido') {
          // Abre edição para preencher avaliação e data, mantendo a posse do livro
          const forEdit: Book = {
            ...existing,
            status_leitura: 'lido',
            anoLeitura: existing.anoLeitura || new Date().getFullYear(),
            mesLeitura: existing.mesLeitura || (new Date().getMonth() + 1),
          };
          setEditingBookInModal(forEdit);
          return;
        }

        if (targetAction === 'quero_ler') {
          const updated: Book = {
            ...existing,
            status_leitura: 'quero_ler',
            dataAtualizacao: Date.now(),
          };
          handleSaveBook(updated);
          setToastMessage(`"${existing.titulo}" atualizado para Quero Ler!`);
          return;
        }
      }

      // Novo livro
      const now = Date.now();
      const baseBook: Book = {
        id: 0,
        origem: searchedBook.origem,
        idExterno: searchedBook.idExterno,
        titulo: searchedBook.titulo,
        subtitulo: searchedBook.subtitulo,
        autores: searchedBook.autores,
        editora: searchedBook.editora,
        anoPublicacao: searchedBook.anoPublicacao,
        paginas: searchedBook.paginas,
        isbn10: searchedBook.isbn10,
        isbn13: searchedBook.isbn13,
        generos: searchedBook.generos,
        descricao: searchedBook.descricao,
        capaUrl: searchedBook.capaUrl,
        formato: targetAction === 'ebook' ? 'ebook' : 'fisico',
        tenho_fisico: targetAction === 'meus_livros',
        status_leitura: targetAction === 'lido' ? 'lido' : targetAction === 'quero_ler' ? 'quero_ler' : 'nenhum',
        anoLeitura: targetAction === 'lido' ? new Date().getFullYear() : null,
        mesLeitura: targetAction === 'lido' ? new Date().getMonth() + 1 : null,
        nota: targetAction === 'lido' ? 10 : null,
        dataCadastro: now,
        dataAtualizacao: now,
      };

      if (targetAction === 'lido') {
        setEditingBookInModal(baseBook);
      } else {
        const { updatedBooks } = BookStorage.saveBook(baseBook, books);
        setBooks(updatedBooks);
        setToastMessage(
          targetAction === 'meus_livros'
            ? `"${searchedBook.titulo}" adicionado a Livros Físicos!`
            : targetAction === 'ebook'
            ? `"${searchedBook.titulo}" adicionado a E-books!`
            : `"${searchedBook.titulo}" adicionado a Quero Ler!`
        );
      }
    },
    [books, handleSaveBook]
  );

  // Filter & Sort books por consulta de aba e filtros avançados
  const filteredBooks = useMemo(() => {
    // 1. Consulta da aba ativa
    let list = books.filter((b) => isBookInTab(b, statusTab));

    // 2. Filtro de texto
    if (textQuery.trim()) {
      const q = textQuery.toLowerCase().trim();
      list = list.filter((b) => {
        return (
          b.titulo.toLowerCase().includes(q) ||
          b.autores.some((a) => a.toLowerCase().includes(q)) ||
          (b.observacoes && b.observacoes.toLowerCase().includes(q)) ||
          (b.descricao && b.descricao.toLowerCase().includes(q))
        );
      });
    }

    // 3. Filtro por Ano de leitura:
    // Regra: nas abas Quero ler e Meus Livros, livros sem ano de leitura ficam de fora quando o filtro de ano está ativo.
    if (selectedYear != null) {
      list = list.filter((b) => b.anoLeitura === selectedYear);
    }

    // 4. Filtro por gênero
    if (selectedGenre) {
      list = list.filter((b) =>
        b.generos.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())
      );
    }

    // 5. Filtro por nota mínima
    if (selectedRatingMin != null) {
      list = list.filter((b) => b.nota != null && b.nota >= selectedRatingMin);
    }

    // 6. Ordenação
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'DATA_LEITURA': {
          const yearA = a.anoLeitura ?? -1;
          const yearB = b.anoLeitura ?? -1;
          if (yearA !== yearB) return yearB - yearA;
          const monthA = a.mesLeitura ?? -1;
          const monthB = b.mesLeitura ?? -1;
          return monthB - monthA;
        }
        case 'TITULO':
          return a.titulo.localeCompare(b.titulo);
        case 'AUTOR': {
          const authA = a.autores[0] || '';
          const authB = b.autores[0] || '';
          return authA.localeCompare(authB);
        }
        case 'NOTA': {
          const ratingA = a.nota ?? -1;
          const ratingB = b.nota ?? -1;
          return ratingB - ratingA;
        }
        case 'DATA_CADASTRO':
          return b.dataCadastro - a.dataCadastro;
        default:
          return 0;
      }
    });
  }, [books, statusTab, textQuery, selectedYear, selectedGenre, selectedRatingMin, sortBy]);

  // Estatísticas calculadas
  const stats = useMemo(() => BookStorage.calculateStats(books), [books]);

  // Contagens para a barra inferior de navegação
  const physicalCount = useMemo(
    () => books.filter((b) => b.tenho_fisico && b.formato !== 'ebook').length,
    [books]
  );
  const ebookCount = useMemo(
    () => books.filter((b) => b.formato === 'ebook').length,
    [books]
  );

  const handleBottomTabChange = (tab: MainTab) => {
    if (tab === 'EBOOKS') {
      setStatusTab('ebook');
      setCurrentTab('EBOOKS');
    } else if (tab === 'ESTANTE') {
      if (statusTab === 'ebook') {
        setStatusTab('meus_livros');
      }
      setCurrentTab('ESTANTE');
    } else {
      setCurrentTab(tab);
    }
  };

  // Limpar filtros
  const clearFilters = () => {
    setTextQuery('');
    setSelectedYear(null);
    setSelectedGenre(null);
    setSelectedRatingMin(null);
  };

  return (
    <WoodBackground palette={palette} className="relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm sm:max-w-md w-[90%] pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.goldPrimary,
              color: palette.textOnPaper,
            }}
          >
            <CheckCircle2 size={18} style={{ color: palette.goldPrimary }} className="shrink-0" />
            <span className="font-serif text-sm font-semibold leading-tight line-clamp-2">
              {toastMessage}
            </span>
          </div>
        </div>
      )}

      {/* Diálogo para Livro Órfão (tenho_fisico = false e status_leitura = 'nenhum') */}
      {orphanConflictBook && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setOrphanConflictBook(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl border"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3 text-amber-700">
              <AlertTriangle size={24} />
              <h3 className="font-serif font-bold text-xl leading-tight">
                Livro sem lista ativa
              </h3>
            </div>

            <p className="text-sm leading-relaxed mb-6" style={{ color: palette.textOnPaper }}>
              Este livro não está mais em nenhuma lista (não é posse física em casa e não possui status de leitura). Deseja excluí-lo do aplicativo?
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  handleDeleteBook(orphanConflictBook);
                }}
                className="w-full py-2.5 px-4 rounded-lg font-serif font-bold text-sm bg-red-700 text-white cursor-pointer hover:bg-red-800 active:scale-98 transition-colors"
              >
                Excluir livro definitivamente
              </button>

              <button
                type="button"
                onClick={() => {
                  const updated: Book = {
                    ...orphanConflictBook,
                    tenho_fisico: false,
                    status_leitura: 'nenhum',
                    dataAtualizacao: Date.now(),
                  };
                  handleSaveBook(updated);
                  setOrphanConflictBook(null);
                  setToastMessage(`"${orphanConflictBook.titulo}" mantido oculto no arquivo.`);
                }}
                className="w-full py-2.5 px-4 rounded-lg font-serif font-semibold text-sm border cursor-pointer hover:bg-black/5 active:scale-98"
                style={{
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              >
                Manter oculto no arquivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conflito de Livro Duplicado */}
      <DuplicateConflictModal
        palette={palette}
        conflict={duplicateConflict}
        onDismiss={() => setDuplicateConflict(null)}
        onOpenExisting={(existing: Book) => {
          setDuplicateConflict(null);
          setSelectedBookDetail(existing);
        }}
        onAddAnyway={(searchedBook) => {
          setDuplicateConflict(null);
          const newBookEntity: Book = {
            id: 0,
            origem: searchedBook.origem,
            idExterno: searchedBook.idExterno,
            titulo: searchedBook.titulo,
            subtitulo: searchedBook.subtitulo,
            autores: searchedBook.autores,
            editora: searchedBook.editora,
            anoPublicacao: searchedBook.anoPublicacao,
            paginas: searchedBook.paginas,
            isbn10: searchedBook.isbn10,
            isbn13: searchedBook.isbn13,
            generos: searchedBook.generos,
            descricao: searchedBook.descricao,
            capaUrl: searchedBook.capaUrl,
            tenho_fisico: true,
            status_leitura: 'nenhum',
            dataCadastro: Date.now(),
            dataAtualizacao: Date.now(),
          };
          const { updatedBooks } = BookStorage.saveBook(newBookEntity, books);
          setBooks(updatedBooks);
          setToastMessage(`"${searchedBook.titulo}" adicionado a Meus Livros!`);
        }}
      />

      {/* Ações Rápidas em Livro */}
      <QuickActionModal
        palette={palette}
        book={quickActionBook}
        onDismiss={() => setQuickActionBook(null)}
        onViewDetails={(b) => setSelectedBookDetail(b)}
        onEdit={(b) => setEditingBookInModal(b)}
        onTogglePosse={handleTogglePosse}
        onSetStatusLeitura={handleSetStatusLeitura}
        onDelete={handleDeleteBook}
        onToggleFormato={handleToggleFormato}
      />

      {/* Modal de Filtros com Ano de Leitura */}
      <FilterModal
        palette={palette}
        isOpen={isFilterModalOpen}
        onDismiss={() => setIsFilterModalOpen(false)}
        groupBy={groupBy}
        onGroupByChange={handleGroupByChange}
        sortOption={sortBy}
        onSortChange={setSortBy}
        selectedRatingMin={selectedRatingMin}
        onRatingFilterChange={setSelectedRatingMin}
        selectedYear={selectedYear}
        onYearFilterChange={setSelectedYear}
        onClearFilters={clearFilters}
      />

      {/* Modal de Registro & Edição com controles independentes */}
      <BookEditModal
        key={editingBookInModal?.id ?? 'modal'}
        palette={palette}
        book={editingBookInModal}
        isOpen={Boolean(editingBookInModal)}
        onDismiss={() => setEditingBookInModal(null)}
        onSave={handleSaveBook}
        onDelete={handleDeleteBook}
      />

      {/* Telas Principais ou Telas Sobrepostas */}
      {selectedBookDetail ? (
        <BookDetailScreen
          palette={palette}
          book={selectedBookDetail}
          onBack={() => setSelectedBookDetail(null)}
          onEdit={() => setEditingBookInModal(selectedBookDetail)}
          onDelete={() => handleDeleteBook(selectedBookDetail)}
          onTogglePosse={() => handleTogglePosse(selectedBookDetail)}
          onSetStatusLeitura={(status) => handleSetStatusLeitura(selectedBookDetail, status)}
          onUpdateBook={handleSaveBook}
        />
      ) : isManualRegisterOpen ? (
        <ManualBookScreen
          palette={palette}
          initialTab={statusTab}
          onBack={() => setIsManualRegisterOpen(false)}
          onSave={(newBook) => {
            handleSaveBook(newBook);
            setIsManualRegisterOpen(false);
            setToastMessage(`"${newBook.titulo}" salvo com sucesso!`);
          }}
          onDelete={handleDeleteBook}
        />
      ) : (
        <>
          {(currentTab === 'ESTANTE' || currentTab === 'EBOOKS') && (
            <HomeScreen
              palette={palette}
              books={filteredBooks}
              allBooks={books}
              statusTab={statusTab}
              onStatusTabChange={(tab) => {
                setStatusTab(tab);
                if (tab === 'ebook') {
                  setCurrentTab('EBOOKS');
                } else {
                  setCurrentTab('ESTANTE');
                }
              }}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              groupBy={groupBy}
              onGroupByChange={handleGroupByChange}
              sortOption={sortBy}
              onSortChange={setSortBy}
              searchQuery={textQuery}
              onSearchQueryChange={setTextQuery}
              selectedYear={selectedYear}
              onYearFilterChange={setSelectedYear}
              selectedGenre={selectedGenre}
              onGenreFilterChange={setSelectedGenre}
              selectedRatingMin={selectedRatingMin}
              onRatingFilterChange={setSelectedRatingMin}
              onClearFilters={clearFilters}
              onSelectBook={(book) => setSelectedBookDetail(book)}
              onOpenQuickAction={(book) => setQuickActionBook(book)}
              onOpenFiltersModal={() => setIsFilterModalOpen(true)}
              onAddBookClick={() => setIsManualRegisterOpen(true)}
            />
          )}

          {currentTab === 'BUSCAR' && (
            <SearchScreen
              palette={palette}
              searchQuery={searchInput}
              onQueryChange={setSearchInput}
              onSearch={performSearch}
              isLoading={isSearchLoading}
              results={searchResults}
              errorMessage={searchError}
              onSelectBookToAdd={handleSelectBookToAdd}
              onSelectBookDetail={(book) => setSelectedBookDetail(book)}
              onOpenManualRegister={() => setIsManualRegisterOpen(true)}
              userBooks={books}
            />
          )}

          {currentTab === 'ESTATISTICAS' && (
            <StatsScreen palette={palette} stats={stats} />
          )}

          {currentTab === 'CONFIG' && (
            <SettingsBackupScreen
              palette={palette}
              currentViewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              currentGroupBy={groupBy}
              onGroupByChange={handleGroupByChange}
              isLightOak={isLightOak}
              onToggleTheme={toggleTheme}
              apiKey={googleApiKey}
              onApiKeyChange={handleApiKeyChange}
              onExportCsv={() => BookStorage.exportCsv(books)}
              onExportJson={() => BookStorage.exportJson(books)}
              onImportCsv={(csv) => {
                const res = BookStorage.importCsv(csv, books);
                setBooks(res.updatedBooks);
                setToastMessage(`${res.count} livros importados com sucesso!`);
                return { count: res.count };
              }}
              onImportJson={(json) => {
                const res = BookStorage.importJson(json, books);
                setBooks(res.updatedBooks);
                setToastMessage(`${res.count} livros importados com sucesso!`);
                return { count: res.count };
              }}
              books={books}
              onUpdateAllBooks={(updated) => {
                BookStorage.saveAllBooks(updated);
                setBooks(updated);
              }}
            />
          )}

          {/* Barra de Navegação Inferior Clássica */}
          <NavigationBottomBar
            palette={palette}
            currentTab={
              currentTab === 'ESTANTE' || currentTab === 'EBOOKS'
                ? statusTab === 'ebook'
                  ? 'EBOOKS'
                  : 'ESTANTE'
                : currentTab
            }
            onTabChange={handleBottomTabChange}
            physicalCount={physicalCount}
            ebookCount={ebookCount}
          />
        </>
      )}

      {/* Indicador de Conexão Offline */}
      <OfflineIndicator />
    </WoodBackground>
  );
};
