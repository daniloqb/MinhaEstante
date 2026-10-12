import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ImageService } from '../imageService';

const COVERS_DIRECTORY = 'covers';

/**
 * Validação segura de magic bytes para formatos JPEG, PNG e WebP
 */
export function validateImageMagicBytes(base64Data: string): boolean {
  try {
    const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const binaryString = atob(rawBase64.slice(0, 32));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return true;
    }

    // PNG: 89 50 4E 47 (0x89 'P' 'N' 'G')
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return true;
    }

    // WebP: RIFF ... WEBP
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Gera um nome de arquivo físico seguro e sanitizado
 */
export function generateCoverFileName(bookId?: number | string): string {
  const safeId = bookId ? String(bookId).replace(/[^a-zA-Z0-9_-]/g, '') : 'new';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${COVERS_DIRECTORY}/cover_${safeId}_${timestamp}_${randomSuffix}.jpg`;
}

/**
 * Armazenamento em memória para ambiente Web / Vitest
 */
class WebInMemoryCoverStore {
  private covers: Map<string, string> = new Map();

  async save(path: string, base64Data: string): Promise<void> {
    this.covers.set(path, base64Data);
  }

  async read(path: string): Promise<string | null> {
    return this.covers.get(path) || null;
  }

  async delete(path: string): Promise<boolean> {
    return this.covers.delete(path);
  }

  async list(): Promise<string[]> {
    return Array.from(this.covers.keys());
  }

  clear(): void {
    this.covers.clear();
  }
}

export class CoverStorageService {
  private static webStore = new WebInMemoryCoverStore();
  private static displayUrlCache = new Map<string, string>();

  /**
   * Identifica se está rodando no contêiner nativo com suporte a Filesystem
   */
  private static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Inicializa o diretório de capas no armazenamento privado
   */
  static async initialize(): Promise<void> {
    if (!this.isNative()) return;

    try {
      await Filesystem.mkdir({
        path: COVERS_DIRECTORY,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      // Ignora erro se diretório já existir
    }
  }

  /**
   * Converte uma imagem (Data URL, URL remota ou arquivo) em arquivo físico no disco
   * Retorna o caminho relativo estável (ex: "covers/cover_1_171000_abc.jpg")
   */
  static async saveCover(
    source: string,
    bookId?: number | string
  ): Promise<{ relativePath: string; originalUrl: string | null }> {
    await this.initialize();

    let dataUrl: string;
    let originalUrl: string | null = null;

    if (source.startsWith('data:')) {
      if (!source.startsWith('data:image/')) {
        throw new Error('Formato de imagem inválido ou arquivo corrompido');
      }
      dataUrl = await ImageService.compressImage(source);
    } else if (source.startsWith('http://') || source.startsWith('https://')) {
      originalUrl = source;
      dataUrl = await ImageService.downloadAndSaveCover(source);
    } else {
      // Já é um caminho local existente
      return { relativePath: source, originalUrl: null };
    }

    const cleanBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

    // Validação de integridade do arquivo
    if (!validateImageMagicBytes(cleanBase64)) {
      throw new Error('Formato de imagem inválido ou arquivo corrompido');
    }

    const relativePath = generateCoverFileName(bookId);

    if (this.isNative()) {
      await Filesystem.writeFile({
        path: relativePath,
        data: cleanBase64,
        directory: Directory.Data,
        recursive: true,
      });

      // Atualiza o cache do caminho de exibição web
      try {
        const uriResult = await Filesystem.getUri({
          path: relativePath,
          directory: Directory.Data,
        });
        const convertedSrc = Capacitor.convertFileSrc(uriResult.uri);
        this.displayUrlCache.set(relativePath, convertedSrc);
      } catch (err) {
        console.warn('Erro ao obter URI da capa salva:', err);
      }
    } else {
      // Fallback em ambiente Web / Testes
      await this.webStore.save(relativePath, dataUrl);
      this.displayUrlCache.set(relativePath, dataUrl);
    }

    return { relativePath, originalUrl };
  }

  /**
   * Resolve a URL de exibição utilizável em tags <img> da interface
   */
  static async getCoverDisplayUrl(
    relativePath?: string | null,
    fallbackUrl?: string | null
  ): Promise<string | null> {
    if (!relativePath && !fallbackUrl) return null;

    // Se relativePath for um Data URL direto (transitório) ou URL HTTP
    if (relativePath && (relativePath.startsWith('data:') || relativePath.startsWith('http'))) {
      return relativePath;
    }

    if (relativePath) {
      if (this.displayUrlCache.has(relativePath)) {
        return this.displayUrlCache.get(relativePath)!;
      }

      if (this.isNative()) {
        try {
          const uriResult = await Filesystem.getUri({
            path: relativePath,
            directory: Directory.Data,
          });
          const converted = Capacitor.convertFileSrc(uriResult.uri);
          this.displayUrlCache.set(relativePath, converted);
          return converted;
        } catch {
          // Arquivo local não encontrado, usa fallback
        }
      } else {
        const memoryCover = await this.webStore.read(relativePath);
        if (memoryCover) {
          this.displayUrlCache.set(relativePath, memoryCover);
          return memoryCover;
        }
      }
    }

    return fallbackUrl || null;
  }

  /**
   * Lê uma capa em Base64 limpo (sem prefixo data:) ou null se não encontrada
   */
  static async readCoverBinary(relativePath: string): Promise<string | null> {
    if (!relativePath) return null;

    if (this.isNative()) {
      try {
        const fileResult = await Filesystem.readFile({
          path: relativePath,
          directory: Directory.Data,
        });
        // fileResult.data pode ser string base64
        return typeof fileResult.data === 'string' ? fileResult.data : null;
      } catch {
        return null;
      }
    } else {
      const stored = await this.webStore.read(relativePath);
      if (!stored) return null;
      return stored.includes(',') ? stored.split(',')[1] : stored;
    }
  }

  /**
   * Salva uma imagem binária direta a partir de um arquivo extraído de um ZIP
   * @param relativePath caminho relativo seguro (ex: covers/imagem-001.jpg)
   * @param base64Data dados em base64 da imagem
   */
  static async saveCoverDirect(relativePath: string, base64Data: string): Promise<string> {
    await this.initialize();
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    if (!validateImageMagicBytes(cleanBase64)) {
      throw new Error('Formato de imagem inválido ou arquivo corrompido');
    }

    if (this.isNative()) {
      await Filesystem.writeFile({
        path: relativePath,
        data: cleanBase64,
        directory: Directory.Data,
        recursive: true,
      });

      try {
        const uriResult = await Filesystem.getUri({
          path: relativePath,
          directory: Directory.Data,
        });
        const converted = Capacitor.convertFileSrc(uriResult.uri);
        this.displayUrlCache.set(relativePath, converted);
      } catch {
        // Ignora erro de URI
      }
    } else {
      const dataUrl = `data:image/jpeg;base64,${cleanBase64}`;
      await this.webStore.save(relativePath, dataUrl);
      this.displayUrlCache.set(relativePath, dataUrl);
    }

    return relativePath;
  }

  /**
   * Remove arquivo de capa de forma segura
   */
  static async deleteCover(relativePath: string): Promise<boolean> {
    if (!relativePath || !relativePath.startsWith(COVERS_DIRECTORY)) {
      return false;
    }

    this.displayUrlCache.delete(relativePath);

    if (this.isNative()) {
      try {
        await Filesystem.deleteFile({
          path: relativePath,
          directory: Directory.Data,
        });
        return true;
      } catch (e) {
        console.warn(`Não foi possível remover arquivo ${relativePath}:`, e);
        return false;
      }
    } else {
      return await this.webStore.delete(relativePath);
    }
  }

  /**
   * Converte uma string Base64 em arquivo local (utilizado em migrações e importações)
   */
  static async convertBase64ToLocalCover(base64DataUrl: string, bookId?: number): Promise<string> {
    const { relativePath } = await this.saveCover(base64DataUrl, bookId);
    return relativePath;
  }

  /**
   * Limpeza de arquivos órfãos (arquivos na pasta covers/ que não pertencem a nenhum livro ativo)
   */
  static async cleanOrphanCovers(activePaths: string[]): Promise<number> {
    const activeSet = new Set(activePaths.filter(Boolean));
    let cleaned = 0;

    if (this.isNative()) {
      try {
        const result = await Filesystem.readdir({
          path: COVERS_DIRECTORY,
          directory: Directory.Data,
        });

        for (const file of result.files) {
          const filePath = `${COVERS_DIRECTORY}/${file.name}`;
          if (!activeSet.has(filePath)) {
            await this.deleteCover(filePath);
            cleaned++;
          }
        }
      } catch (err) {
        console.warn('Erro ao ler diretório de capas para limpeza de órfãos:', err);
      }
    } else {
      const allPaths = await this.webStore.list();
      for (const p of allPaths) {
        if (!activeSet.has(p)) {
          await this.deleteCover(p);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Limpeza para testes
   */
  static clearMemoryStore(): void {
    this.webStore.clear();
    this.displayUrlCache.clear();
  }
}
