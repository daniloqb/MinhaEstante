import { SearchResultBook } from '../types/book';
import {
  BookDiscoveryEngine,
  validateIsbn,
  cleanIsbnString,
  isValidIsbn10Checksum,
  isValidIsbn13Checksum,
  looksLikeIsbn,
  areIsbnsEquivalent,
  isbn10ToIsbn13,
  EditionMatcher,
  ResultRanking,
  CoverResolver,
  DiscoveryCache,
  BookDiscoveryConfig,
  DiscoverySearchResponse,
  ProviderStatus,
} from '../features/book-discovery';

export {
  validateIsbn,
  cleanIsbnString,
  isValidIsbn10Checksum,
  isValidIsbn13Checksum,
  looksLikeIsbn,
  areIsbnsEquivalent,
  isbn10ToIsbn13,
  EditionMatcher,
  ResultRanking,
  CoverResolver,
  DiscoveryCache,
};

export type { ProviderStatus, DiscoverySearchResponse };

/**
 * Validação de compatibilidade bibliográfica
 */
export function isBibliographicallyCompatible(
  query: string,
  candidateTitle: string,
  candidateAuthors: string[] = []
): boolean {
  const normQ = EditionMatcher.normalizeText(query);
  const normTitle = EditionMatcher.normalizeText(candidateTitle);
  const normAuthors = candidateAuthors.map((a) => EditionMatcher.normalizeText(a));

  if (!normQ || !normTitle) return false;
  if (normTitle.includes(normQ) || normQ.includes(normTitle)) return true;

  const words = normQ.split(' ').filter((w) => w.length > 2);
  if (words.length > 0) {
    const matched = words.filter((w) => normTitle.includes(w) || normAuthors.some((a) => a.includes(w)));
    if (matched.length / words.length >= 0.6) return true;
  }
  return false;
}

/**
 * Critério explícito para verificar se resultados são insuficientes
 */
export function areResultsInsufficient(query: string, results: SearchResultBook[]): boolean {
  if (!results || results.length === 0) return true;
  return !results.some((r) => isBibliographicallyCompatible(query, r.titulo, r.autores));
}

export interface SourceDiagnostic {
  status: 'idle' | 'success' | 'empty' | 'error' | 'skipped';
  httpStatus?: number;
  resultsCount: number;
  errorMessage?: string;
  durationMs?: number;
}

export interface SearchDiagnostic {
  query: string;
  queryType: 'isbn' | 'text';
  timestamp: number;
  sources: {
    googleBooks: SourceDiagnostic;
    openLibrary: SourceDiagnostic;
    brasilApi: SourceDiagnostic;
    localClassics: SourceDiagnostic;
    geminiFallback: SourceDiagnostic;
  };
  geminiTriggered: boolean;
  geminiReason?: string;
  totalResults: number;
}

export interface BookSearchOptions extends BookDiscoveryConfig {}

