import { SearchResultBook } from '../../../types/book';
import { BookSearchQuery, ProviderId, ProviderSearchPage } from '../models/DiscoveryTypes';
import { BookProvider } from './BookProvider';
import { CoverResolver } from '../core/CoverResolver';

export class GoogleBooksProvider implements BookProvider {
  readonly id: ProviderId = 'google';
  readonly name = 'Google Books';

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey?.trim() || undefined;
  }

  setApiKey(key?: string): void {
    this.apiKey = key?.trim() || undefined;
  }

  isConfigured(): boolean {
    return true; // Suporta tanto busca pública anônima quanto com chave pessoal do usuário (BYOK)
  }

  async search(
    query: BookSearchQuery,
    cursor?: string,
    signal?: AbortSignal
  ): Promise<ProviderSearchPage> {
    const startIndex = cursor ? parseInt(cursor, 10) || 0 : 0;
    const maxResults = 30; // Até 40 permitido pelo Google Books

    let qParam = '';
    if (query.intent === 'isbn' && query.cleanIsbn) {
      qParam = `isbn:${encodeURIComponent(query.cleanIsbn)}`;
    } else if (query.intent === 'author' && query.author) {
      qParam = `inauthor:${encodeURIComponent(query.author)}`;
    } else if (query.intent === 'title' && query.title) {
      qParam = `intitle:${encodeURIComponent(query.title)}`;
    } else if (query.intent === 'mixed' && query.title && query.author) {
      qParam = `intitle:${encodeURIComponent(query.title)}+inauthor:${encodeURIComponent(query.author)}`;
    } else {
      const term = query.title || query.raw;
      qParam = encodeURIComponent(term);
    }

    const keyParam = this.apiKey ? `&key=${encodeURIComponent(this.apiKey)}` : '';
    // Sem restrições de country=BR ou printType=books por padrão para catálogo mundial
    const url = `https://www.googleapis.com/books/v1/volumes?q=${qParam}&startIndex=${startIndex}&maxResults=${maxResults}&hl=pt-BR${keyParam}`;

    try {
      let res = await fetch(url, { signal });

      // Se a chamada direta falhar e estiver em ambiente web com servidor disponível, tenta o proxy do backend
      if (!res.ok && typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
        try {
          const proxyKeyParam = this.apiKey ? `&key=${encodeURIComponent(this.apiKey)}` : '';
          const proxyUrl = `/api/books/search?q=${qParam}&cursor=${startIndex}${proxyKeyParam}`;
          const proxyRes = await fetch(proxyUrl, { signal });
          if (proxyRes.ok) {
            const proxyData = await proxyRes.json();
            if (Array.isArray(proxyData.books) && proxyData.books.length > 0) {
              return {
                providerId: this.id,
                books: proxyData.books,
                hasMore: Boolean(proxyData.hasMore),
                nextCursor: proxyData.nextCursor || null,
                httpStatus: 200,
                totalItems: proxyData.totalResults || proxyData.books.length,
              };
            }
          }
        } catch {
          // Continua para tratamento de erro abaixo
        }
      }

      if (!res.ok) {
        let msg = `Google Books HTTP ${res.status}`;
        if (res.status === 429) {
          msg = this.apiKey
            ? 'Cota diária da chave Google Books atingida (HTTP 429)'
            : 'Limite de requisições anônimas do Google Books atingido (HTTP 429). Cadastre sua chave gratuita nas Configurações.';
        } else if (res.status === 401 || res.status === 403) {
          msg = `Chave Google Books inválida ou sem permissão (HTTP ${res.status}). Verifique nas Configurações.`;
        }

        return {
          providerId: this.id,
          books: [],
          hasMore: false,
          httpStatus: res.status,
          errorMessage: msg,
        };
      }

      const data = await res.json();
      const books = this.parseItems(data.items);
      const totalItems = data.totalItems || 0;
      const nextStartIndex = startIndex + books.length;
      const hasMore = nextStartIndex < totalItems && books.length > 0;

      return {
        providerId: this.id,
        books,
        hasMore,
        nextCursor: hasMore ? String(nextStartIndex) : null,
        httpStatus: 200,
        totalItems,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return {
        providerId: this.id,
        books: [],
        hasMore: false,
        errorMessage: err?.message || 'Falha de conexão com Google Books',
      };
    }
  }

  async getByISBN(isbn: string, signal?: AbortSignal): Promise<SearchResultBook | null> {
    const clean = isbn.replace(/[-\s]/g, '');
    const keyParam = this.apiKey ? `&key=${encodeURIComponent(this.apiKey)}` : '';
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${clean}&maxResults=1&hl=pt-BR${keyParam}`;

    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      const books = this.parseItems(data.items);
      return books[0] || null;
    } catch {
      return null;
    }
  }

  async getById(volumeId: string, signal?: AbortSignal): Promise<SearchResultBook | null> {
    const keyParam = this.apiKey ? `?key=${encodeURIComponent(this.apiKey)}` : '';
    const url = `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}${keyParam}`;

    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const item = await res.json();
      const books = this.parseItems([item]);
      return books[0] || null;
    } catch {
      return null;
    }
  }

  private parseItems(items?: any[]): SearchResultBook[] {
    if (!Array.isArray(items)) return [];

    const results: SearchResultBook[] = [];
    for (const item of items) {
      const info = item.volumeInfo;
      if (!info || !info.title?.trim()) continue;

      let isbn10: string | null = null;
      let isbn13: string | null = null;

      if (Array.isArray(info.industryIdentifiers)) {
        for (const id of info.industryIdentifiers) {
          const type = (id.type || '').toUpperCase();
          if (type === 'ISBN_13') isbn13 = id.identifier;
          if (type === 'ISBN_10') isbn10 = id.identifier;
        }
      }

      const imgLinks = info.imageLinks || {};
      const rawCover =
        imgLinks.extraLarge ||
        imgLinks.large ||
        imgLinks.medium ||
        imgLinks.small ||
        imgLinks.thumbnail ||
        imgLinks.smallThumbnail;

      const secureCover = CoverResolver.cleanGoogleCoverUrl(rawCover);
      const year = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) || null : null;

      const generos: string[] = Array.isArray(info.categories)
        ? Array.from(
            new Set<string>(
              info.categories.flatMap((cat: string) =>
                cat.split(/[/,]/).map((c: string) => c.trim()).filter(Boolean)
              )
            )
          )
        : [];

      results.push({
        origem: 'google',
        idExterno: item.id || null,
        volumeId: item.id || null,
        titulo: info.title.trim(),
        subtitulo: info.subtitle || null,
        autores: Array.isArray(info.authors) ? info.authors : [],
        editora: info.publisher || null,
        anoPublicacao: year,
        paginas: info.pageCount || null,
        isbn10,
        isbn13,
        generos,
        descricao: info.description || null,
        capaUrl: secureCover,
        idioma: info.language || null,
        fontes: ['google'],
      });
    }

    return results;
  }
}
