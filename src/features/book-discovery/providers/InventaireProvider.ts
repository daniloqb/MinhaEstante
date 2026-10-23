import { SearchResultBook } from '../../../types/book';
import { BookSearchQuery, ProviderId, ProviderSearchPage } from '../models/DiscoveryTypes';
import { BookProvider } from './BookProvider';

export class InventaireProvider implements BookProvider {
  readonly id: ProviderId = 'inventaire';
  readonly name = 'Inventaire / Wikidata';

  isConfigured(): boolean {
    return true; // Endpoint público aberto (inventaire.io) com CORS liberado
  }

  async search(
    query: BookSearchQuery,
    cursor?: string,
    signal?: AbortSignal
  ): Promise<ProviderSearchPage> {
    const term = query.cleanIsbn || query.title || query.raw;
    if (!term || term.length < 2) {
      return { providerId: this.id, books: [], hasMore: false };
    }

    const limit = 15;
    const offset = cursor ? parseInt(cursor, 10) || 0 : 0;
    // O endpoint canônico do Inventaire usa domínio inventaire.io, parâmetro 'search' e tipo 'works'
    const url = `https://inventaire.io/api/search?search=${encodeURIComponent(term)}&types=works&limit=${limit}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal,
      });

      if (!res.ok) {
        return {
          providerId: this.id,
          books: [],
          hasMore: false,
          httpStatus: res.status,
          errorMessage: `Inventaire HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      if (results.length === 0) {
        return { providerId: this.id, books: [], hasMore: false, httpStatus: 200, totalItems: 0 };
      }

      // Os resultados da busca trazem 'uri', 'label', 'description', etc.
      // Se houver URIs de obras/edições, consultamos os detalhes das entidades
      const urisToFetch = results
        .map((r: any) => r.uri)
        .filter(Boolean)
        .slice(0, 10);

      const detailedBooks = await this.fetchEntitiesDetails(urisToFetch, signal);

      // Se detalhamento não trouxer ou falhar, montamos os livros a partir do resultado sumário
      const books: SearchResultBook[] = urisToFetch.map((uri: string) => {
        const detailed = detailedBooks.find((b) => b.idExterno === uri || b.inventaireUri === uri);
        if (detailed) return detailed;

        const summary = results.find((r: any) => r.uri === uri);
        const isWikidata = uri.startsWith('wd:');
        let coverUrl: string | null = null;
        if (summary?.image) {
          coverUrl = summary.image.startsWith('http')
            ? summary.image
            : `https://inventaire.io${summary.image}`;
        }

        return {
          origem: 'inventaire',
          idExterno: uri,
          titulo: String(summary?.label || 'Sem título').trim(),
          subtitulo: null,
          autores: [],
          editora: null,
          anoPublicacao: null,
          paginas: null,
          isbn10: null,
          isbn13: null,
          generos: [],
          descricao: summary?.description || null,
          capaUrl: coverUrl,
          wikidataId: isWikidata ? uri.replace('wd:', '') : null,
          inventaireUri: uri,
          fontes: ['inventaire'],
        };
      });

      const hasMore = results.length >= limit;
      const nextCursor = hasMore ? String(offset + results.length) : null;

      return {
        providerId: this.id,
        books,
        hasMore,
        nextCursor,
        httpStatus: 200,
        totalItems: data.total || results.length,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return {
        providerId: this.id,
        books: [],
        hasMore: false,
        errorMessage: err?.message || 'Falha de conexão com Inventaire',
      };
    }
  }

  async getByISBN(isbn: string, signal?: AbortSignal): Promise<SearchResultBook | null> {
    const clean = isbn.replace(/[-\s]/g, '');
    if (!clean) return null;

    try {
      // O Inventaire suporta buscar entidades diretamente por URI de ISBN
      const url = `https://inventaire.io/api/entities/by-uris?uris=isbn:${clean}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
      if (!res.ok) return null;

      const data = await res.json();
      const entities = data?.entities || {};
      const foundUri = Object.keys(entities)[0];
      if (!foundUri) return null;

      const parsed = this.parseEntity(foundUri, entities[foundUri]);
      return parsed;
    } catch {
      return null;
    }
  }

  private async fetchEntitiesDetails(uris: string[], signal?: AbortSignal): Promise<SearchResultBook[]> {
    if (uris.length === 0) return [];

    try {
      // Endpoint canônico documentado: /api/entities/by-uris?uris=...
      const entitiesUrl = `https://inventaire.io/api/entities/by-uris?uris=${encodeURIComponent(uris.join(','))}`;
      const res = await fetch(entitiesUrl, {
        headers: { Accept: 'application/json' },
        signal,
      });
      if (!res.ok) return [];

      const data = await res.json();
      const entities = data?.entities || {};
      const books: SearchResultBook[] = [];

      for (const uri of uris) {
        const ent = entities[uri];
        if (!ent) continue;

        const book = this.parseEntity(uri, ent);
        if (book) {
          books.push(book);
        }
      }

      return books;
    } catch {
      return [];
    }
  }

  private parseEntity(uri: string, ent: any): SearchResultBook {
    const claims = ent.claims || {};
    const label =
      ent.labels?.pt ||
      ent.labels?.['pt-br'] ||
      ent.labels?.en ||
      ent.labels?.es ||
      ent.labels?.fr ||
      ent.label ||
      'Sem título';

    // ISBNs no inventaire ficam em 'wdt:P212' (ISBN-13) e 'wdt:P957' (ISBN-10)
    const isbn13List = claims['wdt:P212'] || claims['isbn13'] || [];
    const isbn10List = claims['wdt:P957'] || claims['isbn10'] || [];
    const rawIsbn13 = isbn13List[0] ? String(isbn13List[0]).replace(/[-\s]/g, '') : null;
    const rawIsbn10 = isbn10List[0] ? String(isbn10List[0]).replace(/[-\s]/g, '') : null;

    // Imagem / Capa
    let coverUrl: string | null = null;
    if (ent.image?.url) {
      coverUrl = ent.image.url;
    } else {
      const images = claims['wdt:P18'] || claims['image'] || [];
      if (images[0]) {
        const imgName = encodeURIComponent(String(images[0]).replace(/ /g, '_'));
        coverUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${imgName}?width=400`;
      }
    }

    const dateClaims = claims['wdt:P577'] || claims['publicationDate'] || [];
    const year = dateClaims[0] ? parseInt(String(dateClaims[0]).slice(0, 4), 10) || null : null;

    // Páginas
    const pageClaims = claims['wdt:P1104'] || claims['pageCount'] || [];
    const pages = pageClaims[0] ? parseInt(String(pageClaims[0]), 10) || null : null;

    const description =
      ent.descriptions?.pt ||
      ent.descriptions?.['pt-br'] ||
      ent.descriptions?.en ||
      ent.descriptions?.es ||
      ent.description ||
      null;

    const isWikidata = uri.startsWith('wd:');
    const wikidataId = isWikidata ? uri.replace('wd:', '') : null;

    return {
      origem: 'inventaire',
      idExterno: uri,
      titulo: String(label).trim(),
      subtitulo: null,
      autores: [],
      editora: null,
      anoPublicacao: year,
      paginas: pages,
      isbn10: rawIsbn10,
      isbn13: rawIsbn13,
      generos: [],
      descricao: description,
      capaUrl: coverUrl,
      wikidataId,
      inventaireUri: uri,
      fontes: ['inventaire'],
    };
  }
}
