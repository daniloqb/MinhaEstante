import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { BackupService } from '../services/storage/backupService';
import { CoverStorageService } from '../services/storage/coverStorageService';
import { BookRepository } from '../services/database/bookRepository';
import { DatabaseService } from '../services/database/databaseService';
import { Book, isBookInTab } from '../types/book';

const REFERENCE_ZIP_PATH = path.resolve(process.cwd(), 'public/assets/aistudio/20-10_019c1511.zip');

describe('MinhaEstante 2.0 — Validação e Restauração Integral do Backup de Referência (20-10.zip)', () => {
  let dbService: DatabaseService;
  let repo: BookRepository;
  let referenceZipBuffer: Uint8Array;

  beforeEach(async () => {
    CoverStorageService.clearMemoryStore();
    dbService = DatabaseService.createTestInstance();
    await dbService.initialize();
    repo = new BookRepository(dbService);
    await repo.clearAll();
    BackupService.setRepository(repo);

    if (fs.existsSync(REFERENCE_ZIP_PATH)) {
      referenceZipBuffer = new Uint8Array(fs.readFileSync(REFERENCE_ZIP_PATH));
    } else {
      throw new Error(`Arquivo de referência não encontrado em: ${REFERENCE_ZIP_PATH}`);
    }
  });

  it('A. Análise e validação estrutural do arquivo 20-10.zip', async () => {
    expect(referenceZipBuffer).toBeDefined();
    expect(referenceZipBuffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(referenceZipBuffer);

    // 1. Validar manifesto
    const manifestFile = zip.file('manifest.json');
    expect(manifestFile).not.toBeNull();
    const manifest = JSON.parse(await manifestFile!.async('string'));
    expect(manifest.appId).toBe('com.booknookapp');
    expect(manifest.appName).toBe('Booknook');
    expect(manifest.version).toBe(1);
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.booksCount).toBe(215);
    expect(manifest.coversCount).toBe(207);

    // 2. Validar books.json
    const booksFile = zip.file('books.json');
    expect(booksFile).not.toBeNull();
    const books = JSON.parse(await booksFile!.async('string')) as any[];
    expect(books.length).toBe(215);

    // Contagens originais do modelo legado
    const tenhoFisicoCounts = { true: 0, false: 0 };
    const statusCounts = { lido: 0, quero_ler: 0, nenhum: 0 };
    let booksWithCoverPath = 0;
    let booksWithoutCoverPath = 0;

    for (const b of books) {
      if (b.tenho_fisico === true) tenhoFisicoCounts.true++;
      else if (b.tenho_fisico === false) tenhoFisicoCounts.false++;

      if (b.status_leitura === 'lido') statusCounts.lido++;
      else if (b.status_leitura === 'quero_ler') statusCounts.quero_ler++;
      else if (b.status_leitura === 'nenhum') statusCounts.nenhum++;

      if (b.capaLocalPath) booksWithCoverPath++;
      else booksWithoutCoverPath++;

      // Ausência esperada de campos v2 no modelo legado
      expect(b.uuid).toBeUndefined();
      expect(b.formatos).toBeUndefined();
    }

    expect(tenhoFisicoCounts.true).toBe(141);
    expect(tenhoFisicoCounts.false).toBe(74);
    expect(statusCounts.lido).toBe(97);
    expect(statusCounts.quero_ler).toBe(3);
    expect(statusCounts.nenhum).toBe(115);
    expect(booksWithCoverPath).toBe(207);
    expect(booksWithoutCoverPath).toBe(8);

    // 3. Validar arquivos de capas físicas no ZIP
    const coverEntries = Object.keys(zip.files).filter((k) => k.startsWith('covers/') && !zip.files[k].dir);
    expect(coverEntries.length).toBe(207);

    for (const coverPath of coverEntries) {
      const coverBase64 = await zip.files[coverPath].async('base64');
      expect(coverBase64.length).toBeGreaterThan(0);
    }
  });

  it('B. Restauração integral do 20-10.zip em instância limpa', async () => {
    // Executa restauração completa no modo 'replace'
    const result = await BackupService.restoreFromZip(referenceZipBuffer, 'replace');

    expect(result.mode).toBe('replace');
    expect(result.booksRestored).toBe(215);
    expect(result.coversRestored).toBe(207);
    expect(result.warnings.length).toBeLessThanOrEqual(4); // Apenas avisos de capas externas http

    // Verifica persistência no banco de dados SQLite
    const totalInDb = await repo.count();
    expect(totalInDb).toBe(215);

    const allBooks = await repo.getAll();
    expect(allBooks.length).toBe(215);

    // 1. Preservação estrita de Posse Física e Status de Leitura
    const countTenhoFisicoTrue = allBooks.filter((b) => b.tenho_fisico === true).length;
    const countTenhoFisicoFalse = allBooks.filter((b) => b.tenho_fisico === false).length;
    expect(countTenhoFisicoTrue).toBe(141);
    expect(countTenhoFisicoFalse).toBe(74);

    const countLido = allBooks.filter((b) => b.status_leitura === 'lido').length;
    const countQueroLer = allBooks.filter((b) => b.status_leitura === 'quero_ler').length;
    const countNenhum = allBooks.filter((b) => b.status_leitura === 'nenhum').length;
    expect(countLido).toBe(97);
    expect(countQueroLer).toBe(3);
    expect(countNenhum).toBe(115);

    // Cruzamento exato de integridade:
    // 71 lidos sem posse física, 3 quero ler sem posse física, 26 lidos com posse física, 115 sem leitura com posse física
    const lidoSemFisico = allBooks.filter((b) => b.status_leitura === 'lido' && b.tenho_fisico === false).length;
    const queroLerSemFisico = allBooks.filter((b) => b.status_leitura === 'quero_ler' && b.tenho_fisico === false).length;
    const lidoComFisico = allBooks.filter((b) => b.status_leitura === 'lido' && b.tenho_fisico === true).length;
    const nenhumComFisico = allBooks.filter((b) => b.status_leitura === 'nenhum' && b.tenho_fisico === true).length;

    expect(lidoSemFisico).toBe(71);
    expect(queroLerSemFisico).toBe(3);
    expect(lidoComFisico).toBe(26);
    expect(nenhumComFisico).toBe(115);

    // 2. Todos os 215 livros possuem UUIDs válidos e únicos
    const uuids = new Set<string>();
    for (const b of allBooks) {
      expect(b.uuid).toBeDefined();
      expect(typeof b.uuid).toBe('string');
      expect(b.uuid!.length).toBeGreaterThan(5);
      uuids.add(b.uuid!);
    }
    expect(uuids.size).toBe(215);

    // 3. Acesso e integridade das capas locais restauradas
    const booksWithCovers = allBooks.filter((b) => !!b.capaLocalPath);
    expect(booksWithCovers.length).toBe(207);

    for (const book of booksWithCovers.slice(0, 25)) {
      const displayUrl = await CoverStorageService.getCoverDisplayUrl(book.capaLocalPath);
      expect(displayUrl).toBeDefined();
      expect(displayUrl).toMatch(/^data:image\/jpeg;base64,/);

      const binary = await CoverStorageService.readCoverBinary(book.capaLocalPath!);
      expect(binary).not.toBeNull();
      expect(binary!.length).toBeGreaterThan(100);
    }

    // 4. Validação das abas da interface
    const meusLivros = allBooks.filter((b) => isBookInTab(b, 'meus_livros'));
    const lidos = allBooks.filter((b) => isBookInTab(b, 'lido'));
    const queroLer = allBooks.filter((b) => isBookInTab(b, 'quero_ler'));
    expect(meusLivros.length).toBe(141);
    expect(lidos.length).toBe(97);
    expect(queroLer.length).toBe(3);
  });

  it('C. Persistência de dados após reinicialização da instância (App Restart)', async () => {
    // 1. Restaura
    await BackupService.restoreFromZip(referenceZipBuffer, 'replace');

    // 2. Simula encerramento e reinicialização completa do repositório
    const newRepo = new BookRepository(dbService);
    await newRepo.initialize();

    expect(await newRepo.count()).toBe(215);

    // Verifica um livro específico (id 221: 'Breve História da Economia, Uma')
    const book221 = await newRepo.getById(221);
    expect(book221).not.toBeNull();
    expect(book221?.titulo).toBe('Breve História da Economia, Uma');
    expect(book221?.autores).toContain('Paul Strathern');
    expect(book221?.anoPublicacao).toBe(2003);
    expect(book221?.anoLeitura).toBe(2019);
    expect(book221?.mesLeitura).toBe(2);
    expect(book221?.nota).toBe(6);
    expect(book221?.status_leitura).toBe('lido');
    expect(book221?.tenho_fisico).toBe(false); // Estritamente preservado!
    expect(book221?.capaLocalPath).toBe('covers/cover_new_1792724790188_e0b52r.jpg');
    expect(book221?.uuid).toBeDefined();

    // Verifica outro livro específico (id 79: 'Os quatro amores')
    const book79 = await newRepo.getById(79);
    expect(book79).not.toBeNull();
    expect(book79?.titulo).toBe('Os quatro amores');
    expect(book79?.autores).toContain('C. S. Lewis');
    expect(book79?.status_leitura).toBe('nenhum');
    expect(book79?.tenho_fisico).toBe(true); // Estritamente preservado!
    expect(book79?.capaLocalPath).toBe('covers/cover_79_1792020917634_2hl3w8.jpg');
  });

  it('D. Re-exportação da biblioteca restaurada com integridade total', async () => {
    // 1. Restaura biblioteca de referência
    await BackupService.restoreFromZip(referenceZipBuffer, 'replace');

    // 2. Exporta novo backup ZIP a partir da biblioteca restaurada
    const exported = await BackupService.exportZipBackup();
    expect(exported.booksCount).toBe(215);
    expect(exported.coversCount).toBe(207);
    expect(exported.blob).toBeDefined();

    // 3. Inspeciona o arquivo ZIP recém-gerado
    const newZip = await JSZip.loadAsync(exported.blob!);

    // Manifesto do novo backup
    const newManifestFile = newZip.file('manifest.json');
    expect(newManifestFile).not.toBeNull();
    const newManifest = JSON.parse(await newManifestFile!.async('string'));
    expect(newManifest.booksCount).toBe(215);
    expect(newManifest.coversCount).toBe(207);
    expect(newManifest.version).toBe(1);
    expect(newManifest.schemaVersion).toBe(2);

    // Registros bibliográficos
    const newBooksFile = newZip.file('books.json');
    expect(newBooksFile).not.toBeNull();
    const newBooks = JSON.parse(await newBooksFile!.async('string')) as Book[];
    expect(newBooks.length).toBe(215);

    // Todos os livros no novo backup possuem UUID e formatos
    for (const b of newBooks) {
      expect(b.uuid).toBeDefined();
      expect(b.formatos).toBeDefined();
      expect(b.formatos).toContain('fisico');
    }

    // Capas físicas contidas no ZIP
    const newCoverEntries = Object.keys(newZip.files).filter((k) => k.startsWith('covers/') && !newZip.files[k].dir);
    expect(newCoverEntries.length).toBe(207);
  });

  it('E. Re-importação em segunda instância virgem (Roundtrip 100% loss-free)', async () => {
    // 1. Restaura no primeiro banco
    await BackupService.restoreFromZip(referenceZipBuffer, 'replace');
    const firstBooks = await repo.getAll();

    // 2. Exporta o backup
    const exported = await BackupService.exportZipBackup();

    // 3. Cria uma segunda instância virgem de banco e armazenamento
    CoverStorageService.clearMemoryStore();
    const secondDbService = DatabaseService.createTestInstance();
    await secondDbService.initialize();
    const secondRepo = new BookRepository(secondDbService);
    await secondRepo.clearAll();
    BackupService.setRepository(secondRepo);

    expect(await secondRepo.count()).toBe(0);

    // 4. Restaura o backup exportado na segunda instância
    const restoreResult = await BackupService.restoreFromZip(exported.blob!, 'replace');
    expect(restoreResult.booksRestored).toBe(215);
    expect(restoreResult.coversRestored).toBe(207);
    expect(await secondRepo.count()).toBe(215);

    const secondBooks = await secondRepo.getAll();
    expect(secondBooks.length).toBe(215);

    // 5. Comparação precisa livro a livro entre a primeira e a segunda instância
    const firstMap = new Map(firstBooks.map((b) => [b.id, b]));
    for (const b2 of secondBooks) {
      const b1 = firstMap.get(b2.id);
      expect(b1).toBeDefined();
      expect(b2.titulo).toBe(b1!.titulo);
      expect(b2.status_leitura).toBe(b1!.status_leitura);
      expect(b2.tenho_fisico).toBe(b1!.tenho_fisico);
      expect(b2.capaLocalPath).toBe(b1!.capaLocalPath);
      expect(b2.uuid).toBe(b1!.uuid); // UUID preservado identicamente!
      expect(b2.anoLeitura).toBe(b1!.anoLeitura);
      expect(b2.mesLeitura).toBe(b1!.mesLeitura);
      expect(b2.nota).toBe(b1!.nota);
    }
  });

  it('F. Segurança e modo mesclagem (merge mode)', async () => {
    // 1. Insere um livro preexistente
    const initialBook = await repo.insert({
      origem: 'manual',
      titulo: 'Meu Livro Pré-Existente Exclusivo',
      autores: ['Autor Local'],
      tenho_fisico: true,
      status_leitura: 'lido',
      generos: ['Ficção'],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    });

    expect(await repo.count()).toBe(1);

    // 2. Restaura o 20-10.zip em modo 'merge'
    const mergeResult = await BackupService.restoreFromZip(referenceZipBuffer, 'merge');
    expect(mergeResult.mode).toBe('merge');
    expect(mergeResult.booksRestored).toBe(215);

    // O banco agora deve conter 1 livro anterior + 215 novos livros = 216 livros!
    const totalAfterMerge = await repo.count();
    expect(totalAfterMerge).toBe(216);

    const retainedInitial = await repo.getByUuid(initialBook.uuid!);
    expect(retainedInitial).not.toBeNull();
    expect(retainedInitial?.titulo).toBe('Meu Livro Pré-Existente Exclusivo');

    // 3. Rejeição de arquivo ZIP corrompido
    await expect(BackupService.restoreFromZip('CONTEUDO_INVALIDO_NAO_ZIP', 'replace')).rejects.toThrow();

    // O banco não pode ter sido corrompido ou apagado
    expect(await repo.count()).toBe(216);
  });
});
