import { Book, SearchResultBook } from '../../types/book';

export type HomeSectionType =
  | 'personal-shelf'
  | 'trending'
  | 'apple-books'
  | 'bestsellers'
  | 'genre'
  | 'recommended'
  | 'new-releases'
  | 'reading-journey';

export interface DiscoveryNavigationContext {
  source: 'home';
  mode?: 'genre' | 'trending' | 'bestsellers' | 'apple-books' | 'releases' | 'recommended';
  genre?: string;
  provider?: string;
  market?: string;
  title?: string;
  sourceName?: string;
  referenceDate?: string;
  searchTerm?: string;
  type?: HomeSectionType;
  books?: HomeBookItem[];
}

export interface HomeBookItem {
  id: string;
  isLocal: boolean;
  localBook?: Book;
  searchResult?: SearchResultBook;
  titulo: string;
  autores: string[];
  capaUrl?: string | null;
  capaLocalPath?: string | null;
  anoPublicacao?: number | null;
  editora?: string | null;
  generos?: string[];
  isbn13?: string | null;
  isbn10?: string | null;
  reason?: string;
  rankPosition?: number;
  rating?: number | null;
  releaseType?: 'new-work' | 'new-edition';
  externalLink?: string;
}

export interface HomeBookSection {
  id: string;
  type: HomeSectionType;
  title: string;
  subtitle?: string;
  source?: string;
  referenceDate?: string;
  books: HomeBookItem[];
  state: 'loading' | 'ready' | 'empty' | 'error';
  errorMessage?: string;
  genre?: string;
  canViewAll?: boolean;
  lastUpdated?: number;
  isCached?: boolean;
  discoveryContext?: DiscoveryNavigationContext;
}

export interface ReadingPreferences {
  favoriteGenres: string[];
  preferredLanguages: string[];
  fictionPreference: 'all' | 'fiction' | 'non-fiction';
  enableRecommendations: boolean;
  avoidGenres: string[];
  hasCompletedOnboarding: boolean;
  updatedAt: number;
}

export const STANDARD_GENRES = [
  'Romance',
  'Literatura Clássica',
  'Ficção Científica',
  'Fantasia',
  'Filosofia',
  'História',
  'Biografia & Memórias',
  'Suspense & Mistério',
  'Poesia',
  'Ciência & Natureza',
  'Tecnologia',
  'Desenvolvimento Pessoal',
  'Religião & Espiritualidade',
  'Psicologia',
  'Economia & Negócios',
  'Arte & Arquitetura',
  'Terror & Horror',
  'Sociologia & Política',
  'Aventura',
  'Contos & Crônicas',
];
