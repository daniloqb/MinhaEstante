export type ReadingStatus = 'nenhum' | 'lido' | 'quero_ler' | 'lendo' | 'abandonado';

// Formato do livro: Físico, E-book digital ou Audiolivro
export type BookFormat = 'fisico' | 'ebook' | 'audiolivro';

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

// As abas de consulta da estante unificada: Todos (Físicos + E-books + Audiolivros), Lidos, Quero Ler
export type ShelfTab = 'todos' | 'meus_livros' | 'ebook' | 'lido' | 'quero_ler';

// Legado para compatibilidade retroativa com código existente
export type BookStatus = 'todos' | 'meus_livros' | 'ebook' | 'lido' | 'quero_ler';

export type BookOrigin = 'google' | 'openlibrary' | 'brasilapi' | 'inventaire' | 'isbndb' | 'manual' | 'local';

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

  // Formato primário da obra para compatibilidade retroativa
  formato?: BookFormat;

  // Lista de formatos associados à obra (permite ter físico, e-book e audiolivro simultâneos)
  formatos?: BookFormat[];

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
  tradutores?: string[];
  editora?: string | null;
  anoPublicacao?: number | null;
  paginas?: number | null;
  isbn10?: string | null;
  isbn13?: string | null;
  generos: string[];
  descricao?: string | null;
  capaUrl?: string | null;
  formato?: BookFormat;
  formatos?: BookFormat[];
  idioma?: string | null;
  edicaoId?: string | null;
  obraId?: string | null;
  fontes?: string[];
  relevanceScore?: number;
  volumeId?: string | null;
  wikidataId?: string | null;
  inventaireUri?: string | null;
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
  totalAudiolivros?: number;
}

/**
 * Obtém todos os formatos da obra, com fallback resiliente para campos legados
 */
export function getBookFormats(book?: Partial<Book> | null): BookFormat[] {
  if (!book) return ['fisico'];
  if (Array.isArray(book.formatos) && book.formatos.length > 0) {
    return Array.from(new Set(book.formatos));
  }
  const formats: BookFormat[] = [];
  if (book.formato === 'audiolivro') {
    formats.push('audiolivro');
  } else if (book.formato === 'ebook') {
    formats.push('ebook');
  }
  if (book.tenho_fisico || book.formato === 'fisico') {
    if (!formats.includes('fisico')) {
      formats.push('fisico');
    }
  }
  return formats.length > 0 ? formats : [book.formato || 'fisico'];
}

/**
 * Verifica se a obra contempla determinado formato
 */
export function hasBookFormat(book: Partial<Book> | null | undefined, format: BookFormat): boolean {
  if (!book) return false;
  return getBookFormats(book).includes(format);
}

/**
 * Lista canônica de formatos de livros válidos no sistema
 */
export const VALID_BOOK_FORMATS: readonly BookFormat[] = ['fisico', 'ebook', 'audiolivro'] as const;

/**
 * Alterna a seleção de um formato segundo as regras canônicas do MinhaEstante:
 * 1. Clicar em um formato desmarcado ativa esse formato.
 * 2. Clicar novamente no mesmo formato desativa esse formato.
 * 3. É possível selecionar dois ou três formatos simultaneamente.
 * 4. A seleção de um formato não desativa automaticamente os outros.
 * 5. Pelo menos um formato precisa permanecer selecionado.
 * 6. Quando existe somente um formato ativo, clicar nele novamente não desmarca (mantém inalterado).
 * 7. Evita duplicatas e preserva apenas valores canônicos válidos.
 */
export function toggleBookFormat(
  currentFormats: BookFormat[] | readonly BookFormat[] | undefined | null,
  formatToToggle: BookFormat
): BookFormat[] {
  if (!VALID_BOOK_FORMATS.includes(formatToToggle)) {
    return Array.isArray(currentFormats) && currentFormats.length > 0
      ? (Array.from(new Set(currentFormats)).filter((f): f is BookFormat => VALID_BOOK_FORMATS.includes(f)))
      : ['fisico'];
  }

  // Sanitiza formatos atuais garantindo unicidade e valores canônicos
  const sanitizedCurrent: BookFormat[] = Array.isArray(currentFormats)
    ? Array.from(new Set(currentFormats)).filter((f): f is BookFormat => VALID_BOOK_FORMATS.includes(f))
    : [];

  const baseFormats = sanitizedCurrent.length > 0 ? sanitizedCurrent : (['fisico'] as BookFormat[]);

  if (baseFormats.includes(formatToToggle)) {
    // Tentativa de desmarcar
    if (baseFormats.length <= 1) {
      // Regra 5 e 6: Pelo menos um formato precisa permanecer selecionado
      return baseFormats;
    }
    // Remove o formato mantendo a ordem relativa
    return baseFormats.filter((f) => f !== formatToToggle);
  } else {
    // Adiciona o formato
    return [...baseFormats, formatToToggle];
  }
}

