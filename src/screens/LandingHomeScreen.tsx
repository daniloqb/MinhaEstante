import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Book, SearchResultBook, ShelfTab } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { MainTab } from '../components/NavigationBottomBar';
import { HomeHeader } from '../components/home/HomeHeader';
import { HomeQuickLinks } from '../components/home/HomeQuickLinks';
import { HomeSection } from '../components/home/HomeSection';
import { ReadingPreferencesPrompt } from '../components/home/ReadingPreferencesPrompt';
import { ReadingPreferencesModal } from '../components/home/ReadingPreferencesModal';
import {
  HomeBookItem,
  HomeBookSection,
  ReadingPreferences,
  HomeFeedService,
  ReadingPreferencesService,
  DiscoveryNavigationContext,
} from '../features/home-feed';
import { CoverStorageService } from '../services/storage/coverStorageService';
import { App as CapacitorApp } from '@capacitor/app';

export interface LandingHomeScreenProps {
  palette: WoodPalette;
  books: Book[];
  onNavigateToTab: (tab: MainTab) => void;
  onOpenShelfWithStatus: (status: ShelfTab) => void;
  onSelectLocalBook: (book: Book) => void;
  onSelectExternalBook: (book: SearchResultBook) => void;
  onNavigateToSearch: (initialQuery?: string, context?: DiscoveryNavigationContext) => void;
  onOpenManualRegister: () => void;
}

const CANONICAL_SECTION_ORDER: Record<string, number> = {
  'personal-shelf': 1,
  'trending': 2,
  'bestsellers': 3,
  'apple-books': 3.5,
  'genre': 4,
  'recommended': 5,
  'new-releases': 6,
  'reading-journey': 7,
};

function sortSections(list: HomeBookSection[]): HomeBookSection[] {
  return [...list].sort((a, b) => {
    const orderA = CANONICAL_SECTION_ORDER[a.type] ?? 99;
    const orderB = CANONICAL_SECTION_ORDER[b.type] ?? 99;
    return orderA - orderB;
  });
}

