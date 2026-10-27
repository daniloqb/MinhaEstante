import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** Separate entry: never imported by the production application or its navigation. */
export default defineConfig({
  root: path.resolve('diagnostics'),
  publicDir: false,
  base: './',
  plugins: [react()],
});
