import { BookSearchQuery } from '../models/DiscoveryTypes';
import { validateIsbn, looksLikeIsbn } from './ISBNValidator';

export class QueryParser {
  static parse(rawQuery: string): BookSearchQuery {
    const raw = (rawQuery || '').trim();
    if (!raw) {
      return { raw: '', intent: 'general' };
    }

    // 1. Verificação de ISBN
    const isbnVal = validateIsbn(raw);
    if (isbnVal.isValid) {
      return {
        raw,
        intent: 'isbn',
        cleanIsbn: isbnVal.type === 'isbn13' ? isbnVal.cleanIsbn : isbnVal.isbn13 || isbnVal.cleanIsbn,
      };
    }
    if (looksLikeIsbn(raw)) {
      return {
        raw,
        intent: 'isbn',
        cleanIsbn: raw.replace(/[-\s]/g, ''),
      };
    }

    // 2. Prefixos explícitos (ex: author:Machado, autor:Machado, title:1984, etc.)
    const authorMatch = raw.match(/^(?:author|autor|inauthor)\s*[:=]\s*(.+)$/i);
    if (authorMatch && authorMatch[1].trim()) {
      return {
        raw,
        intent: 'author',
        author: authorMatch[1].trim(),
      };
    }

    const titleMatch = raw.match(/^(?:title|titulo|intitle)\s*[:=]\s*(.+)$/i);
    if (titleMatch && titleMatch[1].trim()) {
      return {
        raw,
        intent: 'title',
        title: titleMatch[1].trim(),
      };
    }

    // 3. Padrões combinados: "Título" por Autor, "Título" by Autor, Título por Autor, Título by Autor
    const quotesByPattern = /^["'“]([^"'”]+)["'”]\s+(?:by|por|de)\s+([^,]+)$/i;
    const qbMatch = raw.match(quotesByPattern);
    if (qbMatch) {
      return {
        raw,
        intent: 'mixed',
        title: qbMatch[1].trim(),
        author: qbMatch[2].trim(),
      };
    }

    const unquotedByPattern = /^(.+?)\s+(?:by|por)\s+([^,]+)$/i;
    const uqbMatch = raw.match(unquotedByPattern);
    if (uqbMatch && uqbMatch[1].trim().length > 1 && uqbMatch[2].trim().length > 1) {
      return {
        raw,
        intent: 'mixed',
        title: uqbMatch[1].trim(),
        author: uqbMatch[2].trim(),
      };
    }

    // 4. Divisores com hífen ou barra (ex: "O Passeador de Livros - Carsten Henn")
    if (raw.includes(' - ') || raw.includes(' / ')) {
      const parts = raw.split(/\s+[-/]\s+/);
      if (parts.length === 2 && parts[0].trim().length > 1 && parts[1].trim().length > 1) {
        return {
          raw,
          intent: 'mixed',
          title: parts[0].trim(),
          author: parts[1].trim(),
        };
      }
    }

    // 5. Consulta textual geral
    return {
      raw,
      intent: 'general',
      title: raw,
    };
  }
}
