/**
 * Normalizador Centralizado de Gêneros Literários
 * Mapeia termos internos e multilíngues para as taxonomias de assuntos dos provedores:
 * - Open Library (subject slugs em inglês)
 * - Google Books (categories em inglês/português)
 * - Apple Books (genre mapping)
 */

export interface GenreMapping {
  displayNamePt: string;
  openLibrarySubject: string;
  googleBooksCategory: string;
  appleBooksGenre?: string;
  aliases: string[];
}

export const GENRE_MAPPINGS: GenreMapping[] = [
  {
    displayNamePt: 'Ficção Científica',
    openLibrarySubject: 'science_fiction',
    googleBooksCategory: 'Fiction / Science Fiction',
    appleBooksGenre: 'Ficção científica e fantasia',
    aliases: ['ficção científica', 'sci-fi', 'scifi', 'science fiction', 'ficcao cientifica'],
  },
  {
    displayNamePt: 'Fantasia',
    openLibrarySubject: 'fantasy',
    googleBooksCategory: 'Fiction / Fantasy',
    appleBooksGenre: 'Fantasia',
    aliases: ['fantasia', 'fantasy', 'alta fantasia', 'fantasia épica'],
  },
  {
    displayNamePt: 'Literatura Clássica',
    openLibrarySubject: 'classic_literature',
    googleBooksCategory: 'Fiction / Classics',
    appleBooksGenre: 'Clássicos',
    aliases: ['literatura clássica', 'clássicos', 'classics', 'classic literature', 'classicos', 'literatura classica'],
  },
  {
    displayNamePt: 'Romance',
    openLibrarySubject: 'romance',
    googleBooksCategory: 'Fiction / Romance',
    appleBooksGenre: 'Romance',
    aliases: ['romance', 'love stories', 'novela', 'romance contemporâneo'],
  },
  {
    displayNamePt: 'Filosofia',
    openLibrarySubject: 'philosophy',
    googleBooksCategory: 'Philosophy',
    appleBooksGenre: 'Filosofia',
    aliases: ['filosofia', 'philosophy', 'ética', 'epistemologia', 'metafísica'],
  },
  {
    displayNamePt: 'História',
    openLibrarySubject: 'history',
    googleBooksCategory: 'History',
    appleBooksGenre: 'História',
    aliases: ['história', 'history', 'historia', 'história mundial', 'história do brasil'],
  },
  {
    displayNamePt: 'Biografia & Memórias',
    openLibrarySubject: 'biography',
    googleBooksCategory: 'Biography & Autobiography',
    appleBooksGenre: 'Biografias e memórias',
    aliases: ['biografia', 'biografias', 'memórias', 'memorias', 'autobiografia', 'biography', 'autobiography'],
  },
  {
    displayNamePt: 'Mistério & Suspense',
    openLibrarySubject: 'mystery_and_detective_stories',
    googleBooksCategory: 'Fiction / Mystery & Detective',
    appleBooksGenre: 'Mistério e suspense',
    aliases: ['mistério', 'suspense', 'mystery', 'thriller', 'policial', 'detetive', 'misterio'],
  },
  {
    displayNamePt: 'Terror & Horror',
    openLibrarySubject: 'horror',
    googleBooksCategory: 'Fiction / Horror',
    appleBooksGenre: 'Terror',
    aliases: ['terror', 'horror', 'gótico', 'gotico'],
  },
  {
    displayNamePt: 'Poesia',
    openLibrarySubject: 'poetry',
    googleBooksCategory: 'Poetry',
    appleBooksGenre: 'Poesia',
    aliases: ['poesia', 'poetry', 'poemas', 'versos'],
  },
  {
    displayNamePt: 'Psicologia & Mente',
    openLibrarySubject: 'psychology',
    googleBooksCategory: 'Psychology',
    appleBooksGenre: 'Psicologia',
    aliases: ['psicologia', 'psychology', 'mente', 'psicanálise', 'saúde mental'],
  },
  {
    displayNamePt: 'Economia & Negócios',
    openLibrarySubject: 'economics',
    googleBooksCategory: 'Business & Economics',
    appleBooksGenre: 'Negócios e finanças pessoais',
    aliases: ['economia', 'negócios', 'economics', 'business', 'finanças', 'administração'],
  },
  {
    displayNamePt: 'Ciência & Tecnologia',
    openLibrarySubject: 'science',
    googleBooksCategory: 'Science',
    appleBooksGenre: 'Ciência e natureza',
    aliases: ['ciência', 'tecnologia', 'science', 'technology', 'física', 'astronomia', 'computação'],
  },
  {
    displayNamePt: 'Desenvolvimento Pessoal',
    openLibrarySubject: 'self_help',
    googleBooksCategory: 'Self-Help',
    appleBooksGenre: 'Autoajuda',
    aliases: ['desenvolvimento pessoal', 'autoajuda', 'self-help', 'produtividade', 'hábitos'],
  },
  {
    displayNamePt: 'Arte & Arquitetura',
    openLibrarySubject: 'art',
    googleBooksCategory: 'Art',
    appleBooksGenre: 'Artes e entretenimento',
    aliases: ['arte', 'art', 'arquitetura', 'design', 'pintura', 'fotografia'],
  },
];

export class BookGenreNormalizer {
  private static normalizeKey(val: string): string {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Encontra o mapeamento de um gênero a partir de um termo livre
   */
  static findMapping(inputGenre: string): GenreMapping | null {
    if (!inputGenre || typeof inputGenre !== 'string') return null;
    const clean = this.normalizeKey(inputGenre);
    if (!clean) return null;

    for (const m of GENRE_MAPPINGS) {
      if (this.normalizeKey(m.displayNamePt) === clean) return m;
      if (this.normalizeKey(m.openLibrarySubject) === clean) return m;
      for (const alias of m.aliases) {
        if (this.normalizeKey(alias) === clean) return m;
      }
    }
    return null;
  }

  /**
   * Retorna o slug adequado para a Open Library Subjects API (ex: "classic_literature")
   */
  static toOpenLibrarySubject(inputGenre: string): string {
    const mapping = this.findMapping(inputGenre);
    if (mapping) return mapping.openLibrarySubject;
    // Fallback: sanitiza para slug aceito pela Open Library
    return inputGenre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'general';
  }

  /**
   * Retorna a categoria formatada para consultas na Google Books API
   */
  static toGoogleBooksCategory(inputGenre: string): string {
    const mapping = this.findMapping(inputGenre);
    if (mapping) return mapping.googleBooksCategory;
    return inputGenre.trim();
  }

  /**
   * Retorna o nome amigável para exibição
   */
  static toDisplayName(inputGenre: string): string {
    const mapping = this.findMapping(inputGenre);
    if (mapping) return mapping.displayNamePt;
    return inputGenre.trim();
  }
}
