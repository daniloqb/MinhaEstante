export type BookStatus = 'lido' | 'quero_ler';

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
  status: BookStatus;
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
