import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Book, BookFormat, ReadingStatus, getBookFormats, hasBookFormat, isBookInTab, isBookOwned, updateBookFormats } from '../types/book';
import { BookStorage, migrateLegacyBooks, mergeDuplicateBooks } from '../services/storage';
import { LocalShelfFeed } from '../features/home-feed/LocalShelfFeed';

const formatCombinations: BookFormat[][] = [
  ['fisico'], ['ebook'], ['audiolivro'], ['fisico', 'ebook'],
  ['fisico', 'audiolivro'], ['ebook', 'audiolivro'], ['fisico', 'ebook', 'audiolivro'],
];

const sample: Book = {
  id: 1, uuid: 'ownership-fixture', origem: 'manual', titulo: 'Obra sintética', autores: ['Autor de teste'],
  generos: [], tenho_fisico: false, status_leitura: 'nenhum', nota: 7, anoLeitura: 2025, mesLeitura: 6,
  emprestimo: { nomePessoa: 'Pessoa de teste', dataEmprestimo: '2026-01-01', dataDevolucao: '2026-01-31' },
  dataCadastro: 1000, dataAtualizacao: 1000,
};

describe('Posse independente de modalidades', () => {
  beforeEach(() => vi.stubGlobal('localStorage', { setItem: vi.fn() }));
  afterEach(() => vi.unstubAllGlobals());
  const matrix = formatCombinations.flatMap((formatos) => [true, false].map((owned) => ({ formatos, owned })));

  it.each(matrix)('Meus Livros e Home: $formatos, posse=$owned', ({ formatos, owned }) => {
    const book = { ...sample, formato: formatos[0], formatos, tenho_fisico: owned };
    expect(isBookOwned(book)).toBe(owned);
    expect(isBookInTab(book, 'todos')).toBe(owned);
    expect(isBookInTab(book, 'meus_livros')).toBe(owned);
    const feed = LocalShelfFeed.getPersonalShelfSection([book]);
    expect(feed.books.length).toBe(owned ? 1 : 0);
    expect(BookStorage.computeStats([book]).totalMeusLivros).toBe(feed.books.length);
    expect(BookStorage.computeStats([book]).totalRegistros).toBe(1);

    for (const format of ['fisico', 'ebook', 'audiolivro'] as BookFormat[]) {
      const updated = updateBookFormats(book, format);
      expect(isBookOwned(updated)).toBe(owned);
      expect(updated.status_leitura).toBe(book.status_leitura);
      expect(updated.uuid).toBe(book.uuid);
      expect(updated.emprestimo).toEqual(book.emprestimo);
      expect(updated.nota).toBe(book.nota);
      expect(updated.anoLeitura).toBe(book.anoLeitura);
      expect(updated.mesLeitura).toBe(book.mesLeitura);
      expect(getBookFormats(updated).length).toBeGreaterThanOrEqual(1);
      expect(getBookFormats(updated)).toContain(updated.formato);
    }
    // A mesma declaração de posse não acrescenta nem remove modalidades legadas.
    expect(getBookFormats({ formato: formatos[0], tenho_fisico: owned })).toEqual([formatos[0]]);
    expect(getBookFormats({ ...book, tenho_fisico: !owned })).toEqual(formatos);
    expect(hasBookFormat(book, 'fisico')).toBe(formatos.includes('fisico'));
  });

  it.each(['nenhum', 'quero_ler', 'lendo', 'lido', 'abandonado'] as ReadingStatus[])(
    'normalização preserva leitura %s e posse explícita em qualquer modalidade', (status) => {
      for (const formatos of formatCombinations) {
        for (const owned of [true, false]) {
          const book = { ...sample, formatos, formato: formatos[0], status_leitura: status, tenho_fisico: owned };
          const [normalized] = migrateLegacyBooks([book], false);
          expect(normalized.status_leitura).toBe(status);
          expect(isBookOwned(normalized)).toBe(owned);
          expect(normalized.formatos).toEqual(formatos);
          expect(isBookInTab(normalized, 'lido')).toBe(status === 'lido');
          expect(isBookInTab(normalized, 'quero_ler')).toBe(status === 'quero_ler');
          expect(mergeDuplicateBooks(normalized, normalized).status_leitura).toBe(status);
        }
      }
    }
  );

  it('não infere posse na ausência do booleano nem sobrescreve false por categoria legada', () => {
    for (const formato of ['fisico', 'ebook', 'audiolivro']) {
      expect(migrateLegacyBooks([{ formato }], false)[0].tenho_fisico).toBe(false);
      expect(migrateLegacyBooks([{ formato, tenho_fisico: false, categoria: 'meus_livros' }], false)[0].tenho_fisico).toBe(false);
    }
    expect(migrateLegacyBooks([{ categoria: 'meus_livros' }], false)[0].tenho_fisico).toBe(true);
    expect(isBookOwned({ tenho_fisico: 1 as unknown as boolean })).toBe(false);
    expect(isBookOwned(undefined)).toBe(false);
  });

  it('estatísticas distinguem registros, posse, modalidades e leitura', () => {
    const books: Book[] = [
      { ...sample, id: 1, formato: 'ebook', formatos: ['ebook'], tenho_fisico: true },
      { ...sample, id: 2, formato: 'fisico', formatos: ['fisico'], status_leitura: 'lido' },
      { ...sample, id: 3, formato: 'audiolivro', formatos: ['audiolivro'], tenho_fisico: true },
      { ...sample, id: 4, formato: 'ebook', formatos: ['ebook', 'audiolivro'], status_leitura: 'quero_ler' },
    ];
    const stats = BookStorage.computeStats(books);
    expect(stats).toMatchObject({ totalRegistros: 4, totalMeusLivros: 2, totalFisicos: 1, totalEbooks: 2, totalAudiolivros: 2, totalLidos: 1, totalQueroLer: 1 });
    expect(LocalShelfFeed.getPersonalShelfSection(books).books.map((b) => b.localBook?.id).sort()).toEqual([1, 3]);
    expect(LocalShelfFeed.getReadingJourneySection(books).books.some((b) => b.localBook?.id === 4)).toBe(true);
  });

  it('JSON e CSV preservam posse e os cinco status, incluindo digitais possuídos e físicos sem posse', () => {
    for (const formatos of formatCombinations) {
      for (const owned of [true, false]) {
        for (const status of ['nenhum', 'quero_ler', 'lendo', 'lido', 'abandonado'] as ReadingStatus[]) {
          const book = { ...sample, formatos, formato: formatos[0], tenho_fisico: owned, status_leitura: status };
          const fromJson = BookStorage.importJson(BookStorage.exportJson([book]), []).updatedBooks[0];
          expect(fromJson.tenho_fisico).toBe(owned);
          expect(fromJson.status_leitura).toBe(status);
          expect(fromJson.formatos).toEqual(formatos);
          expect(fromJson.uuid).toBe(book.uuid);
          const fromCsv = BookStorage.importCsv(BookStorage.exportCsv([book]), []).updatedBooks[0];
          expect(fromCsv.tenho_fisico).toBe(owned);
          expect(fromCsv.status_leitura).toBe(status);
          expect(fromCsv.formato).toBe(book.formato);
        }
      }
    }
    const csv = 'titulo,tenho_fisico,status\nObra sintética,nao,meus_livros';
    expect(BookStorage.importCsv(csv, []).updatedBooks[0].tenho_fisico).toBe(false);
  });
});
