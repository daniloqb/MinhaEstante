import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Share as CapShare } from '@capacitor/share';
import { Browser as CapBrowser } from '@capacitor/browser';
import { StatusBar as CapStatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { Keyboard as CapKeyboard } from '@capacitor/keyboard';

import { Filesystem, Directory } from '@capacitor/filesystem';

export interface SaveFileOptions {
  content: string; // Base64 string para arquivos binários como ZIP, ou texto
  filename: string;
  mimeType: string;
  title?: string;
  isBase64?: boolean;
}

export class NativeService {
  /**
   * Identifica se a execução está ocorrendo no contêiner nativo (Android ou iOS)
   */
  static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Identifica a plataforma atual ('android' | 'ios' | 'web')
   */
  static getPlatform(): string {
    return Capacitor.getPlatform();
  }

  /**
   * Configura o comportamento nativo de status bar e teclado ao inicializar o app
   */
  static async initNativeEnvironment(): Promise<void> {
    if (!this.isNative()) return;

    try {
      // 1. Barra de status com paleta madeira nobre escura
      await CapStatusBar.setStyle({ style: StatusBarStyle.Dark });
      if (Capacitor.getPlatform() === 'android') {
        await CapStatusBar.setBackgroundColor({ color: '#2B1A0F' });
      }
    } catch (e) {
      console.warn('Não foi possível configurar StatusBar:', e);
    }

    try {
      // 2. Configurações de teclado virtual
      await CapKeyboard.setAccessoryBarVisible({ isVisible: false });
    } catch {
      // ignore se não suportado na plataforma
    }
  }

  /**
   * Registra o listener para o botão Voltar físico do Android
   */
  static registerBackButton(onBack: () => boolean): () => void {
    if (!this.isNative()) return () => {};

    let removeListener: (() => void) | null = null;

    CapApp.addListener('backButton', () => {
      const handled = onBack();
      if (!handled) {
        // Se a navegação interna já estiver na tela raiz, encerra o app
        CapApp.exitApp();
      }
    }).then((handle) => {
      removeListener = () => handle.remove();
    }).catch((e) => {
      console.warn('Erro ao registrar backButton do Capacitor:', e);
    });

    return () => {
      if (removeListener) removeListener();
    };
  }

  /**
   * Abre links externos com o navegador seguro do sistema (InAppBrowser)
   */
  static async openExternalUrl(url: string): Promise<void> {
    if (!url) return;

    if (this.isNative()) {
      try {
        await CapBrowser.open({ url, windowName: '_blank' });
        return;
      } catch (e) {
        console.warn('Erro ao abrir link via Capacitor Browser:', e);
      }
    }

    // Fallback Web
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Converte uma string base64 em um Blob binário real
   */
  static base64ToBlob(base64Data: string, mimeType: string): Blob {
    const clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const byteCharacters = atob(clean);
    const byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays as any, { type: mimeType });
  }

  /**
   * Exporta ou compartilha arquivo de backup respeitando o ambiente nativo e web
   */
  static async exportOrShareFile(options: SaveFileOptions): Promise<boolean> {
    const { content, filename, mimeType, title = 'Minha Estante Backup', isBase64 = false } = options;

    // 1. Se estiver rodando dentro do WebView nativo com bridge Android personalizada (Storage Access Framework SAF)
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (win && win.AndroidApp && typeof win.AndroidApp.createFile === 'function') {
      return new Promise<boolean>((resolve) => {
        let timer: any = null;
        win.onAndroidFileSaved = (success: boolean) => {
          if (timer) clearTimeout(timer);
          delete win.onAndroidFileSaved;
          resolve(Boolean(success));
        };
        // Timeout de fallback para não travar Promise indefinidamente
        timer = setTimeout(() => {
          delete win.onAndroidFileSaved;
          resolve(true);
        }, 60000);

        win.AndroidApp.createFile(content, filename, mimeType);
      });
    }

    // 2. Se for ambiente nativo Capacitor padrão (Capacitor Filesystem + Share nativo de arquivo)
    if (this.isNative()) {
      try {
        // Grava o arquivo binário no armazenamento de cache do app para obter URI compartilhável
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: content, // base64 string
          directory: Directory.Cache,
          recursive: true,
        });

        const fileUri = writeResult.uri;
        const canShare = await CapShare.canShare();
        if (canShare.value && fileUri) {
          await CapShare.share({
            title,
            dialogTitle: `Salvar ou Compartilhar: ${filename}`,
            files: [fileUri],
          });
          return true;
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('canceled')) {
          return false;
        }
        console.warn('Falha ao compartilhar arquivo via Capacitor Filesystem/Share:', err);
      } finally {
        // Limpeza garantida do arquivo temporário gerado no cache
        try {
          await Filesystem.deleteFile({
            path: filename,
            directory: Directory.Cache,
          });
        } catch {
          // Ignora se o arquivo já tiver sido removido
        }
      }
    }

    // 3. Tentar Web Share API (se suportada pelo navegador com envio de arquivos)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const blob = isBase64 ? this.base64ToBlob(content, mimeType) : new Blob([content], { type: mimeType });
        const file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
            text: `Backup Minha Estante: ${filename}`,
          });
          return true;
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return false;
      }
    }

    // 4. Download direto via Blob e elemento âncora (Web Desktop & WebViews padrão)
    if (typeof document !== 'undefined') {
      try {
        const blob = isBase64 ? this.base64ToBlob(content, mimeType) : new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return true;
      } catch (e) {
        console.error('Erro no fallback de download:', e);
        return false;
      }
    }

    return true;
  }
}
