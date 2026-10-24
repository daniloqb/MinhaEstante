import { Book } from '../../types/book';
import { areBooksDuplicate } from '../../services/storage';
import { HomeBookItem, HomeBookSection, ReadingPreferences } from './types';
import { HomeFeedCache } from './HomeFeedCache';
import { ReadingPreferencesService } from './ReadingPreferencesService';
import { BookGenreNormalizer } from './BookGenreNormalizer';

export class GenreRecommendations {
  private static CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

  /**
   * Escolhe um gênero favorito com rotação estável baseada no dia do ano
   * (evita que o gênero mude aleatoriamente a cada clique/renderização)
   */
  static pickStableGenre(books: Book[], preferences?: ReadingPreferences): string {
    const prefs = preferences || ReadingPreferencesService.getPreferences();
    const candidateGenres =
      prefs.favoriteGenres.length > 0
        ? prefs.favoriteGenres
        : ReadingPreferencesService.suggestGenresFromLibrary(books);

    if (candidateGenres.length === 0) {
      return 'Literatura Clássica';
    }

    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );

    return candidateGenres[dayOfYear % candidateGenres.length];
  }

  static async getGenreSection(
    books: Book[],
    preferences?: ReadingPreferences,
    signal?: AbortSignal
  ): Promise<HomeBookSection> {
    const genre = this.pickStableGenre(books, preferences);
    const signature = HomeFeedCache.computeProfileSignature(books, preferences);
    const subjectSlug = BookGenreNormalizer.toOpenLibrarySubject(genre);
    const displayGenreName = BookGenreNormalizer.toDisplayName(genre);

    const cacheKey = `personalized_genre_${subjectSlug}_${signature}`;

    const cached = HomeFeedCache.get(cacheKey, signature);
    if (cached && !cached.isStale) {
      return { ...cached.section, isCached: true, lastUpdated: cached.timestamp };
    }

    const fetchTask = async (): Promise<HomeBookSection> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const onGlobalAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onGlobalAbort, { once: true });
      }

      try {
        const url = `https://openlibrary.org/subjects/${encodeURIComponent(subjectSlug)}.json?limit=30`;
        const res = await fetch(url, { signal: controller.signal });

        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onGlobalAbort);

        if (!res.ok) {
          throw new Error(`Open Library Subjects HTTP ${res.status}`);
        }

        const data = await res.json();
        const works = Array.isArray(data?.works) ? data.works : [];

        const items: HomeBookItem[] = [];

        for (const w of works) {
          if (items.length >= 10) break;
          if (!w.title) continue;

          const candidateAuthors = Array.isArray(w.authors) ? w.authors.map((a: any) => a.name).filter(Boolean) : [];
          const candidateBook = {
            titulo: w.title,
            autores: candidateAuthors,
            isbn13: undefined,
            isbn10: undefined,
          };

          // Exclui obras que o usuário já possui na estante
          const isDuplicate = (books || []).some((b) => areBooksDuplicate(b, candidateBook));
          if (isDuplicate) continue;

          const coverId = w.cover_id;
          const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;

          items.push({
            id: `genre_${w.key || items.length}`,
            isLocal: false,
            searchResult: {
              origem: 'openlibrary',
              idExterno: w.key,
              titulo: w.title,
              autores: candidateAuthors,
              anoPublicacao: typeof w.first_publish_year === 'number' ? w.first_publish_year : null,
              capaUrl: coverUrl,
              generos: [displayGenreName],
              fontes: [`Open Library (${displayGenreName})`],
            },
            titulo: w.title,
            autores: candidateAuthors,
            capaUrl: coverUrl,
            anoPublicacao: typeof w.first_publish_year === 'number' ? w.first_publish_year : null,
            generos: [displayGenreName],
            reason: `Destaque no gênero ${displayGenreName}`,
          });
        }

        const now = Date.now();
        const section: HomeBookSection = {
          id: 'section_genre',
          type: 'genre',
          title: `Porque você gosta de ${displayGenreName}`,
          subtitle: `Seleção de obras aclamadas de ${displayGenreName}`,
          source: `Open Library Subject (${displayGenreName})`,
          books: items,
          genre: displayGenreName,
          state: items.length > 0 ? 'ready' : 'empty',
          canViewAll: items.length > 0,
          lastUpdated: now,
          isCached: false,
        };

        if (items.length > 0) {
          HomeFeedCache.set(cacheKey, section, this.CACHE_TTL_MS, signature);
        }

        return section;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onGlobalAbort);

        if (cached) {
          return { ...cached.section, isCached: true, lastUpdated: cached.timestamp };
        }

        return {
          id: 'section_genre',
          type: 'genre',
          title: `Porque você gosta de ${displayGenreName}`,
          genre: displayGenreName,
          books: [],
          state: 'empty',
          errorMessage: `Não foi possível carregar sugestões de ${displayGenreName} no momento.`,
        };
      }
    };

    return HomeFeedCache.setInFlight(cacheKey, fetchTask());
  }
}
