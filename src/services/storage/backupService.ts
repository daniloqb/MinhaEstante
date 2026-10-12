import JSZip from 'jszip';
import { Book } from '../../types/book';
import { bookRepository, BookRepository } from '../database/bookRepository';
import { CoverStorageService, validateImageMagicBytes } from './coverStorageService';
import { NativeService } from '../nativeService';
import { CURRENT_SCHEMA_VERSION, migrateLegacyBooks } from '../storage';

export interface BackupManifest {
  appId: string;
  appName: string;
  version: number;
  schemaVersion: number;
  createdAt: string;
  booksCount: number;
  coversCount: number;
  platform: string;
  checksum?: string;
}

export interface BackupResult {
  fileName: string;
  booksCount: number;
  coversCount: number;
  blob?: Blob;
  base64?: string;
}

export interface RestoreResult {
  mode: 'replace' | 'merge';
  booksRestored: number;
  coversRestored: number;
  warnings: string[];
}

export class BackupService {
  private static readonly BACKUP_FORMAT_VERSION = 1;
  private static readonly APP_IDENTIFIER = 'com.booknookapp';
  private static customRepo: BookRepository | null = null;

  static setRepository(repo: BookRepository | null): void {
    this.customRepo = repo;
  }

  private static getRepo(): BookRepository {
    return this.customRepo || bookRepository;
  }

