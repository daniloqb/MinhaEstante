export type ReadingStatus = 'nenhum' | 'lido' | 'quero_ler';

// As 3 abas de consulta da estante
export type ShelfTab = 'meus_livros' | 'lido' | 'quero_ler';

// Legado para compatibilidade retroativa com código existente
export type BookStatus = 'meus_livros' | 'lido' | 'quero_ler';

export type BookOrigin = 'google' | 'openlibrary' | 'manual';

export interface Book {
  id: number;
  origem: BookOrigin;
  idExterno?: string | null;
  titulo: string;
  subtitulo?: string | null;
  autores: string[];
  editora?: string | null;
  anoPublicacao?: number | null;
  paginas?: number | null;
  isbn10?: string | null;
  isbn13?: string | null;
  generos: string[];
  descricao?: string | null;
  capaUrl?: string | null;
  capaLocalPath?: string | null;

  // Nova regra de negócio: posse e status de leitura independentes
  tenho_fisico: boolean;
  status_leitura: ReadingStatus;

  // Campo de compatibilidade opcional
  status?: string;

  mesLeitura?: number | null; // 1-12
  anoLeitura?: number | null;
  nota?: number | null; // 0-10
  observacoes?: string | null;
  dataCadastro: number;
  dataAtualizacao: number;
}

export type ViewMode = 'CAPAS' | 'LISTA';
export type GroupByMode = 'ANO' | 'AUTOR' | 'GENERO';
export type SortOption = 'DATA_LEITURA' | 'TITULO' | 'AUTOR' | 'NOTA' | 'DATA_CADASTRO';

export interface SearchResultBook {
  origem: BookOrigin;
  idExterno?: string | null;
  titulo: string;
  subtitulo?: string | null;
  autores: string[];
  editora?: string | null;
  anoPublicacao?: number | null;
  paginas?: number | null;
  isbn10?: string | null;
  isbn13?: string | null;
  generos: string[];
  descricao?: string | null;
  capaUrl?: string | null;
}

export interface EstanteStats {
  totalMeusLivros: number;
  totalLidos: number;
  totalQueroLer: number;
  totalPaginasLidas: number;
  paginasLidasAnoAtual: number;
  livrosLidosAnoAtual: number;
  notaMedia: number | null;
  lidosPorAno: Record<number, number>;
  topAutores: [string, number][];
  topGeneros: [string, number][];
}

/**
 * Consulta de pertencimento à aba:
 * - Meus Livros: tenho_fisico === true
 * - Lidos: status_leitura === 'lido'
 * - Quero ler: status_leitura === 'quero_ler'
 */
export function isBookInTab(book: Book, tab: ShelfTab): boolean {
  switch (tab) {
    case 'meus_livros':
      return Boolean(book.tenho_fisico);
    case 'lido':
      return book.status_leitura === 'lido';
    case 'quero_ler':
      return book.status_leitura === 'quero_ler';
    default:
      return false;
  }
}

export function getReadingStatusLabel(status: ReadingStatus): string {
  switch (status) {
    case 'nenhum':
      return 'Nenhum';
    case 'lido':
      return 'Lido';
    case 'quero_ler':
      return 'Quero Ler';
    default:
      return 'Nenhum';
  }
}

export function getStatusLabel(status: BookStatus | ReadingStatus): string {
  switch (status) {
    case 'meus_livros':
      return 'Meus Livros';
    case 'lido':
      return 'Lido';
    case 'quero_ler':
      return 'Quero Ler';
    case 'nenhum':
      return 'Sem leitura';
    default:
      return 'Meus Livros';
  }
}

export function formatAuthors(authors: string[]): string {
  if (!authors || authors.length === 0) return 'Autor desconhecido';
  return authors.join(', ');
}

export function formatGenres(genres: string[]): string {
  if (!genres || genres.length === 0) return 'Geral';
  return genres.join(', ');
}

export function formatReadingDate(ano?: number | null, mes?: number | null): string {
  if (ano != null && mes != null) {
    const monthNames = [
      '', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return `${monthNames[mes] || mes}/${ano}`;
  }
  if (ano != null) {
    return `${ano}`;
  }
  return 'Sem data';
}