export const BookSearchService = {
  /**
   * Ponto de entrada de pesquisa padrão utilizando o novo BookDiscoveryEngine
   */
  async search(
    query: string,
    apiKeyOrOptions?: string | BookSearchOptions,
    onProgressiveUpdate?: (results: SearchResultBook[]) => void
  ): Promise<SearchResultBook[]> {
    const config: BookDiscoveryConfig =
      typeof apiKeyOrOptions === 'string'
        ? { googleBooksApiKey: apiKeyOrOptions, geminiApiKey: apiKeyOrOptions }
        : apiKeyOrOptions || {};

    const engine = BookDiscoveryEngine.getInstance(config);
    const response = await engine.search(query);

    if (onProgressiveUpdate && response.books.length > 0) {
      onProgressiveUpdate(response.books);
    }

    return response.books;
  },

  /**
   * Pesquisa estruturada com diagnóstico completo
   */
  async searchWithDiagnostic(
    query: string,
    options?: BookSearchOptions,
    onProgressiveUpdate?: (results: SearchResultBook[]) => void
  ): Promise<{ results: SearchResultBook[]; diagnostic: SearchDiagnostic }> {
    const engine = BookDiscoveryEngine.getInstance(options);
    const response = await engine.search(query);

    if (onProgressiveUpdate && response.books.length > 0) {
      onProgressiveUpdate(response.books);
    }

    // Mapeia o ProviderStatus moderno para o SearchDiagnostic
    const googleStatus = response.providerStatuses.find((p) => p.providerId === 'google');
    const openLibStatus = response.providerStatuses.find((p) => p.providerId === 'openlibrary');
    const brasilApiStatus = response.providerStatuses.find((p) => p.providerId === 'brasilapi');
    const localStatus = response.providerStatuses.find((p) => p.providerId === 'local');

    const diagnostic: SearchDiagnostic = {
      query,
      queryType: validateIsbn(query).isValid ? 'isbn' : 'text',
      timestamp: Date.now(),
      sources: {
        googleBooks: {
          status: (googleStatus?.status as any) || 'idle',
          httpStatus: googleStatus?.httpStatus,
          resultsCount: googleStatus?.resultsCount || 0,
          errorMessage: googleStatus?.errorMessage,
          durationMs: googleStatus?.durationMs,
        },
        openLibrary: {
          status: (openLibStatus?.status as any) || 'idle',
          httpStatus: openLibStatus?.httpStatus,
          resultsCount: openLibStatus?.resultsCount || 0,
          errorMessage: openLibStatus?.errorMessage,
          durationMs: openLibStatus?.durationMs,
        },
        brasilApi: {
          status: (brasilApiStatus?.status as any) || 'idle',
          httpStatus: brasilApiStatus?.httpStatus,
          resultsCount: brasilApiStatus?.resultsCount || 0,
          errorMessage: brasilApiStatus?.errorMessage,
          durationMs: brasilApiStatus?.durationMs,
        },
        localClassics: {
          status: (localStatus?.status as any) || 'idle',
          resultsCount: localStatus?.resultsCount || 0,
        },
        geminiFallback: {
          status: response.geminiEnrichmentAttempted ? 'success' : 'skipped',
          resultsCount: 0,
        },
      },
      geminiTriggered: response.geminiEnrichmentAttempted,
      geminiReason: response.geminiEnrichmentReason,
      totalResults: response.totalResults,
    };

    return { results: response.books, diagnostic };
  },

  async searchFast(query: string, googleBooksApiKey?: string): Promise<SearchResultBook[]> {
    const engine = BookDiscoveryEngine.getInstance({ googleBooksApiKey });
    const response = await engine.search(query);
    return response.books;
  },

  async searchGeminiComplement(
    _query: string,
    _geminiApiKey?: string,
    _googleBooksApiKey?: string,
    currentResults: SearchResultBook[] = []
  ): Promise<SearchResultBook[]> {
    return currentResults;
  },

  clearCache(): void {
    DiscoveryCache.clear();
  },

  parseBrasilApiResult(data: any, originalIsbn: string): SearchResultBook | null {
    if (!data || !data.title?.trim()) return null;
    const rawIsbn = data.isbn ? String(data.isbn).replace(/[-\s]/g, '') : originalIsbn;
    return {
      origem: 'brasilapi',
      idExterno: rawIsbn || data.title,
      titulo: String(data.title).trim(),
      subtitulo: data.subtitle ? String(data.subtitle).trim() : null,
      autores: Array.isArray(data.authors) ? data.authors.map((a: any) => String(a).trim()) : [],
      editora: data.publisher ? String(data.publisher).trim() : null,
      anoPublicacao: data.year ? parseInt(String(data.year), 10) || null : null,
      paginas: data.page_count ? parseInt(String(data.page_count), 10) || null : null,
      isbn10: rawIsbn.length === 10 ? rawIsbn : null,
      isbn13: rawIsbn.length === 13 ? rawIsbn : null,
      generos: Array.isArray(data.subjects) ? data.subjects : [],
      descricao: data.synopsis ? String(data.synopsis).trim() : null,
      capaUrl: data.cover_url || (rawIsbn ? `https://covers.openlibrary.org/b/isbn/${rawIsbn}-M.jpg` : null),
      fontes: ['brasilapi'],
    };
  },

  parseGoogleResults(data: any): SearchResultBook[] {
    if (!data || !Array.isArray(data.items)) return [];
    return data.items.map((item: any) => {
      const info = item.volumeInfo || {};
      const imgLinks = info.imageLinks || {};
      const rawCover =
        imgLinks.extraLarge ||
        imgLinks.large ||
        imgLinks.medium ||
        imgLinks.small ||
        imgLinks.thumbnail ||
        imgLinks.smallThumbnail;

      let isbn10: string | null = null;
      let isbn13: string | null = null;
      if (Array.isArray(info.industryIdentifiers)) {
        for (const id of info.industryIdentifiers) {
          const type = (id.type || '').toUpperCase();
          if (type === 'ISBN_13') isbn13 = id.identifier;
          if (type === 'ISBN_10') isbn10 = id.identifier;
        }
      }

      return {
        origem: 'google',
        idExterno: item.id || null,
        volumeId: item.id || null,
        titulo: String(info.title || '').trim(),
        subtitulo: info.subtitle || null,
        autores: Array.isArray(info.authors) ? info.authors : [],
        editora: info.publisher || null,
        anoPublicacao: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) || null : null,
        paginas: info.pageCount || null,
        isbn10,
        isbn13,
        generos: Array.isArray(info.categories) ? info.categories : [],
        descricao: info.description || null,
        capaUrl: CoverResolver.cleanGoogleCoverUrl(rawCover),
        fontes: ['google'],
      };
    });
  },

  parseOpenLibResults(data: any): SearchResultBook[] {
    if (!data || !Array.isArray(data.docs)) return [];
    return data.docs.map((doc: any) => {
      const isbns: string[] = Array.isArray(doc.isbn) ? doc.isbn : [];
      const cleanIsbns = isbns.map((i) => String(i).replace(/[-\s]/g, ''));
      const isbn13 = cleanIsbns.find((i) => i.length === 13) || null;
      const isbn10 = cleanIsbns.find((i) => i.length === 10) || null;

      let coverUrl: string | null = null;
      if (doc.cover_i && doc.cover_i > 0) {
        coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`;
      } else if (isbn13) {
        coverUrl = CoverResolver.getOpenLibraryIsbnCover(isbn13, 'L');
      }

      return {
        origem: 'openlibrary',
        idExterno: doc.key || null,
        titulo: String(doc.title || '').trim(),
        subtitulo: doc.subtitle || null,
        autores: Array.isArray(doc.author_name) ? doc.author_name : [],
        editora: Array.isArray(doc.publisher) ? doc.publisher[0] : null,
        anoPublicacao: doc.first_publish_year || null,
        paginas: doc.number_of_pages_median || doc.number_of_pages || null,
        isbn10,
        isbn13,
        generos: Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : [],
        descricao: null,
        capaUrl: coverUrl,
        fontes: ['openlibrary'],
      };
    });
  },

  calculateRelevanceScore(query: string, book: SearchResultBook): number {
    return ResultRanking.calculateScore({ raw: query, intent: 'general', title: query }, book);
  },

  mergeAndDeduplicate(...args: any[]): SearchResultBook[] {
    let rawList: SearchResultBook[] = [];
    if (typeof args[0] === 'string') {
      rawList = [...(args[1] || []), ...(args[2] || []), ...(args[3] || []), ...(args[4] || [])];
    } else {
      rawList = [...(args[0] || []), ...(args[1] || []), ...(args[2] || []), ...(args[3] || [])];
    }
    return EditionMatcher.deduplicateEditions(rawList);
  },
};
