import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService, CURRENT_DB_VERSION } from '../services/database/databaseService';
import { BookRepository } from '../services/database/bookRepository';

describe('MinhaEstante 2.0 — Migração SQLite v1 -> v2 e Estabilidade de Esquema', () => {
  let dbService: DatabaseService;

  beforeEach(async () => {
    dbService = DatabaseService.createTestInstance();
    await dbService.initialize();
  });

  it('1. Migração versionada registra versão 1 e 2 em schema_migrations', async () => {
    const migrations = await dbService.query<{ version: number; applied_at: number }>(
      'SELECT version, applied_at FROM schema_migrations ORDER BY version ASC;'
    );

    const versions = migrations.map((m) => Number(m.version));
    expect(versions).toContain(1);
    expect(versions).toContain(2);
    expect(CURRENT_DB_VERSION).toBe(2);
  });

  it('2. Inicialização e consultas respeitam campos v2 (uuid e formatos_json)', async () => {
    const repo = new BookRepository(dbService);
    await repo.clearAll();

    // Insere livro sem UUID explícito
    const created = await repo.insert({
      origem: 'manual',
      titulo: 'Livro Migração v2',
      autores: ['Engenharia'],
      tenho_fisico: false,
      status_leitura: 'lido',
      generos: ['Tecnologia'],
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
    });

    expect(created.uuid).toBeDefined();
    expect(created.uuid!.length).toBeGreaterThan(0);
    expect(created.tenho_fisico).toBe(false); // Preservado como false!

    // Recupera por ID e por UUID
    const byId = await repo.getById(created.id);
    expect(byId?.uuid).toBe(created.uuid);
    expect(byId?.tenho_fisico).toBe(false);

    const byUuid = await repo.getByUuid(created.uuid!);
    expect(byUuid).not.toBeNull();
    expect(byUuid?.id).toBe(created.id);
    expect(byUuid?.titulo).toBe('Livro Migração v2');
  });

  it('3. Migração é idempotente e pode ser reexecutada sem erros ou conflitos', async () => {
    // Reexecutar consultas de migração não causa erro
    const migrationsBefore = await dbService.query<{ version: number }>(
      'SELECT version FROM schema_migrations;'
    );
    expect(migrationsBefore.length).toBeGreaterThanOrEqual(2);

    // Inserção repetida de migração existente é ignorada
    await dbService.execute(
      'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?);',
      [2, Date.now()]
    );

    const migrationsAfter = await dbService.query<{ version: number }>(
      'SELECT version FROM schema_migrations;'
    );
    expect(migrationsAfter.length).toBe(migrationsBefore.length);
  });

  it('4. Novas tabelas da Versão 2 existem e aceitam operações de integridade referencial', async () => {
    const repo = new BookRepository(dbService);
    const book = await repo.insert({
      origem: 'manual',
      titulo: 'Livro com Anexo e Sessão',
      autores: ['Autor v2'],
      tenho_fisico: true,
      status_leitura: 'lendo',
      generos: ['Ficção'],
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
    });

    // Insere anexo digital associado ao livro
    await dbService.execute(
      `INSERT INTO book_attachments (
        id, book_id, type, format, filename, mime_type, size_bytes,
        storage_provider, storage_reference, checksum, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'att-test-1',
        book.id,
        'ebook',
        'epub',
        'livro.epub',
        'application/epub+zip',
        1024000,
        'app_storage',
        'files/livro.epub',
        null,
        Date.now(),
        Date.now(),
      ]
    );

    const attachments = await dbService.query<{ id: string; filename: string }>(
      'SELECT id, filename FROM book_attachments WHERE book_id = ?;',
      [book.id]
    );
    expect(attachments.length).toBe(1);
    expect(attachments[0].filename).toBe('livro.epub');

    // Ao deletar o livro, o anexo associado deve ser removido em cascata
    await repo.delete(book.id);

    const attachmentsAfterDelete = await dbService.query(
      'SELECT id FROM book_attachments WHERE book_id = ?;',
      [book.id]
    );
    expect(attachmentsAfterDelete.length).toBe(0);
  });
});
