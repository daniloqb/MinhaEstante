import { HomeBookItem, HomeBookSection } from './types';
import { HomeFeedCache } from './HomeFeedCache';

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
  private static CACHE_KEY = 'bestsellers_feed_ranking';

  static async getBestSellersSection(nytApiKey?: string, signal?: AbortSignal): Promise<HomeBookSection> {
    const provider = new NYTBestSellerProvider(nytApiKey);

    if (!provider.isAvailable()) {
      // Quando não há chave comercial configurada, exibe discretamente informação de ausência sem inventar dados
      return {
        id: 'section_bestsellers',
        type: 'bestsellers',
        title: 'Mais vendidos',
        subtitle: 'Rankings oficiais com apuração auditada',
        source: 'Aguardando configuração de API editorial',
        books: [],
        state: 'empty',
        errorMessage: 'Rankings auditados de vendas (como NYT ou Nielsen) requerem integração editorial. Consulte as tendências em alta acima.',
      };
    }

    const cached = HomeFeedCache.get(this.CACHE_KEY);
    if (cached && !cached.isStale) {
      return cached.section;
    }

    try {
      const { books, referenceDate } = await provider.fetchRankings(signal);

      const section: HomeBookSection = {
        id: 'section_bestsellers',
        type: 'bestsellers',
        title: 'Mais vendidos',
        subtitle: `${provider.category} — ${provider.market}`,
        source: provider.name,
        referenceDate: `Edição de ${referenceDate}`,
        books,
        state: books.length > 0 ? 'ready' : 'empty',
      };

      if (books.length > 0) {
        HomeFeedCache.set(this.CACHE_KEY, section, 24 * 60 * 60 * 1000);
      }

      return section;
    } catch {
      if (cached) return cached.section;
      return {
        id: 'section_bestsellers',
        type: 'bestsellers',
        title: 'Mais vendidos',
        subtitle: 'Rankings de vendas',
        books: [],
        state: 'empty',
        errorMessage: 'Falha temporária ao carregar o ranking de mais vendidos.',
      };
    }
  }
}
