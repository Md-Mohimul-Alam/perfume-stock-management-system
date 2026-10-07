import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Ensure the API URL is set
  const apiUrl =
    env.VITE_API_URL ||
    (mode === 'development' ? 'http://localhost:5001' : undefined)

  if (mode === 'production' && !apiUrl) {
    console.warn(
      '⚠️ VITE_API_URL is not set in production! API calls will fail.'
    )
  }

  return {
    plugins: [
      react(),

      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',

        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icons/icon-192.png',
          'icons/icon-512.png',
        ],

        manifest: {
          name: 'LUXE Perfume Management',
          short_name: 'LUXE',
          description:
            'LUXE Perfume Stock, Sales, Inventory and Business Management System',

          start_url: '/',
          scope: '/',

          display: 'standalone',
          orientation: 'portrait',

          theme_color: '#111111',
          background_color: '#111111',

          categories: ['business', 'productivity'],

          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },

        workbox: {
          cleanupOutdatedCaches: true,

          globPatterns: [
            '**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}',
          ],

          navigateFallback: '/index.html',

          runtimeCaching: [
            {
              urlPattern: ({ request }) =>
                request.destination === 'image',

              handler: 'CacheFirst',

              options: {
                cacheName: 'luxe-images',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },

            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api/'),

              handler: 'NetworkFirst',

              options: {
                cacheName: 'luxe-api-cache',

                networkTimeoutSeconds: 10,

                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5,
                },

                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },

        // Helpful while testing locally.
        // You can remove this later if you prefer.
        devOptions: {
          enabled: true,
        },
      }),
    ],

    server: {
      // Only proxy in development
      proxy:
        mode === 'development' && apiUrl
          ? {
              '/api': {
                target: apiUrl,
                changeOrigin: true,
              },
            }
          : undefined,
    },

    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                id.includes('react') ||
                id.includes('react-dom') ||
                id.includes('react-router-dom')
              ) {
                return 'vendor-react'
              }

              return 'vendor'
            }
          },
        },
      },

      chunkSizeWarningLimit: 1000,
    },

    define: {
      // Makes VITE_API_URL available as import.meta.env.VITE_API_URL
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl || ''),
    },
  }
})