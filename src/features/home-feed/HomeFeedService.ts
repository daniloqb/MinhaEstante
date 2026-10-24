import { Book } from '../../types/book';
import { HomeBookSection, ReadingPreferences, HomeSectionType } from './types';
import { LocalShelfFeed } from './LocalShelfFeed';
import { TrendsFeed } from './TrendsFeed';
import { BestSellersFeed } from './BestSellersFeed';
import { GenreRecommendations } from './GenreRecommendations';
import { PersonalRecommendations } from './PersonalRecommendations';
import { NewReleasesFeed } from './NewReleasesFeed';
import { ReadingPreferencesService } from './ReadingPreferencesService';

export interface LoadFeedOptions {
  nytApiKey?: string;
  appleMarket?: string;
  signal?: AbortSignal;
}

export class HomeFeedService {
  /**
   * Retorna imediatamente as seções locais (Sua Estante e Continue sua Jornada).
   * Totalmente síncrono e offline, garantindo abertura instantânea sem espera de rede.
   */
  static getLocalSections(books: Book[]): HomeBookSection[] {
    const personalShelf = LocalShelfFeed.getPersonalShelfSection(books);
    const readingJourney = LocalShelfFeed.getReadingJourneySection(books);
    return [personalShelf, readingJourney];
  }

  /**
   * Carrega uma única seção específica do feed
   */
  static async loadSection(
    type: HomeSectionType,
    books: Book[],
    preferences?: ReadingPreferences,
    options?: LoadFeedOptions
  ): Promise<HomeBookSection> {
    const prefs = preferences || ReadingPreferencesService.getPreferences();
    const signal = options?.signal;

    switch (type) {
      case 'personal-shelf':
        return LocalShelfFeed.getPersonalShelfSection(books);

      case 'reading-journey':
        return LocalShelfFeed.getReadingJourneySection(books);

      case 'trending':
        return TrendsFeed.getTrendingSection(signal);

      case 'bestsellers':
        return BestSellersFeed.getBestSellersSection(options?.nytApiKey, signal);

      case 'apple-books':
        return BestSellersFeed.getAppleBooksSection(options?.appleMarket || 'br', signal);

      case 'genre':
        return GenreRecommendations.getGenreSection(books, prefs, signal);

      case 'recommended':
        return PersonalRecommendations.getRecommendedSection(books, prefs, signal);

      case 'new-releases':
        return NewReleasesFeed.getNewReleasesSection(books, signal);

      default:
        throw new Error(`Seção desconhecida: ${type}`);
    }
  }

  /**
   * Carregamento progressivo (stale-while-revalidate e renderização incremental):
   * Dispara imediatamente as seções locais, e conforme cada seção remota é resolvida,
   * dispara o callback `onSectionReady(section)`.
   */
  static async loadAllProgressive(
    books: Book[],
    preferences: ReadingPreferences | undefined,
    options: LoadFeedOptions | undefined,
    onSectionReady: (section: HomeBookSection) => void
  ): Promise<void> {
    const prefs = preferences || ReadingPreferencesService.getPreferences();
    const signal = options?.signal;

    // 1. Emite seções locais instantaneamente
    const localPersonal = LocalShelfFeed.getPersonalShelfSection(books);
    onSectionReady(localPersonal);

    const localJourney = LocalShelfFeed.getReadingJourneySection(books);
    onSectionReady(localJourney);

    // 2. Tarefas assíncronas concorrentes
    const remoteTasks: Array<{ type: HomeSectionType; run: () => Promise<HomeBookSection> }> = [
      {
        type: 'trending',
        run: () => TrendsFeed.getTrendingSection(signal),
      },
      {
        type: 'apple-books',
        run: () => BestSellersFeed.getAppleBooksSection(options?.appleMarket || 'br', signal),
      },
      {
        type: 'bestsellers',
        run: () => BestSellersFeed.getBestSellersSection(options?.nytApiKey, signal),
      },
      {
        type: 'genre',
        run: () => GenreRecommendations.getGenreSection(books, prefs, signal),
      },
      {
        type: 'recommended',
        run: () => PersonalRecommendations.getRecommendedSection(books, prefs, signal),
      },
      {
        type: 'new-releases',
        run: () => NewReleasesFeed.getNewReleasesSection(books, signal),
      },
    ];

    await Promise.allSettled(
      remoteTasks.map(async (task) => {
        try {
          const section = await task.run();
          onSectionReady(section);
        } catch {
          // Mantém estado resiliente em caso de falha isolada
        }
      })
    );
  }

