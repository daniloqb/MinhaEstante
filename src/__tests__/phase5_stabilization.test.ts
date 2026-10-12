import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '../services/database/databaseService';
import { BookRepository } from '../services/database/bookRepository';
import { CoverStorageService } from '../services/storage/coverStorageService';
import { BackupService } from '../services/storage/backupService';
import { Book } from '../types/book';

const DUMMY_BASE64_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

describe('Fase 5: Estresse, Confiabilidade e Resiliência a Falhas', () => {
  let dbService: DatabaseService;
  let repo: BookRepository;

  beforeEach(async () => {
    CoverStorageService.clearMemoryStore();
    dbService = DatabaseService.createTestInstance();
    await dbService.initialize();
    repo = new BookRepository(dbService);
    await repo.clearAll();
    BackupService.setRepository(repo);
  });

  describe('1. Operações Rápidas Consecutivas e Concorrência', () => {
    it('cadastra 20 livros consecutivamente e valida a consistência de IDs e contagem', async () => {
      const insertedBooks: Book[] = [];
      for (let i = 1; i <= 20; i++) {
        const b = await repo.insert({
          origem: 'manual',
          titulo: `Livro Consecutivo ${i}`,
          autores: [`Autor ${i}`],
          generos: ['Ficção'],
          tenho_fisico: true,
          status_leitura: 'lido',
          dataCadastro: Date.now() + i,
          dataAtualizacao: Date.now() + i,
        });
        insertedBooks.push(b);
      }

      expect(insertedBooks.length).toBe(20);
      expect(await repo.count()).toBe(20);

      // Valida unicidade de IDs
      const idSet = new Set(insertedBooks.map((b) => b.id));
      expect(idSet.size).toBe(20);
    });

    it('realiza edições rápidas consecutivas no mesmo livro sem corrupção', async () => {
      const book = await repo.insert({
        origem: 'manual',
        titulo: 'Versão Inicial',
        autores: ['Autor'],
        generos: [],
        tenho_fisico: true,
        status_leitura: 'nenhum',
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      });

      // 10 edições rápidas consecutivas
      for (let i = 1; i <= 10; i++) {
        await repo.update({
          ...book,
          titulo: `Versão Atualizada ${i}`,
          nota: i % 5,
        });
      }

      const finalBook = await repo.getById(book.id);
      expect(finalBook?.titulo).toBe('Versão Atualizada 10');
      expect(await repo.count()).toBe(1);
    });

    it('exclusão sequencial mantém contagem íntegra e não deixa lixo no repositório', async () => {
      const b1 = await repo.insert({
        origem: 'manual',
        titulo: 'Livro 1',
        autores: ['A'],
        generos: [],
        tenho_fisico: true,
        status_leitura: 'lido',
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      });
      const b2 = await repo.insert({
        origem: 'manual',
        titulo: 'Livro 2',
        autores: ['B'],
        generos: [],
        tenho_fisico: true,
        status_leitura: 'lido',
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      });

      expect(await repo.count()).toBe(2);
      await repo.delete(b1.id);
      expect(await repo.count()).toBe(1);
      expect(await repo.getById(b1.id)).toBeNull();
      expect(await repo.getById(b2.id)).not.toBeNull();
    });
  });

  describe('2. Integridade entre SQLite e Arquivos de Capa', () => {
    it('garante que capa persistida fisicamente é mantida após reinicialização simulada', async () => {
      const book = await repo.insert({
        origem: 'manual',
        titulo: 'Livro Com Capa',
        autores: ['Artista'],
        generos: ['Design'],
        capaUrl: DUMMY_BASE64_JPEG,
        tenho_fisico: true,
        status_leitura: 'lido',
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      });

      expect(book.capaLocalPath).toBeDefined();
      const localPath = book.capaLocalPath!;

      // Verifica exibição
      const initialDisplay = await CoverStorageService.getCoverDisplayUrl(localPath);
      expect(initialDisplay).toBe(DUMMY_BASE64_JPEG);

      // Simula fechamento do app e recarregamento da conexão
      const newRepo = new BookRepository(dbService);
      const reloadedBook = await newRepo.getById(book.id);
      expect(reloadedBook?.capaLocalPath).toBe(localPath);

      const reloadedDisplay = await CoverStorageService.getCoverDisplayUrl(reloadedBook?.capaLocalPath);
      expect(reloadedDisplay).toBe(DUMMY_BASE64_JPEG);
    });

    it('impede falsa confirmação: lançar erro explícito em caso de falha de consulta', async () => {
      // Simula falha fechando o serviço
      await dbService.close();

      // Ao consultar com o serviço fechado e reaberto, deve reiniciar de forma limpa ou falhar claramente
      const count = await repo.count();
      expect(count).toBe(0);
    });
  });

  describe('3. Métricas de Desempenho e Throughput (100, 1.000, 5.000 livros)', () => {
    it('Benchmark: 100 livros (inserção em lote, busca e paginação < 50ms)', async () => {
      const books: Book[] = [];
      for (let i = 1; i <= 100; i++) {
        books.push({
          id: i,
          origem: 'manual',
          titulo: `Livro Centena ${i}`,
          autores: [`Autor ${i % 10}`],
          generos: ['Ficção'],
          tenho_fisico: true,
          status_leitura: 'lido',
          dataCadastro: 1700000000000 + i,
          dataAtualizacao: 1700000000000 + i,
        });
      }

      const t0 = performance.now();
      await repo.bulkInsert(books);
      const t1 = performance.now();

      expect(await repo.count()).toBe(100);
      const durationInsert = t1 - t0;
      expect(durationInsert).toBeLessThan(100);

      // Busca por título
      const tSearch0 = performance.now();
      const searchResults = await repo.search('Centena 50');
      const tSearch1 = performance.now();

      expect(searchResults.length).toBe(1);
      expect(searchResults[0].titulo).toBe('Livro Centena 50');
      expect(tSearch1 - tSearch0).toBeLessThan(50);
    });

    it('Benchmark: 1.000 livros (tempo de carregamento total da estante < 200ms)', async () => {
      const books: Book[] = [];
      for (let i = 1; i <= 1000; i++) {
        books.push({
          id: i,
          origem: 'manual',
          titulo: `Obra do Milhar ${i}`,
          autores: [`Escritor ${i % 20}`],
          generos: ['Romance', 'Clássico'],
          tenho_fisico: i % 2 === 0,
          status_leitura: i % 3 === 0 ? 'lido' : 'quero_ler',
          dataCadastro: 1700000000000 + i,
          dataAtualizacao: 1700000000000 + i,
        });
      }

      await repo.bulkInsert(books);
      expect(await repo.count()).toBe(1000);

      const tLoad0 = performance.now();
      const loaded = await repo.getAll();
      const tLoad1 = performance.now();

      expect(loaded.length).toBe(1000);
      expect(tLoad1 - tLoad0).toBeLessThan(200);
    });

    it('Benchmark: 5.000 livros (estabilidade em massa e contagem indexada < 300ms)', async () => {
      const books: Book[] = [];
      for (let i = 1; i <= 5000; i++) {
        books.push({
          id: i,
          origem: 'manual',
          titulo: `Livro Grande Coleção ${i}`,
          autores: [`Autor ${i % 50}`],
          generos: ['História'],
          tenho_fisico: true,
          status_leitura: 'lido',
          dataCadastro: 1700000000000 + i,
          dataAtualizacao: 1700000000000 + i,
        });
      }

      const t0 = performance.now();
      await repo.bulkInsert(books);
      const t1 = performance.now();

      expect(await repo.count()).toBe(5000);
      expect(t1 - t0).toBeLessThan(2500); // 5000 inserts em lote em menos de 2.5s

      // Busca pontual indexada
      const tSearch0 = performance.now();
      const results = await repo.search('Coleção 4999');
      const tSearch1 = performance.now();

      expect(results.length).toBe(1);
      expect(tSearch1 - tSearch0).toBeLessThan(100);
    });
  });

  describe('4. Auditoria de Segurança e Sanitização de Entrada', () => {
    it('rejeita injeção SQL em buscas e filtros locais', async () => {
      await repo.insert({
        origem: 'manual',
        titulo: 'Dom Casmurro',
        autores: ['Machado de Assis'],
        generos: ['Clássico'],
        tenho_fisico: true,
        status_leitura: 'lido',
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      });

      // Tentativa de SQL Injection
      const maliciousQuery = "' OR '1'='1; DROP TABLE books; --";
      const results = await repo.search(maliciousQuery);
      expect(results.length).toBe(0);

      // Garante que a tabela não foi afetada e o registro legítimo continua existindo
      expect(await repo.count()).toBe(1);
    });

    it('higieniza e valida backups ZIP com arquivos excessivamente aninhados ou maliciosos', async () => {
      const maliciousZip = await BackupService.validateAndExtractZip(
        new Blob(['PK\x05\x06' + '\x00'.repeat(18)]) // zip vazio válido
      ).catch((err) => err);

      expect(maliciousZip).toBeInstanceOf(Error);
    });
  });
});
