import { SearchResultBook } from '../../../types/book';
import { BookSearchQuery, ProviderId, ProviderSearchPage } from '../models/DiscoveryTypes';

export interface BookProvider {
  readonly id: ProviderId;
  readonly name: string;

  isConfigured(): boolean;

  search(
    query: BookSearchQuery,
    cursor?: string,
    signal?: AbortSignal
  ): Promise<ProviderSearchPage>;

  getByISBN?(
    isbn: string,
    signal?: AbortSignal
  ): Promise<SearchResultBook | null>;

  getById?(
    id: string,
    signal?: AbortSignal
  ): Promise<SearchResultBook | null>;
}
