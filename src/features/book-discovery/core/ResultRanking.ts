import { SearchResultBook } from '../../../types/book';
import { BookSearchQuery } from '../models/DiscoveryTypes';
import { cleanIsbnString } from './ISBNValidator';
import { EditionMatcher } from './EditionMatcher';

export class ResultRanking {
  static calculateScore(query: BookSearchQuery, book: SearchResultBook): number {
    let score = 0;
    const normQ = EditionMatcher.normalizeText(query.title || query.raw);
    const normTitle = EditionMatcher.normalizeText(book.titulo);
    const normAuthors = (book.autores || []).map((a) => EditionMatcher.normalizeText(a));

    // 1. Correspondência por ISBN
    if (query.intent === 'isbn' || query.cleanIsbn) {
      const qIsbn = cleanIsbnString(query.cleanIsbn || query.raw);
      const b13 = cleanIsbnString(book.isbn13 || '');
      const b10 = cleanIsbnString(book.isbn10 || '');
      if (qIsbn && (b13 === qIsbn || b10 === qIsbn)) {
        score += 100;
      }
    }

    // 2. Correspondência de Título
    if (normQ && normTitle) {
      if (normTitle === normQ) {
        score += 60;
      } else if (normTitle.startsWith(normQ)) {
        score += 50;
      } else if (normTitle.includes(normQ)) {
        score += 40;
      } else {
        const qWords = normQ.split(' ').filter((w) => w.length > 2);
        if (qWords.length > 0) {
          const matchCount = qWords.filter((w) => normTitle.includes(w)).length;
          score += (matchCount / qWords.length) * 35;
        }
      }
    }

    // 3. Correspondência de Autor
    if (query.author) {
      const qAuthor = EditionMatcher.normalizeText(query.author);
      if (normAuthors.some((a) => a.includes(qAuthor) || qAuthor.includes(a))) {
        score += 30;
      }
    } else if (normQ) {
      // Se a consulta contiver nome de autor
      if (normAuthors.some((a) => a.includes(normQ))) {
        score += 25;
      }
    }

    // 4. Presença de capa verificada
    if (book.capaUrl) {
      score += 15;
    }

    // 5. Completude dos dados bibliográficos
    if (book.editora && book.paginas) {
      score += 10;
    } else if (book.editora || book.paginas) {
      score += 5;
    }

    // 6. Preferência de idioma
    if (query.lang && book.idioma && book.idioma.toLowerCase().startsWith(query.lang.toLowerCase())) {
      score += 5;
    }

    // 7. Proveniência e tie-breaker Google Books
    if (book.origem === 'google') {
      score += 5;
    }

    return score;
  }

  static rankResults(query: BookSearchQuery, books: SearchResultBook[]): SearchResultBook[] {
    const scored = books.map((b) => ({
      book: b,
      score: this.calculateScore(query, b),
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      // Desempate por capa
      const aHasCover = Boolean(a.book.capaUrl);
      const bHasCover = Boolean(b.book.capaUrl);
      if (aHasCover && !bHasCover) return -1;
      if (!aHasCover && bHasCover) return 1;

      // Desempate por ano mais recente
      const yearA = a.book.anoPublicacao || 0;
      const yearB = b.book.anoPublicacao || 0;
      return yearB - yearA;
    });

    return scored.map((s) => ({
      ...s.book,
      relevanceScore: s.score,
    }));
  }
}
