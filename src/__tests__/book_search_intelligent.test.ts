import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanIsbnString,
  isValidIsbn10Checksum,
  isValidIsbn13Checksum,
  validateIsbn,
  looksLikeIsbn,
  isBibliographicallyCompatible,
  areResultsInsufficient,
  BookSearchService,
} from '../services/bookSearch';
import { SearchResultBook } from '../types/book';

beforeEach(() => {
  BookSearchService.clearCache();
});

describe('Validação Rigorosa de ISBN (Etapa 1)', () => {
  it('remove hífens e espaços de formatação corretamente', () => {
    expect(cleanIsbnString('978-85-359-1484-9')).toBe('9788535914849');
    expect(cleanIsbnString(' 85 359 0277 5 ')).toBe('8535902775');
    expect(cleanIsbnString('0-19-853453-1')).toBe('0198534531');
  });

  it('valida matematicamente dígitos verificadores de ISBN-10 legítimos', () => {
    expect(isValidIsbn10Checksum('0198534531')).toBe(true);
    expect(isValidIsbn10Checksum('080442957X')).toBe(true);
    expect(isValidIsbn10Checksum('080442957x')).toBe(true);

    // ISBN-10 com dígito verificador errado
    expect(isValidIsbn10Checksum('0198534539')).toBe(false);
    expect(isValidIsbn10Checksum('1234567890')).toBe(false);
  });

  it('valida matematicamente dígitos verificadores de ISBN-13 legítimos', () => {
    expect(isValidIsbn13Checksum('9786556920092')).toBe(true);
    expect(isValidIsbn13Checksum('9788535914849')).toBe(true);
    expect(isValidIsbn13Checksum('9786555604047')).toBe(true);
    expect(isValidIsbn13Checksum('9786581097264')).toBe(true);

    // ISBN-13 com dígito adulterado
    expect(isValidIsbn13Checksum('9788535914840')).toBe(false);
    expect(isValidIsbn13Checksum('9781234567890')).toBe(false);
  });

  it('função validateIsbn categoriza corretamente o tipo de ISBN', () => {
    const res13 = validateIsbn('978-85-359-1484-9');
    expect(res13.isValid).toBe(true);
    expect(res13.type).toBe('isbn13');
    expect(res13.cleanIsbn).toBe('9788535914849');

    const res10 = validateIsbn('080442957X');
    expect(res10.isValid).toBe(true);
    expect(res10.type).toBe('isbn10');
    expect(res10.cleanIsbn).toBe('080442957X');

    const resInvalido = validateIsbn('9788535914840');
    expect(resInvalido.isValid).toBe(false);
    expect(resInvalido.type).toBeNull();
  });

  it('looksLikeIsbn detecta tentativas de ISBN mesmo quando o checksum é inválido', () => {
    expect(looksLikeIsbn('9788535914840')).toBe(true);
    expect(looksLikeIsbn('978-6555604047')).toBe(true);
    expect(looksLikeIsbn('8535902779')).toBe(true);

    // Títulos de livros comuns NÃO devem parecer ISBN
    expect(looksLikeIsbn('O Passeador de Livros')).toBe(false);
    expect(looksLikeIsbn('Crítica da Razão Negra')).toBe(false);
    expect(looksLikeIsbn('Torto Arado')).toBe(false);
    expect(looksLikeIsbn('1984')).toBe(false);
  });
});

describe('Compatibilidade Bibliográfica e Insuficiência de Resultados', () => {
  it('confirma compatibilidade entre títulos e autores correspondentes', () => {
    expect(isBibliographicallyCompatible('O Passeador de Livros', 'O Passeador de Livros', ['Carsten Henn'])).toBe(true);
    expect(isBibliographicallyCompatible('Crítica da Razão Negra', 'Crítica da Razão Negra', ['Achille Mbembe'])).toBe(true);
    expect(isBibliographicallyCompatible('torto arado', 'Torto Arado (Edição Especial)', ['Itamar Vieira Junior'])).toBe(true);
  });

  it('rejeita correspondências alucinadas ou incompatíveis', () => {
    expect(isBibliographicallyCompatible('O Passeador de Livros', 'Manual de Direito Tributário', ['Eduardo'])).toBe(false);
    expect(isBibliographicallyCompatible('Crítica da Razão Negra', 'A Metamorfose', ['Franz Kafka'])).toBe(false);
  });

  it('areResultsInsufficient detecta quando resultados são insuficientes ou satisfatórios', () => {
    expect(areResultsInsufficient('O Passeador de Livros', [])).toBe(true);

    const goodResults: SearchResultBook[] = [
      {
        origem: 'google',
        idExterno: '1',
        titulo: 'O Passeador de Livros',
        subtitulo: null,
        autores: ['Carsten Henn'],
        editora: 'Intrínseca',
        anoPublicacao: 2022,
        paginas: 224,
        isbn10: null,
        isbn13: '9786555604047',
        generos: ['Ficção'],
        descricao: 'Sinopse...',
        capaUrl: 'https://exemplo.com/passeador.jpg',
      },
    ];
    expect(areResultsInsufficient('O Passeador de Livros', goodResults)).toBe(false);

    const unrelatedResults: SearchResultBook[] = [
      {
        origem: 'google',
        idExterno: '2',
        titulo: 'Química Orgânica Geral',
        subtitulo: null,
        autores: ['Silva'],
        editora: 'Editora X',
        anoPublicacao: 2010,
        paginas: 300,
        isbn10: null,
        isbn13: null,
        generos: [],
        descricao: null,
        capaUrl: null,
      },
    ];
    expect(areResultsInsufficient('O Passeador de Livros', unrelatedResults)).toBe(true);
  });
});

