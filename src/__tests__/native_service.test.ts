import { describe, it, expect, vi } from 'vitest';
import { NativeService } from '../services/nativeService';

describe('Fase 1: NativeService & Capacitor Integration', () => {
  it('identifica ambiente de execução (web vs native)', () => {
    const isNative = NativeService.isNative();
    expect(typeof isNative).toBe('boolean');

    const platform = NativeService.getPlatform();
    expect(['web', 'android', 'ios']).toContain(platform);
  });

  it('registra manipulador do botão Voltar sem lançar erros em ambiente de testes', () => {
    const dummyCallback = vi.fn().mockReturnValue(true);
    const unregister = NativeService.registerBackButton(dummyCallback);

    expect(typeof unregister).toBe('function');
    unregister();
  });

  it('exportOrShareFile executa sem falhas com fallback de download via Blob', async () => {
    const success = await NativeService.exportOrShareFile({
      content: '{"teste": true}',
      filename: 'backup_teste.json',
      mimeType: 'application/json',
      title: 'Teste de Backup',
    });

    expect(typeof success).toBe('boolean');
  });

  it('exportOrShareFile aciona AndroidApp.createFile quando bridge nativa está disponível', async () => {
    const fakeCreateFile = vi.fn((_content: string, _filename: string, _mime: string) => {
      // Simula callback nativo do Android
      setTimeout(() => {
        if ((globalThis as any).window.onAndroidFileSaved) {
          (globalThis as any).window.onAndroidFileSaved(true);
        }
      }, 10);
    });

    if (!(globalThis as any).window) {
      (globalThis as any).window = {};
    }
    (globalThis as any).window.AndroidApp = {
      createFile: fakeCreateFile,
      isAndroidApp: () => true,
    };

    const res = await NativeService.exportOrShareFile({
      content: 'UEsDBBQAAAAIA===',
      filename: 'backup.zip',
      mimeType: 'application/zip',
      isBase64: true,
    });

    expect(res).toBe(true);
    expect(fakeCreateFile).toHaveBeenCalledWith('UEsDBBQAAAAIA===', 'backup.zip', 'application/zip');
    delete (globalThis as any).window.AndroidApp;
  });
});
