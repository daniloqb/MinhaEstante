import { SearchResultBook } from '../../../types/book';
import {
  BookDiscoveryConfig,
  DiscoverySearchResponse,
  ProviderId,
} from '../models/DiscoveryTypes';
import { QueryParser } from './QueryParser';
import { SearchCoordinator } from './SearchCoordinator';
import { DiscoveryCache } from './DiscoveryCache';
import { validateIsbn, cleanIsbnString, looksLikeIsbn } from './ISBNValidator';
import { EditionMatcher } from './EditionMatcher';
import { ResultRanking } from './ResultRanking';
import { getSavedGeminiApiKey } from '../../../services/aiService';

export class BookDiscoveryEngine {
  private static instance: BookDiscoveryEngine;
  private coordinator: SearchCoordinator;
  private config: BookDiscoveryConfig;

  constructor(config?: BookDiscoveryConfig) {
    this.config = config || {};
    this.coordinator = new SearchCoordinator(this.config);
  }

  static getInstance(config?: BookDiscoveryConfig): BookDiscoveryEngine {
    if (!BookDiscoveryEngine.instance) {
      BookDiscoveryEngine.instance = new BookDiscoveryEngine(config);
    } else if (config) {
      BookDiscoveryEngine.instance.updateConfig(config);
    }
    return BookDiscoveryEngine.instance;
  }

  updateConfig(config: Partial<BookDiscoveryConfig>): void {
    this.config = { ...this.config, ...config };
    this.coordinator.updateConfig(this.config);
  }

