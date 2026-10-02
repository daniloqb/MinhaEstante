import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Book,
  BookStatus,
  ViewMode,
  GroupByMode,
  SortOption,
  SearchResultBook,
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

// Screens
import { HomeScreen } from './screens/HomeScreen';
import { BookDetailScreen } from './screens/BookDetailScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ManualBookScreen } from './screens/ManualBookScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsBackupScreen } from './screens/SettingsBackupScreen';

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

  // Shelf Filtering State
  const [statusTab, setStatusTab] = useState<BookStatus>('lido');
  const [sortBy, setSortBy] = useState<SortOption>('DATA_LEITURA');
  const [textQuery, setTextQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedRatingMin, setSelectedRatingMin] = useState<number | null>(null);

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
    },
    [books, selectedBookDetail]
  );

  const handleToggleStatus = useCallback(
    (book: Book) => {
      const nextStatus: BookStatus = book.status === 'lido' ? 'quero_ler' : 'lido';
      const updated: Book = {
        ...book,
        status: nextStatus,
        dataAtualizacao: Date.now(),
      };
      handleSaveBook(updated);
    },
    [handleSaveBook]
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

  // Add searched book with duplicate detection
  const handleSelectBookToAdd = (searchedBook: SearchResultBook) => {
    const existing = BookStorage.findPotentialDuplicate(
      searchedBook.isbn13,
      searchedBook.isbn10,
      searchedBook.titulo,
      books
    );

    if (existing) {
      setDuplicateConflict({ newBook: searchedBook, existingBook: existing });
    } else {
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
        status: 'lido',
        anoLeitura: new Date().getFullYear(),
        mesLeitura: new Date().getMonth() + 1,
        nota: 10,
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      };
      setEditingBookInModal(newBookEntity);
    }
  };

  // Filter & Sort books
  const filteredBooks = useMemo(() => {
    let list = books.filter((b) => b.status === statusTab);

    // Text query
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

    // Year filter
    if (selectedYear != null) {
      if (selectedYear === -1) {
        list = list.filter((b) => b.anoLeitura == null);
      } else {
        list = list.filter((b) => b.anoLeitura === selectedYear);
      }
    }

    // Genre filter
    if (selectedGenre) {
      list = list.filter((b) =>
        b.generos.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())
      );
    }

    // Rating filter
    if (selectedRatingMin != null) {
      list = list.filter((b) => (b.nota ?? -1) >= selectedRatingMin);
    }

    // Sorting
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'DATA_LEITURA': {
          const yearDiff = (b.anoLeitura ?? -1) - (a.anoLeitura ?? -1);
          if (yearDiff !== 0) return yearDiff;
          const monthDiff = (b.mesLeitura ?? -1) - (a.mesLeitura ?? -1);
          if (monthDiff !== 0) return monthDiff;
          return b.dataCadastro - a.dataCadastro;
        }
        case 'TITULO':
          return a.titulo.localeCompare(b.titulo, 'pt-BR');
        case 'AUTOR':
          return (a.autores[0] || '').localeCompare(b.autores[0] || '', 'pt-BR');
        case 'NOTA':
          return (b.nota ?? -1) - (a.nota ?? -1);
        case 'DATA_CADASTRO':
          return b.dataCadastro - a.dataCadastro;
        default:
          return 0;
      }
    });

    return list;
  }, [books, statusTab, textQuery, selectedYear, selectedGenre, selectedRatingMin, sortBy]);

  // Computed Stats
  const stats = useMemo(() => BookStorage.computeStats(books), [books]);

  const clearFilters = () => {
    setTextQuery('');
    setSelectedYear(null);
    setSelectedGenre(null);
    setSelectedRatingMin(null);
  };

  // Esc key closes modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickActionBook) setQuickActionBook(null);
        else if (duplicateConflict) setDuplicateConflict(null);
        else if (isFilterModalOpen) setIsFilterModalOpen(false);
        else if (editingBookInModal) setEditingBookInModal(null);
        else if (selectedBookDetail) setSelectedBookDetail(null);
        else if (isManualRegisterOpen) setIsManualRegisterOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    quickActionBook,
    duplicateConflict,
    isFilterModalOpen,
    editingBookInModal,
    selectedBookDetail,
    isManualRegisterOpen,
  ]);

  return (
    <WoodBackground palette={palette}>
      {/* Diálogo de Conflito de Duplicata */}
      <DuplicateConflictModal
        palette={palette}
        conflict={duplicateConflict}
        onDismiss={() => setDuplicateConflict(null)}
        onOpenExisting={(existing) => {
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
            status: 'lido',
            anoLeitura: new Date().getFullYear(),
            mesLeitura: new Date().getMonth() + 1,
            nota: 10,
            dataCadastro: Date.now(),
            dataAtualizacao: Date.now(),
          };
          setEditingBookInModal(newBookEntity);
        }}
      />

      {/* Ações Rápidas em Livro */}
      <QuickActionModal
        palette={palette}
        book={quickActionBook}
        onDismiss={() => setQuickActionBook(null)}
        onViewDetails={(b) => setSelectedBookDetail(b)}
        onEdit={(b) => setEditingBookInModal(b)}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteBook}
      />

      {/* Modal de Filtros Completos */}
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
        onClearFilters={clearFilters}
      />

      {/* Modal de Registro & Edição de Leitura */}
      <BookEditModal
        palette={palette}
        book={editingBookInModal}
        isOpen={Boolean(editingBookInModal)}
        onDismiss={() => setEditingBookInModal(null)}
        onSave={handleSaveBook}
      />

      {/* Telas Principais ou Telas Sobrepostas */}
      {selectedBookDetail ? (
        <BookDetailScreen
          palette={palette}
          book={selectedBookDetail}
          onBack={() => setSelectedBookDetail(null)}
          onEdit={() => setEditingBookInModal(selectedBookDetail)}
          onDelete={() => handleDeleteBook(selectedBookDetail)}
          onToggleStatus={() => handleToggleStatus(selectedBookDetail)}
        />
      ) : isManualRegisterOpen ? (
        <ManualBookScreen
          palette={palette}
          onBack={() => setIsManualRegisterOpen(false)}
          onSave={(newBook) => {
            handleSaveBook(newBook);
            setIsManualRegisterOpen(false);
          }}
        />
      ) : (
        <>
          {currentTab === 'ESTANTE' && (
            <HomeScreen
              palette={palette}
              books={filteredBooks}
              statusTab={statusTab}
              onStatusTabChange={setStatusTab}
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
              onAddBookClick={() => setCurrentTab('BUSCAR')}
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
              onOpenManualRegister={() => setIsManualRegisterOpen(true)}
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
                return { count: res.count };
              }}
              onImportJson={(json) => {
                const res = BookStorage.importJson(json, books);
                setBooks(res.updatedBooks);
                return { count: res.count };
              }}
            />
          )}

          {/* Barra de Navegação Inferior Clássica */}
          <NavigationBottomBar
            palette={palette}
            currentTab={currentTab}
            onTabChange={(tab) => setCurrentTab(tab)}
          />
        </>
      )}
    </WoodBackground>
  );
};
