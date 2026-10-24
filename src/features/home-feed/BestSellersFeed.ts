import { HomeBookItem, HomeBookSection } from './types';
import { HomeFeedCache } from './HomeFeedCache';
import { AppleBooksRankingProvider } from './AppleBooksRankingProvider';

export interface BestSellerRankingProvider {
  id: string;
  name: string;
  market: string;
  category: string;
  isAvailable(): boolean;
  fetchRankings(signal?: AbortSignal): Promise<{ books: HomeBookItem[]; referenceDate: string }>;
}

/**
 * Provedor New York Times Books API (Opcional - Requer API Key)
 */
export class NYTBestSellerProvider implements BestSellerRankingProvider {
  readonly id = 'nyt';
  readonly name = 'The New York Times Best Sellers';
  readonly market = 'Estados Unidos / Internacional';
  readonly category = 'Hardcover Fiction';

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey?.trim();
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async fetchRankings(signal?: AbortSignal): Promise<{ books: HomeBookItem[]; referenceDate: string }> {
    if (!this.apiKey) {
      return { books: [], referenceDate: '' };
    }

    const url = `https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json?api-key=${encodeURIComponent(
      this.apiKey
    )}`;

    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`NYT Books HTTP ${res.status}`);
    }

    const data = await res.json();
    const results = data?.results?.books || [];
    const date = data?.results?.published_date || new Date().toISOString().slice(0, 10);

    const items: HomeBookItem[] = results.slice(0, 10).map((b: any, index: number) => ({
      id: `nyt_${b.primary_isbn13 || index}`,
      isLocal: false,
      searchResult: {
        origem: 'manual',
        idExterno: b.primary_isbn13,
        titulo: b.title,
        autores: b.author ? [b.author] : [],
        editora: b.publisher,
        isbn13: b.primary_isbn13,
        isbn10: b.primary_isbn10,
        descricao: b.description,
        capaUrl: b.book_image,
        generos: ['Ficção'],
        fontes: ['The New York Times'],
      },
      titulo: b.title,
      autores: b.author ? [b.author] : [],
      capaUrl: b.book_image,
      editora: b.publisher,
      isbn13: b.primary_isbn13,
      isbn10: b.primary_isbn10,
      rankPosition: b.rank || index + 1,
      reason: `#${b.rank || index + 1} na lista oficial do NYT (${b.weeks_on_list || 1} sem. na lista)`,
    }));

    return { books: items, referenceDate: date };
  }
}

export class BestSellersFeed {
  private static CACHE_KEY_NYT = 'bestsellers_feed_nyt';
  private static CACHE_KEY_APPLE = 'bestsellers_feed_apple_';
  private static CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

  /**
   * Obtém ranking oficial gratuito da Apple Books (Brasil como padrão, ou 'us' / 'pt')
   */
  static async getAppleBooksSection(
    marketCode: string = 'br',
    signal?: AbortSignal
  ): Promise<HomeBookSection> {
    const cacheKey = `${this.CACHE_KEY_APPLE}${marketCode.toLowerCase()}`;
    const cached = HomeFeedCache.get(cacheKey);
    if (cached && !cached.isStale) {
      return {
        ...cached.section,
        isCached: true,
        lastUpdated: cached.timestamp,
      };
    }

    const inFlight = HomeFeedCache.getInFlight<HomeBookSection>(cacheKey);
    if (inFlight) return inFlight;

    const fetchPromise: Promise<HomeBookSection> = (async (): Promise<HomeBookSection> => {
      const appleProvider = new AppleBooksRankingProvider();
      try {
        const { books, referenceDate, marketName } = await appleProvider.fetchRankings(
          marketCode,
          signal
        );

        const formattedDate = referenceDate ? new Date(referenceDate).toLocaleDateString() : '';
        const now = Date.now();

        const section: HomeBookSection = {
          id: 'section_apple_books',
          type: 'apple-books',
          title: `Mais vendidos — ${marketName}`,
          subtitle: 'Ranking oficial dos e-books mais lidos e vendidos na Apple Books',
          source: marketName,
          referenceDate: formattedDate ? `Atualizado em ${formattedDate}` : 'Atualização diária',
          books,
          state: books.length > 0 ? 'ready' : 'empty',
          canViewAll: books.length > 0,
          discoveryContext: {
            source: 'home',
            mode: 'apple-books',
            title: `Mais vendidos (${marketName})`,
            sourceName: marketName,
            type: 'apple-books',
            referenceDate: formattedDate,
            searchTerm: 'bestseller',
          },
          lastUpdated: now,
          isCached: false,
        };

        if (books.length > 0) {
          HomeFeedCache.set(cacheKey, section, this.CACHE_TTL_MS);
        }

        return section;
      } catch (err: any) {
        if (signal?.aborted) throw err;
        if (cached) {
          return {
            ...cached.section,
            isCached: true,
            lastUpdated: cached.timestamp,
          };
        }

        const fallbackSection: HomeBookSection = {
          id: 'section_apple_books',
          type: 'apple-books',
          title: 'Mais vendidos — Apple Books',
          subtitle: 'Ranking oficial de e-books',
          source: 'Apple Books',
          books: [],
          state: 'empty',
          errorMessage: 'Não foi possível carregar os rankings da Apple Books no momento.',
        };
        return fallbackSection;
      }
    })();

    return HomeFeedCache.setInFlight(cacheKey, fetchPromise);
  }

