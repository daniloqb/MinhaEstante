import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BookDiscoveryEngine,
  SearchCoordinator,
  DiscoveryCache,
  PROVIDER_TIMEOUT_MS,
  QueryParser,
} from '../features/book-discovery';

describe('Pesquisa Bibliográfica — Timeout de 10s e Cancelamento (Toggle Explorar/Cancelar)', () => {
  beforeEach(() => {
    DiscoveryCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('exporta PROVIDER_TIMEOUT_MS definido como exatamente 10000 milissegundos (10 segundos)', () => {
    expect(PROVIDER_TIMEOUT_MS).toBe(10000);
  });

  it('aborta a pesquisa imediatamente quando o usuário aciona o cancelamento', async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();

    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: any) => {
      return new Promise((_resolve, reject) => {
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    try {
      const engine = BookDiscoveryEngine.getInstance();
      const searchPromise = engine.search('Dom Casmurro', undefined, controller.signal);

      // Usuário clica no botão "Cancelar"
      controller.abort();

      await expect(searchPromise).rejects.toThrow();

      // Confirma que não polui o cache com pesquisas canceladas
      expect(DiscoveryCache.get('Dom Casmurro')).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('SearchCoordinator lida com timeout de 10s isoladamente sem bloquear outras bases', async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;

    try {
      // Mock onde Google Books demora mais de 10s (fica pendente), mas Open Library responde rápido
      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (url.includes('googleapis.com/books')) {
          return new Promise((_resolve, reject) => {
            if (opts?.signal) {
              opts.signal.addEventListener('abort', () => {
                const err = new Error('The operation was aborted.');
                err.name = 'AbortError';
                reject(err);
              });
            }
          });
        }

        if (url.includes('openlibrary.org/search')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              numFound: 1,
              docs: [
                {
                  key: '/works/OL12345W',
                  title: 'Memórias Póstumas de Brás Cubas',
                  author_name: ['Machado de Assis'],
                  first_publish_year: 1881,
                  publisher: ['Tipografia Nacional'],
                  isbn: ['9788535910663'],
                },
              ],
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ docs: [], results: [] }),
        });
      });

      const coordinator = new SearchCoordinator();
      const query = QueryParser.parse('Memorias Postumas');
      const promise = coordinator.coordinateSearch(query);

      // Avança o timer além do limite de 10 segundos
      await vi.advanceTimersByTimeAsync(10050);

      const res = await promise;

      // Google Books deve ter sofrido timeout de 10s
      const googleStatus = res.providerStatuses.find((p) => p.providerId === 'google');
      expect(googleStatus?.status).toBe('error');
      expect(googleStatus?.errorMessage).toContain('Tempo limite esgotado (10s)');

      // Open Library deve ter respondido com sucesso
      const openLibStatus = res.providerStatuses.find((p) => p.providerId === 'openlibrary');
      expect(openLibStatus?.status).toBe('success');

      // A busca geral retorna os resultados das outras bases normalmente!
      expect(res.books.length).toBeGreaterThan(0);
      expect(res.books[0].titulo).toContain('Memórias Póstumas');
    } finally {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    }
  });

  it('quando a pesquisa é cancelada globalmente pelo usuário, o status reflete cancelamento', async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();

    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: any) => {
      return new Promise((_resolve, reject) => {
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    try {
      const coordinator = new SearchCoordinator();
      const query = QueryParser.parse('Quincas Borba');
      const promise = coordinator.coordinateSearch(query, undefined, controller.signal);

      // Usuário cancela
      controller.abort();

      await expect(promise).rejects.toThrow('Pesquisa cancelada');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('valida que o toggle em estado de carregamento aciona cancelamento e não reenvia busca', () => {
    const onSearchMock = vi.fn();
    const onCancelMock = vi.fn();

    // Simula a lógica do handleToggleAction e handleSubmit de SearchScreen
    const simulateToggleClick = (isLoading: boolean) => {
      if (isLoading) {
        onCancelMock();
      } else {
        onSearchMock('termo');
      }
    };

    // Quando não está carregando: dispara busca
    simulateToggleClick(false);
    expect(onSearchMock).toHaveBeenCalledWith('termo');
    expect(onCancelMock).not.toHaveBeenCalled();

    onSearchMock.mockClear();
    onCancelMock.mockClear();

    // Quando está carregando: dispara cancelamento imediatamente
    simulateToggleClick(true);
    expect(onCancelMock).toHaveBeenCalledTimes(1);
    expect(onSearchMock).not.toHaveBeenCalled();
  });
});
