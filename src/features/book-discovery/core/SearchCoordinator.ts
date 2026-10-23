import { SearchResultBook } from '../../../types/book';
import {
  AggregatedCursor,
  BookDiscoveryConfig,
  BookSearchQuery,
  DiscoverySearchResponse,
  ProviderId,
  ProviderSearchPage,
  ProviderStatus,
} from '../models/DiscoveryTypes';
import { BookProvider } from '../providers/BookProvider';
import { GoogleBooksProvider } from '../providers/GoogleBooksProvider';
import { OpenLibraryProvider } from '../providers/OpenLibraryProvider';
import { InventaireProvider } from '../providers/InventaireProvider';
import { BrasilApiProvider } from '../providers/BrasilApiProvider';
import { ISBNdbProvider } from '../providers/ISBNdbProvider';
import { LocalCatalogProvider } from '../providers/LocalCatalogProvider';
import { EditionMatcher } from './EditionMatcher';
import { ResultRanking } from './ResultRanking';
import { CoverResolver } from './CoverResolver';

export class SearchCoordinator {
  private providers: Map<ProviderId, BookProvider> = new Map();

  constructor(config?: BookDiscoveryConfig) {
    this.providers.set('google', new GoogleBooksProvider(config?.googleBooksApiKey));
    this.providers.set('openlibrary', new OpenLibraryProvider());
    this.providers.set('inventaire', new InventaireProvider());
    this.providers.set('brasilapi', new BrasilApiProvider());
    this.providers.set('local', new LocalCatalogProvider());
    this.providers.set('isbndb', new ISBNdbProvider(config?.isbndbApiKey));
  }

  updateConfig(config: BookDiscoveryConfig): void {
    const google = this.providers.get('google') as GoogleBooksProvider;
    if (google && config.googleBooksApiKey !== undefined) {
      google.setApiKey(config.googleBooksApiKey);
    }
    const isbndb = this.providers.get('isbndb') as ISBNdbProvider;
    if (isbndb && config.isbndbApiKey !== undefined) {
      isbndb.setApiKey(config.isbndbApiKey);
    }
  }

  getProvider(id: ProviderId): BookProvider | undefined {
    return this.providers.get(id);
  }

  static encodeCursor(cursorObj: AggregatedCursor): string | null {
    const hasAnyMore =
      cursorObj.hasMoreGoogle ||
      cursorObj.hasMoreOpenLibrary ||
      cursorObj.hasMoreInventaire ||
      cursorObj.hasMoreIsbndb;

    if (!hasAnyMore) return null;

    try {
      return btoa(JSON.stringify(cursorObj));
    } catch {
      return null;
    }
  }

  static decodeCursor(cursorStr?: string | null): AggregatedCursor {
    if (!cursorStr) return {};
    try {
      const decoded = JSON.parse(atob(cursorStr));
      return typeof decoded === 'object' && decoded !== null ? decoded : {};
    } catch {
      return {};
    }
  }

