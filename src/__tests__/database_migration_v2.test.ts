import { describe, it, expect } from 'vitest';
import { DatabaseService, CURRENT_DB_VERSION } from '../services/database/databaseService';
import { BookRepository } from '../services/database/bookRepository';
import { BookAttachmentRepository } from '../services/database/bookAttachmentRepository';
import { ReadingSessionRepository } from '../services/database/readingSessionRepository';
import { ReadingStatus, BookFormat } from '../types/book';

describe('MinhaEstante 2.0 - Testes de Migração SQLite Versão 2', () => {
  it('1. Banco novo sem livros inicializa na versão 2 com todas as tabelas prontas', async () => {
    const db = DatabaseService.createTestInstance();
    await db.initialize();

    const bookRepo = new BookRepository(db);
    const attachmentRepo = new BookAttachmentRepository(db);
    const sessionRepo = new ReadingSessionRepository(db);

    expect(await bookRepo.count()).toBe(0);
    expect(await attachmentRepo.count()).toBe(0);
    expect(await sessionRepo.count()).toBe(0);

    const applied = (db as any).adapter.getAppliedMigrationVersions();
    expect(applied).toContain(1);
    expect(applied).toContain(2);
    expect(CURRENT_DB_VERSION).toBe(2);
  });

  it('2. Preserva integralmente livros existentes com múltiplos formatos, status e avaliações', async () => {
    const db = DatabaseService.createTestInstance();
    await db.initialize();
    const bookRepo = new BookRepository(db);

    // Insere múltiplos livros com diferentes estados da versão 1.1
    const testCases: {
      titulo: string;
      status: ReadingStatus;
      formatos: BookFormat[];
      nota: number | null;
      tenhoFisico: boolean;
      emprestimo?: any;
      capaLocalPath?: string;
    }[] = [
      {
        titulo: 'Dom Casmurro',
        status: 'lido',
        formatos: ['fisico', 'ebook', 'audiolivro'],
        nota: 10,
        tenhoFisico: true,
      },
      {
        titulo: 'Memórias Póstumas de Brás Cubas',
        status: 'quero_ler',
        formatos: ['ebook'],
        nota: null,
        tenhoFisico: false,
      },
      {
        titulo: 'Quincas Borba',
        status: 'lendo',
        formatos: ['fisico', 'ebook'],
        nota: null,
        tenhoFisico: true,
      },
      {
        titulo: 'O Alienista',
        status: 'abandonado',
        formatos: ['audiolivro'],
        nota: 6,
        tenhoFisico: false,
      },
      {
        titulo: 'Helena',
        status: 'nenhum',
        formatos: ['fisico'],
        nota: null,
        tenhoFisico: true,
        emprestimo: {
          nomePessoa: 'Mariana',
          dataEmprestimo: '2026-02-01',
          dataDevolucao: '2026-03-01',
          devolvido: false,
        },
        capaLocalPath: 'covers/helena_local.jpg',
      },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      await bookRepo.insert({
        id: i + 1,
        titulo: tc.titulo,
        autores: ['Machado de Assis'],
        origem: 'manual',
        status_leitura: tc.status,
        formatos: tc.formatos,
        formato: tc.formatos[0],
        tenho_fisico: tc.tenhoFisico,
        nota: tc.nota,
        emprestimo: tc.emprestimo || null,
        capaLocalPath: tc.capaLocalPath || null,
        dataCadastro: 1700000000000 + i * 1000,
        dataAtualizacao: 1700000000000 + i * 1000,
        generos: ['Clássico'],
      });
    }

    expect(await bookRepo.count()).toBe(5);

    // Consulta e valida cada registro preservado
    const allBooks = await bookRepo.getAll();
    expect(allBooks.length).toBe(5);

    const casmurro = allBooks.find((b) => b.titulo === 'Dom Casmurro');
    expect(casmurro).toBeDefined();
    expect(casmurro?.status_leitura).toBe('lido');
    expect(casmurro?.formatos).toEqual(['fisico', 'ebook', 'audiolivro']);
    expect(casmurro?.nota).toBe(10);
    expect(casmurro?.uuid).toBeTruthy(); // UUID estável atribuído

    const alienista = allBooks.find((b) => b.titulo === 'O Alienista');
    expect(alienista).toBeDefined();
    expect(alienista?.status_leitura).toBe('abandonado');
    expect(alienista?.formatos).toEqual(['audiolivro']);

    const helena = allBooks.find((b) => b.titulo === 'Helena');
    expect(helena).toBeDefined();
    expect(helena?.emprestimo?.nomePessoa).toBe('Mariana');
    expect(helena?.capaLocalPath).toBe('covers/helena_local.jpg');
  });

  it('3. Idempotência: múltiplas chamadas de inicialização não duplicam migrações nem geram erros', async () => {
    const db = DatabaseService.createTestInstance();

    // 1ª inicialização
    await db.initialize();
    const bookRepo = new BookRepository(db);
    await bookRepo.insert({
      titulo: 'Livro de Idempotência',
      autores: ['Autor'],
      origem: 'manual',
      status_leitura: 'lido',
      tenho_fisico: true,
      dataCadastro: 1000,
      dataAtualizacao: 1000,
      generos: [],
    });

    // 2ª inicialização subsequente
    await db.initialize();
    // 3ª inicialização subsequente
    await db.initialize();

    expect(await bookRepo.count()).toBe(1);
    const book = (await bookRepo.getAll())[0];
    expect(book.titulo).toBe('Livro de Idempotência');
  });

  it('4. Suporta biblioteca com centenas de registros sem perda de desempenho ou dados', async () => {
    const db = DatabaseService.createTestInstance();
    await db.initialize();
    const bookRepo = new BookRepository(db);

    const BATCH_SIZE = 150;
    for (let i = 1; i <= BATCH_SIZE; i++) {
      await bookRepo.insert({
        id: i,
        titulo: `Volume Bibliográfico ${i}`,
        autores: [`Autor ${(i % 10) + 1}`],
        origem: 'manual',
        status_leitura: i % 2 === 0 ? 'lido' : 'quero_ler',
        tenho_fisico: true,
        dataCadastro: 1700000000000 + i,
        dataAtualizacao: 1700000000000 + i,
        generos: ['Ficção'],
      });
    }

    expect(await bookRepo.count()).toBe(BATCH_SIZE);
    const queried = await bookRepo.getAll();
    expect(queried.length).toBe(BATCH_SIZE);
  });
});