  /**
   * Sanitiza nomes de arquivos de imagem no zip para prevenir zip-slip
   */
  private static sanitizeZipEntryName(entryPath: string): string | null {
    // Rejeita caminhos com .. ou barras iniciais ou absolutos
    if (!entryPath || entryPath.includes('..') || entryPath.startsWith('/') || entryPath.startsWith('\\')) {
      return null;
    }
    // Permite apenas caminhos sob covers/
    const normalized = entryPath.replace(/\\/g, '/');
    if (!normalized.startsWith('covers/')) {
      return null;
    }
    const filename = normalized.split('/').pop();
    if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      return null;
    }
    return `covers/${filename}`;
  }

  /**
   * 1. Exporta a biblioteca completa como arquivo ZIP portátil
   */
  static async exportZipBackup(
    onProgress?: (step: string, current: number, total: number) => void
  ): Promise<BackupResult> {
    const repo = this.getRepo();
    await repo.initialize();
    const books = await repo.getAll();

    const zip = new JSZip();
    const coversFolder = zip.folder('covers')!;

    // Identifica capas locais portáteis
    let coversCount = 0;
    const total = books.length;

    onProgress?.('Lendo capas da biblioteca...', 0, total);

    // Ajusta referências para serem relativas no backup
    const portableBooks: Book[] = [];

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      let portableCoverPath: string | null = null;

      if (book.capaLocalPath) {
        try {
          const coverBase64 = await CoverStorageService.readCoverBinary(book.capaLocalPath);
          if (coverBase64) {
            const fileName = book.capaLocalPath.split('/').pop() || `cover_${book.id}.jpg`;
            const zipPath = `covers/${fileName}`;
            coversFolder.file(fileName, coverBase64, { base64: true });
            coversCount++;
            portableCoverPath = zipPath;
          }
        } catch (err) {
          console.warn(`Aviso: Não foi possível empacotar capa do livro ${book.id}:`, err);
        }
      }

      portableBooks.push({
        ...book,
        capaLocalPath: portableCoverPath || book.capaLocalPath || null,
      });

      if ((i + 1) % 10 === 0 || i === books.length - 1) {
        onProgress?.('Empacotando registros...', i + 1, total);
      }
    }

    const manifest: BackupManifest = {
      appId: this.APP_IDENTIFIER,
      appName: 'Minha Estante',
      version: this.BACKUP_FORMAT_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      booksCount: portableBooks.length,
      coversCount,
      platform: 'cross-platform',
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('books.json', JSON.stringify(portableBooks, null, 2));

    onProgress?.('Compactando arquivo ZIP...', total, total);

    // Gera o ZIP binário comprimido
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `MinhaEstante_Backup_${dateStr}.zip`;

    // Gera base64 diretamente pelo JSZip de forma universal
    const zipBase64 = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return {
      fileName,
      booksCount: portableBooks.length,
      coversCount,
      blob: zipBlob,
      base64: zipBase64,
    };
  }

  /**
   * 2. Valida a integridade e descompacta um backup ZIP
   */
  static async validateAndExtractZip(
    zipInput: Blob | ArrayBuffer | string
  ): Promise<{
    manifest: BackupManifest;
    books: Book[];
    coverFiles: Map<string, string>; // relativePath -> base64
    warnings: string[];
  }> {
    const warnings: string[] = [];
    let zip: JSZip;

    try {
      zip = await JSZip.loadAsync(zipInput);
    } catch {
      throw new Error('Arquivo corrompido ou formato ZIP inválido');
    }

    // 1. Validar manifest.json
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('Arquivo de manifesto (manifest.json) não encontrado no backup ZIP');
    }

    let manifest: BackupManifest;
    try {
      const manifestStr = await manifestFile.async('string');
      manifest = JSON.parse(manifestStr);
    } catch {
      throw new Error('Arquivo manifest.json corrompido ou formato JSON inválido');
    }

    if (!manifest.appId || manifest.version == null) {
      throw new Error('Estrutura de manifest.json inválida');
    }

    // 2. Validar books.json
    const booksFile = zip.file('books.json');
    if (!booksFile) {
      throw new Error('Arquivo books.json não encontrado no backup ZIP');
    }

    let books: Book[];
    try {
      const booksStr = await booksFile.async('string');
      const parsedBooks = JSON.parse(booksStr);
      if (!Array.isArray(parsedBooks)) {
        throw new Error('books.json não contém uma lista de livros');
      }
      books = migrateLegacyBooks(parsedBooks);
    } catch (err: any) {
      throw new Error(`Erro ao validar livros do backup: ${err.message}`);
    }

    // 3. Extrair capas de forma protegida contra zip-slip
    const coverFiles = new Map<string, string>();
    const zipEntries = Object.keys(zip.files);

    for (const entryPath of zipEntries) {
      if (zip.files[entryPath].dir) continue;
      if (entryPath === 'manifest.json' || entryPath === 'books.json') continue;

      if (entryPath.includes('..') || entryPath.startsWith('/') || entryPath.startsWith('\\') || !entryPath.startsWith('covers/')) {
        warnings.push(`Arquivo ignorado por caminho não seguro: ${entryPath}`);
        continue;
      }

      const safePath = this.sanitizeZipEntryName(entryPath);
      if (!safePath) {
        warnings.push(`Arquivo ignorado por caminho não seguro: ${entryPath}`);
        continue;
      }

      try {
        const base64Data = await zip.files[entryPath].async('base64');
        if (validateImageMagicBytes(base64Data)) {
          coverFiles.set(safePath, base64Data);
        } else {
          warnings.push(`Capa ${safePath} ignorada por dados de imagem inválidos.`);
        }
      } catch {
        warnings.push(`Falha ao ler capa ${safePath}`);
      }
    }

    return {
      manifest,
      books,
      coverFiles,
      warnings,
    };
  }

  /**
   * 3. Restaura o backup na biblioteca (Modo 'replace' ou 'merge')
   */
  static async restoreFromZip(
    zipInput: Blob | ArrayBuffer | string,
    mode: 'replace' | 'merge' = 'replace',
    onProgress?: (step: string, current: number, total: number) => void
  ): Promise<RestoreResult> {
    onProgress?.('Validando integridade do arquivo ZIP...', 0, 100);

    const { books, coverFiles, warnings } = await this.validateAndExtractZip(zipInput);

    const repo = this.getRepo();
    await repo.initialize();

    // Snapshot para rollback caso ocorra falha durante a substituição
    let previousBooksSnapshot: Book[] = [];
    if (mode === 'replace') {
      try {
        previousBooksSnapshot = await repo.getAll();
      } catch (err) {
        console.warn('Não foi possível obter snapshot prévio para rollback:', err);
      }
    }

    onProgress?.('Gravando capas no armazenamento do dispositivo...', 20, 100);

    let coversRestored = 0;
    // Grava capas descompactadas no CoverStorageService
    for (const [relativePath, base64Data] of coverFiles.entries()) {
      try {
        await CoverStorageService.saveCoverDirect(relativePath, base64Data);
        coversRestored++;
      } catch (err) {
        warnings.push(`Erro ao persistir capa ${relativePath}: ${(err as Error).message}`);
      }
    }

    onProgress?.('Aplicando dados no banco SQLite...', 60, 100);

    try {
      if (mode === 'replace') {
        await repo.clearAll();
      }

      // Insere ou mescla livros
      const currentList = mode === 'replace' ? [] : await repo.getAll();
      const booksToInsert: Book[] = [];

      for (const item of books) {
        let finalCoverPath = item.capaLocalPath || null;
        if (finalCoverPath && !coverFiles.has(finalCoverPath)) {
          // Se o arquivo da capa não existia no zip, verificar se existe localmente
          const existsLocal = await CoverStorageService.readCoverBinary(finalCoverPath);
          if (!existsLocal) {
            warnings.push(`Capa ${finalCoverPath} do livro "${item.titulo}" não encontrada.`);
          }
        }

        // Se o item tinha capa em base64 antiga, converte para local
        if (item.capaUrl && (item.capaUrl.startsWith('data:image/') || item.capaUrl.startsWith('data:application/'))) {
          try {
            const localSaved = await CoverStorageService.convertBase64ToLocalCover(item.capaUrl, item.id);
            finalCoverPath = localSaved;
            item.capaUrl = null;
          } catch {
            warnings.push(`Não foi possível converter capa em base64 do livro "${item.titulo}".`);
          }
        }

        booksToInsert.push({
          ...item,
          capaLocalPath: finalCoverPath,
        });
      }

      if (mode === 'replace') {
        await repo.bulkInsert(booksToInsert);
      } else {
        // Merge
        const mergedList = [...currentList];
        for (const item of booksToInsert) {
          const maxId = mergedList.reduce((max, b) => Math.max(max, b.id || 0), 0);
          mergedList.push({ ...item, id: maxId + 1 });
        }
        await repo.clearAll();
        await repo.bulkInsert(mergedList);
      }

      onProgress?.('Restauração concluída com sucesso!', 100, 100);

      return {
        mode,
        booksRestored: booksToInsert.length,
        coversRestored,
        warnings,
      };
    } catch (err: any) {
      // Rollback se for replace
      if (mode === 'replace' && previousBooksSnapshot.length > 0) {
        try {
          await repo.clearAll();
          await repo.bulkInsert(previousBooksSnapshot);
          console.warn('Rollback executado com sucesso após falha na restauração.');
        } catch (rollbackErr) {
          console.error('Falha crítica ao executar rollback:', rollbackErr);
        }
      }
      throw new Error(`Falha durante a restauração do banco: ${err.message}`);
    }
  }

  /**
   * 4. Importa backups JSON legados (com suporte transparente a conversão de Base64)
   */
  static async importLegacyJson(
    jsonString: string,
    mode: 'replace' | 'merge' = 'merge',
    onProgress?: (step: string, current: number, total: number) => void
  ): Promise<{ count: number; coversConverted: number; warnings: string[] }> {
    const warnings: string[] = [];
    let parsed: any;

    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Formato de arquivo JSON inválido');
    }

    const rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed.books) ? parsed.books : [];
    if (rawList.length === 0) {
      return { count: 0, coversConverted: 0, warnings: ['O arquivo JSON não contém livros.'] };
    }

    onProgress?.('Validando e migrando esquema dos registros...', 0, rawList.length);
    const migrated = migrateLegacyBooks(rawList);

    const repo = this.getRepo();
    await repo.initialize();

    let coversConverted = 0;
    const preparedBooks: Book[] = [];

    for (let i = 0; i < migrated.length; i++) {
      const book = migrated[i];
      let capaLocal = book.capaLocalPath || null;
      let capaUrl = book.capaUrl || null;

      // Se contém capa Base64, converte para arquivo físico persistente
      if (capaUrl && capaUrl.startsWith('data:image/')) {
        try {
          const path = await CoverStorageService.convertBase64ToLocalCover(capaUrl, book.id);
          capaLocal = path;
          capaUrl = null; // Remove o Base64 pesado do banco!
          coversConverted++;
        } catch {
          warnings.push(`Não foi possível salvar imagem do livro "${book.titulo}".`);
        }
      }

      preparedBooks.push({
        ...book,
        capaLocalPath: capaLocal,
        capaUrl,
      });

      if ((i + 1) % 15 === 0 || i === migrated.length - 1) {
        onProgress?.('Convertendo imagens e registros...', i + 1, migrated.length);
      }
    }

    if (mode === 'replace') {
      await repo.clearAll();
      await repo.bulkInsert(preparedBooks);
    } else {
      const current = await repo.getAll();
      const updated = [...current];
      for (const item of preparedBooks) {
        const maxId = updated.reduce((max, b) => Math.max(max, b.id || 0), 0);
        updated.push({ ...item, id: maxId + 1 });
      }
      await repo.clearAll();
      await repo.bulkInsert(updated);
    }

    return {
      count: preparedBooks.length,
      coversConverted,
      warnings,
    };
  }

  /**
   * 5. Compartilha ou faz download do arquivo gerado
   */
  static async deliverBackupFile(backup: BackupResult): Promise<boolean> {
    if (NativeService.isNative()) {
      return await NativeService.exportOrShareFile({
        content: backup.base64 || '',
        filename: backup.fileName,
        mimeType: 'application/zip',
        title: `Minha Estante Backup - ${backup.fileName}`,
      });
    } else if (backup.blob) {
      const url = URL.createObjectURL(backup.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    }
    return false;
  }
}
