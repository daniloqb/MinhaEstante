import { Book } from '../../types/book';
import { areBooksDuplicate } from '../../services/storage';
import { HomeBookItem, HomeBookSection } from './types';
import { HomeFeedCache } from './HomeFeedCache';

export class NewReleasesFeed {
  private static CACHE_KEY = 'home_feed_new_releases_v1';

  static async getNewReleasesSection(books: Book[], signal?: AbortSignal): Promise<HomeBookSection> {
    const cached = HomeFeedCache.get(this.CACHE_KEY);
    if (cached && !cached.isStale) {
      return cached.section;
    }

    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 1; // Últimos 12 a 18 meses

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9500);

      const onGlobalAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onGlobalAbort, { once: true });
      }

      // Consulta lançamentos recentes via busca do Open Library
      const url = `https://openlibrary.org/search.json?q=*&first_publish_year:[${minYear}+TO+${currentYear}]&sort=new&limit=25`;
      const res = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onGlobalAbort);

      if (!res.ok) {
        throw new Error(`Open Library Search HTTP ${res.status}`);
      }

      const data = await res.json();
      const docs = Array.isArray(data?.docs) ? data.docs : [];

      const items: HomeBookItem[] = [];

      for (const d of docs) {
        if (items.length >= 10) break;
        if (!d.title) continue;

        const candidateBook = {
          titulo: d.title,
          autores: Array.isArray(d.author_name) ? d.author_name : [],
          isbn13: Array.isArray(d.isbn) ? d.isbn[0] : undefined,
          isbn10: undefined,
        };

        // Exclui livros já presentes na estante
        const isDuplicate = (books || []).some((b) => areBooksDuplicate(b, candidateBook));
        if (isDuplicate) continue;

        const coverId = d.cover_i;
        const capaUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;
        const pubYear = typeof d.first_publish_year === 'number' ? d.first_publish_year : currentYear;

        items.push({
          id: `release_${d.key || items.length}`,
          isLocal: false,
          searchResult: {
            origem: 'openlibrary',
            idExterno: d.key,
            titulo: d.title,
            autores: candidateBook.autores,
            anoPublicacao: pubYear,
            editora: Array.isArray(d.publisher) ? d.publisher[0] : undefined,
            capaUrl,
            generos: [],
            fontes: ['Open Library Releases'],
          },
          titulo: d.title,
          autores: candidateBook.autores,
          capaUrl,
          anoPublicacao: pubYear,
          editora: Array.isArray(d.publisher) ? d.publisher[0] : undefined,
          reason: `Publicação recente (${pubYear})`,
        });
      }

      const section: HomeBookSection = {
        id: 'section_new_releases',
        type: 'new-releases',
        title: 'Lançamentos',
        subtitle: `Obras publicadas recentemente (${minYear}–${currentYear})`,
        source: 'Open Library Global Releases',
        referenceDate: `${currentYear}`,
        books: items,
        state: items.length > 0 ? 'ready' : 'empty',
        canViewAll: false,
      };

      if (items.length > 0) {
        HomeFeedCache.set(this.CACHE_KEY, section, 24 * 60 * 60 * 1000);
      }

      return section;
    } catch {
      if (cached) return cached.section;
      return {
        id: 'section_new_releases',
        type: 'new-releases',
        title: 'Lançamentos',
        subtitle: 'Publicações recentes',
        books: [],
        state: 'empty',
        errorMessage: 'Não foi possível carregar os lançamentos no momento.',
      };
    }
  }
}
