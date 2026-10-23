import { SearchResultBook } from '../../../types/book';
import { BookSearchQuery, ProviderId, ProviderSearchPage } from '../models/DiscoveryTypes';
import { BookProvider } from './BookProvider';

export class ISBNdbProvider implements BookProvider {
  readonly id: ProviderId = 'isbndb';
  readonly name = 'ISBNdb (Opcional)';

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey?.trim();
  }

  setApiKey(key?: string): void {
    this.apiKey = key?.trim();
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async search(
    query: BookSearchQuery,
    cursor?: string,
    signal?: AbortSignal
  ): Promise<ProviderSearchPage> {
    if (!this.isConfigured()) {
      return {
        providerId: this.id,
        books: [],
        hasMore: false,
        errorMessage: 'ISBNdb não configurado (chave opcional de desenvolvedor ausente)',
      };
    }

    const page = cursor ? parseInt(cursor, 10) || 1 : 1;
    const pageSize = 20;
    const term = query.cleanIsbn || query.title || query.raw;
    const url = `https://api2.isbndb.com/books/${encodeURIComponent(term)}?page=${page}&pageSize=${pageSize}`;

    try {
      const res = await fetch(url, {
        signal,
        headers: {
          Authorization: this.apiKey!,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        return {
          providerId: this.id,
          books: [],
          hasMore: false,
          httpStatus: res.status,
          errorMessage: `ISBNdb HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      const rawBooks = Array.isArray(data.books) ? data.books : [];
      const total = data.total || 0;
      const books = this.parseBooks(rawBooks);

      const hasMore = page * pageSize < total && rawBooks.length > 0;
      const nextCursor = hasMore ? String(page + 1) : null;

      return {
        providerId: this.id,
        books,
        hasMore,
        nextCursor,
        httpStatus: 200,
        totalItems: total,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return {
        providerId: this.id,
        books: [],
        hasMore: false,
        errorMessage: err?.message || 'Falha de conexão com ISBNdb',
      };
    }
  }

  async getByISBN(isbn: string, signal?: AbortSignal): Promise<SearchResultBook | null> {
    if (!this.isConfigured()) return null;

    const clean = isbn.replace(/[-\s]/g, '');
    const url = `https://api2.isbndb.com/book/${clean}`;

    try {
      const res = await fetch(url, {
        signal,
        headers: {
          Authorization: this.apiKey!,
          Accept: 'application/json',
        },
      });

      if (!res.ok) return null;
      const data = await res.json();
      const raw = data?.book;
      if (!raw) return null;

      const parsed = this.parseBooks([raw]);
      return parsed[0] || null;
    } catch {
      return null;
    }
  }

  private parseBooks(items: any[]): SearchResultBook[] {
    return items.map((item) => {
      const isbns13 = item.isbn13 ? String(item.isbn13).replace(/[-\s]/g, '') : null;
      const isbns10 = item.isbn ? String(item.isbn).replace(/[-\s]/g, '') : null;

      const authors = Array.isArray(item.authors)
        ? item.authors.map((a: any) => String(a).trim())
        : item.author
        ? [String(item.author).trim()]
        : [];

      const year = item.date_published ? parseInt(String(item.date_published).slice(0, 4), 10) || null : null;

      return {
        origem: 'isbndb',
        idExterno: isbns13 || isbns10 || item.title,
        titulo: String(item.title || item.title_long || '').trim(),
        subtitulo: null,
        autores: authors,
        editora: item.publisher ? String(item.publisher).trim() : null,
        anoPublicacao: year,
        paginas: item.pages ? parseInt(String(item.pages), 10) || null : null,
        isbn10: isbns10,
        isbn13: isbns13,
        generos: Array.isArray(item.subjects) ? item.subjects : [],
        descricao: item.synopsis || item.overview || null,
        capaUrl: item.image ? String(item.image).replace(/^http:\/\//i, 'https://') : null,
        idioma: item.language || null,
        fontes: ['isbndb'],
      };
    });
  }
}
