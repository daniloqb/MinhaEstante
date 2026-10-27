import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import production from './vite.config';

/** Opt-in validation build. Never use this configuration to publish production artifacts. */
export default mergeConfig(production, defineConfig({
  base: '/',
  define: { 'import.meta.env.VITE_DIGITAL_TEST_CATALOG': JSON.stringify('true') },
  plugins: [{ name:'conformance-build-marker',transformIndexHtml(html) {
    const tag=process.env.DIGITAL_TEST_BUILD === 'third' ? 'third' : process.env.DIGITAL_TEST_BUILD === 'second' ? 'second' : 'first';
    return html.replace('</head>',`<meta name="digital-test-build" content="${tag}"></head>`);
  }, generateBundle(_options,bundle) {
    const manifest=bundle['manifest.webmanifest'];
    if(manifest?.type==='asset') {
      const value=JSON.parse(typeof manifest.source==='string'?manifest.source:new TextDecoder().decode(manifest.source));
      value.name='MinhaEstante DEV PWA';value.short_name='Estante DEV';
      manifest.source=JSON.stringify(value);
    }
  } }],
  build: { rollupOptions: { input: { app:path.resolve('index.html'),conformance:path.resolve('diagnostics/cross-platform.html') } } },
}));