  async coordinateSearch(
    query: BookSearchQuery,
    cursor?: string,
    signal?: AbortSignal
  ): Promise<DiscoverySearchResponse> {
    const aggCursor = SearchCoordinator.decodeCursor(cursor);
    const providerStatuses: ProviderStatus[] = [];
    const rawPages: ProviderSearchPage[] = [];

    // Lista de provedores a consultar nesta rodada
    const providersToRun: {
      provider: BookProvider;
      subCursor?: string;
      shouldRun: boolean;
    }[] = [
      {
        provider: this.providers.get('google')!,
        subCursor: aggCursor.googleStartIndex ? String(aggCursor.googleStartIndex) : undefined,
        shouldRun: cursor ? Boolean(aggCursor.hasMoreGoogle) : true,
      },
      {
        provider: this.providers.get('openlibrary')!,
        subCursor: aggCursor.openLibraryPage ? String(aggCursor.openLibraryPage) : undefined,
        shouldRun: cursor ? Boolean(aggCursor.hasMoreOpenLibrary) : true,
      },
      {
        provider: this.providers.get('inventaire')!,
        subCursor: aggCursor.inventairePage ? String(aggCursor.inventairePage) : undefined,
        shouldRun: cursor ? Boolean(aggCursor.hasMoreInventaire) : true,
      },
      {
        provider: this.providers.get('brasilapi')!,
        subCursor: undefined,
        shouldRun: query.intent === 'isbn' || Boolean(query.cleanIsbn),
      },
      {
        provider: this.providers.get('local')!,
        subCursor: undefined,
        shouldRun: !cursor, // Catálogo local só roda na primeira página
      },
      {
        provider: this.providers.get('isbndb')!,
        subCursor: aggCursor.isbndbPage ? String(aggCursor.isbndbPage) : undefined,
        shouldRun: this.providers.get('isbndb')!.isConfigured() && (cursor ? Boolean(aggCursor.hasMoreIsbndb) : true),
      },
    ];

    const promises = providersToRun.map(async ({ provider, subCursor, shouldRun }) => {
      const isConfigured = provider.isConfigured();
      const statusEntry: ProviderStatus = {
        providerId: provider.id,
        name: provider.name,
        status: !isConfigured ? 'unconfigured' : !shouldRun ? 'skipped' : 'searching',
        resultsCount: 0,
        isOptional: provider.id === 'isbndb',
      };

      if (!isConfigured || !shouldRun) {
        providerStatuses.push(statusEntry);
        return;
      }

      const startMs = Date.now();
      try {
        const page = await provider.search(query, subCursor, signal);
        const duration = Date.now() - startMs;
        statusEntry.durationMs = duration;
        statusEntry.httpStatus = page.httpStatus || 200;
        statusEntry.resultsCount = page.books.length;
        statusEntry.status = page.books.length > 0 ? 'success' : 'empty';

        if (page.errorMessage && page.books.length === 0) {
          statusEntry.status = 'error';
          statusEntry.errorMessage = page.errorMessage;
        }

        rawPages.push(page);
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        statusEntry.durationMs = Date.now() - startMs;
        statusEntry.status = 'error';
        statusEntry.errorMessage = err?.message || 'Erro inesperado';
      }

      providerStatuses.push(statusEntry);
    });

    await Promise.allSettled(promises);

    // Constrói novo cursor agregado
    const nextAggCursor: AggregatedCursor = {};
    for (const page of rawPages) {
      if (page.providerId === 'google') {
        nextAggCursor.hasMoreGoogle = page.hasMore;
        nextAggCursor.googleStartIndex = page.nextCursor ? parseInt(page.nextCursor, 10) : undefined;
      } else if (page.providerId === 'openlibrary') {
        nextAggCursor.hasMoreOpenLibrary = page.hasMore;
        nextAggCursor.openLibraryPage = page.nextCursor ? parseInt(page.nextCursor, 10) : undefined;
      } else if (page.providerId === 'inventaire') {
        nextAggCursor.hasMoreInventaire = page.hasMore;
        nextAggCursor.inventairePage = page.nextCursor ? parseInt(page.nextCursor, 10) : undefined;
      } else if (page.providerId === 'isbndb') {
        nextAggCursor.hasMoreIsbndb = page.hasMore;
        nextAggCursor.isbndbPage = page.nextCursor ? parseInt(page.nextCursor, 10) : undefined;
      }
    }

    const nextCursorEncoded = SearchCoordinator.encodeCursor(nextAggCursor);
    const hasMore = Boolean(nextCursorEncoded);

    // Coleta todos os livros brutos retornados
    const allRawBooks: SearchResultBook[] = rawPages.flatMap((p) => p.books);

    // Deduplicação estrita de edições (preserva edições com ISBNs/editoras diferentes)
    const deduplicated = EditionMatcher.deduplicateEditions(allRawBooks);

    // Higienização de capas
    const resolvedCovers = deduplicated.map((book) => ({
      ...book,
      capaUrl: CoverResolver.resolveCover(book),
    }));

    // Classificação determinística por relevância
    const rankedBooks = ResultRanking.rankResults(query, resolvedCovers);

    return {
      books: rankedBooks,
      nextCursor: nextCursorEncoded,
      hasMore,
      totalResults: rankedBooks.length,
      providerStatuses,
      geminiEnrichmentAttempted: false,
    };
  }
}
