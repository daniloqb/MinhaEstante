import { SearchResultBook } from '../types/book';

function createSafeTimeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
    try {
      return (AbortSignal as any).timeout(ms);
    } catch {}
  }
  if (typeof AbortController !== 'undefined') {
    try {
      const controller = new AbortController();
      setTimeout(() => {
        try {
          controller.abort();
        } catch {}
      }, ms);
      return controller.signal;
    } catch {}
  }
  return undefined;
}

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

    // Google Books com preferência brasileira (country=BR)
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&country=BR&maxResults=20${
      apiKey?.trim() ? `&key=${apiKey.trim()}` : ''
    }`;
    const openLibUrl = `https://openlibrary.org/search.json?q=${openLibQuery}&limit=20`;

    const promises: Promise<SearchResultBook[]>[] = [];

    // 1. BrasilAPI (CBL - Câmara Brasileira do Livro & Mercado Editorial)
    if (isIsbn) {
      const brasilApiUrl = `https://brasilapi.com.br/api/isbn/v1/${cleanIsbn}`;
      promises.push(
        fetch(brasilApiUrl, { signal: createSafeTimeoutSignal(7000) })
          .then(async (res) => {
            if (!res.ok) return [];
            const data = await res.json();
            const book = this.parseBrasilApiResult(data, cleanIsbn);
            return book ? [book] : [];
          })
          .catch(() => [])
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    // 2. Google Books API
    promises.push(
      fetch(googleUrl, { signal: createSafeTimeoutSignal(7000) })
        .then(async (res) => {
          if (!res.ok) return [];
          const data = await res.json();
          return this.parseGoogleResults(data);
        })
        .catch(() => [])
    );

    // 3. Open Library API
    promises.push(
      fetch(openLibUrl, { signal: createSafeTimeoutSignal(7000) })
        .then(async (res) => {
          if (!res.ok) return [];
          const data = await res.json();
          return this.parseOpenLibResults(data);
        })
        .catch(() => [])
    );

    const [brasilPromise, googlePromise, openLibPromise] = await Promise.allSettled(promises);

    const brasilResults: SearchResultBook[] =
      brasilPromise.status === 'fulfilled' ? brasilPromise.value : [];
    const googleResults: SearchResultBook[] =
      googlePromise.status === 'fulfilled' ? googlePromise.value : [];
    const openLibResults: SearchResultBook[] =
      openLibPromise.status === 'fulfilled' ? openLibPromise.value : [];

    return this.mergeAndDeduplicate(brasilResults, googleResults, openLibResults);
  },

  parseBrasilApiResult(data: any, originalIsbn: string): SearchResultBook | null {
    if (!data || !data.title?.trim()) return null;

    const rawIsbn = data.isbn ? String(data.isbn).replace(/[-\s]/g, '') : originalIsbn;
    const isbn10 = rawIsbn.length === 10 ? rawIsbn : null;
    const isbn13 = rawIsbn.length === 13 ? rawIsbn : null;

    let coverUrl: string | null = data.cover_url || null;
    // Se a BrasilAPI não trouxe capa, tentar obter capa do Open Library pelo ISBN
    if (!coverUrl && rawIsbn) {
      coverUrl = `https://covers.openlibrary.org/b/isbn/${rawIsbn}-M.jpg`;
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
      titulo: data.title.trim(),
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
    };
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
    brasilList: SearchResultBook[],
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

    // 1. BrasilAPI tem prioridade máxima para livros brasileiros
    for (const bBook of brasilList) {
      let finalBook = { ...bBook };

      // Se a BrasilAPI não trouxe capa ou sinopse, enriquecer com Google ou OpenLibrary
      const matchingGoogle = googleList.find((g) => {
        if (g.isbn13 && finalBook.isbn13 && g.isbn13 === finalBook.isbn13) return true;
        if (g.isbn10 && finalBook.isbn10 && g.isbn10 === finalBook.isbn10) return true;
        return keyTitleAuthor(g.titulo, g.autores) === keyTitleAuthor(finalBook.titulo, finalBook.autores);
      });

      const matchingOl = openLibList.find((ol) => {
        if (ol.isbn13 && finalBook.isbn13 && ol.isbn13 === finalBook.isbn13) return true;
        if (ol.isbn10 && finalBook.isbn10 && ol.isbn10 === finalBook.isbn10) return true;
        return keyTitleAuthor(ol.titulo, ol.autores) === keyTitleAuthor(finalBook.titulo, finalBook.autores);
      });

      if (!finalBook.capaUrl && matchingGoogle?.capaUrl) {
        finalBook.capaUrl = matchingGoogle.capaUrl;
      } else if (!finalBook.capaUrl && matchingOl?.capaUrl) {
        finalBook.capaUrl = matchingOl.capaUrl;
      }

      if (!finalBook.descricao && matchingGoogle?.descricao) {
        finalBook.descricao = matchingGoogle.descricao;
      }

      if ((!finalBook.autores || finalBook.autores.length === 0) && matchingGoogle?.autores?.length) {
        finalBook.autores = matchingGoogle.autores;
      } else if ((!finalBook.autores || finalBook.autores.length === 0) && matchingOl?.autores?.length) {
        finalBook.autores = matchingOl.autores;
      }

      if (!finalBook.paginas && matchingGoogle?.paginas) {
        finalBook.paginas = matchingGoogle.paginas;
      }

      merged.push(finalBook);
      if (finalBook.isbn13) seenIsbns.add(finalBook.isbn13);
      if (finalBook.isbn10) seenIsbns.add(finalBook.isbn10);
      seenTitleAuthors.add(keyTitleAuthor(finalBook.titulo, finalBook.autores));
    }

    // 2. Google Books
    for (const gBook of googleList) {
      const taKey = keyTitleAuthor(gBook.titulo, gBook.autores);
      const hasSeenIsbn =
        (gBook.isbn13 && seenIsbns.has(gBook.isbn13)) ||
        (gBook.isbn10 && seenIsbns.has(gBook.isbn10));
      const hasSeenTitleAuthor = seenTitleAuthors.has(taKey);

      if (hasSeenIsbn || hasSeenTitleAuthor) continue;

      let finalBook = { ...gBook };

      // Se o Google não tiver capa, tentar OpenLibrary
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

    // 3. Open Library
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
