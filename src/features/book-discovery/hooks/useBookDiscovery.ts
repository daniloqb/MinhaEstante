import { useState, useCallback, useRef, useEffect } from 'react';
import { SearchResultBook } from '../../../types/book';
import { BookDiscoveryConfig, ProviderStatus } from '../models/DiscoveryTypes';
import { BookDiscoveryEngine } from '../core/BookDiscoveryEngine';

export type SearchUiState =
  | 'idle'
  | 'searching'
  | 'partial'
  | 'success'
  | 'empty'
  | 'error';

export interface UseBookDiscoveryReturn {
  results: SearchResultBook[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  providerStatuses: ProviderStatus[];
  searchState: SearchUiState;
  search: (query: string) => Promise<void>;
  loadMore: () => Promise<void>;
  clear: () => void;
  updateConfig: (config: Partial<BookDiscoveryConfig>) => void;
}

export function useBookDiscovery(initialConfig?: BookDiscoveryConfig): UseBookDiscoveryReturn {
  const [results, setResults] = useState<SearchResultBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [searchState, setSearchState] = useState<SearchUiState>('idle');

  const currentQueryRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const engineRef = useRef<BookDiscoveryEngine>(BookDiscoveryEngine.getInstance(initialConfig));

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const updateConfig = useCallback((config: Partial<BookDiscoveryConfig>) => {
    engineRef.current.updateConfig(config);
  }, []);

  const clear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    currentQueryRef.current = '';
    setResults([]);
    setNextCursor(null);
    setHasMore(false);
    setError(null);
    setProviderStatuses([]);
    setSearchState('idle');
    setIsLoading(false);
    setIsLoadingMore(false);
  }, []);

  const search = useCallback(
    async (rawQuery: string) => {
      const trimmed = (rawQuery || '').trim();
      if (!trimmed) {
        clear();
        return;
      }

      // Cancela requisição anterior se houver
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      currentQueryRef.current = trimmed;
      setIsLoading(true);
      setError(null);
      setSearchState('searching');

      try {
        const response = await engineRef.current.search(trimmed, undefined, controller.signal);

        // Se uma nova busca foi disparada nesse meio tempo, ignora a resposta antiga
        if (currentQueryRef.current !== trimmed) return;

        setResults(response.books);
        setNextCursor(response.nextCursor);
        setHasMore(response.hasMore);
        setProviderStatuses(response.providerStatuses);

        const allFailed =
          response.providerStatuses.length > 0 &&
          response.providerStatuses.every((p) => p.status === 'error' || p.status === 'unconfigured');

        if (allFailed) {
          setSearchState('error');
          setError('Todos os catálogos bibliográficos estão temporariamente indisponíveis. Verifique sua conexão com a internet.');
        } else if (response.books.length === 0) {
          setSearchState('empty');
          setError(`Nenhum livro encontrado para "${trimmed}"`);
        } else {
          setSearchState('success');
          setError(null);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (currentQueryRef.current === trimmed) {
          setSearchState('error');
          setError('Ocorreu um erro ao consultar os catálogos mundiais. Tente novamente.');
        }
      } finally {
        if (currentQueryRef.current === trimmed) {
          setIsLoading(false);
        }
      }
    },
    [clear]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoading || isLoadingMore || !currentQueryRef.current) {
      return;
    }

    setIsLoadingMore(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await engineRef.current.search(
        currentQueryRef.current,
        nextCursor,
        controller.signal
      );

      setResults((prev) => {
        // Concatena novos livros evitando duplicar edições que já estejam na lista
        const combined = [...prev, ...response.books];
        return combined;
      });

      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
      setProviderStatuses(response.providerStatuses);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn('Falha ao carregar mais resultados:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, nextCursor, isLoading, isLoadingMore]);

  return {
    results,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    providerStatuses,
    searchState,
    search,
    loadMore,
    clear,
    updateConfig,
  };
}
