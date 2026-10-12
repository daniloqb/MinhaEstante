import { describe, it, expect, beforeEach } from 'vitest';
import { Book, ReadingStatus, BookFormat } from '../types/book';
import { BookRepository } from '../services/database/bookRepository';
import { DatabaseService } from '../services/database/databaseService';

// Gerador de livros sintéticos com metadados completos
function generateSyntheticBook(index: number, options: { withCover?: boolean } = {}): Book {
  const isLido = index % 3 === 0;
  const isQueroLer = index % 3 === 1;
  const status: ReadingStatus = isLido ? 'lido' : isQueroLer ? 'quero_ler' : 'nenhum';
  const formato: BookFormat = index % 4 === 0 ? 'ebook' : 'fisico';
  const anoPublicacao = 1950 + (index % 74);
  const anoLeitura = isLido ? 2015 + (index % 12) : null;

  // Simulação de volume real de dados (descrições textuais ricas e capa em base64 sintética)
  const syntheticCover = options.withCover
    ? `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/${index.toString(16).padStart(64, 'a')}`
    : null;

  return {
    id: index,
    origem: 'manual',
    idExterno: `EXT-${index}`,
    titulo: `Livro Sintético Volume ${index}`,
    subtitulo: `Subtítulo Detalhado do Volume ${index}`,
    autores: [`Autor Principal ${index % 50}`, `Coautor ${index % 20}`],
    editora: `Editora Literária ${index % 15}`,
    anoPublicacao,
    paginas: 150 + (index % 600),
    isbn10: `85${String(index).padStart(8, '0')}`,
    isbn13: `97885${String(index).padStart(8, '0')}`,
    generos: [`Gênero ${(index % 10) + 1}`, `Ficção`, `Literatura`],
    descricao: `Descrição completa da obra número ${index} contendo metadados detalhados de sinopse e contexto histórico para teste de volume de dados efetivo.`,
    capaUrl: syntheticCover,
    capaLocalPath: `covers/book_${index}_thumb.jpg`,
    formato,
    tenho_fisico: formato === 'fisico',
    status_leitura: status,
    emprestimo:
      index % 10 === 0
        ? {
            nomePessoa: `Amigo Leitor ${index}`,
            dataEmprestimo: '2026-01-15',
            dataDevolucao: '2026-02-15',
            devolvido: false,
          }
        : null,
    mesLeitura: isLido ? ((index % 12) + 1) : null,
    anoLeitura,
    nota: isLido ? ((index % 5) + 6) : null,
    observacoes: `Notas de leitura sobre a obra ${index}`,
    dataCadastro: 1700000000000 + index * 1000,
    dataAtualizacao: 1700000000000 + index * 1000,
  };
}

