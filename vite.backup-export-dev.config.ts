import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import development from './vite.attachments-dev.config';
import { createWriteStream, existsSync, lstatSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
export default mergeConfig(development, defineConfig({
  server: { host: '127.0.0.1', port: 3423, strictPort: true },
  build: { rollupOptions: { input: { export: path.resolve('diagnostics/backup-export.html') } } },
  plugins: [{ name: 'backup-export-synthetic-artifacts', configureServer(server) {
    const root = process.env.BACKUP_EXPORT_ARTIFACT_ROOT;
    if (!root) return;
    if (!/^\/tmp\/minhaestante-4-2b-[a-z0-9-]+$/.test(root) || lstatSync(root).isSymbolicLink() || !existsSync(path.join(root, 'synthetic-export-root.json'))) throw Error('Exclusive synthetic root required');
    server.middlewares.use('/__backup_export_artifacts', async (req, res) => {
      const name = (req.url ?? '').replace(/^\//, '');
      if (req.method !== 'POST' || !/^backup-[a-f0-9-]{36}\.zip$/.test(name)) { res.statusCode = 404; res.end(); return; }
      let bytes = 0;
      const bounded = new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; callback(bytes > 132 * 1024 ** 2 ? Error('Synthetic budget exceeded') : null, chunk); } });
      try { await pipeline(req, bounded, createWriteStream(path.join(root, name), { flags: 'wx' })); res.end('synthetic artifact received'); }
      catch { if (!res.headersSent) res.statusCode = 500; res.end('Synthetic transfer failed'); }
    });
  } }],
}));
