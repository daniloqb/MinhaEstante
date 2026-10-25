import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Book } from '../types/book';
import {
  LocalShelfFeed,
  ReadingPreferencesService,
  HomeFeedCache,
  TrendsFeed,
  BestSellersFeed,
  GenreRecommendations,
  PersonalRecommendations,
  HomeFeedService,
} from '../features/home-feed';

// Mock simples e fiel do LocalStorage para ambiente de teste Node
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageMock(),
    writable: true,
  });
}

describe('Home Feed & Descoberta Literária (Kindle-inspired Home)', () => {
  beforeEach(() => {
    localStorage.clear();
    HomeFeedCache.clear();
    ReadingPreferencesService.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Seção "Sua Estante" (LocalShelfFeed)', () => {
    it('retorna estado vazio quando não há livros na coleção', () => {
      const section = LocalShelfFeed.getPersonalShelfSection([]);
      expect(section.state).toBe('empty');
      expect(section.books).toHaveLength(0);
      expect(section.type).toBe('personal-shelf');
    });

    it('exclui livros sem posse declarada, incluindo e-books', () => {
      const mockBooks: Book[] = [
        {
          id: 1,
          origem: 'manual',
          titulo: 'Livro Emprestado por Terceiro',
          autores: ['Autor A'],
          generos: ['Ficção'],
          tenho_fisico: false,
          status_leitura: 'quero_ler',
          formato: 'fisico',
          dataCadastro: 1000,
          dataAtualizacao: 1000,
        },
        {
          id: 2,
          origem: 'manual',
          titulo: 'Meu Livro Físico',
          autores: ['Autor B'],
          generos: ['Filosofia'],
          tenho_fisico: true,
          status_leitura: 'nenhum',
          formato: 'fisico',
          dataCadastro: 2000,
          dataAtualizacao: 2000,
        },
        {
          id: 3,
          origem: 'manual',
          titulo: 'Meu E-book',
          autores: ['Autor C'],
          generos: ['Tecnologia'],
          tenho_fisico: false,
          status_leitura: 'lido',
          formato: 'ebook',
          dataCadastro: 3000,
          dataAtualizacao: 3000,
        },
      ];

      const section = LocalShelfFeed.getPersonalShelfSection(mockBooks);
      expect(section.state).toBe('ready');
      expect(section.books).toHaveLength(1);
      expect(section.books[0].titulo).toBe('Meu Livro Físico');
    });

    it('ordena estritamente por dataCadastro decrescente e limita a 10 livros', () => {
      const mockBooks: Book[] = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        origem: 'manual',
        titulo: `Livro ${i + 1}`,
        autores: [`Autor ${i + 1}`],
        generos: ['Ficção'],
        tenho_fisico: true,
        status_leitura: 'nenhum',
        dataCadastro: 1000 + i * 100, // Livro 15 é o mais novo (2400)
        dataAtualizacao: 5000,
      }));

      const section = LocalShelfFeed.getPersonalShelfSection(mockBooks);
      expect(section.books).toHaveLength(10);
      expect(section.books[0].titulo).toBe('Livro 15');
      expect(section.books[9].titulo).toBe('Livro 6');
      expect(section.canViewAll).toBe(true);
    });
  });

  describe('2. Seção "Continue sua jornada literária"', () => {
    it('prioriza livros da lista Quero Ler e obras não lidas na estante', () => {
      const mockBooks: Book[] = [
        {
          id: 1,
          origem: 'manual',
          titulo: 'Livro Já Lido',
          autores: ['Autor A'],
          generos: ['Romance'],
          tenho_fisico: true,
          status_leitura: 'lido',
          nota: 10,
          dataCadastro: 1000,
          dataAtualizacao: 1000,
        },
        {
          id: 2,
          origem: 'manual',
          titulo: 'O Passeador de Livros',
          autores: ['Carsten Henn'],
          generos: ['Romance'],
          tenho_fisico: true,
          status_leitura: 'quero_ler',
          dataCadastro: 2000,
          dataAtualizacao: 2000,
        },
        {
          id: 3,
          origem: 'manual',
          titulo: 'Ensaio Sobre a Cegueira',
          autores: ['José Saramago'],
          generos: ['Clássicos'],
          tenho_fisico: true,
          status_leitura: 'nenhum',
          dataCadastro: 3000,
          dataAtualizacao: 3000,
        },
      ];

      const section = LocalShelfFeed.getReadingJourneySection(mockBooks);
      expect(section.state).toBe('ready');
      expect(section.books).toHaveLength(2);
      expect(section.books[0].titulo).toBe('O Passeador de Livros');
      expect(section.books[0].reason).toContain('Quero Ler');
      expect(section.books[1].titulo).toBe('Ensaio Sobre a Cegueira');
      expect(section.books[1].reason).toContain('estante');
    });
  });

  describe('3. Preferências de Leitura (ReadingPreferencesService)', () => {
    it('carrega preferências padrão quando não há nada no armazenamento', () => {
      const prefs = ReadingPreferencesService.getPreferences();
      expect(prefs.enableRecommendations).toBe(true);
      expect(prefs.favoriteGenres).toEqual([]);
      expect(prefs.hasCompletedOnboarding).toBe(false);
    });

    it('persiste alterações e marca onboarding como concluído', () => {
      ReadingPreferencesService.completeOnboarding(['Filosofia', 'Ficção Científica']);
      const updated = ReadingPreferencesService.getPreferences();
      expect(updated.hasCompletedOnboarding).toBe(true);
      expect(updated.favoriteGenres).toContain('Filosofia');
      expect(updated.favoriteGenres).toContain('Ficção Científica');
    });

    it('sugere gêneros automaticamente analisando a estante do usuário', () => {
      const mockBooks: Book[] = [
        {
          id: 1,
          origem: 'manual',
          titulo: 'Duna',
          autores: ['Frank Herbert'],
          generos: ['Ficção Científica'],
          tenho_fisico: true,
          status_leitura: 'lido',
          nota: 10,
          dataCadastro: 1000,
          dataAtualizacao: 1000,
        },
        {
          id: 2,
          origem: 'manual',
          titulo: 'Neuromancer',
          autores: ['William Gibson'],
          generos: ['Ficção Científica'],
          tenho_fisico: true,
          status_leitura: 'lido',
          nota: 9,
          dataCadastro: 2000,
          dataAtualizacao: 2000,
        },
        {
          id: 3,
          origem: 'manual',
          titulo: 'Crítica da Razão Pura',
          autores: ['Immanuel Kant'],
          generos: ['Filosofia'],
          tenho_fisico: true,
          status_leitura: 'nenhum',
          dataCadastro: 3000,
          dataAtualizacao: 3000,
        },
      ];

      const suggested = ReadingPreferencesService.suggestGenresFromLibrary(mockBooks);
      expect(suggested[0]).toBe('Ficção Científica');
      expect(suggested).toContain('Filosofia');
    });
  });

  describe('4. Seção "Em alta entre leitores" (TrendsFeed)', () => {
    it('consulta Open Library trending e anota posições de ranking e capas', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          works: [
            {
              key: '/works/OL1',
              title: 'Hábitos Atômicos',
              author_name: ['James Clear'],
              cover_i: 12345,
              first_publish_year: 2018,
            },
            {
              key: '/works/OL2',
              title: '1984',
              author_name: ['George Orwell'],
              cover_i: 67890,
              first_publish_year: 1949,
            },
          ],
        }),
      });

      try {
        const section = await TrendsFeed.getTrendingSection();
        expect(section.state).toBe('ready');
        expect(section.books).toHaveLength(2);
        expect(section.books[0].titulo).toBe('Hábitos Atômicos');
        expect(section.books[0].rankPosition).toBe(1);
        expect(section.books[0].capaUrl).toContain('12345-M.jpg');
        expect(section.source).toContain('Open Library');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('utiliza cache para evitar requisições repetidas', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            works: [{ key: '/works/OL1', title: 'Livro Tendência', author_name: ['Autor X'] }],
          }),
        });
      });

      try {
        await TrendsFeed.getTrendingSection();
        expect(callCount).toBe(1);

        // Segunda chamada deve usar o cache
        await TrendsFeed.getTrendingSection();
        expect(callCount).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('5. Seção "Mais vendidos" (BestSellersFeed)', () => {
    it('informa estado limpo sem inventar rankings quando não há chave comercial configurada', async () => {
      const section = await BestSellersFeed.getBestSellersSection(undefined);
      expect(section.type).toBe('bestsellers');
      expect(section.books).toHaveLength(0);
      expect(section.state).toBe('empty');
      expect(section.errorMessage).toContain('Rankings auditados');
    });
  });

  describe('6. Recomendações Baseadas em Conteúdo (PersonalRecommendations)', () => {
    it('calcula perfil bibliográfico com maior peso para avaliações altas e recência', () => {
      const mockBooks: Book[] = [
        {
          id: 1,
          origem: 'manual',
          titulo: 'Fundação',
          autores: ['Isaac Asimov'],
          generos: ['Ficção Científica'],
          tenho_fisico: true,
          status_leitura: 'lido',
          nota: 10,
          anoLeitura: new Date().getFullYear(),
          dataCadastro: 1000,
          dataAtualizacao: 1000,
        },
        {
          id: 2,
          origem: 'manual',
          titulo: 'O Príncipe',
          autores: ['Maquiavel'],
          generos: ['Filosofia'],
          tenho_fisico: true,
          status_leitura: 'lido',
          nota: 4, // nota baixa
          anoLeitura: 2015, // leitura antiga
          dataCadastro: 2000,
          dataAtualizacao: 2000,
        },
      ];

      const profile = PersonalRecommendations.buildUserProfile(mockBooks);
      expect(profile.topGenres[0]).toBe('ficção científica');
      expect(profile.topAuthors[0]).toBe('Isaac Asimov');
      expect(profile.genreWeights['ficção científica']).toBeGreaterThan(profile.genreWeights['filosofia']);
    });

    it('exclui rigorosamente livros que o usuário já possui na estante', async () => {
      const originalFetch = globalThis.fetch;
      const userLibrary: Book[] = [
        {
          id: 1,
          origem: 'manual',
          titulo: 'Duna',
          autores: ['Frank Herbert'],
          generos: ['Ficção Científica'],
          tenho_fisico: true,
          status_leitura: 'lido',
          nota: 10,
          dataCadastro: 1000,
          dataAtualizacao: 1000,
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          works: [
            {
              key: '/works/OL_DUNA',
              title: 'Duna', // Livro já na estante!
              authors: [{ name: 'Frank Herbert' }],
              edition_count: 50,
            },
            {
              key: '/works/OL_NEUROMANCER',
              title: 'Neuromancer', // Novo livro!
              authors: [{ name: 'William Gibson' }],
              edition_count: 40,
            },
          ],
        }),
      });

      try {
        const section = await PersonalRecommendations.getRecommendedSection(userLibrary);
        expect(section.state).toBe('ready');
        // Deve conter Neuromancer, mas NUNCA Duna
        const titles = section.books.map((b) => b.titulo);
        expect(titles).toContain('Neuromancer');
        expect(titles).not.toContain('Duna');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('7. Seção "Porque você gosta de [Gênero]" (GenreRecommendations)', () => {
    it('garante rotação estável baseada na data sem alternar aleatoriamente no mesmo dia', () => {
      const mockBooks: Book[] = [
        {
          id: 1,
          origem: 'manual',
          titulo: 'Livro',
          autores: ['Autor'],
          generos: ['Filosofia', 'História'],
          tenho_fisico: true,
          status_leitura: 'lido',
          dataCadastro: 1000,
          dataAtualizacao: 1000,
        },
      ];

      const g1 = GenreRecommendations.pickStableGenre(mockBooks);
      const g2 = GenreRecommendations.pickStableGenre(mockBooks);
      expect(g1).toBe(g2); // Estabilidade determinística
    });
  });

  describe('8. Orquestração do HomeFeedService', () => {
    it('retorna seções locais instantaneamente e de forma síncrona/offline', () => {
      const sections = HomeFeedService.getLocalSections([]);
      expect(sections).toHaveLength(2);
      expect(sections[0].type).toBe('personal-shelf');
      expect(sections[1].type).toBe('reading-journey');
    });
  });
});