export const LandingHomeScreen: React.FC<LandingHomeScreenProps> = ({
  palette,
  books,
  onNavigateToTab,
  onOpenShelfWithStatus,
  onSelectLocalBook,
  onSelectExternalBook,
  onNavigateToSearch,
  onOpenManualRegister,
}) => {
  const [preferences, setPreferences] = useState<ReadingPreferences>(() =>
    ReadingPreferencesService.getPreferences()
  );
  const [sections, setSections] = useState<HomeBookSection[]>(() =>
    sortSections(HomeFeedService.getLocalSections(books))
  );
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | undefined>();
  const [isCached, setIsCached] = useState<boolean>(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const activeAbortRef = useRef<AbortController | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  // Contadores reais da coleção
  const counts = useMemo(() => {
    return {
      meusLivros: books.filter((b) => Boolean(b.tenho_fisico) || b.formato === 'ebook').length,
      lidos: books.filter((b) => b.status_leitura === 'lido').length,
      queroLer: books.filter((b) => b.status_leitura === 'quero_ler').length,
      emprestados: books.filter((b) => b.emprestimo && !b.emprestimo.devolvido).length,
    };
  }, [books]);

  // Atualizador incremental e resiliente de uma seção
  const updateSectionState = useCallback((newSection: HomeBookSection) => {
    setSections((prev) => {
      const filtered = prev.filter((s) => s.id !== newSection.id && s.type !== newSection.type);
      return sortSections([...filtered, newSection]);
    });

    if (newSection.lastUpdated) {
      setLastUpdated(newSection.lastUpdated);
      setIsCached(Boolean(newSection.isCached));
    }
  }, []);

  // Carregamento progressivo (Stale-While-Revalidate): cada seção aparece assim que finaliza
  const fetchFeedProgressive = useCallback(
    async (isManual: boolean = false) => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
      const controller = new AbortController();
      activeAbortRef.current = controller;

      if (isManual) {
        setIsRefreshing(true);
      } else {
        setIsLoadingRemote(true);
      }

      try {
        await HomeFeedService.loadAllProgressive(
          books,
          preferences,
          { signal: controller.signal },
          (section) => {
            if (!controller.signal.aborted) {
              updateSectionState(section);
            }
          }
        );
        lastFetchTimeRef.current = Date.now();
        if (!controller.signal.aborted) {
          setLastUpdated(Date.now());
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          console.warn('Erro ao carregar feed progressivo:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingRemote(false);
          setIsRefreshing(false);
        }
      }
    },
    [books, preferences, updateSectionState]
  );

  // Revalidação inteligente se o app voltar de segundo plano ou ficar online após período ocioso
  const revalidateIfStale = useCallback(() => {
    const elapsed = Date.now() - lastFetchTimeRef.current;
    // Se passaram mais de 10 minutos desde o último carregamento
    if (elapsed > 10 * 60 * 1000) {
      fetchFeedProgressive(false);
    }
  }, [fetchFeedProgressive]);

  // Pré-aquecimento de capas e disparo do feed ao iniciar
  useEffect(() => {
    CoverStorageService.warmDisplayCache(books);

    // Atualiza imediatamente seções locais quando a coleção muda
    setSections((prev) => {
      const local = HomeFeedService.getLocalSections(books);
      const personalShelf = local[0];
      const readingJourney = local[1];

      const filtered = prev.filter(
        (s) => s.type !== 'personal-shelf' && s.type !== 'reading-journey'
      );
      return sortSections([...filtered, personalShelf, readingJourney]);
    });

    fetchFeedProgressive(false);

    return () => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
    };
  }, [books, preferences, fetchFeedProgressive]);

  // Triggers de Ciclo de Vida: Capacitor AppState, document.visibilitychange, window.online
  useEffect(() => {
    // 1. Capacitor AppState
    let appStateHandle: any = null;
    try {
      appStateHandle = CapacitorApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          revalidateIfStale();
        }
      });
    } catch {
      // Em navegadores comuns o plugin pode não estar ativo
    }

    // 2. Visibilidade da página no navegador
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateIfStale();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Reconexão de rede
    const handleOnline = () => {
      revalidateIfStale();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      if (appStateHandle && typeof appStateHandle.then === 'function') {
        appStateHandle.then((h: any) => h.remove?.());
      } else if (appStateHandle?.remove) {
        appStateHandle.remove();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [revalidateIfStale]);

  const handleSelectBook = (item: HomeBookItem) => {
    if (item.isLocal && item.localBook) {
      onSelectLocalBook(item.localBook);
    } else if (item.searchResult) {
      onSelectExternalBook(item.searchResult);
    }
  };

  const handleViewAll = (section: HomeBookSection) => {
    if (section.type === 'personal-shelf') {
      onOpenShelfWithStatus('todos');
    } else if (section.type === 'reading-journey') {
      onOpenShelfWithStatus('quero_ler');
    } else if (section.discoveryContext) {
      onNavigateToSearch(section.discoveryContext.searchTerm, section.discoveryContext);
    } else if (section.type === 'genre' && section.genre) {
      onNavigateToSearch(`gênero: ${section.genre}`);
    } else {
      onNavigateToSearch();
    }
  };

  const handleUseLibrarySuggestions = () => {
    const suggested = ReadingPreferencesService.suggestGenresFromLibrary(books);
    const updated = ReadingPreferencesService.completeOnboarding(suggested);
    setPreferences(updated);
  };

  const handleDismissOnboarding = () => {
    ReadingPreferencesService.dismissOnboarding();
    setOnboardingDismissed(true);
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center">
      <div className="w-full max-w-4xl px-3 sm:px-6 py-4 flex flex-col gap-4 pb-28">
        {/* Cabeçalho com indicador de atualização e botão manual de refresh */}
        <HomeHeader
          palette={palette}
          onNavigateToSearch={() => onNavigateToSearch()}
          onOpenPreferences={() => setIsPreferencesModalOpen(true)}
          onRefresh={() => fetchFeedProgressive(true)}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          isCached={isCached}
        />

        {/* Atalhos de Acesso Rápido */}
        <HomeQuickLinks
          palette={palette}
          counts={counts}
          onOpenShelf={onOpenShelfWithStatus}
          onOpenLoans={() => onNavigateToTab('EMPRESTADOS')}
        />

        {/* Onboarding Opcional de Preferências */}
        {!preferences.hasCompletedOnboarding && !onboardingDismissed && (
          <ReadingPreferencesPrompt
            palette={palette}
            onOpenPreferences={() => setIsPreferencesModalOpen(true)}
            onUseLibrarySuggestions={handleUseLibrarySuggestions}
            onDismiss={handleDismissOnboarding}
          />
        )}

        {/* Seções em Carrosséis Horizontais */}
        <div className="w-full flex flex-col gap-2 divide-y divide-stone-800/20">
          {sections.map((section) => (
            <HomeSection
              key={section.id}
              palette={palette}
              section={section}
              libraryBooks={books}
              onSelectBook={handleSelectBook}
              onViewAll={handleViewAll}
              onAddFirstBook={onOpenManualRegister}
            />
          ))}

          {isLoadingRemote && sections.length <= 2 && (
            <div
              className="w-full flex items-center justify-center gap-2 py-6 text-xs font-sans opacity-70"
              style={{ color: palette.textOnWood }}
            >
              <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span>Consultando tendências e recomendações bibliográficas...</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Configuração de Preferências de Leitura */}
      <ReadingPreferencesModal
        palette={palette}
        isOpen={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
        onSaved={(updated) => setPreferences(updated)}
      />
    </div>
  );
};
