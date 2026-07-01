import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Ensure the API URL is set (throw a warning in production if missing)
  const apiUrl = env.VITE_API_URL || (mode === 'development' ? 'http://localhost:5001' : undefined)
  if (mode === 'production' && !apiUrl) {
    console.warn('⚠️ VITE_API_URL is not set in production! API calls will fail.')
  }

  return {
    plugins: [react()],
    server: {
      // Only proxy in development
      proxy: mode === 'development' && apiUrl ? {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        }
      } : undefined,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
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
      // This makes VITE_API_URL available as import.meta.env.VITE_API_URL
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl || ''),
    },
  }
})