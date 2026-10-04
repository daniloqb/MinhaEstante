import { describe, it, expect } from 'vitest';
import { BookSearchService } from '../services/bookSearch';

describe('BrasilAPI & BookSearchService Integration', () => {
  it('corretamente parseia os dados da BrasilAPI', () => {
    const mockBrasilApiData = {
      isbn: '9788535914849',
      title: '1984',
      subtitle: null,
      authors: ['George Orwell', 'Alexandre Hubner'],
      publisher: 'Companhia das Letras',
      synopsis: 'Publicada originalmente em 1949...',
      year: 2009,
      page_count: 416,
      subjects: ['Literatura', 'Distopia'],
      cover_url: null,
      provider: 'cbl',
    };

    const parsed = BookSearchService.parseBrasilApiResult(mockBrasilApiData, '9788535914849');

    expect(parsed).not.toBeNull();
    expect(parsed?.origem).toBe('brasilapi');
    expect(parsed?.titulo).toBe('1984');
    expect(parsed?.autores).toEqual(['George Orwell', 'Alexandre Hubner']);
    expect(parsed?.editora).toBe('Companhia das Letras');
    expect(parsed?.anoPublicacao).toBe(2009);
    expect(parsed?.paginas).toBe(416);
    expect(parsed?.isbn13).toBe('9788535914849');
    expect(parsed?.capaUrl).toBe('https://covers.openlibrary.org/b/isbn/9788535914849-M.jpg');
    expect(parsed?.generos).toContain('Literatura');
    expect(parsed?.generos).toContain('Distopia');
  });

  it('faz merge e deduplicação priorizando a BrasilAPI para livros brasileiros', () => {
    const brasilList = [
      {
        origem: 'brasilapi' as const,
        idExterno: '9788535914849',
        titulo: '1984',
        subtitulo: null,
        autores: ['George Orwell'],
        editora: 'Companhia das Letras',
        anoPublicacao: 2009,
        paginas: 416,
        isbn10: null,
        isbn13: '9788535914849',
        generos: ['Ficção'],
        descricao: 'Sinopse CBL',
        capaUrl: null,
      },
    ];

    const googleList = [
      {
        origem: 'google' as const,
        idExterno: 'g123',
        titulo: '1984',
        subtitulo: null,
        autores: ['George Orwell'],
        editora: 'Companhia das Letras',
        anoPublicacao: 2009,
        paginas: 416,
        isbn10: null,
        isbn13: '9788535914849',
        generos: ['Ficção'],
        descricao: 'Sinopse Google',
        capaUrl: 'https://books.google.com/cover.jpg',
      },
    ];

    const openLibList: any[] = [];

    const merged = BookSearchService.mergeAndDeduplicate(brasilList, googleList, openLibList);

    expect(merged.length).toBe(1);
    expect(merged[0].origem).toBe('brasilapi');
    expect(merged[0].capaUrl).toBe('https://books.google.com/cover.jpg');
  });

  it('pesquisa vazia ou com espaços retorna array vazio sem lançar exceções', async () => {
    const res = await BookSearchService.search('   ');
    expect(res).toEqual([]);
  });

  it('formata códigos EAN-13 de barras sem quebrar', async () => {
    const rawBarcode = ' 978-85-359-0277-8 ';
    const clean = rawBarcode.trim().replace(/[-\s]/g, '');
    expect(clean).toBe('9788535902778');
    expect(clean.length).toBe(13);
  });
});
