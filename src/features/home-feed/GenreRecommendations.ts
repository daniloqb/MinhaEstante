import { Book } from '../../types/book';
import { areBooksDuplicate } from '../../services/storage';
import { HomeBookItem, HomeBookSection, ReadingPreferences } from './types';
import { HomeFeedCache } from './HomeFeedCache';
import { ReadingPreferencesService } from './ReadingPreferencesService';

// Mapeamento de termos de gêneros em português para slugs do Open Library
const GENRE_SUBJECT_MAP: Record<string, string> = {
  'romance': 'romance',
  'literatura clássica': 'classic_literature',
  'clássicos': 'classic_literature',
  'ficção científica': 'science_fiction',
  'fantasia': 'fantasy',
  'filosofia': 'philosophy',
  'história': 'history',
  'biografia': 'biography',
  'biografia & memórias': 'biography',
  'suspense & mistério': 'mystery_and_detective_stories',
  'suspense': 'thriller',
  'poesia': 'poetry',
  'ciência & natureza': 'science',
  'ciência': 'science',
  'tecnologia': 'technology',
  'desenvolvimento pessoal': 'self_help',
  'psicologia': 'psychology',
  'economia': 'economics',
  'arte': 'art',
  'terror & horror': 'horror',
  'terror': 'horror',
};

export class GenreRecommendations {
  private static CACHE_PREFIX = 'genre_rec_';

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
    const cacheKey = `${this.CACHE_PREFIX}${genre.toLowerCase().replace(/\s+/g, '_')}`;

    const cached = HomeFeedCache.get(cacheKey);
    if (cached && !cached.isStale) {
      return cached.section;
    }

    // Identifica o slug do assunto para a Open Library
    const lower = genre.toLowerCase();
    const subjectSlug = GENRE_SUBJECT_MAP[lower] || lower.replace(/[^a-z0-9]/g, '_');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const onGlobalAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onGlobalAbort, { once: true });
      }

      const url = `https://openlibrary.org/subjects/${encodeURIComponent(subjectSlug)}.json?limit=25`;
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

        const candidateBook = {
          titulo: w.title,
          autores: Array.isArray(w.authors) ? w.authors.map((a: any) => a.name) : [],
          isbn13: undefined,
          isbn10: undefined,
        };

        // Regra estrita: Exclui livros que o usuário já possui ou leu
        const alreadyInLibrary = (books || []).some((b) => areBooksDuplicate(b, candidateBook));
        if (alreadyInLibrary) continue;

        const coverId = w.cover_id;
        const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;

        items.push({
          id: `genre_${w.key || items.length}`,
          isLocal: false,
          searchResult: {
            origem: 'openlibrary',
            idExterno: w.key,
            titulo: w.title,
            autores: candidateBook.autores,
            anoPublicacao: typeof w.first_publish_year === 'number' ? w.first_publish_year : null,
            capaUrl: coverUrl,
            generos: [genre],
            fontes: ['Open Library Subjects'],
          },
          titulo: w.title,
          autores: candidateBook.autores,
          capaUrl: coverUrl,
          anoPublicacao: typeof w.first_publish_year === 'number' ? w.first_publish_year : null,
          generos: [genre],
          reason: `Destaque no gênero ${genre}`,
        });
      }

      const section: HomeBookSection = {
        id: `section_genre_${subjectSlug}`,
        type: 'genre',
        title: `Porque você gosta de ${genre}`,
        subtitle: `Novas obras selecionadas para o seu interesse em ${genre}`,
        source: 'Open Library Catalog',
        genre,
        books: items,
        state: items.length > 0 ? 'ready' : 'empty',
        canViewAll: true,
      };

      if (items.length > 0) {
        HomeFeedCache.set(cacheKey, section, 24 * 60 * 60 * 1000); // 24h
      }

      return section;
    } catch {
      if (cached) return cached.section;
      return {
        id: `section_genre_${subjectSlug}`,
        type: 'genre',
        title: `Porque você gosta de ${genre}`,
        subtitle: `Obras de ${genre}`,
        genre,
        books: [],
        state: 'empty',
        errorMessage: 'Não foi possível carregar sugestões de gênero.',
      };
    }
  }
}
