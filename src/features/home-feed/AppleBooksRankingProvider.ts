import { HomeBookItem } from './types';

export interface AppleBooksMarket {
  code: string;
  name: string;
  displayName: string;
}

export const SUPPORTED_APPLE_MARKETS: Record<string, AppleBooksMarket> = {
  br: { code: 'br', name: 'Brasil', displayName: 'Apple Books Brasil' },
  us: { code: 'us', name: 'Estados Unidos', displayName: 'Apple Books EUA' },
  pt: { code: 'pt', name: 'Portugal', displayName: 'Apple Books Portugal' },
};

export class AppleBooksRankingProvider {
  readonly id = 'apple-books';
  readonly name = 'Apple Books Official Top Paid RSS';

  /**
   * Provedor gratuito oficial da Apple, sempre disponível sem necessidade de chaves de API
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Converte a URL de capa do RSS da Apple para resolução de alta fidelidade (ex: 400x600)
   */
  static optimizeCoverUrl(rawUrl?: string): string | undefined {
    if (!rawUrl) return undefined;
    // As URLs de thumbnail da Apple contêm dimensões como /100x150bb.png ou /100x160bb.png
    return rawUrl.replace(/\/\d+x\d+bb\.(png|jpg)/i, '/400x600bb.jpg');
  }

  /**
   * Consulta os rankings oficiais de e-books mais vendidos da Apple Books
   */
  async fetchRankings(
    marketCode: string = 'br',
    signal?: AbortSignal
  ): Promise<{
    books: HomeBookItem[];
    referenceDate: string;
    marketName: string;
    officialUrl: string;
  }> {
    const market = SUPPORTED_APPLE_MARKETS[marketCode.toLowerCase()] || SUPPORTED_APPLE_MARKETS.br;
    const directUrl = `https://rss.marketingtools.apple.com/api/v2/${market.code}/books/top-paid/10/books.json`;
    const proxyUrl = `/api/bestsellers/apple?market=${encodeURIComponent(market.code)}`;
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9500);

    const onGlobalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onGlobalAbort, { once: true });
    }

    try {
      let res: Response;
      const primaryUrl = isBrowser ? proxyUrl : directUrl;

      try {
        res = await fetch(primaryUrl, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
      } catch (firstErr) {
        // Fallback para URL direta ou proxy se a primeira tentativa falhar
        if (signal?.aborted) throw firstErr;
        const fallbackUrl = primaryUrl === proxyUrl ? directUrl : proxyUrl;
        res = await fetch(fallbackUrl, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
      }

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onGlobalAbort);

      if (!res.ok) {
        throw new Error(`Apple Books RSS HTTP ${res.status}`);
      }

      const json = await res.json();
      const feed = json?.feed;
      const results: any[] = Array.isArray(feed?.results) ? feed.results : [];
      const updatedDate = feed?.updated || new Date().toISOString();

      const books: HomeBookItem[] = results.slice(0, 10).map((item: any, index: number) => {
        const rank = index + 1;
        const generos = Array.isArray(item.genres)
          ? item.genres.map((g: any) => g.name).filter(Boolean)
          : [];
        const highResCover = AppleBooksRankingProvider.optimizeCoverUrl(item.artworkUrl100);
        const releaseYear = item.releaseDate ? parseInt(String(item.releaseDate).slice(0, 4), 10) || null : null;

        return {
          id: `apple_${market.code}_${item.id || rank}`,
          isLocal: false,
          searchResult: {
            origem: 'openlibrary', // compatível para motor de busca
            idExterno: item.id,
            titulo: item.name || 'Sem título',
            autores: item.artistName ? [item.artistName] : ['Autor Desconhecido'],
            anoPublicacao: releaseYear,
            capaUrl: highResCover,
            generos,
            fontes: [`Apple Books (${market.name})`],
          },
          titulo: item.name || 'Sem título',
          autores: item.artistName ? [item.artistName] : ['Autor Desconhecido'],
          capaUrl: highResCover,
          anoPublicacao: releaseYear,
          generos,
          rankPosition: rank,
          reason: `#${rank} no Top e-books da Apple Books (${market.name})`,
        };
      });

      return {
        books,
        referenceDate: updatedDate,
        marketName: market.displayName,
        officialUrl: feed?.links?.[0]?.self || directUrl,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onGlobalAbort);
      throw err;
    }
  }
}
