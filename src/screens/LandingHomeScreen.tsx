import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from '../features/home-feed';
import { CoverStorageService } from '../services/storage/coverStorageService';

export interface LandingHomeScreenProps {
  palette: WoodPalette;
  books: Book[];
  onNavigateToTab: (tab: MainTab) => void;
  onOpenShelfWithStatus: (status: ShelfTab) => void;
  onSelectLocalBook: (book: Book) => void;
  onSelectExternalBook: (book: SearchResultBook) => void;
  onNavigateToSearch: (initialQuery?: string) => void;
  onOpenManualRegister: () => void;
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
    HomeFeedService.getLocalSections(books)
  );
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Contadores reais da coleção
  const counts = useMemo(() => {
    return {
      meusLivros: books.filter((b) => Boolean(b.tenho_fisico) || b.formato === 'ebook').length,
      lidos: books.filter((b) => b.status_leitura === 'lido').length,
      queroLer: books.filter((b) => b.status_leitura === 'quero_ler').length,
      emprestados: books.filter((b) => b.emprestimo && !b.emprestimo.devolvido).length,
    };
  }, [books]);

  // Carrega seções remotas (Tendências, Recomendações, Gênero, Lançamentos)
  const fetchFeed = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoadingRemote(true);
      try {
        const all = await HomeFeedService.loadAllSections(books, preferences, undefined, signal);
        if (!signal?.aborted) {
          setSections(all);
        }
      } catch (err: any) {
        if (!signal?.aborted) {
          console.warn('Erro ao carregar seções da Home:', err);
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoadingRemote(false);
        }
      }
    },
    [books, preferences]
  );

  useEffect(() => {
    // Pré-aquece o cache de exibição das capas locais imediatamente
    CoverStorageService.warmDisplayCache(books);

    // Atualiza imediatamente seções locais quando a coleção muda
    setSections((prev) => {
      const local = HomeFeedService.getLocalSections(books);
      const personalShelf = local[0];
      const readingJourney = local[1];

      // Substitui as seções locais preservando as remotas
      const updated = prev.map((s) => {
        if (s.type === 'personal-shelf') return personalShelf;
        if (s.type === 'reading-journey') return readingJourney;
        return s;
      });

      if (!updated.some((s) => s.type === 'personal-shelf')) {
        updated.unshift(personalShelf);
      }
      if (!updated.some((s) => s.type === 'reading-journey')) {
        updated.push(readingJourney);
      }

      return updated;
    });

    const controller = new AbortController();
    fetchFeed(controller.signal);

    return () => {
      controller.abort();
    };
  }, [books, preferences, fetchFeed]);

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
        {/* Cabeçalho */}
        <HomeHeader
          palette={palette}
          onNavigateToSearch={() => onNavigateToSearch()}
          onOpenPreferences={() => setIsPreferencesModalOpen(true)}
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
            <div className="w-full flex items-center justify-center gap-2 py-6 text-xs font-sans opacity-70" style={{ color: palette.textOnWood }}>
              <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span>Consultando tendências e recomendações bibliográficas mundiais...</span>
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
