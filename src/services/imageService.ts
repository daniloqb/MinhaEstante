/**
 * Serviço para download, compressão e armazenamento local permanente de capas de livros.
 * Garante que a capa fique salva como Data URL (base64) no dispositivo,
 * funcionando 100% offline e protegendo contra links quebrados ou sites fora do ar.
 */

export class ImageService {
  /**
   * Verifica se a URL já é uma imagem local salva no app
   */
  static isLocalImage(url?: string | null): boolean {
    if (!url) return false;
    return url.startsWith('data:image/') || url.startsWith('blob:');
  }

  /**
   * Redimensiona e comprime uma imagem em Canvas para JPEG otimizado (~20-40 KB)
   */
  static async compressImage(
    sourceUrlOrData: string,
    maxWidth = 320,
    maxHeight = 480,
    quality = 0.82
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          let { width, height } = img;

          // Manter proporção
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(sourceUrlOrData);
            return;
          }

          // Fundo suave caso haja transparência
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);

          // Gera JPEG com boa fidelidade e tamanho reduzido
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          console.warn('Erro ao comprimir imagem via canvas:', err);
          resolve(sourceUrlOrData);
        }
      };

      img.onerror = () => {
        reject(new Error('Não foi possível carregar a imagem para compressão'));
      };

      img.src = sourceUrlOrData;
    });
  }

  /**
   * Baixa uma imagem de URL externa e converte em Data URL local permanente
   */
  static async downloadAndSaveCover(url: string): Promise<string> {
    if (!url || typeof url !== 'string') {
      throw new Error('URL inválida');
    }

    // Se já é local, apenas comprime caso necessário
    if (this.isLocalImage(url)) {
      try {
        return await this.compressImage(url);
      } catch {
        return url;
      }
    }

    // 1. Tenta baixar via proxy backend para contornar restrições de CORS
    try {
      const response = await fetch('/api/fetch-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.dataUrl) {
          return await this.compressImage(data.dataUrl);
        }
      }
    } catch (err) {
      console.warn('Proxy de imagem falhou ou indisponível, tentando download direto...', err);
    }

    // 2. Fallback: tenta baixar diretamente pelo navegador
    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (resp.ok) {
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        const compressed = await this.compressImage(objectUrl);
        URL.revokeObjectURL(objectUrl);
        return compressed;
      }
    } catch {
      // 3. Fallback final: tenta carregar direto no elemento Image
      try {
        return await this.compressImage(url);
      } catch {
        // Se tudo falhar, mantém a URL original
        return url;
      }
    }

    return url;
  }

  /**
   * Converte arquivo selecionado do aparelho (File/Blob) em Data URL comprimido
   */
  static async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const rawDataUrl = reader.result as string;
          const compressed = await ImageService.compressImage(rawDataUrl);
          resolve(compressed);
        } catch {
          resolve(reader.result as string);
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo selecionado'));
      reader.readAsDataURL(file);
    });
  }
}

// Funções de conveniência no nível do módulo
export const isDataUrl = (url?: string | null): boolean => ImageService.isLocalImage(url);
export const cacheImageLocally = (url: string): Promise<string> => ImageService.downloadAndSaveCover(url);
export const processUploadedImage = (file: File): Promise<string> => ImageService.fileToDataUrl(file);