describe('Google Books Parser & Capas em Alta Resolução', () => {
  it('extrai capa de melhor resolução, força HTTPS e remove &edge=curl', () => {
    const rawGoogleData = {
      items: [
        {
          id: 'vol_1',
          volumeInfo: {
            title: 'O Passeador de Livros',
            authors: ['Carsten Henn'],
            publisher: 'Intrínseca',
            publishedDate: '2022-05-10',
            pageCount: 224,
            industryIdentifiers: [
              { type: 'ISBN_13', identifier: '9786555604047' },
              { type: 'ISBN_10', identifier: '6555604047' },
            ],
            imageLinks: {
              smallThumbnail: 'http://books.google.com/thumb_small.jpg?edge=curl',
              thumbnail: 'http://books.google.com/thumb.jpg?edge=curl&zoom=1',
              large: 'http://books.google.com/thumb_large.jpg?edge=curl&zoom=3',
            },
            categories: ['Ficção / Literatura'],
            description: 'Uma história encantadora sobre livros e conexões humanas.',
          },
        },
      ],
    };

    const parsed = BookSearchService.parseGoogleResults(rawGoogleData);
    expect(parsed.length).toBe(1);
    const book = parsed[0];
    expect(book.titulo).toBe('O Passeador de Livros');
    expect(book.autores).toContain('Carsten Henn');
    expect(book.editora).toBe('Intrínseca');
    expect(book.isbn13).toBe('9786555604047');
    expect(book.capaUrl).toBe('https://books.google.com/thumb_large.jpg?zoom=3');
    expect(book.capaUrl).not.toContain('http://');
    expect(book.capaUrl).not.toContain('&edge=curl');
  });

  it('não descarta chaves do Google Cloud iniciadas por AIzaSy', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      });
    });

    try {
      await BookSearchService.searchFast('Machado de Assis', 'AIzaSyGoogleBooksKey123');
      const googleUrls = requestedUrls.filter((u) => u.includes('googleapis.com'));
      expect(googleUrls.length).toBeGreaterThan(0);
      expect(googleUrls.every((u) => u.includes('&key=AIzaSyGoogleBooksKey123'))).toBe(true);
      expect(googleUrls.every((u) => !u.includes('country=BR'))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Deduplicação, Preservação de Edições e Relevância', () => {
  it('preserva edições com ISBNs distintos como registros independentes', () => {
    const edicaoIntrinseca: SearchResultBook = {
      origem: 'google',
      idExterno: '1',
      titulo: 'O Passeador de Livros',
      subtitulo: null,
      autores: ['Carsten Henn'],
      editora: 'Intrínseca',
      anoPublicacao: 2022,
      paginas: 224,
      isbn10: '6555604047',
      isbn13: '9786555604047',
      generos: ['Ficção'],
      descricao: null,
      capaUrl: 'https://exemplo.com/capa1.jpg',
    };

    const edicaoAlema: SearchResultBook = {
      origem: 'openlibrary',
      idExterno: '2',
      titulo: 'Der Buchspazierer',
      subtitulo: null,
      autores: ['Carsten Henn'],
      editora: 'Pendo',
      anoPublicacao: 2020,
      paginas: 272,
      isbn10: null,
      isbn13: '9783866124776',
      generos: ['Ficção'],
      descricao: null,
      capaUrl: 'https://exemplo.com/capa2.jpg',
    };

    const merged = BookSearchService.mergeAndDeduplicate(
      'O Passeador de Livros',
      [],
      [],
      [edicaoIntrinseca],
      [edicaoAlema]
    );

    expect(merged.length).toBe(2);
    expect(merged.some((b) => b.isbn13 === '9786555604047')).toBe(true);
    expect(merged.some((b) => b.isbn13 === '9783866124776')).toBe(true);
  });

  it('calcula pontuação de relevância favorecendo correspondência exata de título e capa', () => {
    const exatoComCapa: SearchResultBook = {
      origem: 'google',
      idExterno: '1',
      titulo: 'Crítica da Razão Negra',
      subtitulo: null,
      autores: ['Achille Mbembe'],
      editora: 'N-1 Edições',
      anoPublicacao: 2018,
      paginas: 320,
      isbn10: null,
      isbn13: '9786581097264',
      generos: ['Filosofia'],
      descricao: 'Ensaio',
      capaUrl: 'https://exemplo.com/critica.jpg',
    };

    const parcialSemCapa: SearchResultBook = {
      origem: 'openlibrary',
      idExterno: '2',
      titulo: 'Estudos sobre a Razão',
      subtitulo: null,
      autores: ['Vários Autores'],
      editora: null,
      anoPublicacao: 2010,
      paginas: null,
      isbn10: null,
      isbn13: null,
      generos: [],
      descricao: null,
      capaUrl: null,
    };

    const scoreExato = BookSearchService.calculateRelevanceScore('Crítica da Razão Negra', exatoComCapa);
    const scoreParcial = BookSearchService.calculateRelevanceScore('Crítica da Razão Negra', parcialSemCapa);

    expect(scoreExato).toBeGreaterThan(scoreParcial);
  });
});