  /**
   * Constrói todas as seções ordenadas da Home.
   * Ordem canônica:
   * 1. Sua Estante
   * 2. Em alta entre leitores
   * 3. Mais vendidos (Apple Books ou NYT)
   * 4. Porque você gosta de [Gênero]
   * 5. Recomendados para você
   * 6. Lançamentos
   * 7. Continue sua jornada literária
   */
  static async loadAllSections(
    books: Book[],
    preferences?: ReadingPreferences,
    nytApiKey?: string,
    signal?: AbortSignal
  ): Promise<HomeBookSection[]> {
    const prefs = preferences || ReadingPreferencesService.getPreferences();

    // Seções locais imediatas
    const personalShelf = LocalShelfFeed.getPersonalShelfSection(books);
    const readingJourney = LocalShelfFeed.getReadingJourneySection(books);

    // Carregamento concorrente das seções remotas
    const [trendingRes, bestsellersRes, appleRes, genreRes, recommendedRes, newReleasesRes] =
      await Promise.allSettled([
        TrendsFeed.getTrendingSection(signal),
        BestSellersFeed.getBestSellersSection(nytApiKey, signal),
        BestSellersFeed.getAppleBooksSection('br', signal),
        GenreRecommendations.getGenreSection(books, prefs, signal),
        PersonalRecommendations.getRecommendedSection(books, prefs, signal),
        NewReleasesFeed.getNewReleasesSection(books, signal),
      ]);

    const trending =
      trendingRes.status === 'fulfilled'
        ? trendingRes.value
        : {
            id: 'section_trending',
            type: 'trending' as const,
            title: 'Em alta entre leitores',
            subtitle: 'Tendências',
            books: [],
            state: 'empty' as const,
          };

    const bestsellers =
      bestsellersRes.status === 'fulfilled'
        ? bestsellersRes.value
        : {
            id: 'section_bestsellers',
            type: 'bestsellers' as const,
            title: 'Mais vendidos',
            subtitle: 'Rankings oficiais',
            books: [],
            state: 'empty' as const,
          };

    const appleBooks =
      appleRes.status === 'fulfilled'
        ? appleRes.value
        : {
            id: 'section_apple_books',
            type: 'apple-books' as const,
            title: 'Mais vendidos — Apple Books',
            subtitle: 'Rankings oficiais',
            books: [],
            state: 'empty' as const,
          };

    const genre =
      genreRes.status === 'fulfilled'
        ? genreRes.value
        : {
            id: 'section_genre',
            type: 'genre' as const,
            title: 'Porque você gosta deste gênero',
            books: [],
            state: 'empty' as const,
          };

    const recommended =
      recommendedRes.status === 'fulfilled'
        ? recommendedRes.value
        : {
            id: 'section_recommended',
            type: 'recommended' as const,
            title: 'Recomendados para você',
            books: [],
            state: 'empty' as const,
          };

    const newReleases =
      newReleasesRes.status === 'fulfilled'
        ? newReleasesRes.value
        : {
            id: 'section_new_releases',
            type: 'new-releases' as const,
            title: 'Lançamentos',
            books: [],
            state: 'empty' as const,
          };

    // Se NYT Best Sellers tiver livros, utiliza NYT; senão, utiliza o ranking gratuito oficial da Apple Books
    const rankingSection = bestsellers.books.length > 0 ? bestsellers : appleBooks;

    const allSections: HomeBookSection[] = [
      personalShelf,
      trending,
      rankingSection,
      genre,
      recommended,
      newReleases,
      readingJourney,
    ];

    return allSections.filter(
      (s) => s.state !== 'empty' || s.type === 'personal-shelf' || s.type === 'bestsellers' || s.type === 'apple-books'
    );
  }
}
