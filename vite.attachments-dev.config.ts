import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import production from './vite.config';

/** Explicit local/Android DEV artifact. Never use to publish a public build. */
export default mergeConfig(production, defineConfig({
  define: { __ATTACHMENTS_DEV_BUILD__: 'true' },
  base: '/',
  plugins: [{ name: 'attachments-dev-identity', enforce: 'post', generateBundle: { order: 'post', handler(_options, bundle) {
    const manifest = bundle['manifest.webmanifest'];
    if (manifest?.type === 'asset') {
      const value = JSON.parse(typeof manifest.source === 'string' ? manifest.source : new TextDecoder().decode(manifest.source));
      value.name = 'MinhaEstante DEV PWA'; value.short_name = 'Estante DEV'; manifest.source = JSON.stringify(value);
    }
  } } }],
  build: { rollupOptions: { input: { app: path.resolve('index.html'), saf: path.resolve('diagnostics/index.html'), management: path.resolve('diagnostics/attachments-management.html') } } },
}));
