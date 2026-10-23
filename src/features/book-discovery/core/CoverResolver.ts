import { SearchResultBook } from '../../../types/book';

export class CoverResolver {
  /**
   * Sanitiza URLs do Google Books para forçar HTTPS e remover o efeito artificial &edge=curl
   */
  static cleanGoogleCoverUrl(rawUrl?: string | null): string | null {
    if (!rawUrl) return null;
    return rawUrl
      .replace(/^http:\/\//i, 'https://')
      .replace(/([?&])edge=curl&/gi, '$1')
      .replace(/[?&]edge=curl/gi, '')
      .replace(/[?&]$/, '');
  }

  /**
   * Constrói URL de alta resolução da Open Library usando default=false para evitar placeholders falsos
   */
  static getOpenLibraryIsbnCover(isbn: string, size: 'S' | 'M' | 'L' = 'L'): string {
    const clean = isbn.replace(/[-\s]/g, '');
    return `https://covers.openlibrary.org/b/isbn/${clean}-${size}.jpg?default=false`;
  }

  /**
   * Resolve a melhor capa para uma edição bibliográfica
   */
  static resolveCover(book: Partial<SearchResultBook>): string | null {
    // 1. Capa já existente se for do Google Books sanitizada
    if (book.capaUrl && (book.origem === 'google' || book.capaUrl.includes('books.google'))) {
      return this.cleanGoogleCoverUrl(book.capaUrl);
    }

    // 2. Capa existente qualquer
    if (book.capaUrl) {
      return book.capaUrl.replace(/^http:\/\//i, 'https://');
    }

    // 3. Fallback de capa da Open Library por ISBN se tiver ISBN válido
    const isbn = book.isbn13 || book.isbn10;
    if (isbn) {
      return this.getOpenLibraryIsbnCover(isbn, 'M');
    }

    return null;
  }
}