/**
 * Atualiza um livro aplicando a alternância de formato e sincronizando
 * os campos legados (formato principal e tenho_fisico) de forma atômica e consistente.
 */
export function updateBookFormats(book: Book, formatToToggle: BookFormat): Book {
  const currentFormats = getBookFormats(book);
  const nextFormats = toggleBookFormat(currentFormats, formatToToggle);

  // Formato principal: prioriza o formato que acabou de ser ativado se ainda ativo,
  // ou mantém o formato principal anterior se ainda ativo, ou pega o primeiro disponível
  let nextPrimary: BookFormat = book.formato || 'fisico';
  if (nextFormats.includes(formatToToggle)) {
    nextPrimary = formatToToggle;
  } else if (!nextFormats.includes(nextPrimary)) {
    nextPrimary = nextFormats[0] || 'fisico';
  }

  const hasFisico = nextFormats.includes('fisico');

  return {
    ...book,
    formato: nextPrimary,
    formatos: nextFormats,
    tenho_fisico: hasFisico,
    dataAtualizacao: Date.now(),
  };
}

/**
 * Formata os nomes legíveis dos formatos para exibição na UI
 */
export function formatFormatNames(formats?: BookFormat[] | null): string {
  if (!formats || formats.length === 0) return 'Livro Físico';
  const labelMap: Record<BookFormat, string> = {
    fisico: 'Livro Físico',
    ebook: 'E-book Digital',
    audiolivro: 'Audiolivro',
  };
  return formats.map((f) => labelMap[f] || f).join(', ');
}

/**
 * Consulta de pertencimento à aba:
 * - Todos / Estante: apenas livros que tenho fisicamente OU como e-book OU como audiolivro (posse confirmada)
 * - Lidos: status_leitura === 'lido'
 * - Quero ler: status_leitura === 'quero_ler'
 */
export function isBookInTab(book: Book, tab: ShelfTab): boolean {
  switch (tab) {
    case 'todos':
      // Filtra apenas os livros que o usuário tem fisicamente, como e-book ou como audiolivro
      return (
        Boolean(book.tenho_fisico) ||
        hasBookFormat(book, 'ebook') ||
        hasBookFormat(book, 'audiolivro') ||
        book.formato === 'ebook' ||
        book.formato === 'audiolivro'
      );
    case 'meus_livros':
      return Boolean(book.tenho_fisico);
    case 'ebook':
      return hasBookFormat(book, 'ebook') || book.formato === 'ebook';
    case 'lido':
      return book.status_leitura === 'lido';
    case 'quero_ler':
      return book.status_leitura === 'quero_ler';
    default:
      return (
        Boolean(book.tenho_fisico) ||
        hasBookFormat(book, 'ebook') ||
        hasBookFormat(book, 'audiolivro') ||
        book.formato === 'ebook' ||
        book.formato === 'audiolivro'
      );
  }
}

export function isBookBorrowed(book: Book): boolean {
  return Boolean(book.emprestimo && !book.emprestimo.devolvido);
}

export function getShelfTabLabel(tab: ShelfTab): string {
  switch (tab) {
    case 'todos':
    case 'meus_livros':
      return 'Meus Livros';
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
    case 'lendo':
      return 'Lendo';
    case 'abandonado':
      return 'Abandonado';
    default:
      return 'Nenhum';
  }
}

export function getStatusLabel(status: BookStatus | ReadingStatus | BookFormat): string {
  switch (status) {
    case 'meus_livros':
      return 'Livros Físicos';
    case 'ebook':
      return 'E-books';
    case 'audiolivro':
      return 'Audiolivros';
    case 'lido':
      return 'Lido';
    case 'quero_ler':
      return 'Quero Ler';
    case 'lendo':
      return 'Lendo';
    case 'abandonado':
      return 'Abandonado';
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
