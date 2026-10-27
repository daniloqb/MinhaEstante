import { defineConfig } from 'vite';
import path from 'node:path';
/** Isolated Web diagnostic bundle: no public assets, production navigation, or Android sync. */
export default defineConfig({
  publicDir: false,
  build: { rollupOptions: { input: path.resolve('diagnostics/opfs.html') } },
});
