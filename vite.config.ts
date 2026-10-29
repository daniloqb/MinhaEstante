import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { assertAndroidPackageSafe, assertPublicAssetsSafe } from './scripts/publicAssetPolicy';
import fs from 'node:fs';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __ATTACHMENTS_DEV_BUILD__: 'false',
    'import.meta.env.VITE_APP_URL': JSON.stringify(process.env.APP_URL || ''),
  },
  plugins: [
    { name: 'public-asset-policy', buildStart() { assertPublicAssetsSafe(path.resolve('public')); },
      configureServer(server) {
        assertPublicAssetsSafe(path.resolve('public'));
        server.middlewares.use((req, res, next) => {
          let url: string;
          try { url = decodeURIComponent((req.url || '').split('?')[0]); } catch { res.statusCode = 400; res.end(); return; }
          if (/\.(?:jks|keystore|p12|key)(?:$|[/?])/i.test(url) || url.includes('/assets/aistudio/')
            || (/\.(?:apk|aab)$/i.test(url) && !['/booknook.aab', '/minha-estante.apk', '/app-debug.apk'].includes(url))) {
            res.statusCode = 404; res.setHeader('Cache-Control', 'no-store'); res.end(); return;
          }
          next();
        });
      } },
    {
      name: 'serve-apk',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url || '';
          let cleanUrl: string;
          try { cleanUrl = decodeURIComponent(rawUrl.split('?')[0]); } catch { res.statusCode = 400; res.end(); return; }
          if (cleanUrl === '/booknook.aab') {
            const filePath = path.resolve(process.cwd(), 'booknook.aab');
            if (fs.existsSync(filePath)) {
              try { await assertAndroidPackageSafe(filePath); } catch { res.statusCode = 404; res.setHeader('Cache-Control', 'no-store'); res.end(); return; }
              const stats = fs.statSync(filePath);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Disposition', 'attachment; filename="booknook.aab"');
              res.setHeader('Content-Length', stats.size);
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          if (cleanUrl === '/minha-estante.apk' || cleanUrl === '/app-debug.apk') {
            const fileName = cleanUrl === '/app-debug.apk' ? 'app-debug.apk' : 'minha-estante.apk';
            const filePath = path.resolve(process.cwd(), fileName);
            if (fs.existsSync(filePath)) {
              try { await assertAndroidPackageSafe(filePath); } catch { res.statusCode = 404; res.setHeader('Cache-Control', 'no-store'); res.end(); return; }
              const stats = fs.statSync(filePath);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/vnd.android.package-archive');
              res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
              res.setHeader('Content-Length', stats.size);
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      manifest: {
        id: '/',
        name: 'Booknook',
        short_name: 'Booknook',
        description: 'Booknook - Organizador e catálogo pessoal de livros com estante clássica de madeira.',
        theme_color: '#2B1A0F',
        background_color: '#1E1008',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/covers\.openlibrary\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'openlibrary-covers-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: false,
  },
});