describe('Hierarquia de Fontes, Diagnósticos Estruturados e Fallback Condicional', () => {
  it('não aciona o Gemini quando a busca direta é realizada por ISBN', async () => {
    const originalFetch = globalThis.fetch;
    let geminiCalled = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (
        url.includes('generativelanguage.googleapis.com') ||
        url === '/api/isbn' ||
        url.startsWith('/api/isbn?') ||
        url.includes('localhost/api/isbn')
      ) {
        geminiCalled = true;
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });

    try {
      const { diagnostic } = await BookSearchService.searchWithDiagnostic(
        '978-6555604047',
        { geminiApiKey: 'AIzaSyGeminiKey123' }
      );

      expect(diagnostic.queryType).toBe('isbn');
      expect(diagnostic.geminiTriggered).toBe(false);
      expect(geminiCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('não aciona o Gemini quando a busca convencional já retorna resultados satisfatórios', async () => {
    const originalFetch = globalThis.fetch;
    let geminiCalled = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (
        url.includes('generativelanguage.googleapis.com') ||
        url === '/api/isbn' ||
        url.startsWith('/api/isbn?') ||
        url.includes('localhost/api/isbn')
      ) {
        geminiCalled = true;
      }
      if (url.includes('googleapis.com/books')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: '1',
                volumeInfo: {
                  title: 'O Passeador de Livros',
                  authors: ['Carsten Henn'],
                  publisher: 'Intrínseca',
                  publishedDate: '2022',
                  industryIdentifiers: [{ type: 'ISBN_13', identifier: '9786555604047' }],
                },
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ docs: [] }),
      });
    });

    try {
      const { results, diagnostic } = await BookSearchService.searchWithDiagnostic(
        'O Passeador de Livros',
        { googleBooksApiKey: 'AIzaSyGoogleBooksKey', geminiApiKey: 'AIzaSyGeminiKey' }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].titulo).toBe('O Passeador de Livros');
      expect(diagnostic.geminiTriggered).toBe(false);
      expect(geminiCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('registra códigos de status HTTP como 429 ou 403 nos diagnósticos de erro', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('googleapis.com/books')) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({ error: { code: 429, message: 'Resource exhausted' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ docs: [] }),
      });
    });

    try {
      const { diagnostic } = await BookSearchService.searchWithDiagnostic('Livro Sem Chave', {});
      expect(diagnostic.sources.googleBooks.status).toBe('error');
      expect(diagnostic.sources.googleBooks.httpStatus).toBe(429);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejeita sugestões do Gemini que sejam bibliograficamente incompatíveis com a busca', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      // Fontes convencionais retornam vazio
      if (url.includes('googleapis.com/books') && !url.includes('isbn:')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [] }) });
      }
      if (url.includes('openlibrary.org')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ docs: [] }) });
      }
      // Gemini sugere um ISBN válido, mas pertencente a outra obra não relacionada
      if (url.includes('generativelanguage.googleapis.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'ISBN: 9788535914849' }] } }], // 1984
          }),
        });
      }
      // BrasilAPI retorna o livro do ISBN sugerido (1984 de George Orwell)
      if (url.includes('brasilapi.com.br/api/isbn')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            title: '1984',
            authors: ['George Orwell'],
            publisher: 'Companhia das Letras',
            isbn: '9788535914849',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    try {
      // Usuário buscou "O Passeador de Livros"
      const { results } = await BookSearchService.searchWithDiagnostic(
        'O Passeador de Livros',
        { geminiApiKey: 'AIzaSyGeminiKey' }
      );

      // O livro "1984" sugerido erroneamente deve ser sumariamente descartado pela compatibilidade bibliográfica
      expect(results.length).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
