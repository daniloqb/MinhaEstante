import { SearchResultBook } from '../../../types/book';
import { BookSearchQuery, ProviderId, ProviderSearchPage } from '../models/DiscoveryTypes';
import { BookProvider } from './BookProvider';
import { CLASSIC_BOOKS_CATALOG, searchLocalClassics } from '../../../services/classicBooksCatalog';
import { areIsbnsEquivalent } from '../core/ISBNValidator';

export class LocalCatalogProvider implements BookProvider {
  readonly id: ProviderId = 'local';
  readonly name = 'Catálogo Clássico Local';

  isConfigured(): boolean {
    return true;
  }

  async search(
    query: BookSearchQuery,
    cursor?: string,
    _signal?: AbortSignal
  ): Promise<ProviderSearchPage> {
    const page = cursor ? parseInt(cursor, 10) || 1 : 1;
    const limit = 20;

    let matches: SearchResultBook[] = [];
    if (query.intent === 'isbn' && query.cleanIsbn) {
      matches = CLASSIC_BOOKS_CATALOG.filter(
        (b) => areIsbnsEquivalent(b.isbn13, query.cleanIsbn) || areIsbnsEquivalent(b.isbn10, query.cleanIsbn)
      );
    } else {
      matches = searchLocalClassics(query.title || query.raw);
    }

    const startIndex = (page - 1) * limit;
    const pageItems = matches.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < matches.length;
    const nextCursor = hasMore ? String(page + 1) : null;

    return {
      providerId: this.id,
      books: pageItems.map((b) => ({ ...b, origem: 'local', fontes: ['local'] })),
      hasMore,
      nextCursor,
      httpStatus: 200,
      totalItems: matches.length,
    };
  }

  async getByISBN(isbn: string): Promise<SearchResultBook | null> {
    const match = CLASSIC_BOOKS_CATALOG.find(
      (b) => areIsbnsEquivalent(b.isbn13, isbn) || areIsbnsEquivalent(b.isbn10, isbn)
    );
    return match ? { ...match, origem: 'local', fontes: ['local'] } : null;
  }
}
