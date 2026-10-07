export type ReadingStatus = 'nenhum' | 'lido' | 'quero_ler';

// Formato do livro: Físico ou E-book digital
export type BookFormat = 'fisico' | 'ebook';

// Dados do empréstimo do livro para terceiros
export interface BookLoan {
  nomePessoa: string; // Nome de quem pegou emprestado (obrigatório)
  emailPessoa?: string | null; // E-mail de contato (opcional)
  dataEmprestimo: string; // Data em que o livro foi emprestado (YYYY-MM-DD)
  dataDevolucao: string; // Data prevista para devolução (YYYY-MM-DD)
  dataDevolucaoEfetiva?: string | null; // Data em que foi devolvido (YYYY-MM-DD)
  devolvido?: boolean; // Se o livro já foi devolvido
  observacoes?: string | null;
}

// As abas de consulta da estante unificada: Todos (Físicos + E-books), Lidos, Quero Ler
export type ShelfTab = 'todos' | 'meus_livros' | 'ebook' | 'lido' | 'quero_ler';

// Legado para compatibilidade retroativa com código existente
export type BookStatus = 'todos' | 'meus_livros' | 'ebook' | 'lido' | 'quero_ler';

export type BookOrigin = 'google' | 'openlibrary' | 'brasilapi' | 'manual';

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

  // Formato da obra (Físico ou E-book)
  formato?: BookFormat;

  // Posse e status de leitura independentes
  tenho_fisico: boolean;
  status_leitura: ReadingStatus;

  // Empréstimo ativo ou histórico de empréstimo
  emprestimo?: BookLoan | null;

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
  formato?: BookFormat;
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
  totalEbooks?: number;
  totalFisicos?: number;
}

/**
 * Consulta de pertencimento à aba:
 * - Todos / Estante: apenas livros que tenho fisicamente OU como e-book (posse confirmada)
 * - Lidos: status_leitura === 'lido'
 * - Quero ler: status_leitura === 'quero_ler'
 */
export function isBookInTab(book: Book, tab: ShelfTab): boolean {
  switch (tab) {
    case 'todos':
      // Filtra apenas os livros que o usuário tem fisicamente ou como e-book
      return Boolean(book.tenho_fisico) || book.formato === 'ebook';
    case 'meus_livros':
      return Boolean(book.tenho_fisico);
    case 'ebook':
      return book.formato === 'ebook';
    case 'lido':
      return book.status_leitura === 'lido';
    case 'quero_ler':
      return book.status_leitura === 'quero_ler';
    default:
      return Boolean(book.tenho_fisico) || book.formato === 'ebook';
  }
}

export function isBookBorrowed(book: Book): boolean {
  return Boolean(book.emprestimo && !book.emprestimo.devolvido);
}

export function getShelfTabLabel(tab: ShelfTab): string {
  switch (tab) {
    case 'todos':
    case 'meus_livros':
      return 'Todos';
    case 'ebook':
      return 'E-books';
    case 'lido':
      return 'Lidos';
    case 'quero_ler':
      return 'Quero Ler';
    default:
      return 'Estante';
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
      return 'Livros Físicos';
    case 'ebook':
      return 'E-books';
    case 'lido':
      return 'Lido';
    case 'quero_ler':
      return 'Quero Ler';
    case 'nenhum':
      return 'Sem leitura';
    default:
      return 'Estante';
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