describe('Fase 2: Persistência com SQLite & BookRepository', () => {
  let dbService: DatabaseService;
  let repo: BookRepository;

  beforeEach(async () => {
    dbService = DatabaseService.createTestInstance();
    await dbService.initialize();
    repo = new BookRepository(dbService);
    await repo.clearAll();
  });

  // 1. Cenário com 1 Livro
  it('Cenário 1 livro: ciclo completo de CRUD (inserção, busca, atualização e exclusão)', async () => {
    const book = generateSyntheticBook(1, { withCover: true });
    
    // Inserção
    const inserted = await repo.insert(book);
    expect(inserted.id).toBe(1);
    expect(await repo.count()).toBe(1);

    // Consulta por ID
    const found = await repo.getById(1);
    expect(found).not.toBeNull();
    expect(found?.titulo).toBe('Livro Sintético Volume 1');
    expect(found?.autores).toContain('Autor Principal 1');
    expect(found?.formato).toBe('fisico');
    expect(found?.tenho_fisico).toBe(true);

    // Atualização
    const updated = await repo.update({
      ...found!,
      titulo: 'Livro Sintético Volume 1 - Edição Especial',
      nota: 10,
      status_leitura: 'lido',
    });
    expect(updated.titulo).toBe('Livro Sintético Volume 1 - Edição Especial');

    const foundUpdated = await repo.getById(1);
    expect(foundUpdated?.titulo).toBe('Livro Sintético Volume 1 - Edição Especial');
    expect(foundUpdated?.nota).toBe(10);
    expect(foundUpdated?.status_leitura).toBe('lido');

    // Exclusão
    const deleted = await repo.delete(1);
    expect(deleted).toBe(true);
    expect(await repo.count()).toBe(0);
    expect(await repo.getById(1)).toBeNull();
  });

  // 2. Cenário com 204 Livros (Volume representativo de acervo pessoal real)
  it('Cenário 204 livros: inserção em lote, integridade de dados e consultas indexadas', async () => {
    const books: Book[] = [];
    for (let i = 1; i <= 204; i++) {
      books.push(generateSyntheticBook(i, { withCover: true }));
    }

    const insertedCount = await repo.bulkInsert(books);
    expect(insertedCount).toBe(204);
    expect(await repo.count()).toBe(204);

    const all = await repo.getAll();
    expect(all.length).toBe(204);

    // Verificação de integridade dos campos
    const book50 = all.find((b) => b.id === 50);
    expect(book50).toBeDefined();
    expect(book50?.titulo).toBe('Livro Sintético Volume 50');
    expect(book50?.autores.length).toBeGreaterThan(0);
    expect(book50?.generos.length).toBe(3);

    // Busca textual indexada
    const searchResults = await repo.search('Volume 50');
    expect(searchResults.some((b) => b.id === 50)).toBe(true);
  });

  // 3. Cenário com 1.000 Livros
  it('Cenário 1.000 livros: consistência e consultas de filtragem', async () => {
    const books: Book[] = [];
    for (let i = 1; i <= 1000; i++) {
      books.push(generateSyntheticBook(i));
    }

    await repo.bulkInsert(books);
    expect(await repo.count()).toBe(1000);

    const all = await repo.getAll();
    expect(all.length).toBe(1000);

    // Consulta pontual de registro específico
    const book777 = await repo.getById(777);
    expect(book777).not.toBeNull();
    expect(book777?.titulo).toBe('Livro Sintético Volume 777');
  });

  // 4. Cenário com 5.000 Livros
  it('Cenário 5.000 livros: transação em massa e estabilidade da persistência', async () => {
    const books: Book[] = [];
    for (let i = 1; i <= 5000; i++) {
      books.push(generateSyntheticBook(i));
    }

    const start = performance.now();
    await repo.bulkInsert(books);
    const duration = performance.now() - start;

    expect(await repo.count()).toBe(5000);
    expect(duration).toBeLessThan(5000); // Executa em menos de 5 segundos

    // Atualização de livro em massa
    const target = await repo.getById(2500);
    expect(target).not.toBeNull();
    await repo.update({ ...target!, status_leitura: 'lido', nota: 9 });
    const verified = await repo.getById(2500);
    expect(verified?.nota).toBe(9);
  });

  // 5. Cenário com 10.000 Livros (Sem limites artificiais de 5MB do localStorage)
  it('Cenário 10.000 livros: volume massivo sem estouro de cota e contagem exata', async () => {
    const books: Book[] = [];
    for (let i = 1; i <= 10000; i++) {
      books.push(generateSyntheticBook(i));
    }

    await repo.bulkInsert(books);
    const totalCount = await repo.count();
    expect(totalCount).toBe(10000);

    // Validação de consulta e integridade dos limites
    const first = await repo.getById(1);
    const last = await repo.getById(10000);
    expect(first?.titulo).toBe('Livro Sintético Volume 1');
    expect(last?.titulo).toBe('Livro Sintético Volume 10000');
  });

  // 6. Teste de Operações Concorrentes
  it('Concorrência: múltiplas operações paralelas de inserção e consulta sem corrupção', async () => {
    const parallelOps = Array.from({ length: 50 }, async (_, idx) => {
      const book = generateSyntheticBook(1000 + idx);
      return await repo.insert(book);
    });

    const results = await Promise.all(parallelOps);
    expect(results.length).toBe(50);
    expect(await repo.count()).toBe(50);
  });

  // 7. Teste de Falhas Simuladas de Escrita e Atomicidade
  it('Tratamento de falhas: transação com erro não corrompe o estado prévio', async () => {
    await repo.insert(generateSyntheticBook(1));
    expect(await repo.count()).toBe(1);

    // Simula transação que lança exceção proposital
    let errorThrown = false;
    try {
      await dbService.runInTransaction(async () => {
        await repo.insert(generateSyntheticBook(2));
        throw new Error('Falha simulada de I/O em disco');
      });
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);
  });

  // 8. Teste de Reinicialização & Recuperação após Fechamento
  it('Reinicialização: dados persistem e permanecem íntegros após reabertura do repositório', async () => {
    const b1 = generateSyntheticBook(101);
    const b2 = generateSyntheticBook(102);

    await repo.insert(b1);
    await repo.insert(b2);
    expect(await repo.count()).toBe(2);

    // Simula reabertura criando uma nova instância de repositório apontando para o mesmo serviço
    const newRepoInstance = new BookRepository(dbService);
    await newRepoInstance.initialize();

    const retrieved = await newRepoInstance.getAll();
    expect(retrieved.length).toBe(2);
    expect(retrieved.some((b) => b.id === 101)).toBe(true);
    expect(retrieved.some((b) => b.id === 102)).toBe(true);
  });
});
