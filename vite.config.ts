import { BRAND } from './shared/brand';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: `${BRAND.name} · ${BRAND.edition}`,
        short_name: BRAND.name,
        description: BRAND.slogan,
        theme_color: BRAND.theme,
        background_color: BRAND.theme,
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globIgnores: ['sports/**'],
        runtimeCaching: [
          {
            urlPattern: /\/sports\/.*\.(?:jpg|jpeg|png|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'monigones-sports-v1',
              expiration: { maxEntries: 180, maxAgeSeconds: 14 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        dontCacheBustURLsMatching: /-[a-zA-Z0-9_-]{8}\.(js|css)$/,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,woff2}'],
      },
    }),
  ],
  server: {
    port: Number(process.env.WEB_PORT || 5173),
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.PORT || 3001}`, changeOrigin: true },
    },
  },
  build: { chunkSizeWarningLimit: 650 },
});
