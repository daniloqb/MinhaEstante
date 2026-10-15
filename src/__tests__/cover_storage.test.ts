import { describe, it, expect, beforeEach } from 'vitest';
import {
  CoverStorageService,
  validateImageMagicBytes,
  generateCoverFileName,
} from '../services/storage/coverStorageService';
import { BookRepository } from '../services/database/bookRepository';
import { DatabaseService } from '../services/database/databaseService';
import { Book } from '../types/book';

// Header JPEG sintético válido: FF D8 FF E0
const VALID_JPEG_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

// Header PNG sintético válido: 89 50 4E 47
const VALID_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// String de dados arbitrária sem magic bytes de imagem válidos
const INVALID_DATA_BASE64 = 'data:text/plain;base64,VGhpcyBpcyBub3QgYW4gaW1hZ2UgZmlsZQ==';

describe('Fase 3: Armazenamento Local de Capas (CoverStorageService)', () => {
  let dbService: DatabaseService;
  let repo: BookRepository;

  beforeEach(async () => {
    CoverStorageService.clearMemoryStore();
    dbService = DatabaseService.createTestInstance();
    await dbService.initialize();
    repo = new BookRepository(dbService);
    await repo.clearAll();
  });

  it('1. Valida magic bytes de formatos de imagem suportados (JPEG, PNG)', () => {
    expect(validateImageMagicBytes(VALID_JPEG_BASE64)).toBe(true);
    expect(validateImageMagicBytes(VALID_PNG_BASE64)).toBe(true);
    expect(validateImageMagicBytes(INVALID_DATA_BASE64)).toBe(false);
  });

  it('2. Gera nomes de arquivos estáveis e sanitizados', () => {
    const fileName1 = generateCoverFileName(42);
    const fileName2 = generateCoverFileName(42);
    expect(fileName1).toMatch(/^covers\/cover_42_\d+_[a-z0-9]+\.jpg$/);
    expect(fileName2).toMatch(/^covers\/cover_42_\d+_[a-z0-9]+\.jpg$/);
    expect(fileName1).not.toBe(fileName2);
  });

  it('3. Salva capa física no armazenamento privado e retorna caminho relativo', async () => {
    const { relativePath, originalUrl } = await CoverStorageService.saveCover(VALID_JPEG_BASE64, 10);
    expect(relativePath).toMatch(/^covers\/cover_10_/);
    expect(originalUrl).toBeNull();

    // Recupera a URL de exibição
    const displayUrl = await CoverStorageService.getCoverDisplayUrl(relativePath);
    expect(displayUrl).not.toBeNull();
    expect(displayUrl).toBe(VALID_JPEG_BASE64);
  });

  it('4. Rejeita arquivos corrompidos ou com formato não suportado', async () => {
    await expect(
      CoverStorageService.saveCover(INVALID_DATA_BASE64, 99)
    ).rejects.toThrow('Formato de imagem inválido ou arquivo corrompido');
  });

  it('5. Integração com SQLite: ao inserir livro com capa, extrai Base64 para arquivo local', async () => {
    const newBook: Omit<Book, 'id'> = {
      origem: 'manual',
      titulo: 'Dom Casmurro Offline',
      autores: ['Machado de Assis'],
      tenho_fisico: true,
      status_leitura: 'lido',
      generos: ['Literatura Brasileira'],
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
      capaUrl: VALID_JPEG_BASE64,
    };

    const inserted = await repo.insert(newBook);
    expect(inserted.id).toBeDefined();
    expect(inserted.capaLocalPath).toMatch(/^covers\/cover_/);
    expect(inserted.capaUrl).toBeNull(); // Base64 removido do campo capaUrl!

    // Confirma que no banco SQLite o campo capa_local_path foi persistido
    const fromDb = await repo.getById(inserted.id);
    expect(fromDb?.capaLocalPath).toBe(inserted.capaLocalPath);
    expect(fromDb?.capaUrl).toBeNull();

    // Exibição offline deve funcionar perfeitamente
    const displayUrl = await CoverStorageService.getCoverDisplayUrl(fromDb?.capaLocalPath);
    expect(displayUrl).toBe(VALID_JPEG_BASE64);
  });

  it('6. Atualização de capa: substitui arquivo e remove capa antiga se não for compartilhada', async () => {
    const book = await repo.insert({
      origem: 'manual',
      titulo: 'Livro para Atualizar Capa',
      autores: ['Autor Teste'],
      tenho_fisico: true,
      status_leitura: 'nenhum',
      generos: [],
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
      capaUrl: VALID_JPEG_BASE64,
    });

    const initialCoverPath = book.capaLocalPath!;
    expect(initialCoverPath).toBeDefined();

    // Atualiza com uma nova capa (PNG)
    const updated = await repo.update({
      ...book,
      capaUrl: VALID_PNG_BASE64,
    });

    expect(updated.capaLocalPath).not.toBe(initialCoverPath);
    expect(updated.capaLocalPath).toMatch(/^covers\/cover_/);

    // Capa antiga não deve mais estar no armazenamento
    const oldDisplay = await CoverStorageService.getCoverDisplayUrl(initialCoverPath);
    expect(oldDisplay).toBeNull();

    // Nova capa deve estar acessível
    const newDisplay = await CoverStorageService.getCoverDisplayUrl(updated.capaLocalPath);
    expect(newDisplay).toBe(VALID_PNG_BASE64);
  });

  it('7. Exclusão segura: ao deletar livro, apaga o arquivo físico da capa se não houver referências', async () => {
    const book = await repo.insert({
      origem: 'manual',
      titulo: 'Livro para Deletar',
      autores: ['Autor'],
      tenho_fisico: true,
      status_leitura: 'nenhum',
      generos: [],
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
      capaUrl: VALID_JPEG_BASE64,
    });

    const coverPath = book.capaLocalPath!;
    expect(await CoverStorageService.getCoverDisplayUrl(coverPath)).not.toBeNull();

    await repo.delete(book.id);

    // Arquivo físico deve ter sido excluído
    const resolvedAfterDelete = await CoverStorageService.getCoverDisplayUrl(coverPath);
    expect(resolvedAfterDelete).toBeNull();
  });

  it('8. Referência compartilhada: não deleta arquivo se outro livro estiver utilizando a mesma capa', async () => {
    const book1 = await repo.insert({
      origem: 'manual',
      titulo: 'Volume 1 (Capa Compartilhada)',
      autores: ['Autor'],
      tenho_fisico: true,
      status_leitura: 'nenhum',
      generos: [],
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
      capaUrl: VALID_JPEG_BASE64,
    });

    // Livro 2 compartilhando exatamente o mesmo capaLocalPath do livro 1
    const book2 = await repo.insert({
      origem: 'manual',
      titulo: 'Volume 2 (Capa Compartilhada)',
      autores: ['Autor'],
      tenho_fisico: true,
      status_leitura: 'nenhum',
      generos: [],
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
      capaLocalPath: book1.capaLocalPath,
    });

    const sharedPath = book1.capaLocalPath!;

    // Deleta apenas o Livro 1
    await repo.delete(book1.id);

    // Livro 2 ainda existe com essa capa, logo o arquivo DEVE permanecer intacto!
    const displayStillValid = await CoverStorageService.getCoverDisplayUrl(sharedPath);
    expect(displayStillValid).not.toBeNull();
    expect(displayStillValid).toBe(VALID_JPEG_BASE64);

    // Agora deleta o Livro 2 (último usuário da capa)
    await repo.delete(book2.id);

    // Agora sim o arquivo deve ser removido
    expect(await CoverStorageService.getCoverDisplayUrl(sharedPath)).toBeNull();
  });

  it('9. Limpeza de órfãos: remove arquivos da pasta covers/ que não pertencem a nenhum livro', async () => {
    // Cria 2 capas diretamente no storage sem associar a nenhum livro
    const orphan1 = await CoverStorageService.saveCover(VALID_JPEG_BASE64, 'orphan1');
    const orphan2 = await CoverStorageService.saveCover(VALID_PNG_BASE64, 'orphan2');

    // Livro legítimo com capa ativa
    const activeBook = await repo.insert({
      origem: 'manual',
      titulo: 'Livro com Capa Ativa',
      autores: ['Autor Ativo'],
      tenho_fisico: true,
      status_leitura: 'nenhum',
      generos: [],
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
      capaUrl: VALID_JPEG_BASE64,
    });

    // Executa limpeza de órfãos informando apenas os caminhos dos livros no SQLite
    const activePaths = [activeBook.capaLocalPath!];
    const cleanedCount = await CoverStorageService.cleanOrphanCovers(activePaths);

    expect(cleanedCount).toBe(2);
    expect(await CoverStorageService.getCoverDisplayUrl(orphan1.relativePath)).toBeNull();
    expect(await CoverStorageService.getCoverDisplayUrl(orphan2.relativePath)).toBeNull();
    expect(await CoverStorageService.getCoverDisplayUrl(activeBook.capaLocalPath)).not.toBeNull();
  });

  it('10. Função utilitária para converter Base64 em arquivo local (Fase 4 readiness)', async () => {
    const localPath = await CoverStorageService.convertBase64ToLocalCover(VALID_JPEG_BASE64, 555);
    expect(localPath).toMatch(/^covers\/cover_555_/);
    expect(await CoverStorageService.getCoverDisplayUrl(localPath)).toBe(VALID_JPEG_BASE64);
  });

  it('11. getCoverDisplayUrlSync retorna null para caminhos relativos não resolvidos e URL para dados em cache', async () => {
    // Caminho relativo não resolvido no cache síncrono retorna null (evita 404 no WebView)
    const unconvertedPath = 'covers/cover_nonexistent_123.jpg';
    expect(CoverStorageService.getCoverDisplayUrlSync(unconvertedPath, null)).toBeNull();

    // Data URLs e HTTP URLs são retornadas diretamente
    expect(CoverStorageService.getCoverDisplayUrlSync(null, 'https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg');
    expect(CoverStorageService.getCoverDisplayUrlSync(VALID_JPEG_BASE64, null)).toBe(VALID_JPEG_BASE64);

    // Salva uma capa e verifica se o cache síncrono a retorna após salva
    const { relativePath } = await CoverStorageService.saveCover(VALID_JPEG_BASE64, 777);
    expect(CoverStorageService.getCoverDisplayUrlSync(relativePath, null)).toBe(VALID_JPEG_BASE64);
  });

  it('12. warmDisplayCache executa com segurança em lista de livros', async () => {
    const fakeBooks = [
      { id: 1, capaLocalPath: 'covers/test_1.jpg' },
      { id: 2, capaLocalPath: null },
    ];
    await expect(CoverStorageService.warmDisplayCache(fakeBooks as any)).resolves.not.toThrow();
  });
});
