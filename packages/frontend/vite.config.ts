import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const commitSha = process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'dev';

export default defineConfig({
  base: process.env.VITE_CDN_URL || '/',
  server: {
    port: 3000,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'splash/splash.svg'],
      manifest: {
        name: 'NIT Logistics',
        short_name: 'NIT',
        description: 'Nesma Infrastructure & Technology — Supply Chain Management',
        theme_color: '#2E3192',
        background_color: '#0a1628',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple touch icon',
          },
        ],
      },
      workbox: {
        // Import push notification handler into the service worker
        importScripts: ['sw-push.js'],
        // Cache strategies
        runtimeCaching: [
          {
            // API calls: network-first with fallback
            urlPattern: /\/api\/v1\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Static assets: cache-first
            urlPattern: /\.(js|css|png|jpg|jpeg|svg|gif|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
        // Don't precache everything - just the shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Skip large chunks
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
      },
    }),
  ],
  build: {
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (/[\\/](react-dom|react[\\/]|react-router-dom)[\\/]/.test(id)) return 'vendor-react';
            if (/[\\/](@tanstack[\\/]react-query|axios|zustand)[\\/]/.test(id)) return 'vendor-data';
            if (/[\\/](react-hook-form|@hookform[\\/]resolvers|zod)[\\/]/.test(id)) return 'vendor-forms';
            if (/[\\/]recharts[\\/]/.test(id)) return 'vendor-charts';
            if (/[\\/]@dnd-kit[\\/]/.test(id)) return 'vendor-dnd';
            if (/[\\/]socket\.io-client[\\/]/.test(id)) return 'vendor-socket';
          }
        },
      },
    },
  },
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha.slice(0, 7)),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
