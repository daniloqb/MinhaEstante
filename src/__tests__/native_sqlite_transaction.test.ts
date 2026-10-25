import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AsyncMutex,
  NativeTransactionContext,
  NativeSQLiteDatabaseAdapter,
} from '../services/database/databaseService';
import { BookRepository } from '../services/database/bookRepository';
import { Book } from '../types/book';

/**
 * Simulador de alta fidelidade do comportamento nativo do @capacitor-community/sqlite no Android
 * Lança exatamente "Execute: Failed in beginTransaction Already in transaction" se uma operação
 * for invocada com `transaction = true` enquanto uma transação já estiver aberta.
 */
class AndroidCapacitorSQLiteSimulator {
  private inTransaction = false;
  private isOpen = true;
  public tables: Map<string, any[]> = new Map();
  public executeLog: string[] = [];

  constructor() {
    this.tables.set('schema_migrations', []);
    this.tables.set('books', []);
  }

  async isDBOpen() {
    return { result: this.isOpen };
  }

  async open() {
    this.isOpen = true;
  }

  async close() {
    this.isOpen = false;
  }

  async isTransactionActive() {
    return { result: this.inTransaction };
  }

  async beginTransaction() {
    if (this.inTransaction) {
      throw new Error('Execute: Failed in beginTransaction Already in transaction');
    }
    this.inTransaction = true;
    return { changes: 0 };
  }

  async commitTransaction() {
    if (!this.inTransaction) {
      throw new Error('No transaction active');
    }
    this.inTransaction = false;
    return { changes: 0 };
  }

  async rollbackTransaction() {
    this.inTransaction = false;
    return { changes: 0 };
  }

  async execute(statements: string, transaction = true) {
    if (transaction) {
      if (this.inTransaction) {
        throw new Error('Execute: Failed in beginTransaction Already in transaction');
      }
      this.inTransaction = true;
    }

    this.executeLog.push(`EXEC: ${statements} (tx=${transaction})`);

    if (transaction) {
      this.inTransaction = false;
    }
    return { changes: 1 };
  }

  async run(statement: string, values?: any[], transaction = true) {
    if (transaction) {
      if (this.inTransaction) {
        throw new Error('Execute: Failed in beginTransaction Already in transaction');
      }
      this.inTransaction = true;
    }

    this.executeLog.push(`RUN: ${statement} (tx=${transaction})`);

    const upper = statement.trim().toUpperCase();
    if (upper.startsWith('INSERT INTO BOOKS') || upper.startsWith('INSERT OR REPLACE INTO BOOKS')) {
      const list = this.tables.get('books') || [];
      list.push(values || []);
      this.tables.set('books', list);
    } else if (upper.startsWith('INSERT INTO SCHEMA_MIGRATIONS') || upper.startsWith('INSERT OR IGNORE INTO SCHEMA_MIGRATIONS')) {
      const list = this.tables.get('schema_migrations') || [];
      list.push({ version: values?.[0], applied_at: values?.[1] });
      this.tables.set('schema_migrations', list);
    }

    if (transaction) {
      this.inTransaction = false;
    }
    return { changes: 1, lastId: Date.now() };
  }

  async query(statement: string, _params?: any[]) {
    const upper = statement.trim().toUpperCase();
    if (upper.includes('FROM SCHEMA_MIGRATIONS')) {
      return { values: this.tables.get('schema_migrations') || [] };
    }
    if (upper.includes('PRAGMA TABLE_INFO(BOOKS)')) {
      return {
        values: [
          { name: 'id' },
          { name: 'titulo' },
          { name: 'formatos_json' },
          { name: 'uuid' },
        ],
      };
    }
    if (upper.includes('SELECT ID FROM BOOKS WHERE UUID IS NULL')) {
      return { values: [] };
    }
    if (upper.includes('SELECT COUNT(*) FROM BOOKS')) {
      return { values: [{ count: (this.tables.get('books') || []).length }] };
    }
    return { values: [] };
  }
}