  /**
   * Obtém a seção de Best Sellers:
   * 1. Se NYT API Key estiver configurada, consulta o NYT.
   * 2. Caso contrário, utiliza o ranking verificado da Apple Books Brasil como fonte primária gratuita.
   */
  static async getBestSellersSection(
    nytApiKey?: string,
    signal?: AbortSignal
  ): Promise<HomeBookSection> {
    const nytProvider = new NYTBestSellerProvider(nytApiKey);

    if (!nytProvider.isAvailable()) {
      return {
        id: 'section_bestsellers',
        type: 'bestsellers',
        title: 'Mais vendidos',
        subtitle: 'Rankings oficiais com apuração auditada',
        source: 'Aguardando configuração de API editorial',
        books: [],
        state: 'empty',
        errorMessage:
          'Rankings auditados de vendas (como NYT ou Nielsen) requerem integração editorial. Consulte as tendências em alta acima.',
      };
    }

    const cached = HomeFeedCache.get(this.CACHE_KEY_NYT);
    if (cached && !cached.isStale) {
      return {
        ...cached.section,
        isCached: true,
        lastUpdated: cached.timestamp,
      };
    }

    const inFlight = HomeFeedCache.getInFlight<HomeBookSection>(this.CACHE_KEY_NYT);
    if (inFlight) return inFlight;

    const fetchPromise: Promise<HomeBookSection> = (async (): Promise<HomeBookSection> => {
      try {
        const { books, referenceDate } = await nytProvider.fetchRankings(signal);
        const now = Date.now();

        const section: HomeBookSection = {
          id: 'section_bestsellers',
          type: 'bestsellers',
          title: 'Mais vendidos (NYT)',
          subtitle: `${nytProvider.category} — ${nytProvider.market}`,
          source: nytProvider.name,
          referenceDate: `Edição de ${referenceDate}`,
          books,
          state: books.length > 0 ? 'ready' : 'empty',
          canViewAll: books.length > 0,
          discoveryContext: {
            source: 'home',
            mode: 'bestsellers',
            title: 'The New York Times Best Sellers',
            sourceName: 'The New York Times',
            type: 'bestsellers',
            referenceDate,
            searchTerm: 'fiction bestsellers',
          },
          lastUpdated: now,
          isCached: false,
        };

        if (books.length > 0) {
          HomeFeedCache.set(this.CACHE_KEY_NYT, section, this.CACHE_TTL_MS);
        }

        return section;
      } catch (err: any) {
        if (signal?.aborted) throw err;
        if (cached) {
          return {
            ...cached.section,
            isCached: true,
            lastUpdated: cached.timestamp,
          };
        }
        return {
          id: 'section_bestsellers',
          type: 'bestsellers',
          title: 'Mais vendidos (NYT)',
          subtitle: 'Rankings de vendas',
          books: [],
          state: 'empty',
          errorMessage: 'Falha temporária ao carregar o ranking de mais vendidos.',
        };
      }
    })();

    return HomeFeedCache.setInFlight(this.CACHE_KEY_NYT, fetchPromise);
  }
}
