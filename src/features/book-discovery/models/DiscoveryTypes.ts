import { SearchResultBook } from '../../../types/book';

export type ProviderId = 'google' | 'openlibrary' | 'inventaire' | 'brasilapi' | 'isbndb' | 'local';

export type QueryIntent = 'isbn' | 'title' | 'author' | 'mixed' | 'general';

export interface BookSearchQuery {
  raw: string;
  intent: QueryIntent;
  cleanIsbn?: string;
  title?: string;
  author?: string;
  lang?: string;
  page?: number;
  limit?: number;
}

export type ProviderStatusType =
  | 'idle'
  | 'searching'
  | 'success'
  | 'empty'
  | 'error'
  | 'skipped'
  | 'unconfigured';

export interface ProviderStatus {
  providerId: ProviderId;
  name: string;
  status: ProviderStatusType;
  httpStatus?: number;
  resultsCount: number;
  durationMs?: number;
  errorMessage?: string;
  isOptional?: boolean;
}

export interface AggregatedCursor {
  googleStartIndex?: number;
  openLibraryPage?: number;
  inventairePage?: number;
  isbndbPage?: number;
  hasMoreGoogle?: boolean;
  hasMoreOpenLibrary?: boolean;
  hasMoreInventaire?: boolean;
  hasMoreIsbndb?: boolean;
}

export interface DiscoverySearchResponse {
  books: SearchResultBook[];
  nextCursor: string | null;
  hasMore: boolean;
  totalResults: number;
  providerStatuses: ProviderStatus[];
  geminiEnrichmentAttempted: boolean;
  geminiEnrichmentReason?: string;
}

export interface ProviderSearchPage {
  providerId: ProviderId;
  books: SearchResultBook[];
  nextCursor?: string | null;
  hasMore: boolean;
  httpStatus?: number;
  totalItems?: number;
  errorMessage?: string;
}

export interface BookDiscoveryConfig {
  googleBooksApiKey?: string;
  geminiApiKey?: string;
  isbndbApiKey?: string;
  preferredLanguage?: string;
  enableGeminiFallback?: boolean;
  timeoutMs?: number;
  useBackendIfAvailable?: boolean;
}
