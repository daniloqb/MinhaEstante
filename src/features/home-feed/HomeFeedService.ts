import { Book } from '../../types/book';
import { HomeBookSection, ReadingPreferences } from './types';
import { LocalShelfFeed } from './LocalShelfFeed';
import { TrendsFeed } from './TrendsFeed';
import { BestSellersFeed } from './BestSellersFeed';
import { GenreRecommendations } from './GenreRecommendations';
import { PersonalRecommendations } from './PersonalRecommendations';
import { NewReleasesFeed } from './NewReleasesFeed';
import { ReadingPreferencesService } from './ReadingPreferencesService';

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
   * Constrói todas as seções ordenadas da Home.
   * Ordem canônica:
   * 1. Sua Estante
   * 2. Em alta entre leitores
   * 3. Mais vendidos (opcional/verificável)
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
    const [trendingRes, bestsellersRes, genreRes, recommendedRes, newReleasesRes] = await Promise.allSettled([
      TrendsFeed.getTrendingSection(signal),
      BestSellersFeed.getBestSellersSection(nytApiKey, signal),
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

    const allSections: HomeBookSection[] = [
      personalShelf,
      trending,
      bestsellers,
      genre,
      recommended,
      newReleases,
      readingJourney,
    ];

    // Se mais vendidos estiver vazio sem erro grave, preserva a ordem mas permite filtrar seções sem conteúdo
    return allSections.filter((s) => s.state !== 'empty' || s.type === 'personal-shelf' || s.type === 'bestsellers');
  }
}
