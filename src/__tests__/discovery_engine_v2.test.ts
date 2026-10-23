import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BookDiscoveryEngine,
  isValidIsbn10Checksum,
  isValidIsbn13Checksum,
  areIsbnsEquivalent,
  isbn10ToIsbn13,
  EditionMatcher,
  CoverResolver,
  QueryParser,
  SearchCoordinator,
  DiscoveryCache,
} from '../features/book-discovery';
import { SearchResultBook } from '../types/book';

describe('MinhaEstante 2.0 — Motor Universal de Descoberta Bibliográfica', () => {
  beforeEach(() => {
    DiscoveryCache.clear();
  });

  describe('1. Validação Matemática e Normalização de ISBN', () => {
    it('valida ISBN-10 com mod 11 e caractere X maiúsculo e minúsculo', () => {
      expect(isValidIsbn10Checksum('080442957X')).toBe(true);
      expect(isValidIsbn10Checksum('080442957x')).toBe(true);
      expect(isValidIsbn10Checksum('0198534531')).toBe(true);
      expect(isValidIsbn10Checksum('0198534539')).toBe(false);
    });

    it('valida ISBN-13 com mod 10', () => {
      // 3 Obras de Referência
      expect(isValidIsbn13Checksum('9786585832960')).toBe(true); // As vacas não me olham mais na cara
      expect(isValidIsbn13Checksum('9786581097264')).toBe(true); // Crítica da razão negra
      expect(isValidIsbn13Checksum('9786555604047')).toBe(true); // O passeador de livros
      // Dígito adulterado
      expect(isValidIsbn13Checksum('9786555604048')).toBe(false);
    });

    it('converte corretamente ISBN-10 para ISBN-13', () => {
      // 0198534531 -> 9780198534532
      const conv = isbn10ToIsbn13('0198534531');
      expect(conv).toBe('9780198534532');
      expect(isValidIsbn13Checksum(conv!)).toBe(true);
    });

    it('compara equivalência entre formatos ISBN-10 e ISBN-13', () => {
      expect(areIsbnsEquivalent('0198534531', '9780198534532')).toBe(true);
      expect(areIsbnsEquivalent('9786555604047', '9786555604047')).toBe(true);
      expect(areIsbnsEquivalent('9786555604047', '9786581097264')).toBe(false);
    });
  });

  describe('2. QueryParser — Análise de Intenção e Suporte Internacional', () => {
    it('detecta intenção de ISBN em diversos formatos', () => {
      const q1 = QueryParser.parse('978-65-5560-404-7');
      expect(q1.intent).toBe('isbn');
      expect(q1.cleanIsbn).toBe('9786555604047');

      const q2 = QueryParser.parse('0198534531');
      expect(q2.intent).toBe('isbn');
      expect(q2.cleanIsbn).toBe('9780198534532'); // normalizado para ISBN-13
    });

    it('reconhece prefixos de autor e título em português e inglês', () => {
      const qAuthor = QueryParser.parse('autor: Achille Mbembe');
      expect(qAuthor.intent).toBe('author');
      expect(qAuthor.author).toBe('Achille Mbembe');

      const qTitle = QueryParser.parse('title: O Passeador de Livros');
      expect(qTitle.intent).toBe('title');
      expect(qTitle.title).toBe('O Passeador de Livros');
    });

    it('analisa sintaxe mista "Título por Autor" ou "Title by Author"', () => {
      const q = QueryParser.parse('Crítica da Razão Negra por Achille Mbembe');
      expect(q.intent).toBe('mixed');
      expect(q.title).toBe('Crítica da Razão Negra');
      expect(q.author).toBe('Achille Mbembe');
    });

    it('preserva caracteres não-latinos e Unicode sem corromper', () => {
      const qJp = QueryParser.parse('村上春樹');
      expect(qJp.intent).toBe('general');
      expect(qJp.raw).toBe('村上春樹');

      const qAr = QueryParser.parse('نجيب محفوظ');
      expect(qAr.intent).toBe('general');
      expect(qAr.raw).toBe('نجيب محفوظ');
    });
  });

  describe('3. CoverResolver — Sanitização e Resolução de Capas', () => {
    it('força HTTPS e remove &edge=curl de capas do Google Books', () => {
      const dirtyUrl = 'http://books.google.com/books/content?id=jTn-DwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api';
      const clean = CoverResolver.cleanGoogleCoverUrl(dirtyUrl);
      expect(clean).toContain('https://');
      expect(clean).not.toContain('http://');
      expect(clean).not.toContain('edge=curl');
    });

    it('constrói URL da Open Library com default=false para evitar falsos positivos', () => {
      const olUrl = CoverResolver.getOpenLibraryIsbnCover('9786585832960', 'L');
      expect(olUrl).toBe('https://covers.openlibrary.org/b/isbn/9786585832960-L.jpg?default=false');
    });
  });

  describe('4. EditionMatcher e Deduplicação Estrita', () => {
    it('NUNCA aglutina edições com ISBNs distintos como se fossem duplicadas', () => {
      const edicao1: SearchResultBook = {
        origem: 'google',
        idExterno: 'g1',
        titulo: 'As vacas não me olham mais na cara',
        autores: ['Dora Freind'],
        editora: 'Editora Nós',
        anoPublicacao: 2026,
        isbn13: '9786585832960',
        capaUrl: 'https://exemplo.com/capa1.jpg',
        generos: [],
      };

      const edicao2: SearchResultBook = {
        origem: 'brasilapi',
        idExterno: 'b1',
        titulo: 'As vacas não me olham mais na cara',
        autores: ['Dora Freind'],
        editora: 'Outra Editora',
        anoPublicacao: 2026,
        isbn13: '9786551530005',
        capaUrl: 'https://exemplo.com/capa2.jpg',
        generos: [],
      };

      expect(EditionMatcher.areSameEdition(edicao1, edicao2)).toBe(false);

      const deduplicated = EditionMatcher.deduplicateEditions([edicao1, edicao2]);
      expect(deduplicated.length).toBe(2);
      expect(deduplicated.some((b) => b.isbn13 === '9786585832960')).toBe(true);
      expect(deduplicated.some((b) => b.isbn13 === '9786551530005')).toBe(true);
    });

    it('funde registros comprovadamente da mesma edição enriquecendo metadados', () => {
      const gRecord: SearchResultBook = {
        origem: 'google',
        idExterno: 'vol-123',
        volumeId: 'vol-123',
        titulo: 'O Passeador de Livros',
        autores: ['Carsten Henn'],
        editora: 'Intrínseca',
        anoPublicacao: 2022,
        isbn13: '9786555604047',
        paginas: null, // sem páginas no Google
        capaUrl: 'https://books.google.com/cover.jpg',
        generos: [],
      };

      const brRecord: SearchResultBook = {
        origem: 'brasilapi',
        idExterno: '9786555604047',
        titulo: 'O Passeador de Livros',
        autores: ['Carsten Henn'],
        editora: 'Intrínseca',
        anoPublicacao: 2022,
        isbn13: '9786555604047',
        paginas: 224, // BrasilAPI tem páginas
        capaUrl: null,
        generos: [],
      };

      expect(EditionMatcher.areSameEdition(gRecord, brRecord)).toBe(true);

      const merged = EditionMatcher.mergeEditions(gRecord, brRecord);
      expect(merged.paginas).toBe(224);
      expect(merged.capaUrl).toContain('books.google.com');
      expect(merged.fontes).toContain('google');
      expect(merged.fontes).toContain('brasilapi');
    });
  });

  describe('5. Três Livros de Referência Obrigatórios', () => {
    it('Referência 1: As vacas não me olham mais na cara (Dora Freind, Nós, 2026)', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('googleapis.com/books')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'dora-freind-vol',
                  volumeInfo: {
                    title: 'As vacas não me olham mais na cara',
                    authors: ['Dora Freind'],
                    publisher: 'Nós',
                    publishedDate: '2026',
                    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9786585832960' }],
                    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=dora&edge=curl' },
                  },
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ docs: [], results: [] }) });
      });

      try {
        const engine = BookDiscoveryEngine.getInstance({ googleBooksApiKey: 'TEST_KEY' });
        const res = await engine.search('As vacas não me olham mais na cara');
        expect(res.books.length).toBeGreaterThan(0);
        const book = res.books.find((b) => b.isbn13 === '9786585832960');
        expect(book).toBeDefined();
        expect(book?.titulo).toBe('As vacas não me olham mais na cara');
        expect(book?.autores).toContain('Dora Freind');
        expect(book?.capaUrl).toContain('https://');
        expect(book?.capaUrl).not.toContain('edge=curl');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('Referência 2: Crítica da Razão Negra (Achille Mbembe, N-1 Edições, Vol ID jTn-DwAAQBAJ)', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('googleapis.com/books')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'jTn-DwAAQBAJ',
                  volumeInfo: {
                    title: 'Crítica da razão negra',
                    authors: ['Achille Mbembe'],
                    publisher: 'n-1 edições',
                    publishedDate: '2018',
                    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9786581097264' }],
                    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=jTn-DwAAQBAJ' },
                  },
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ docs: [], results: [] }) });
      });

      try {
        const engine = BookDiscoveryEngine.getInstance({ googleBooksApiKey: 'TEST_KEY' });
        const res = await engine.search('Critica da Razao Negra');
        expect(res.books.length).toBeGreaterThan(0);
        const book = res.books.find((b) => b.volumeId === 'jTn-DwAAQBAJ' || b.isbn13 === '9786581097264');
        expect(book).toBeDefined();
        expect(book?.autores).toContain('Achille Mbembe');
        expect(book?.volumeId).toBe('jTn-DwAAQBAJ');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('Referência 3: O Passeador de Livros (Carsten Henn, Intrínseca, 2022, 9786555604047)', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('googleapis.com/books')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'henn-vol',
                  volumeInfo: {
                    title: 'O Passeador de Livros',
                    authors: ['Carsten Henn'],
                    publisher: 'Intrínseca',
                    publishedDate: '2022',
                    pageCount: 224,
                    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9786555604047' }],
                    imageLinks: { thumbnail: 'https://books.google.com/books/henn.jpg' },
                  },
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ docs: [], results: [] }) });
      });

      try {
        const engine = BookDiscoveryEngine.getInstance({ googleBooksApiKey: 'TEST_KEY' });
        const res = await engine.search('O Passeador de Livros');
        expect(res.books.length).toBeGreaterThan(0);
        const book = res.books.find((b) => b.isbn13 === '9786555604047');
        expect(book).toBeDefined();
        expect(book?.titulo).toBe('O Passeador de Livros');
        expect(book?.editora).toBe('Intrínseca');
        expect(book?.paginas).toBe(224);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('6. Paginação Progressiva Agregada e Cursors', () => {
    it('codifica e decodifica cursor agregado preservando estado de múltiplos provedores', () => {
      const cursorObj = {
        googleStartIndex: 20,
        openLibraryPage: 2,
        inventairePage: 15,
        hasMoreGoogle: true,
        hasMoreOpenLibrary: true,
        hasMoreInventaire: false,
      };

      const encoded = SearchCoordinator.encodeCursor(cursorObj);
      expect(encoded).toBeTruthy();

      const decoded = SearchCoordinator.decodeCursor(encoded);
      expect(decoded.googleStartIndex).toBe(20);
      expect(decoded.openLibraryPage).toBe(2);
      expect(decoded.hasMoreGoogle).toBe(true);
      expect(decoded.hasMoreInventaire).toBe(false);
    });
  });

  describe('7. Tratamento de Erros e Não-Acionamento Silencioso do Gemini', () => {
    it('reporta HTTP 429 ou 403 sem acionar silenciosamente o Gemini quando fontes convencionais falham com erro de cota', async () => {
      const originalFetch = globalThis.fetch;
      let geminiCalled = false;

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('googleapis.com/books')) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({ error: { code: 429, message: 'Resource exhausted' } }),
          });
        }
        if (url.includes('generativelanguage.googleapis.com') || url.includes('/api/isbn')) {
          geminiCalled = true;
          return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ docs: [], results: [] }) });
      });

      try {
        const engine = BookDiscoveryEngine.getInstance({
          googleBooksApiKey: 'KEY',
          geminiApiKey: 'GEMINI_KEY',
        });
        const res = await engine.search('Livro Qualquer');
        const googleStatus = res.providerStatuses.find((p) => p.providerId === 'google');
        expect(googleStatus?.status).toBe('error');
        expect(googleStatus?.httpStatus).toBe(429);
        expect(geminiCalled).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
