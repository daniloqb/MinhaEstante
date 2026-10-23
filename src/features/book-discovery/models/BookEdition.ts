import { BookFormat, BookOrigin, SearchResultBook } from '../../../types/book';

export interface BookEdition {
  id: string;
  workId?: string | null;
  publishedTitle: string;
  subtitle?: string | null;
  authors: string[];
  translators?: string[];
  publisher?: string | null;
  year?: number | null;
  language?: string | null;
  format?: BookFormat;
  pageCount?: number | null;
  isbn10?: string | null;
  isbn13?: string | null;
  coverUrl?: string | null;
  synopsis?: string | null;
  subjects?: string[];
  provenance: {
    origin: BookOrigin;
    externalId?: string | null;
    sources: string[];
    googleVolumeId?: string | null;
    openLibraryEditionKey?: string | null;
    inventaireUri?: string | null;
    wikidataId?: string | null;
    isbndbId?: string | null;
  };
}

export function editionToSearchResultBook(edition: BookEdition): SearchResultBook {
  return {
    origem: edition.provenance.origin,
    idExterno: edition.provenance.externalId || edition.isbn13 || edition.id,
    titulo: edition.publishedTitle,
    subtitulo: edition.subtitle || null,
    autores: edition.authors,
    tradutores: edition.translators || [],
    editora: edition.publisher || null,
    anoPublicacao: edition.year || null,
    paginas: edition.pageCount || null,
    isbn10: edition.isbn10 || null,
    isbn13: edition.isbn13 || null,
    generos: edition.subjects || [],
    descricao: edition.synopsis || null,
    capaUrl: edition.coverUrl || null,
    formato: edition.format || 'fisico',
    idioma: edition.language || null,
    edicaoId: edition.id,
    obraId: edition.workId || null,
    fontes: edition.provenance.sources,
    volumeId: edition.provenance.googleVolumeId || null,
    wikidataId: edition.provenance.wikidataId || null,
    inventaireUri: edition.provenance.inventaireUri || null,
  };
}
