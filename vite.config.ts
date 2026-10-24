import { randomUUID } from 'node:crypto';
import { BRAND } from './shared/brand';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const buildId = process.env.MONIGONES_BUILD_ID || `v05-${randomUUID()}`;
export default defineConfig(({ command }) => ({
  define: {
    __MONIGONES_BUILD_ID__: JSON.stringify(buildId),
    __MONIGONES_SW_ENABLED__: command === 'build',
  },
  plugins: [
    react(),
    {
      name: 'monigones-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId }),
        });
      },
    },
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
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
      injectManifest: {
        rollupFormat: 'iife',
        additionalManifestEntries: [
          { url: '/assets/futbol/fallback/jugador.png', revision: 'v03-player-1' },
          { url: '/assets/futbol/fallback/escudo.png', revision: 'v03-club-1' },
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globIgnores: ['sports/**', 'assets/futbol/**'],
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,woff2}'],
      },
    }),
  ],
  server: {
    port: Number(process.env.WEB_PORT || 5173),
    proxy: {
      '/assets/futbol': {
        target: `http://127.0.0.1:${process.env.PORT || 3001}`,
        changeOrigin: true,
      },
      '/api': { target: `http://127.0.0.1:${process.env.PORT || 3001}`, changeOrigin: true },
    },
  },
  build: { chunkSizeWarningLimit: 650 },
}));
