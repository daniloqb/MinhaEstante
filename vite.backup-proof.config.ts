import { defineConfig } from 'vite';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

/** Isolated localhost server/build. No production config, public assets, service worker or app routes. */
export default defineConfig({
  root: path.resolve('experiments/backup-zip-proof'), publicDir: false, base: './',
  server: { host: '127.0.0.1', port: 3422, strictPort: true, fs: { allow: [process.cwd()] } },
  resolve: { alias: { '/src': path.resolve('src') } },
  plugins: [{ name: 'synthetic-zip-transfer-only', configureServer(server) {
    const root = process.env.MINHAESTANTE_ZIP_PROOF_DIR;
    if (!root || !/^\/tmp\/minhaestante-4-2a-[a-zA-Z0-9_-]+$/.test(root) || !existsSync(path.join(root, 'proof-root.json'))) throw new Error('Exclusive synthetic root required');
    server.middlewares.use('/__proof', async (req, res) => {
      try {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'GET' && name === 'list') {
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify((await readdir(root)).filter(name => /^(kotlin|web)[a-zA-Z0-9_.-]*\.(zip|json)$/.test(name)))); return;
        }
        if (!/^(kotlin|web)[a-zA-Z0-9_.-]*\.(zip|json)$/.test(name)) { res.statusCode = 404; res.end(); return; }
        const file = path.join(root, name);
        if (req.method === 'GET') { await pipeline(createReadStream(file), res); return; }
        if (req.method === 'POST' && name.startsWith('web-')) { await pipeline(req, createWriteStream(file, { flags: 'wx' })); res.end('stored synthetic artifact'); return; }
        res.statusCode = 405; res.end();
      } catch { if (!res.headersSent) res.statusCode = 500; res.end('Synthetic transfer failed'); }
    });
  } }],
});
