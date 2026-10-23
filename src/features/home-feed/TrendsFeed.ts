import { HomeBookItem, HomeBookSection } from './types';
import { HomeFeedCache } from './HomeFeedCache';

export class TrendsFeed {
  private static CACHE_KEY = 'openlibrary_trending_daily';
  private static CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

  static async getTrendingSection(signal?: AbortSignal): Promise<HomeBookSection> {
    // 1. Tenta recuperar do cache
    const cached = HomeFeedCache.get(this.CACHE_KEY);
    if (cached && !cached.isStale) {
      return cached.section;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000); // 9s timeout

      const onGlobalAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onGlobalAbort, { once: true });
      }

      const res = await fetch('https://openlibrary.org/trending/daily.json', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onGlobalAbort);

      if (!res.ok) {
        throw new Error(`Open Library HTTP ${res.status}`);
      }

      const data = await res.json();
      const works = Array.isArray(data?.works) ? data.works : [];

      const books: HomeBookItem[] = [];
      let rank = 1;

      for (const w of works) {
        if (books.length >= 10) break;
        if (!w.title) continue;

        const coverId = w.cover_i;
        const coverUrl = coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
          : undefined;

        books.push({
          id: `trend_ol_${w.key || rank}`,
          isLocal: false,
          searchResult: {
            origem: 'openlibrary',
            idExterno: w.key,
            titulo: w.title,
            autores: Array.isArray(w.author_name) ? w.author_name : [],
            anoPublicacao: typeof w.first_publish_year === 'number' ? w.first_publish_year : null,
            capaUrl: coverUrl,
            generos: [],
            fontes: ['Open Library Trends'],
          },
          titulo: w.title,
          autores: Array.isArray(w.author_name) ? w.author_name : ['Autor Desconhecido'],
          capaUrl: coverUrl,
          anoPublicacao: typeof w.first_publish_year === 'number' ? w.first_publish_year : null,
          rankPosition: rank,
          reason: `#${rank} em alta na comunidade Open Library`,
        });

        rank++;
      }

      const section: HomeBookSection = {
        id: 'section_trending',
        type: 'trending',
        title: 'Em alta entre leitores',
        subtitle: 'Livros mais populares e adicionados recentemente por leitores no mundo',
        source: 'Open Library Community Trends',
        referenceDate: 'Tendências Diárias',
        books,
        state: books.length > 0 ? 'ready' : 'empty',
        canViewAll: false,
      };

      if (books.length > 0) {
        HomeFeedCache.set(this.CACHE_KEY, section, this.CACHE_TTL_MS);
      }

      return section;
    } catch (err: any) {
      if (signal?.aborted) {
        throw err;
      }

      // Se falhar e houver cache antigo (mesmo expirado), retorna para manter offline funcional
      if (cached) {
        return cached.section;
      }

      return {
        id: 'section_trending',
        type: 'trending',
        title: 'Em alta entre leitores',
        subtitle: 'Livros populares na comunidade bibliográfica mundial',
        source: 'Open Library',
        books: [],
        state: 'empty',
        errorMessage: 'Não foi possível carregar as tendências no momento.',
      };
    }
  }
}
