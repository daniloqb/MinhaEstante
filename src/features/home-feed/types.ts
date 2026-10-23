import { Book, SearchResultBook } from '../../types/book';

export type HomeSectionType =
  | 'personal-shelf'
  | 'trending'
  | 'bestsellers'
  | 'genre'
  | 'recommended'
  | 'new-releases'
  | 'reading-journey';

export interface HomeBookItem {
  id: string;
  isLocal: boolean;
  localBook?: Book;
  searchResult?: SearchResultBook;
  titulo: string;
  autores: string[];
  capaUrl?: string | null;
  anoPublicacao?: number | null;
  editora?: string | null;
  generos?: string[];
  isbn13?: string | null;
  isbn10?: string | null;
  reason?: string;
  rankPosition?: number;
  rating?: number | null;
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
