import { SearchResultBook } from '../types/book';

export const BookSearchService = {
  async search(query: string, apiKey?: string): Promise<SearchResultBook[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cleanIsbn = trimmed.replace(/[-\s]/g, '');
    const isIsbn =
      (cleanIsbn.length === 10 || cleanIsbn.length === 13) &&
      cleanIsbn.split('').every((c) => (c >= '0' && c <= '9') || c === 'X' || c === 'x');

    const googleQuery = isIsbn ? `isbn:${cleanIsbn}` : encodeURIComponent(trimmed);
    const openLibQuery = isIsbn ? cleanIsbn : encodeURIComponent(trimmed);

    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&maxResults=20${
      apiKey?.trim() ? `&key=${apiKey.trim()}` : ''
    }`;
    const openLibUrl = `https://openlibrary.org/search.json?q=${openLibQuery}&limit=20`;

    // Execute concurrently with fallback on error
    const [googlePromise, openLibPromise] = await Promise.allSettled([
      fetch(googleUrl)
        .then(async (res) => {
          if (!res.ok) return [];
          const data = await res.json();
          return this.parseGoogleResults(data);
        })
        .catch(() => []),
      fetch(openLibUrl)
        .then(async (res) => {
          if (!res.ok) return [];
          const data = await res.json();
          return this.parseOpenLibResults(data);
        })
        .catch(() => []),
    ]);

    const googleResults: SearchResultBook[] =
      googlePromise.status === 'fulfilled' ? googlePromise.value : [];
    const openLibResults: SearchResultBook[] =
      openLibPromise.status === 'fulfilled' ? openLibPromise.value : [];

    return this.mergeAndDeduplicate(googleResults, openLibResults);
  },

  parseGoogleResults(data: any): SearchResultBook[] {
    if (!data || !Array.isArray(data.items)) return [];

    const results: SearchResultBook[] = [];
    for (const item of data.items) {
      const info = item.volumeInfo;
      if (!info || !info.title?.trim()) continue;

      let isbn10: string | null = null;
      let isbn13: string | null = null;

      if (Array.isArray(info.industryIdentifiers)) {
        for (const id of info.industryIdentifiers) {
          const type = id.type?.toUpperCase();
          if (type === 'ISBN_13') isbn13 = id.identifier;
          if (type === 'ISBN_10') isbn10 = id.identifier;
        }
      }

      const rawCover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail;
      const secureCover = rawCover ? rawCover.replace('http://', 'https://') : null;
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
      });
    }

    return results;
  },

  parseOpenLibResults(data: any): SearchResultBook[] {
    if (!data || !Array.isArray(data.docs)) return [];

    const results: SearchResultBook[] = [];
    for (const doc of data.docs) {
      if (!doc || !doc.title?.trim()) continue;

      const isbns: string[] = Array.isArray(doc.isbn) ? doc.isbn : [];
      const isbn13 = isbns.find((i) => i.replace(/[-\s]/g, '').length === 13) || null;
      const isbn10 = isbns.find((i) => i.replace(/[-\s]/g, '').length === 10) || null;

      let coverUrl: string | null = null;
      if (doc.cover_i && doc.cover_i > 0) {
        coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
      } else if (isbn13) {
        coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg`;
      } else if (isbn10) {
        coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn10}-M.jpg`;
      }

      const generos = Array.isArray(doc.subject)
        ? doc.subject.slice(0, 5).map((s: string) => String(s).trim())
        : [];

      results.push({
        origem: 'openlibrary',
        idExterno: doc.key || null,
        titulo: doc.title.trim(),
        subtitulo: doc.subtitle || null,
        autores: Array.isArray(doc.author_name) ? doc.author_name : [],
        editora: Array.isArray(doc.publisher) ? doc.publisher[0] : null,
        anoPublicacao: doc.first_publish_year || null,
        paginas: doc.number_of_pages_median || doc.number_of_pages || null,
        isbn10,
        isbn13,
        generos,
        descricao: null,
        capaUrl: coverUrl,
      });
    }

    return results;
  },

  mergeAndDeduplicate(
    googleList: SearchResultBook[],
    openLibList: SearchResultBook[]
  ): SearchResultBook[] {
    const merged: SearchResultBook[] = [];
    const seenIsbns = new Set<string>();
    const seenTitleAuthors = new Set<string>();

    const keyTitleAuthor = (title: string, authors: string[]) => {
      const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normAuthor = (authors[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return `${normTitle}|${normAuthor}`;
    };

    // Google Books first
    for (const gBook of googleList) {
      const taKey = keyTitleAuthor(gBook.titulo, gBook.autores);
      let finalBook = { ...gBook };

      // If Google has no cover, lookup in OpenLibrary
      if (!finalBook.capaUrl) {
        const matchingOl = openLibList.find((ol) => {
          if (ol.isbn13 && (ol.isbn13 === finalBook.isbn13 || ol.isbn13 === finalBook.isbn10)) return true;
          if (ol.isbn10 && (ol.isbn10 === finalBook.isbn10 || ol.isbn10 === finalBook.isbn13)) return true;
          return keyTitleAuthor(ol.titulo, ol.autores) === taKey;
        });
        if (matchingOl?.capaUrl) {
          finalBook.capaUrl = matchingOl.capaUrl;
        }
      }

      merged.push(finalBook);
      if (finalBook.isbn13) seenIsbns.add(finalBook.isbn13);
      if (finalBook.isbn10) seenIsbns.add(finalBook.isbn10);
      seenTitleAuthors.add(taKey);
    }

    // Add OpenLibrary items that haven't been seen
    for (const olBook of openLibList) {
      const hasSeenIsbn =
        (olBook.isbn13 && seenIsbns.has(olBook.isbn13)) ||
        (olBook.isbn10 && seenIsbns.has(olBook.isbn10));
      const taKey = keyTitleAuthor(olBook.titulo, olBook.autores);
      const hasSeenTitleAuthor = seenTitleAuthors.has(taKey);

      if (!hasSeenIsbn && !hasSeenTitleAuthor) {
        merged.push(olBook);
        if (olBook.isbn13) seenIsbns.add(olBook.isbn13);
        if (olBook.isbn10) seenIsbns.add(olBook.isbn10);
        seenTitleAuthors.add(taKey);
      }
    }

    return merged;
  },
};