describe('MinhaEstante — Correção Crítica do SQLite Nativo Android', () => {
  describe('1. AsyncMutex — Serialização e Prevenção de Condições de Corrida', () => {
    it('Executa tarefas assíncronas concorrentes de forma sequencial e ordenada', async () => {
      const mutex = new AsyncMutex();
      const executionOrder: number[] = [];

      const task1 = mutex.runExclusive(async () => {
        await new Promise((r) => setTimeout(r, 40));
        executionOrder.push(1);
        return 'res1';
      });

      const task2 = mutex.runExclusive(async () => {
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push(2);
        return 'res2';
      });

      const task3 = mutex.runExclusive(async () => {
        executionOrder.push(3);
        return 'res3';
      });

      const results = await Promise.all([task1, task2, task3]);

      expect(results).toEqual(['res1', 'res2', 'res3']);
      // Mesmo com tempos diferentes, a fila FIFO garante a ordem de submissão
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('Libera o bloqueio do mutex mesmo se a tarefa assíncrona lançar uma exceção', async () => {
      const mutex = new AsyncMutex();
      let caught = false;

      try {
        await mutex.runExclusive(async () => {
          throw new Error('Falha simulada');
        });
      } catch (err: any) {
        caught = true;
        expect(err.message).toBe('Falha simulada');
      }

      expect(caught).toBe(true);

      // Tarefa subsequente deve conseguir adquirir o lock normalmente
      const subsequentResult = await mutex.runExclusive(async () => {
        return 'liberado com sucesso';
      });

      expect(subsequentResult).toBe('liberado com sucesso');
    });
  });

  describe('2. NativeTransactionContext — Passagem Explícita de transaction = false', () => {
    it('Chama execute e run com transaction = false para evitar início de transação duplicada', async () => {
      const mockDb: any = {
        execute: vi.fn().mockResolvedValue({ changes: 1 }),
        run: vi.fn().mockResolvedValue({ changes: 1, lastId: 10 }),
        query: vi.fn().mockResolvedValue({ values: [{ id: 1 }] }),
      };

      const txContext = new NativeTransactionContext(mockDb);

      await txContext.execute('DELETE FROM test_table;');
      expect(mockDb.execute).toHaveBeenCalledWith('DELETE FROM test_table;', false);

      await txContext.execute('INSERT INTO test_table (name) VALUES (?);', ['Livro A']);
      expect(mockDb.run).toHaveBeenCalledWith('INSERT INTO test_table (name) VALUES (?);', ['Livro A'], false);

      const queryRes = await txContext.query('SELECT * FROM test_table;');
      expect(queryRes).toEqual([{ id: 1 }]);
    });

    it('Permite reentrância aninhada transparente dentro do mesmo contexto de transação', async () => {
      const mockDb: any = {
        execute: vi.fn().mockResolvedValue({ changes: 1 }),
        run: vi.fn().mockResolvedValue({ changes: 1 }),
      };

      const txContext = new NativeTransactionContext(mockDb);

      let nestedExecuted = false;
      await txContext.runInTransaction(async (nestedTx) => {
        expect(nestedTx).toBe(txContext);
        await nestedTx?.execute('UPDATE test SET a = 1;');
        nestedExecuted = true;
      });

      expect(nestedExecuted).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledWith('UPDATE test SET a = 1;', false);
    });
  });

  describe('3. NativeSQLiteDatabaseAdapter com Simulador Android Rigoroso', () => {
    let simulator: AndroidCapacitorSQLiteSimulator;
    let adapter: NativeSQLiteDatabaseAdapter;

    beforeEach(() => {
      simulator = new AndroidCapacitorSQLiteSimulator();
      adapter = new NativeSQLiteDatabaseAdapter();
      // Injeta conexão simulada diretamente para validação unitária
      (adapter as any).db = simulator;
      (adapter as any).isInitialized = true;
    });

    it('Executa operações individuais sem erro e sem deixar transações ativas pendentes', async () => {
      await adapter.execute('CREATE TABLE IF NOT EXISTS sample (id INT);');
      await adapter.execute('INSERT INTO sample VALUES (?);', [42]);

      const isTx = (await simulator.isTransactionActive()).result;
      expect(isTx).toBe(false);
    });

    it('Executa bloco runInTransaction com múltiplos execute e run sem estourar Already in transaction', async () => {
      const result = await adapter.runInTransaction(async (tx) => {
        const executor = tx || adapter;
        await executor.execute('INSERT INTO books (id, titulo) VALUES (?, ?);', [1, 'Livro 1']);
        await executor.execute('INSERT INTO books (id, titulo) VALUES (?, ?);', [2, 'Livro 2']);
        await executor.execute('INSERT INTO books (id, titulo) VALUES (?, ?);', [3, 'Livro 3']);
        return 'sucesso_transacao';
      });

      expect(result).toBe('sucesso_transacao');
      expect((await simulator.isTransactionActive()).result).toBe(false);
      expect((simulator.tables.get('books') || []).length).toBe(3);
    });

    it('Garante que transações simultâneas não colidem e não geram Already in transaction', async () => {
      // Dispara 5 transações concorrentes simultaneamente
      const txPromises = [1, 2, 3, 4, 5].map((idx) =>
        adapter.runInTransaction(async (tx) => {
          const executor = tx || adapter;
          await new Promise((r) => setTimeout(r, 10));
          await executor.execute('INSERT INTO books (id, titulo) VALUES (?, ?);', [idx, `Concorrente ${idx}`]);
          return idx;
        })
      );

      const results = await Promise.all(txPromises);
      expect(results).toEqual([1, 2, 3, 4, 5]);

      expect((await simulator.isTransactionActive()).result).toBe(false);
      expect((simulator.tables.get('books') || []).length).toBe(5);
    });

    it('Executa rollback imediato em caso de erro e permite que novas transações funcionem normalmente', async () => {
      let threwError = false;

      try {
        await adapter.runInTransaction(async (tx) => {
          const executor = tx || adapter;
          await executor.execute('INSERT INTO books (id, titulo) VALUES (?, ?);', [99, 'Livro Cancelado']);
          throw new Error('Falha de validação ou restrição de integridade');
        });
      } catch (err: any) {
        threwError = true;
        expect(err.message).toContain('Falha de validação');
      }

      expect(threwError).toBe(true);
      // Confirma que a transação foi desfeita e conexão está livre
      expect((await simulator.isTransactionActive()).result).toBe(false);

      // Nova transação subsequente deve passar limpa
      const nextResult = await adapter.runInTransaction(async (tx) => {
        const executor = tx || adapter;
        await executor.execute('INSERT INTO books (id, titulo) VALUES (?, ?);', [100, 'Livro Bem Sucedido']);
        return 'recuperado';
      });

      expect(nextResult).toBe('recuperado');
      expect((await simulator.isTransactionActive()).result).toBe(false);
    });

    it('bulkInsert de 215 livros sob o simulador Android passa sem nenhum erro de transação', async () => {
      const repo = new BookRepository(adapter);

      const sampleBooks: Book[] = Array.from({ length: 215 }, (_, i) => ({
        id: i + 1,
        origem: 'manual' as const,
        titulo: `Obra do Acervo ${i + 1}`,
        autores: ['Autor Teste'],
        generos: [],
        formato: 'fisico' as const,
        tenhoFisico: true,
        tenho_fisico: true,
        formatos: ['fisico' as const],
        statusLeitura: 'lido' as const,
        status_leitura: 'lido' as const,
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      }));

      const countInserted = await repo.bulkInsert(sampleBooks);
      expect(countInserted).toBe(215);
      expect((await simulator.isTransactionActive()).result).toBe(false);
      expect((simulator.tables.get('books') || []).length).toBe(215);
    });
  });
});
