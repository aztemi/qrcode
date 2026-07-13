import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    'process.env.BUILDTIME': JSON.stringify(new Date().toISOString())
  },
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
      },
      adapter: adapter({
        pages: 'build',
        assets: 'build',
        fallback: 'index.html',
        precompress: false,
        strict: true
      })
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'QR Code Reader & Creator',
        short_name: 'QR Code',
        description: 'Scan and create QR codes offline',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        screenshots: [],
        categories: ['utilities', 'productivity']
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ]
});
