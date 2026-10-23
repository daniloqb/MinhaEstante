import { SearchResultBook } from '../../../types/book';
import { BookSearchQuery, ProviderId, ProviderSearchPage } from '../models/DiscoveryTypes';
import { BookProvider } from './BookProvider';
import { CoverResolver } from '../core/CoverResolver';

export class OpenLibraryProvider implements BookProvider {
  readonly id: ProviderId = 'openlibrary';
  readonly name = 'Open Library';

  isConfigured(): boolean {
    return true; // API pública e gratuita
  }

  async search(
    query: BookSearchQuery,
    cursor?: string,
    signal?: AbortSignal
  ): Promise<ProviderSearchPage> {
    const page = cursor ? parseInt(cursor, 10) || 1 : 1;
    const limit = 25;

    let searchParams = '';
    if (query.intent === 'isbn' && query.cleanIsbn) {
      searchParams = `isbn=${encodeURIComponent(query.cleanIsbn)}`;
    } else if (query.intent === 'author' && query.author) {
      searchParams = `author=${encodeURIComponent(query.author)}`;
    } else if (query.intent === 'title' && query.title) {
      searchParams = `title=${encodeURIComponent(query.title)}`;
    } else if (query.intent === 'mixed' && query.title && query.author) {
      searchParams = `title=${encodeURIComponent(query.title)}&author=${encodeURIComponent(query.author)}`;
    } else {
      searchParams = `q=${encodeURIComponent(query.title || query.raw)}`;
    }

    const url = `https://openlibrary.org/search.json?${searchParams}&page=${page}&limit=${limit}`;

    try {
      const res = await fetch(url, { signal });
      if (!res.ok) {
        return {
          providerId: this.id,
          books: [],
          hasMore: false,
          httpStatus: res.status,
          errorMessage: `Open Library HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      const docs = data.docs || [];
      const numFound = data.numFound || 0;
      const books = this.parseDocs(docs);

      const hasMore = page * limit < numFound && docs.length > 0;
      const nextCursor = hasMore ? String(page + 1) : null;

      return {
        providerId: this.id,
        books,
        hasMore,
        nextCursor,
        httpStatus: 200,
        totalItems: numFound,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return {
        providerId: this.id,
        books: [],
        hasMore: false,
        errorMessage: err?.message || 'Falha de conexão com Open Library',
      };
    }
  }

  async getByISBN(isbn: string, signal?: AbortSignal): Promise<SearchResultBook | null> {
    const clean = isbn.replace(/[-\s]/g, '');
    const url = `https://openlibrary.org/isbn/${clean}.json`;

    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.title) return null;

      const isbns13: string[] = Array.isArray(data.isbn_13) ? data.isbn_13 : [];
      const isbns10: string[] = Array.isArray(data.isbn_10) ? data.isbn_10 : [];

      let coverUrl: string | null = null;
      if (Array.isArray(data.covers) && data.covers[0]) {
        coverUrl = `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg?default=false`;
      } else {
        coverUrl = CoverResolver.getOpenLibraryIsbnCover(clean, 'L');
      }

      const publishers = Array.isArray(data.publishers) ? data.publishers : [];
      const year = data.publish_date ? parseInt(String(data.publish_date).slice(-4), 10) || null : null;

      return {
        origem: 'openlibrary',
        idExterno: data.key || clean,
        titulo: String(data.title).trim(),
        subtitulo: data.subtitle ? String(data.subtitle).trim() : null,
        autores: [],
        editora: publishers[0] ? String(publishers[0]).trim() : null,
        anoPublicacao: year,
        paginas: data.number_of_pages || null,
        isbn10: isbns10[0] || (clean.length === 10 ? clean : null),
        isbn13: isbns13[0] || (clean.length === 13 ? clean : null),
        generos: [],
        descricao: typeof data.description === 'string' ? data.description : data.description?.value || null,
        capaUrl: coverUrl,
        fontes: ['openlibrary'],
      };
    } catch {
      return null;
    }
  }

  private parseDocs(docs?: any[]): SearchResultBook[] {
    if (!Array.isArray(docs)) return [];

    const results: SearchResultBook[] = [];
    for (const doc of docs) {
      if (!doc || !doc.title?.trim()) continue;

      const isbns: string[] = Array.isArray(doc.isbn) ? doc.isbn : [];
      const cleanIsbns = isbns.map((i) => String(i).replace(/[-\s]/g, ''));
      const isbn13 = cleanIsbns.find((i) => i.length === 13) || null;
      const isbn10 = cleanIsbns.find((i) => i.length === 10) || null;

      let coverUrl: string | null = null;
      if (doc.cover_i && doc.cover_i > 0) {
        coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`;
      } else if (isbn13) {
        coverUrl = CoverResolver.getOpenLibraryIsbnCover(isbn13, 'L');
      } else if (isbn10) {
        coverUrl = CoverResolver.getOpenLibraryIsbnCover(isbn10, 'L');
      }

      const generos: string[] = Array.isArray(doc.subject)
        ? Array.from(
            new Set<string>(
              doc.subject.slice(0, 5).map((s: string) => String(s).trim()).filter(Boolean)
            )
          )
        : [];

      const authors = Array.isArray(doc.author_name) ? doc.author_name : [];
      const publisher = Array.isArray(doc.publisher) ? doc.publisher[0] : null;
      const languages = Array.isArray(doc.language) ? doc.language : [];

      results.push({
        origem: 'openlibrary',
        idExterno: doc.key || null,
        titulo: doc.title.trim(),
        subtitulo: doc.subtitle || null,
        autores: authors,
        editora: publisher,
        anoPublicacao: doc.first_publish_year || null,
        paginas: doc.number_of_pages_median || doc.number_of_pages || null,
        isbn10,
        isbn13,
        generos,
        descricao: null,
        capaUrl: coverUrl,
        idioma: languages[0] || null,
        fontes: ['openlibrary'],
      });
    }

    return results;
  }
}
