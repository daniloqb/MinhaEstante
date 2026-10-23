import { SearchResultBook } from '../../../types/book';
import { areIsbnsEquivalent, validateIsbn } from './ISBNValidator';

export class EditionMatcher {
  /**
   * Normalização multilíngue preservando caracteres Unicode e alfabetos internacionais
   */
  static normalizeText(text?: string | null): string {
    if (!text) return '';
    return text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Determina se dois registros bibliográficos correspondem comprovadamente à MESMA publicação (edição)
   */
  static areSameEdition(a: SearchResultBook, b: SearchResultBook): boolean {
    // 1. Verificação rigorosa por ISBN equivalente
    const aHasIsbn = Boolean((a.isbn13 && validateIsbn(a.isbn13).isValid) || (a.isbn10 && validateIsbn(a.isbn10).isValid));
    const bHasIsbn = Boolean((b.isbn13 && validateIsbn(b.isbn13).isValid) || (b.isbn10 && validateIsbn(b.isbn10).isValid));

    if (aHasIsbn && bHasIsbn) {
      if (areIsbnsEquivalent(a.isbn13, b.isbn13)) return true;
      if (areIsbnsEquivalent(a.isbn13, b.isbn10)) return true;
      if (areIsbnsEquivalent(a.isbn10, b.isbn13)) return true;
      if (areIsbnsEquivalent(a.isbn10, b.isbn10)) return true;

      // Ambas possuem ISBNs válidos, mas são diferentes -> Edições distintas garantidas!
      return false;
    }

    // 2. Mesmo ID externo da mesma fonte
    if (a.origem === b.origem && a.idExterno && b.idExterno && a.idExterno === b.idExterno) {
      return true;
    }

    // 3. Mesma obra sem ISBN em ambos: requer mesmo título, autor principal, editora e ano
    const normTitleA = this.normalizeText(a.titulo);
    const normTitleB = this.normalizeText(b.titulo);
    if (!normTitleA || !normTitleB || normTitleA !== normTitleB) {
      return false;
    }

    const normAuthorA = this.normalizeText(a.autores?.[0]);
    const normAuthorB = this.normalizeText(b.autores?.[0]);
    if (normAuthorA && normAuthorB && normAuthorA !== normAuthorB) {
      return false;
    }

    const normPubA = this.normalizeText(a.editora);
    const normPubB = this.normalizeText(b.editora);
    const yearA = a.anoPublicacao;
    const yearB = b.anoPublicacao;

    // Se ambas possuem editora identificada e são diferentes -> Edições distintas
    if (normPubA && normPubB && normPubA !== normPubB) {
      return false;
    }

    // Se ambas possuem ano e diferem por mais de 1 ano -> Edições distintas
    if (yearA && yearB && Math.abs(yearA - yearB) > 1) {
      return false;
    }

    // Se título, autor, editora e ano coincidem (ou ausentes de forma idêntica), são a mesma edição
    if (normPubA && normPubB && normPubA === normPubB) {
      return true;
    }

    return false;
  }

  /**
   * Mescla dois registros da mesma edição enriquecendo metadados sem perdas
   */
  static mergeEditions(primary: SearchResultBook, secondary: SearchResultBook): SearchResultBook {
    return this.mergeSameEdition(primary, secondary);
  }

  static mergeSameEdition(primary: SearchResultBook, secondary: SearchResultBook): SearchResultBook {
    // Escolhe capa: prioriza Google Books, depois Open Library, depois existente
    let bestCover = primary.capaUrl;
    if (secondary.capaUrl) {
      if (!bestCover) {
        bestCover = secondary.capaUrl;
      } else if (secondary.origem === 'google' && primary.origem !== 'google') {
        bestCover = secondary.capaUrl;
      }
    }

    const sources = Array.from(
      new Set<string>([
        primary.origem,
        secondary.origem,
        ...(primary.fontes || []),
        ...(secondary.fontes || []),
      ])
    );

    const generos = Array.from(
      new Set<string>([...(primary.generos || []), ...(secondary.generos || [])])
    );

    const autores = primary.autores && primary.autores.length > 0
      ? primary.autores
      : (secondary.autores || []);

    const tradutores = Array.from(
      new Set<string>([...(primary.tradutores || []), ...(secondary.tradutores || [])])
    );

    return {
      ...primary,
      titulo: primary.titulo || secondary.titulo,
      subtitulo: primary.subtitulo || secondary.subtitulo || null,
      autores,
      tradutores,
      editora: primary.editora || secondary.editora || null,
      anoPublicacao: primary.anoPublicacao || secondary.anoPublicacao || null,
      paginas: primary.paginas || secondary.paginas || null,
      isbn10: primary.isbn10 || secondary.isbn10 || null,
      isbn13: primary.isbn13 || secondary.isbn13 || null,
      generos,
      descricao: primary.descricao || secondary.descricao || null,
      capaUrl: bestCover || null,
      formato: primary.formato || secondary.formato || 'fisico',
      idioma: primary.idioma || secondary.idioma || null,
      fontes: sources,
      volumeId: primary.volumeId || secondary.volumeId || (primary.origem === 'google' ? primary.idExterno : secondary.origem === 'google' ? secondary.idExterno : null),
      wikidataId: primary.wikidataId || secondary.wikidataId || null,
      inventaireUri: primary.inventaireUri || secondary.inventaireUri || null,
    };
  }

  /**
   * Agrupa e deduplica uma lista bruta de livros preservando edições distintas
   */
  static deduplicateEditions(rawBooks: SearchResultBook[]): SearchResultBook[] {
    const result: SearchResultBook[] = [];

    for (const incoming of rawBooks) {
      const matchIndex = result.findIndex((existing) => this.areSameEdition(existing, incoming));
      if (matchIndex >= 0) {
        // Mescla com a edição existente
        result[matchIndex] = this.mergeSameEdition(result[matchIndex], incoming);
      } else {
        result.push({
          ...incoming,
          fontes: incoming.fontes || [incoming.origem],
        });
      }
    }

    return result;
  }
}
