import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { BackupService, BackupManifest } from '../services/storage/backupService';
import { CoverStorageService } from '../services/storage/coverStorageService';
import { BookRepository } from '../services/database/bookRepository';
import { DatabaseService } from '../services/database/databaseService';
import { Book } from '../types/book';

// Headers válidos sintéticos
const VALID_JPEG_BASE64 =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Fase 4: Backup e Restauração (BackupService)', () => {
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

  it('1. Backup e restauração de biblioteca vazia gera ZIP com manifest válido', async () => {
    const backup = await BackupService.exportZipBackup();
    expect(backup.fileName).toMatch(/^MinhaEstante_Backup_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(backup.booksCount).toBe(0);
    expect(backup.coversCount).toBe(0);
    expect(backup.blob).toBeDefined();

    // Valida o zip gerado
    const extracted = await BackupService.validateAndExtractZip(backup.blob!);
    expect(extracted.manifest.appId).toBe('com.booknookapp');
    expect(extracted.manifest.booksCount).toBe(0);
    expect(extracted.books.length).toBe(0);
  });

  it('2. Backup e restauração de 204 livros preserva registros e integridade', async () => {
    const books: Book[] = [];
    for (let i = 1; i <= 204; i++) {
      books.push({
        id: i,
        origem: 'manual',
        titulo: `Livro de Teste ${i}`,
        autores: [`Autor ${i % 10}`],
        anoPublicacao: 2000 + (i % 25),
        tenho_fisico: i % 2 === 0,
        status_leitura: i % 3 === 0 ? 'lido' : i % 3 === 1 ? 'quero_ler' : 'nenhum',
        generos: ['Ficção', `Gênero ${i % 5}`],
        dataCadastro: 1700000000000 + i * 1000,
        dataAtualizacao: 1700000000000 + i * 1000,
      });
    }

    await repo.bulkInsert(books);
    expect(await repo.count()).toBe(204);

    // Exporta backup
    const backup = await BackupService.exportZipBackup();
    expect(backup.booksCount).toBe(204);

    // Limpa o banco simulando reinstalação em aparelho novo
    await repo.clearAll();
    expect(await repo.count()).toBe(0);

    // Restaura no modo 'replace'
    const result = await BackupService.restoreFromZip(backup.blob!, 'replace');
    expect(result.booksRestored).toBe(204);
    expect(await repo.count()).toBe(204);

    const book1 = await repo.getById(1);
    expect(book1).toBeDefined();
    expect(book1?.titulo).toBe('Livro de Teste 1');
  });

  it('3. Backup e restauração completa com capas físicas incluídas no ZIP', async () => {
    // Insere livros com capas
    const bookWithCover = await repo.insert({
      origem: 'manual',
      titulo: 'Livro Com Capa Física',
      autores: ['Autor Ilustrado'],
      tenho_fisico: true,
      status_leitura: 'lido',
      generos: ['Arte'],
      capaUrl: VALID_JPEG_BASE64,
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
    });

    expect(bookWithCover.capaLocalPath).toBeDefined();
    const coverPath = bookWithCover.capaLocalPath!;

    // Exporta backup
    const backup = await BackupService.exportZipBackup();
    expect(backup.coversCount).toBe(1);

    // Simula troca de aparelho: limpa o storage de capas e o banco
    CoverStorageService.clearMemoryStore();
    await repo.clearAll();

    expect(await repo.count()).toBe(0);
    expect(await CoverStorageService.getCoverDisplayUrl(coverPath)).toBeNull();

    // Restaura o ZIP
    const restoreResult = await BackupService.restoreFromZip(backup.blob!, 'replace');
    expect(restoreResult.booksRestored).toBe(1);
    expect(restoreResult.coversRestored).toBe(1);

    // Confirma que a capa foi restaurada fisicamente e funciona offline
    const restoredBook = (await repo.getAll())[0];
    expect(restoredBook.capaLocalPath).toBe(coverPath);
    const restoredCoverUrl = await CoverStorageService.getCoverDisplayUrl(restoredBook.capaLocalPath);
    expect(restoredCoverUrl).not.toBeNull();
    expect(restoredCoverUrl).toBe(VALID_JPEG_BASE64);
  });

  it('4. Importação de backup JSON legado com conversão automática de capas Base64', async () => {
    const legacyBackup = {
      version: 1,
      exportedAt: '2024-01-01T12:00:00Z',
      books: [
        {
          id: 99,
          titulo: 'Livro Legado com Base64',
          autores: ['Escritor Antigo'],
          categoria: 'Meus Livros', // Campo legado que vira tenho_fisico=true
          capaUrl: VALID_PNG_BASE64,
        },
      ],
    };

    const importResult = await BackupService.importLegacyJson(
      JSON.stringify(legacyBackup),
      'replace'
    );

    expect(importResult.count).toBe(1);
    expect(importResult.coversConverted).toBe(1);

    const booksInDb = await repo.getAll();
    expect(booksInDb.length).toBe(1);
    expect(booksInDb[0].titulo).toBe('Livro Legado com Base64');
    expect(booksInDb[0].tenho_fisico).toBe(true);
    expect(booksInDb[0].capaLocalPath).toMatch(/^covers\/cover_/);
    expect(booksInDb[0].capaUrl).toBeNull(); // Base64 removido do campo url!

    // Confirma que a imagem convertida está acessível
    const displayUrl = await CoverStorageService.getCoverDisplayUrl(booksInDb[0].capaLocalPath);
    expect(displayUrl).toBe(VALID_PNG_BASE64);
  });

  it('5. Proteção contra ZIP corrompido ou manifesto ausente', async () => {
    const corruptedZip = new JSZip();
    corruptedZip.file('random.txt', 'arquivo qualquer');
    const corruptedBlob = await corruptedZip.generateAsync({ type: 'blob' });

    await expect(
      BackupService.restoreFromZip(corruptedBlob, 'replace')
    ).rejects.toThrow('manifest.json');
  });

  it('6. Proteção contra Zip-Slip (caminhos com .. ou absolutos)', async () => {
    const maliciousZip = new JSZip();
    const manifest: BackupManifest = {
      appId: 'com.booknookapp',
      appName: 'Minha Estante',
      version: 1,
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      booksCount: 1,
      coversCount: 1,
      platform: 'cross-platform',
    };

    maliciousZip.file('manifest.json', JSON.stringify(manifest));
    maliciousZip.file(
      'books.json',
      JSON.stringify([
        {
          id: 1,
          titulo: 'Livro Malicioso',
          capaLocalPath: 'covers/../../etc/passwd',
        },
      ])
    );
    maliciousZip.file('covers/../../etc/passwd', VALID_JPEG_BASE64.split(',')[1]);

    const blob = await maliciousZip.generateAsync({ type: 'blob' });
    const extracted = await BackupService.validateAndExtractZip(blob);

    // O arquivo com path traversal deve ser ignorado pelos filtros de segurança
    expect(extracted.coverFiles.has('covers/../../etc/passwd')).toBe(false);
    expect(extracted.warnings.some((w) => w.includes('não seguro'))).toBe(true);
  });

  it('7. Resiliência: restauração com imagens ausentes preserva os livros com avisos', async () => {
    const zipWithMissingImages = new JSZip();
    const manifest: BackupManifest = {
      appId: 'com.booknookapp',
      appName: 'Minha Estante',
      version: 1,
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      booksCount: 1,
      coversCount: 0,
      platform: 'cross-platform',
    };

    zipWithMissingImages.file('manifest.json', JSON.stringify(manifest));
    zipWithMissingImages.file(
      'books.json',
      JSON.stringify([
        {
          id: 10,
          titulo: 'Livro cuja capa foi deletada do zip',
          capaLocalPath: 'covers/imagem_inexistente.jpg',
        },
      ])
    );

    const blob = await zipWithMissingImages.generateAsync({ type: 'blob' });
    const res = await BackupService.restoreFromZip(blob, 'replace');

    expect(res.booksRestored).toBe(1);
    expect(res.warnings.some((w) => w.includes('não encontrada'))).toBe(true);
    expect(await repo.count()).toBe(1);
  });

  it('8. Rollback em caso de erro crítico durante substituição de biblioteca', async () => {
    // Popula estado prévio com 5 livros
    for (let i = 1; i <= 5; i++) {
      await repo.insert({
        origem: 'manual',
        titulo: `Livro Preexistente ${i}`,
        autores: ['Autor'],
        generos: [],
        tenho_fisico: true,
        status_leitura: 'lido',
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      });
    }
    expect(await repo.count()).toBe(5);

    // Cria um ZIP com books.json corrompido que falha após validação
    const zipWithBadBooks = new JSZip();
    zipWithBadBooks.file(
      'manifest.json',
      JSON.stringify({
        appId: 'com.booknookapp',
        appName: 'Minha Estante',
        version: 1,
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
        booksCount: 1,
        coversCount: 0,
        platform: 'cross-platform',
      })
    );
    // Dados que causam rejeição
    zipWithBadBooks.file('books.json', 'isto nao eh json valido');

    const blob = await zipWithBadBooks.generateAsync({ type: 'blob' });

    await expect(
      BackupService.restoreFromZip(blob, 'replace')
    ).rejects.toThrow();

    // A biblioteca original deve permanecer intacta (5 livros)
    expect(await repo.count()).toBe(5);
  });

  it('9. Modo mesclar (merge) adiciona livros novos preservando os já existentes', async () => {
    await repo.insert({
      origem: 'manual',
      titulo: 'Livro Anterior no App',
      autores: ['Autor'],
      generos: [],
      tenho_fisico: true,
      status_leitura: 'lido',
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
    });

    const backupZip = new JSZip();
    backupZip.file(
      'manifest.json',
      JSON.stringify({
        appId: 'com.booknookapp',
        appName: 'Minha Estante',
        version: 1,
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
        booksCount: 1,
        coversCount: 0,
        platform: 'cross-platform',
      })
    );
    backupZip.file(
      'books.json',
      JSON.stringify([
        {
          id: 1,
          titulo: 'Livro Importado do Amigo',
          tenho_fisico: false,
          status_leitura: 'quero_ler',
        },
      ])
    );

    const blob = await backupZip.generateAsync({ type: 'blob' });
    const result = await BackupService.restoreFromZip(blob, 'merge');

    expect(result.mode).toBe('merge');
    expect(await repo.count()).toBe(2);

    const allBooks = await repo.getAll();
    expect(allBooks.some((b) => b.titulo === 'Livro Anterior no App')).toBe(true);
    expect(allBooks.some((b) => b.titulo === 'Livro Importado do Amigo')).toBe(true);
  });

  it('10. Backup exportado contém bytes ZIP binários reais (PK\\x03\\x04) e é descompactável', async () => {
    await repo.insert({
      origem: 'manual',
      titulo: 'Livro Para Validação de Bytes Binários',
      autores: ['Engenheiro de Software'],
      tenho_fisico: true,
      status_leitura: 'lido',
      generos: ['Tecnologia'],
      dataCadastro: Date.now(),
      dataAtualizacao: Date.now(),
    });

    const backup = await BackupService.exportZipBackup();
    expect(backup.blob).toBeDefined();
    expect(backup.base64).toBeDefined();

    // Valida magic bytes de um arquivo ZIP binário real: 0x50, 0x4B, 0x03, 0x04 ("PK\x03\x04")
    const arrayBuffer = await backup.blob!.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    // Valida que o base64 começa com "UEsDB" (cabeçalho PK\x03\x04 codificado em Base64)
    expect(backup.base64!.startsWith('UEsDB')).toBe(true);

    // Valida que o ZIP pode ser carregado diretamente pela biblioteca JSZip sem erros
    const unzipped = await JSZip.loadAsync(bytes);
    expect(unzipped.file('manifest.json')).not.toBeNull();
    expect(unzipped.file('books.json')).not.toBeNull();

    const manifestContent = JSON.parse(await unzipped.file('manifest.json')!.async('string'));
    expect(manifestContent.booksCount).toBe(1);
    expect(manifestContent.appId).toBe('com.booknookapp');
  });
});
