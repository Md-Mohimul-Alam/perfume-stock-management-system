import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiUrl =
    env.VITE_API_URL ||
    (mode === 'development'
      ? 'http://localhost:5001'
      : undefined)

  if (mode === 'production' && !apiUrl) {
    console.warn(
      '⚠️ VITE_API_URL is not set in production! API calls will fail.'
    )
  }

  return {
    plugins: [
      react(),

      VitePWA({
        /*
          Prompt user before applying
          a newly available PWA update.
        */
        registerType: 'prompt',

        /*
          Static assets copied into
          the production build.
        */
        includeAssets: [
          'favicon.ico',

          /*
            Primary Apple Home Screen icon.
          */
          'apple-touch-icon.png',

          /*
            Apple touch icons.
          */
          'apple-touch-icons/apple-touch-icon-180x180.png',
          'apple-touch-icons/apple-touch-icon-167x167.png',
          'apple-touch-icons/apple-touch-icon-152x152.png',
          'apple-touch-icons/apple-touch-icon-120x120.png',
          'apple-touch-icons/apple-touch-icon-76x76.png',
          'apple-touch-icons/apple-touch-icon-57x57.png',

          /*
            Android / PWA icons.
          */
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-512-maskable.png',
        ],

        /*
          vite-plugin-pwa generates:

          /manifest.webmanifest

          Do not maintain a separate
          public/manifest.json.
        */
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

          categories: [
            'business',
            'productivity',
          ],

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
          /*
            Remove old service-worker caches
            after new deployments.
          */
          cleanupOutdatedCaches: true,

          globPatterns: [
            '**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}',
          ],

          navigateFallback:
            '/index.html',

          runtimeCaching: [
            {
              /*
                Cache runtime images.

                This is mainly for product images.
              */
              urlPattern: ({
                request,
              }) =>
                request.destination ===
                'image',

              handler:
                'CacheFirst',

              options: {
                cacheName:
                  'luxe-images',

                expiration: {
                  maxEntries:
                    100,

                  maxAgeSeconds:
                    60 *
                    60 *
                    24 *
                    30,
                },

                cacheableResponse: {
                  statuses: [
                    0,
                    200,
                  ],
                },
              },
            },
          ],
        },

        /*
          Useful while developing PWA
          behavior locally.
        */
        devOptions: {
          enabled: true,
        },
      }),
    ],

    server: {
      proxy:
        mode === 'development' &&
        apiUrl
          ? {
              '/api': {
                target:
                  apiUrl,

                changeOrigin:
                  true,
              },
            }
          : undefined,
    },

    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes(
                'node_modules'
              )
            ) {
              if (
                id.includes(
                  'react'
                ) ||
                id.includes(
                  'react-dom'
                ) ||
                id.includes(
                  'react-router-dom'
                )
              ) {
                return 'vendor-react'
              }

              return 'vendor'
            }
          },
        },
      },

      chunkSizeWarningLimit:
        1000,
    },

    define: {
      'import.meta.env.VITE_API_URL':
        JSON.stringify(
          apiUrl || ''
        ),
    },
  }
})