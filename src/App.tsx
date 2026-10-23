import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Book,
  ShelfTab,
  ReadingStatus,
  ViewMode,
  GroupByMode,
  SortOption,
  SearchResultBook,
  BookLoan,
  isBookInTab,
} from './types/book';
import { getPalette } from './theme/woodTheme';
import { BookStorage } from './services/storage';
import { BookDiscoveryEngine, ProviderStatus } from './features/book-discovery';
import { NativeService } from './services/nativeService';

// Layout & Components
import { WoodBackground } from './components/WoodBackground';
import { NavigationBottomBar, MainTab } from './components/NavigationBottomBar';
import { QuickActionModal } from './components/QuickActionModal';
import { FilterModal } from './components/FilterModal';
import { BookEditModal } from './components/BookEditModal';
import { LoanModal } from './components/LoanModal';
import { DuplicateConflictModal } from './components/DuplicateConflictModal';
import { OfflineIndicator } from './components/OfflineIndicator';

// Screens
import { HomeScreen } from './screens/HomeScreen';
import { LoansScreen } from './screens/LoansScreen';
import { BookDetailScreen } from './screens/BookDetailScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ManualBookScreen } from './screens/ManualBookScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsBackupScreen } from './screens/SettingsBackupScreen';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  // App Persistent State (gerenciado via SQLite nativo)
  const [books, setBooks] = useState<Book[]>([]);
  const [isDbReady, setIsDbReady] = useState<boolean>(false);
  const [isLightOak, setIsLightOak] = useState<boolean>(() => BookStorage.loadTheme());
  const [viewMode, setViewMode] = useState<ViewMode>(() => BookStorage.loadViewMode());
  const [groupBy, setGroupBy] = useState<GroupByMode>(() => BookStorage.loadGroupBy());
  const [googleBooksApiKey, setGoogleBooksApiKey] = useState<string>(() => BookStorage.loadGoogleBooksApiKey());
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => BookStorage.loadGeminiApiKey());
  const [googleApiKey, setGoogleApiKey] = useState<string>(() => BookStorage.loadApiKey());

  // Navigation State
  const [currentTab, setCurrentTab] = useState<MainTab>('ESTANTE');
  const [selectedBookDetail, setSelectedBookDetail] = useState<Book | null>(null);
  const [isManualRegisterOpen, setIsManualRegisterOpen] = useState(false);

  // Modals & Sheets
  const [editingBookInModal, setEditingBookInModal] = useState<Book | null>(null);
  const [quickActionBook, setQuickActionBook] = useState<Book | null>(null);
  const [loanModalBook, setLoanModalBook] = useState<Book | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState<{
    newBook: SearchResultBook;
    existingBook: Book;
  } | null>(null);

  // Livro que ficou sem posse e sem status de leitura
  const [orphanConflictBook, setOrphanConflictBook] = useState<Book | null>(null);

  // Shelf Filtering State - Estante unificada (Todos / Lidos / Quero Ler) e formato
  const [statusTab, setStatusTab] = useState<ShelfTab>('todos');
  const [selectedFormat, setSelectedFormat] = useState<'fisico' | 'ebook' | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(() => BookStorage.loadSortBy());
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

  // Navegação Histórica para Botão Voltar do Smartphone (Android & Navegador)
  const tabStackRef = React.useRef<MainTab[]>(['ESTANTE']);
  const historyDepthRef = React.useRef<number>(0);
  const navStateRef = React.useRef({
    orphanConflictBook,
    duplicateConflict,
    loanModalBook,
    editingBookInModal,
    quickActionBook,
    isFilterModalOpen,
    selectedBookDetail,
    isManualRegisterOpen,
    currentTab,
  });

  navStateRef.current = {
    orphanConflictBook,
    duplicateConflict,
    loanModalBook,
    editingBookInModal,
    quickActionBook,
    isFilterModalOpen,
    selectedBookDetail,
    isManualRegisterOpen,
    currentTab,
  };

  const pushNavState = useCallback((screenName: string, meta: Record<string, any> = {}) => {
    try {
      historyDepthRef.current += 1;
      window.history.pushState(
        { screen: screenName, depth: historyDepthRef.current, time: Date.now(), ...meta },
        '',
        `#${screenName}`
      );
    } catch {
      // ignore
    }
  }, []);

  const closeOverlayOrBack = useCallback((closeAction: () => void) => {
    closeAction();
  }, []);

  // Função central de navegação ao pressionar voltar no smartphone (Android / navegador)
  const handleNativeBack = useCallback((): boolean => {
    const s = navStateRef.current;

    // 1. Fechar Modais e Diálogos em ordem de profundidade
    if (s.orphanConflictBook) {
      setOrphanConflictBook(null);
      return true;
    }
    if (s.duplicateConflict) {
      setDuplicateConflict(null);
      return true;
    }
    if (s.loanModalBook) {
      setLoanModalBook(null);
      return true;
    }
    if (s.editingBookInModal) {
      setEditingBookInModal(null);
      return true;
    }
    if (s.quickActionBook) {
      setQuickActionBook(null);
      return true;
    }
    if (s.isFilterModalOpen) {
      setIsFilterModalOpen(false);
      return true;
    }

    // 2. Fechar Telas Sobrepostas (Detalhes e Cadastro Manual)
    if (s.selectedBookDetail) {
      setSelectedBookDetail(null);
      return true;
    }
    if (s.isManualRegisterOpen) {
      setIsManualRegisterOpen(false);
      return true;
    }

    // 3. Voltar para a aba anterior até chegar na tela principal (ESTANTE)
    if (tabStackRef.current.length > 1) {
      tabStackRef.current.pop();
      const prevTab = tabStackRef.current[tabStackRef.current.length - 1] || 'ESTANTE';
      setCurrentTab(prevTab);
      return true;
    }

    if (s.currentTab !== 'ESTANTE') {
      tabStackRef.current = ['ESTANTE'];
      setCurrentTab('ESTANTE');
      return true;
    }

    // 4. Já está na tela principal (ESTANTE) sem nada sobreposto -> sinaliza que pode sair
    return false;
  }, []);

  useEffect(() => {
    try {
      historyDepthRef.current = 0;
      window.history.replaceState({ screen: 'root', tab: 'ESTANTE', depth: 0 }, '', '#estante');
    } catch {
      // ignore
    }

    // Inicializa configurações nativas do Capacitor (StatusBar, Keyboard)
    NativeService.initNativeEnvironment();

    // Registra listener nativo oficial do Capacitor para o botão Voltar físico
    const unregisterCapacitorBack = NativeService.registerBackButton(handleNativeBack);

    // Registra manipulador de compatibilidade chamado por WebViews legadas
    (window as any).onAndroidBackPressed = handleNativeBack;

    const handlePopState = (e: PopStateEvent) => {
      if (e.state && typeof e.state.depth === 'number') {
        historyDepthRef.current = e.state.depth;
      } else {
        historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);
      }
      handleNativeBack();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      unregisterCapacitorBack();
      delete (window as any).onAndroidBackPressed;
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleNativeBack]);

  const handleOpenBookDetail = useCallback((book: Book) => {
    setSelectedBookDetail(book);
    pushNavState('detail');
  }, [pushNavState]);

  const handleOpenManualRegister = useCallback(() => {
    setIsManualRegisterOpen(true);
    pushNavState('manual');
  }, [pushNavState]);

  const handleOpenEditModal = useCallback((book: Book | null) => {
    setEditingBookInModal(book);
    if (book) pushNavState('edit');
  }, [pushNavState]);

  const handleOpenQuickAction = useCallback((book: Book | null) => {
    setQuickActionBook(book);
    if (book) pushNavState('quick');
  }, [pushNavState]);

  const handleOpenLoanModal = useCallback((book: Book | null) => {
    setLoanModalBook(book);
    if (book) pushNavState('loan');
  }, [pushNavState]);

  const handleOpenFilterModal = useCallback((open: boolean) => {
    setIsFilterModalOpen(open);
    if (open) pushNavState('filter');
  }, [pushNavState]);

  // Online Search State
  const [searchInput, setSearchInput] = useState('');
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isLoadingMoreSearch, setIsLoadingMoreSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultBook[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [hasMoreSearch, setHasMoreSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);

  // Palette
  const palette = useMemo(() => getPalette(isLightOak), [isLightOak]);

  // Sync theme changes
  const toggleTheme = () => {
    const next = !isLightOak;
    setIsLightOak(next);
    BookStorage.saveTheme(next);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setViewMode(mode);
    BookStorage.saveViewMode(mode);
  };

  const handleGroupByChange = (group: GroupByMode) => {
    setGroupBy(group);
    BookStorage.saveGroupBy(group);
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    BookStorage.saveSortBy(sort);
  };

  const handleGoogleBooksApiKeyChange = (key: string) => {
    setGoogleBooksApiKey(key);
    BookStorage.saveGoogleBooksApiKey(key);
  };

  const handleGeminiApiKeyChange = (key: string) => {
    setGeminiApiKey(key);
    setGoogleApiKey(key);
    BookStorage.saveGeminiApiKey(key);
  };

  const handleApiKeyChange = (key: string) => {
    handleGeminiApiKeyChange(key);
  };

  // Inicialização assíncrona do banco SQLite nativo e carga inicial da biblioteca
  useEffect(() => {
    let active = true;
    const initializeDatabase = async () => {
      try {
        const loadedBooks = await BookStorage.loadBooksFromDatabase();
        if (active) {
          setBooks(loadedBooks);
          setIsDbReady(true);
        }
      } catch (err) {
        console.error('Falha ao inicializar banco de dados SQLite:', err);
        if (active) {
          setIsDbReady(true);
          setToastMessage('Falha ao conectar com o banco de dados local.');
        }
      }
    };
    initializeDatabase();
    return () => {
      active = false;
    };
  }, []);

  // CRUD Assíncrono com SQLite Nativo
  const handleSaveBook = useCallback(
    async (book: Book) => {
      try {
        const saved = await BookStorage.saveBookToDatabase(book);
        setBooks((prev) => {
          const index = prev.findIndex((b) => b.id === saved.id || (book.id && b.id === book.id));
          if (index >= 0) {
            const next = [...prev];
            next[index] = saved;
            return next;
          } else {
            return [saved, ...prev];
          }
        });

        if (selectedBookDetail && (selectedBookDetail.id === book.id || selectedBookDetail.id === saved.id)) {
          setSelectedBookDetail(saved);
        }

        setEditingBookInModal(null);
        return saved;
      } catch (err) {
        console.error('Falha ao persistir livro no SQLite:', err);
        setToastMessage('Erro ao salvar livro no banco de dados.');
        throw err;
      }
    },
    [selectedBookDetail]
  );

  const handleDeleteBook = useCallback(
    async (book: Book) => {
      try {
        await BookStorage.deleteBookFromDatabase(book.id);
        setBooks((prev) => prev.filter((b) => b.id !== book.id));
        if (selectedBookDetail?.id === book.id) {
          setSelectedBookDetail(null);
        }
        setQuickActionBook(null);
        setOrphanConflictBook(null);
        setToastMessage(`"${book.titulo}" removido da estante.`);
      } catch (err) {
        console.error('Falha ao excluir livro do SQLite:', err);
        setToastMessage('Erro ao excluir livro do banco de dados.');
      }
    },
    [selectedBookDetail]
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
    async (book: Book, targetStatus: ReadingStatus) => {
      // Se remover status de leitura e não tiver posse física: alerta de livro órfão
      if (targetStatus === 'nenhum' && !book.tenho_fisico && book.formato !== 'ebook') {
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

      try {
        const saved = await handleSaveBook(updated);

        if (selectedBookDetail && (selectedBookDetail.id === book.id || selectedBookDetail.id === saved.id || selectedBookDetail.id === 0)) {
          setSelectedBookDetail(saved);
        }

        setQuickActionBook(null);

        if (targetStatus === 'lido') {
          setToastMessage(`"${saved.titulo}" marcado como Lido!`);
          handleOpenEditModal(saved);
        } else if (targetStatus === 'quero_ler') {
          setToastMessage(`"${saved.titulo}" marcado como Quero Ler!`);
        } else {
          setToastMessage(`Status de leitura removido de "${saved.titulo}".`);
        }
      } catch (err) {
        console.error('Erro ao atualizar status de leitura no SQLite:', err);
      }
    },
    [handleSaveBook, selectedBookDetail, handleOpenEditModal]
  );

  // Regra de negócio: Salvar empréstimo para terceiro
  const handleSaveLoan = useCallback(
    (book: Book, loan: BookLoan) => {
      const updated: Book = {
        ...book,
        emprestimo: {
          ...loan,
          devolvido: false,
        },
        dataAtualizacao: Date.now(),
      };
      handleSaveBook(updated);
      setToastMessage(`"${book.titulo}" marcado como emprestado para ${loan.nomePessoa}!`);
    },
    [handleSaveBook]
  );

  // Regra de negócio: Registrar devolução de livro emprestado
  const handleReturnLoan = useCallback(
    (book: Book) => {
      if (!book.emprestimo) return;
      const todayIso = new Date().toISOString().slice(0, 10);
      const updated: Book = {
        ...book,
        emprestimo: {
          ...book.emprestimo,
          devolvido: true,
          dataDevolucaoEfetiva: todayIso,
        },
        dataAtualizacao: Date.now(),
      };
      handleSaveBook(updated);
      setToastMessage(`"${book.titulo}" marcado como devolvido!`);
    },
    [handleSaveBook]
  );

  const searchRequestIdRef = React.useRef<number>(0);
  const searchAbortControllerRef = React.useRef<AbortController | null>(null);

  const handleCancelSearch = useCallback(() => {
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }
    setIsSearchLoading(false);
    setIsLoadingMoreSearch(false);
    searchRequestIdRef.current++;
  }, []);

  // Search logic: busca bibliográfica mundial via BookDiscoveryEngine com suporte a paginação agregada
  const performSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      // Aborta qualquer busca em andamento anterior
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;

      setIsSearchLoading(true);
      setSearchError(null);
      const reqId = ++searchRequestIdRef.current;

      try {
        const engine = BookDiscoveryEngine.getInstance({
          googleBooksApiKey,
          geminiApiKey: geminiApiKey || googleApiKey,
        });

        const response = await engine.search(trimmed, undefined, controller.signal);

        if (searchRequestIdRef.current === reqId && !controller.signal.aborted) {
          setSearchResults(response.books);
          setSearchCursor(response.nextCursor);
          setHasMoreSearch(response.hasMore);
          setProviderStatuses(response.providerStatuses);
          setIsSearchLoading(false);

          if (response.books.length === 0) {
            const googleStatus = response.providerStatuses.find((p) => p.providerId === 'google');
            if (googleStatus?.httpStatus === 429) {
              setSearchError(
                'Limite de requisições anônimas do Google Books atingido (HTTP 429). Configure sua Chave de API Google Books nas Configurações para consultas sem limite.'
              );
            } else if (googleStatus?.httpStatus === 401 || googleStatus?.httpStatus === 403) {
              setSearchError(
                `Chave de API do Google Books inválida ou sem permissão (HTTP ${googleStatus.httpStatus}). Verifique sua chave nas Configurações.`
              );
            } else {
              setSearchError(`Nenhum livro encontrado para "${trimmed}"`);
            }
          } else {
            setSearchError(null);
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) {
          if (searchRequestIdRef.current === reqId) {
            setIsSearchLoading(false);
          }
          return;
        }
        if (searchRequestIdRef.current === reqId) {
          setSearchError('Erro ao buscar livros na internet. Verifique sua conexão e tente novamente.');
          setIsSearchLoading(false);
        }
      } finally {
        if (searchAbortControllerRef.current === controller) {
          searchAbortControllerRef.current = null;
        }
      }
    },
    [googleBooksApiKey, geminiApiKey, googleApiKey]
  );

  const handleLoadMoreSearch = useCallback(async () => {
    if (!hasMoreSearch || !searchCursor || isSearchLoading || isLoadingMoreSearch || !searchInput.trim()) {
      return;
    }

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    setIsLoadingMoreSearch(true);
    try {
      const engine = BookDiscoveryEngine.getInstance({
        googleBooksApiKey,
        geminiApiKey: geminiApiKey || googleApiKey,
      });

      const response = await engine.search(searchInput.trim(), searchCursor, controller.signal);

      if (!controller.signal.aborted) {
        setSearchResults((prev) => [...prev, ...response.books]);
        setSearchCursor(response.nextCursor);
        setHasMoreSearch(response.hasMore);
        setProviderStatuses(response.providerStatuses);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      console.warn('Erro ao carregar mais livros:', err);
    } finally {
      setIsLoadingMoreSearch(false);
      if (searchAbortControllerRef.current === controller) {
        searchAbortControllerRef.current = null;
      }
    }
  }, [hasMoreSearch, searchCursor, isSearchLoading, isLoadingMoreSearch, searchInput, googleBooksApiKey, geminiApiKey, googleApiKey]);

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
          // Persiste como lido no SQLite e abre edição para preencher avaliação e data
          const updated: Book = {
            ...existing,
            status_leitura: 'lido',
            anoLeitura: existing.anoLeitura || new Date().getFullYear(),
            mesLeitura: existing.mesLeitura || (new Date().getMonth() + 1),
            dataAtualizacao: Date.now(),
          };
          handleSaveBook(updated)
            .then((saved) => {
              setToastMessage(`"${saved.titulo}" marcado como Lido!`);
              handleOpenEditModal(saved);
            })
            .catch((err) => {
              console.error('Erro ao atualizar livro lido no SQLite:', err);
            });
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
        handleSaveBook(baseBook)
          .then((saved) => {
            setToastMessage(`"${saved.titulo}" salvo e marcado como Lido!`);
            handleOpenEditModal(saved);
          })
          .catch((err) => {
            console.error('Erro ao adicionar livro da busca como lido no SQLite:', err);
          });
      } else {
        handleSaveBook(baseBook).then(() => {
          setToastMessage(
            targetAction === 'meus_livros'
              ? `"${searchedBook.titulo}" adicionado a Livros Físicos!`
              : targetAction === 'ebook'
              ? `"${searchedBook.titulo}" adicionado a E-books!`
              : `"${searchedBook.titulo}" adicionado a Quero Ler!`
          );
        }).catch((err) => {
          console.error('Erro ao adicionar livro da busca no SQLite:', err);
        });
      }
    },
    [books, handleOpenEditModal, handleSaveBook]
  );

  // Filter & Sort books por consulta de aba e filtros avançados
  const filteredBooks = useMemo(() => {
    // 1. Consulta da aba ativa (Todos / Lidos / Quero Ler)
    let list = books.filter((b) => isBookInTab(b, statusTab));

    // 1.1 Filtro por Formato da Obra (Livros Físicos vs E-books)
    if (selectedFormat === 'fisico') {
      list = list.filter((b) => b.formato !== 'ebook');
    } else if (selectedFormat === 'ebook') {
      list = list.filter((b) => b.formato === 'ebook');
    }

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
          const monthA =
            a.mesLeitura != null && a.mesLeitura >= 1 && a.mesLeitura <= 12
              ? a.mesLeitura
              : null;
          const monthB =
            b.mesLeitura != null && b.mesLeitura >= 1 && b.mesLeitura <= 12
              ? b.mesLeitura
              : null;
          const yearA = a.anoLeitura != null ? a.anoLeitura : null;
          const yearB = b.anoLeitura != null ? b.anoLeitura : null;

          const hasValidA = monthA != null && yearA != null;
          const hasValidB = monthB != null && yearB != null;

          if (hasValidA && !hasValidB) return -1;
          if (!hasValidA && hasValidB) return 1;
          if (!hasValidA && !hasValidB) return 0;

          // Critério principal: Mês em ordem crescente (Janeiro=1 a Dezembro=12)
          if (monthA !== monthB) {
            return monthA! - monthB!;
          }

          // Critério secundário: Ano em ordem crescente (mais antigo ao mais recente)
          if (yearA !== yearB) {
            return yearA! - yearB!;
          }

          // Ordem estável para mesmo mês e ano
          return 0;
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
  }, [books, statusTab, selectedFormat, textQuery, selectedYear, selectedGenre, selectedRatingMin, sortBy]);

  // Estatísticas calculadas
  const stats = useMemo(() => BookStorage.calculateStats(books), [books]);

  // Contagens para a barra inferior de navegação
  const activeBorrowedCount = useMemo(
    () => books.filter((b) => b.emprestimo && !b.emprestimo.devolvido).length,
    [books]
  );

  const handleBottomTabChange = useCallback((tab: MainTab) => {
    if (tab === currentTab) return;
    if (tab === 'ESTANTE') {
      tabStackRef.current = ['ESTANTE'];
      setCurrentTab('ESTANTE');
    } else {
      const currentStack = tabStackRef.current.filter((t) => t !== tab);
      currentStack.push(tab);
      tabStackRef.current = currentStack;
      setCurrentTab(tab);
    }
    pushNavState(`tab-${tab}`, { tab });
  }, [currentTab, pushNavState]);

  // Limpar filtros (restaura padrões: Autor, Data de Leitura, Todos os formatos, Todas as avaliações)
  const clearFilters = () => {
    setTextQuery('');
    setSelectedYear(null);
    setSelectedGenre(null);
    setSelectedRatingMin(null);
    setSelectedFormat(null);
    setGroupBy('AUTOR');
    BookStorage.saveGroupBy('AUTOR');
    setSortBy('DATA_LEITURA');
    BookStorage.saveSortBy('DATA_LEITURA');
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
        onDismiss={() => closeOverlayOrBack(() => setDuplicateConflict(null))}
        onOpenExisting={(existing: Book) => {
          setDuplicateConflict(null);
          handleOpenBookDetail(existing);
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
          handleSaveBook(newBookEntity).then(() => {
            setToastMessage(`"${searchedBook.titulo}" adicionado a Meus Livros!`);
          }).catch((err) => {
            console.error('Erro ao adicionar livro pós-conflito no SQLite:', err);
          });
        }}
      />

      {/* Ações Rápidas em Livro */}
      <QuickActionModal
        palette={palette}
        book={quickActionBook}
        onDismiss={() => closeOverlayOrBack(() => setQuickActionBook(null))}
        onViewDetails={(b) => handleOpenBookDetail(b)}
        onEdit={(b) => handleOpenEditModal(b)}
        onTogglePosse={handleTogglePosse}
        onSetStatusLeitura={handleSetStatusLeitura}
        onDelete={handleDeleteBook}
        onToggleFormato={handleToggleFormato}
        onOpenLoanModal={(b) => handleOpenLoanModal(b)}
      />

      {/* Modal de Filtros com Formato da Obra e Ano de Leitura */}
      <FilterModal
        palette={palette}
        isOpen={isFilterModalOpen}
        onDismiss={() => closeOverlayOrBack(() => setIsFilterModalOpen(false))}
        groupBy={groupBy}
        onGroupByChange={handleGroupByChange}
        sortOption={sortBy}
        onSortChange={handleSortChange}
        selectedRatingMin={selectedRatingMin}
        onRatingFilterChange={setSelectedRatingMin}
        selectedYear={selectedYear}
        onYearFilterChange={setSelectedYear}
        selectedFormat={selectedFormat}
        onFormatFilterChange={setSelectedFormat}
        onClearFilters={clearFilters}
      />

      {/* Modal de Empréstimo de Livro para Terceiro */}
      <LoanModal
        palette={palette}
        isOpen={Boolean(loanModalBook)}
        book={loanModalBook}
        onClose={() => closeOverlayOrBack(() => setLoanModalBook(null))}
        onSaveLoan={handleSaveLoan}
        onReturnBook={handleReturnLoan}
      />

      {/* Modal de Registro & Edição com controles independentes */}
      <BookEditModal
        key={editingBookInModal?.id ?? 'modal'}
        palette={palette}
        book={editingBookInModal}
        isOpen={Boolean(editingBookInModal)}
        onDismiss={() => closeOverlayOrBack(() => setEditingBookInModal(null))}
        onSave={handleSaveBook}
        onDelete={handleDeleteBook}
      />

      {/* Telas Principais ou Telas Sobrepostas */}
      {!isDbReady ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 border-4 border-amber-600/30 border-t-amber-500 rounded-full animate-spin mb-4" />
          <p className="font-serif text-sm" style={{ color: palette.textSecondaryOnWood }}>
            Conectando ao banco de dados SQLite...
          </p>
        </div>
      ) : selectedBookDetail ? (
        <BookDetailScreen
          palette={palette}
          book={selectedBookDetail}
          onBack={() => closeOverlayOrBack(() => setSelectedBookDetail(null))}
          onEdit={() => handleOpenEditModal(selectedBookDetail)}
          onDelete={() => handleDeleteBook(selectedBookDetail)}
          onTogglePosse={() => handleTogglePosse(selectedBookDetail)}
          onSetStatusLeitura={(status) => handleSetStatusLeitura(selectedBookDetail, status)}
          onUpdateBook={handleSaveBook}
          onOpenLoanModal={(b) => handleOpenLoanModal(b)}
          onReturnBook={handleReturnLoan}
        />
      ) : isManualRegisterOpen ? (
        <ManualBookScreen
          palette={palette}
          initialTab={statusTab}
          onBack={() => closeOverlayOrBack(() => setIsManualRegisterOpen(false))}
          onSave={(newBook) => {
            handleSaveBook(newBook);
            closeOverlayOrBack(() => setIsManualRegisterOpen(false));
            setToastMessage(`"${newBook.titulo}" salvo com sucesso!`);
          }}
          onDelete={handleDeleteBook}
        />
      ) : (
        <>
          {currentTab === 'ESTANTE' && (
            <HomeScreen
              palette={palette}
              books={filteredBooks}
              allBooks={books}
              statusTab={statusTab}
              onStatusTabChange={(tab) => {
                setStatusTab(tab);
              }}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              groupBy={groupBy}
              onGroupByChange={handleGroupByChange}
              sortOption={sortBy}
              onSortChange={handleSortChange}
              searchQuery={textQuery}
              onSearchQueryChange={setTextQuery}
              selectedYear={selectedYear}
              onYearFilterChange={setSelectedYear}
              selectedGenre={selectedGenre}
              onGenreFilterChange={setSelectedGenre}
              selectedRatingMin={selectedRatingMin}
              onRatingFilterChange={setSelectedRatingMin}
              selectedFormat={selectedFormat}
              onFormatFilterChange={setSelectedFormat}
              onClearFilters={clearFilters}
              onSelectBook={(book) => handleOpenBookDetail(book)}
              onOpenQuickAction={(book) => handleOpenQuickAction(book)}
              onOpenFiltersModal={() => handleOpenFilterModal(true)}
              onAddBookClick={() => handleBottomTabChange('BUSCAR')}
              onOpenLoans={() => handleBottomTabChange('EMPRESTADOS')}
            />
          )}

          {currentTab === 'EMPRESTADOS' && (
            <LoansScreen
              palette={palette}
              books={books}
              onOpenBookDetail={(book) => handleOpenBookDetail(book)}
              onOpenLoanModal={(book) => handleOpenLoanModal(book)}
              onReturnBook={handleReturnLoan}
              onGoToShelf={() => handleBottomTabChange('ESTANTE')}
              onSelectShelfTab={(tab) => {
                setStatusTab(tab);
                handleBottomTabChange('ESTANTE');
              }}
            />
          )}

          {currentTab === 'BUSCAR' && (
            <SearchScreen
              palette={palette}
              searchQuery={searchInput}
              onQueryChange={(val) => {
                setSearchInput(val);
                if (!val.trim()) {
                  setSearchResults([]);
                  setSearchError(null);
                  setSearchCursor(null);
                  setHasMoreSearch(false);
                  setProviderStatuses([]);
                }
              }}
              onSearch={performSearch}
              onCancelSearch={handleCancelSearch}
              isLoading={isSearchLoading}
              results={searchResults}
              errorMessage={searchError}
              onSelectBookToAdd={handleSelectBookToAdd}
              onSelectBookDetail={(book) => handleOpenBookDetail(book)}
              onOpenManualRegister={() => handleOpenManualRegister()}
              userBooks={books}
              onLoadMore={handleLoadMoreSearch}
              hasMore={hasMoreSearch}
              isLoadingMore={isLoadingMoreSearch}
              providerStatuses={providerStatuses}
              onGoToSettings={() => handleBottomTabChange('CONFIG')}
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
              apiKey={geminiApiKey || googleApiKey}
              onApiKeyChange={handleApiKeyChange}
              googleBooksApiKey={googleBooksApiKey}
              onGoogleBooksApiKeyChange={handleGoogleBooksApiKeyChange}
              geminiApiKey={geminiApiKey}
              onGeminiApiKeyChange={handleGeminiApiKeyChange}
              onExportCsv={() => BookStorage.exportCsv(books)}
              onExportJson={() => BookStorage.exportJson(books)}
              onImportCsv={async (csv) => {
                const res = BookStorage.importCsv(csv, books);
                await BookStorage.saveAllBooksToDatabase(res.updatedBooks);
                setBooks(res.updatedBooks);
                setToastMessage(`${res.count} livros importados com sucesso!`);
                return { count: res.count };
              }}
              onImportJson={async (json) => {
                const res = BookStorage.importJson(json, books);
                await BookStorage.saveAllBooksToDatabase(res.updatedBooks);
                setBooks(res.updatedBooks);
                setToastMessage(`${res.count} livros importados com sucesso!`);
                return { count: res.count };
              }}
              books={books}
              onUpdateAllBooks={async (updated) => {
                await BookStorage.saveAllBooksToDatabase(updated);
                setBooks(updated);
              }}
            />
          )}

          {/* Barra de Navegação Inferior Clássica */}
          <NavigationBottomBar
            palette={palette}
            currentTab={currentTab}
            onTabChange={handleBottomTabChange}
            totalCount={books.filter((b) => Boolean(b.tenho_fisico) || b.formato === 'ebook').length}
            borrowedCount={activeBorrowedCount}
          />
        </>
      )}

      {/* Indicador de Conexão Offline */}
      <OfflineIndicator />
    </WoodBackground>
  );
};
