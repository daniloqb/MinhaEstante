import { SearchResultBook } from '../../../types/book';
import { BookSearchQuery, ProviderId, ProviderSearchPage } from '../models/DiscoveryTypes';
import { BookProvider } from './BookProvider';
import { CoverResolver } from '../core/CoverResolver';

export class BrasilApiProvider implements BookProvider {
  readonly id: ProviderId = 'brasilapi';
  readonly name = 'BrasilAPI';

  isConfigured(): boolean {
    return true; // Endpoint público
  }

  async search(
    query: BookSearchQuery,
    _cursor?: string,
    signal?: AbortSignal
  ): Promise<ProviderSearchPage> {
    // A BrasilAPI não possui busca textual livre por título; apenas por ISBN
    if (query.intent !== 'isbn' && !query.cleanIsbn) {
      return {
        providerId: this.id,
        books: [],
        hasMore: false,
        httpStatus: 200,
      };
    }

    const clean = (query.cleanIsbn || query.raw).replace(/[-\s]/g, '');
    const book = await this.getByISBN(clean, signal);

    return {
      providerId: this.id,
      books: book ? [book] : [],
      hasMore: false,
      httpStatus: book ? 200 : 404,
      totalItems: book ? 1 : 0,
    };
  }

  async getByISBN(isbn: string, signal?: AbortSignal): Promise<SearchResultBook | null> {
    const clean = isbn.replace(/[-\s]/g, '');
    const url = `https://brasilapi.com.br/api/isbn/v1/${clean}`;

    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.title?.trim()) return null;

      const rawIsbn = data.isbn ? String(data.isbn).replace(/[-\s]/g, '') : clean;
      const isbn10 = rawIsbn.length === 10 ? rawIsbn : null;
      const isbn13 = rawIsbn.length === 13 ? rawIsbn : null;

      let coverUrl: string | null = data.cover_url || null;
      if (!coverUrl && rawIsbn) {
        coverUrl = CoverResolver.getOpenLibraryIsbnCover(rawIsbn, 'M');
      }

      const generos: string[] = Array.isArray(data.subjects)
        ? Array.from(
            new Set<string>(
              data.subjects.flatMap((s: string) =>
                String(s)
                  .split(/[/,]/)
                  .map((c: string) => c.trim())
                  .filter(Boolean)
              )
            )
          )
        : [];

      const autores: string[] =
        Array.isArray(data.authors) && data.authors.length > 0
          ? data.authors.map((a: string) => String(a).trim()).filter(Boolean)
          : [];

      return {
        origem: 'brasilapi',
        idExterno: rawIsbn || data.title,
        titulo: String(data.title).trim(),
        subtitulo: data.subtitle ? String(data.subtitle).trim() : null,
        autores,
        editora: data.publisher ? String(data.publisher).trim() : null,
        anoPublicacao: data.year ? parseInt(String(data.year), 10) || null : null,
        paginas: data.page_count ? parseInt(String(data.page_count), 10) || null : null,
        isbn10,
        isbn13,
        generos,
        descricao: data.synopsis ? String(data.synopsis).trim() : null,
        capaUrl: coverUrl,
        fontes: ['brasilapi'],
      };
    } catch {
      return null;
    }
  }
}
