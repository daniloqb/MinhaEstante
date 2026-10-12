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

  it('openExternalUrl não lança erros com URLs válidas', async () => {
    const originalWindow = (globalThis as any).window;
    const fakeOpen = vi.fn();
    (globalThis as any).window = { open: fakeOpen };

    await NativeService.openExternalUrl('https://example.com');
    expect(fakeOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');

    (globalThis as any).window = originalWindow;
  });
});