  /**
   * Ponto central de pesquisa de livros:
   * 1. Consulta cache local
   * 2. Tenta backend Express se disponível (/api/books/search)
   * 3. Executa busca coordenada convencional (Google Books + Open Library + Inventaire + BrasilAPI + Local)
   * 4. Se insuficiente e permitido, aciona fallback estritamente sequencial com Gemini
   */
  async search(
    rawQuery: string,
    cursor?: string,
    signal?: AbortSignal
  ): Promise<DiscoverySearchResponse> {
    const trimmed = (rawQuery || '').trim();
    if (!trimmed) {
      return {
        books: [],
        nextCursor: null,
        hasMore: false,
        totalResults: 0,
        providerStatuses: [],
        geminiEnrichmentAttempted: false,
      };
    }

    // 1. Verificação no cache
    const cached = DiscoveryCache.get(trimmed, cursor);
    if (cached) {
      return cached;
    }

    // Deduplicação de requisições idênticas em andamento
    const inFlight = DiscoveryCache.getInFlight(trimmed, cursor);
    if (inFlight) {
      return inFlight;
    }

    if (signal?.aborted) {
      const abortErr = new Error('Busca cancelada');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const searchPromise = this.executeSearch(trimmed, cursor, signal);
    DiscoveryCache.setInFlight(trimmed, cursor, searchPromise);

    return searchPromise;
  }

  private async executeSearch(
    trimmedQuery: string,
    cursor?: string,
    signal?: AbortSignal
  ): Promise<DiscoverySearchResponse> {
    if (signal?.aborted) {
      const abortErr = new Error('Busca cancelada');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const parsedQuery = QueryParser.parse(trimmedQuery);

    // 2. Executa a busca convencional coordenada
    const response = await this.coordinator.coordinateSearch(parsedQuery, cursor, signal);

    if (signal?.aborted) {
      const abortErr = new Error('Busca cancelada');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    // 3. Avaliação de suficiência para fallback opcional do Gemini (Apenas na página 1 e se não for ISBN)
    // Regra Obrigatória (Cenário D): Não acionar o Gemini silenciosamente para mascarar erro de autenticação (401, 403) ou cota (429) do Google Books
    const googleStatus = response.providerStatuses.find((p) => p.providerId === 'google');
    const isGoogleAuthOrQuotaError =
      googleStatus?.status === 'error' &&
      googleStatus?.httpStatus !== undefined &&
      [401, 403, 429].includes(googleStatus.httpStatus);

    if (!cursor && parsedQuery.intent !== 'isbn' && !looksLikeIsbn(trimmedQuery) && !isGoogleAuthOrQuotaError) {
      const isInsufficient = this.areResultsInsufficient(trimmedQuery, response.books);

      if (isInsufficient) {
        const geminiApiKey = (
          this.config.geminiApiKey ||
          getSavedGeminiApiKey() ||
          ''
        ).trim();

        const isWeb = typeof window !== 'undefined' && window.location.origin.startsWith('http');

        if (geminiApiKey || isWeb) {
          response.geminiEnrichmentAttempted = true;
          response.geminiEnrichmentReason = response.books.length === 0
            ? 'Nenhum resultado nas fontes convencionais'
            : 'Resultados convencionais semanticamente distantes';

          const geminiBooks = await this.executeGeminiFallback(trimmedQuery, geminiApiKey, signal);
          if (geminiBooks.length > 0) {
            // Mescla os livros descobertos pelo fallback sem descartar os já existentes
            const combined = [...geminiBooks, ...response.books];
            const deduplicated = EditionMatcher.deduplicateEditions(combined);
            const ranked = ResultRanking.rankResults(parsedQuery, deduplicated);
            response.books = ranked;
            response.totalResults = ranked.length;
          }
        }
      }
    }

    if (signal?.aborted) {
      const abortErr = new Error('Busca cancelada');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    // Grava no cache
    DiscoveryCache.set(trimmedQuery, cursor, response);
    return response;
  }

  /**
   * Critério estrito de suficiência bibliográfica:
   * Retorna false se houver ao menos um livro cujo título ou autor seja semanticamente compatível.
   */
  private areResultsInsufficient(query: string, books: SearchResultBook[]): boolean {
    if (!books || books.length === 0) return true;

    const normQ = EditionMatcher.normalizeText(query);
    const hasMatch = books.some((b) => {
      const normTitle = EditionMatcher.normalizeText(b.titulo);
      const normAuthors = (b.autores || []).map((a) => EditionMatcher.normalizeText(a));

      if (normTitle.includes(normQ) || normQ.includes(normTitle)) return true;

      const words = normQ.split(' ').filter((w) => w.length > 2);
      if (words.length > 0) {
        const matched = words.filter((w) => normTitle.includes(w) || normAuthors.some((a) => a.includes(w)));
        if (matched.length / words.length >= 0.6) return true;
      }
      return false;
    });

    return !hasMatch;
  }

  /**
   * Descoberta bibliográfica complementar via Gemini (Secundária e Excepcional)
   */
  private async executeGeminiFallback(
    query: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<SearchResultBook[]> {
    const prompt = `retornar somente o número do isbn 13 do livro ${query.trim()}`;
    let candidateIsbns: string[] = [];

    // Tenta primeiro endpoint local do servidor
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http')) {
      try {
        const res = await fetch('/api/isbn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({ termo: query, userApiKey: apiKey }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.isbn) {
            const clean = cleanIsbnString(data.isbn);
            if (validateIsbn(clean).isValid) {
              candidateIsbns.push(clean);
            }
          }
        }
      } catch {
        // Segue para chamada direta se falhar
      }
    }

    // Se não encontrou e possui chave, tenta direto via Gemini
    if (candidateIsbns.length === 0 && apiKey) {
      const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
      for (const model of models) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1 },
            }),
          });
          if (!res.ok) continue;
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const matches = text.replace(/[-\s:]/g, '').match(/97[89][0-9]{10}/g) || [];
          const valid = Array.from(new Set<string>(matches)).filter((c) => validateIsbn(c).isValid);
          if (valid.length > 0) {
            candidateIsbns = valid;
            break;
          }
        } catch {
          // Tenta o próximo
        }
      }
    }

    if (candidateIsbns.length === 0) return [];

    // Confirma cada ISBN nas fontes oficiais (BrasilAPI e Google Books)
    const confirmedBooks: SearchResultBook[] = [];
    for (const isbn of candidateIsbns) {
      const bApi = this.coordinator.getProvider('brasilapi');
      if (bApi?.getByISBN) {
        const book = await bApi.getByISBN(isbn, signal);
        if (book && !this.areResultsInsufficient(query, [book])) {
          confirmedBooks.push(book);
          continue;
        }
      }

      const gBooks = this.coordinator.getProvider('google');
      if (gBooks?.getByISBN) {
        const book = await gBooks.getByISBN(isbn, signal);
        if (book && !this.areResultsInsufficient(query, [book])) {
          confirmedBooks.push(book);
        }
      }
    }

    return confirmedBooks;
  }

  async getByISBN(isbn: string, signal?: AbortSignal): Promise<SearchResultBook | null> {
    const clean = cleanIsbnString(isbn);
    if (!clean) return null;

    // 1. Tenta BrasilAPI
    const brasilApi = this.coordinator.getProvider('brasilapi');
    if (brasilApi?.getByISBN) {
      const book = await brasilApi.getByISBN(clean, signal);
      if (book) return book;
    }

    // 2. Tenta Google Books
    const google = this.coordinator.getProvider('google');
    if (google?.getByISBN) {
      const book = await google.getByISBN(clean, signal);
      if (book) return book;
    }

    // 3. Tenta Open Library
    const openLib = this.coordinator.getProvider('openlibrary');
    if (openLib?.getByISBN) {
      const book = await openLib.getByISBN(clean, signal);
      if (book) return book;
    }

    return null;
  }

  async getById(id: string, provider: ProviderId = 'google', signal?: AbortSignal): Promise<SearchResultBook | null> {
    const p = this.coordinator.getProvider(provider);
    if (p?.getById) {
      return p.getById(id, signal);
    }
    return null;
  }
}
