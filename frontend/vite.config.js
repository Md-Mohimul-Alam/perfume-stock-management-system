import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode (development, production, etc.)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      // Enable proxy only in development mode
      proxy: mode === 'development' ? {
        '/api': {
          // Use VITE_API_URL environment variable or fallback to localhost:5001
          target: env.VITE_API_URL || 'http://localhost:5001',
          changeOrigin: true,
        }
      } : undefined,
    },
    build: {
      rollupOptions: {
        output: {
          // Manual chunk splitting to improve caching and load performance
          manualChunks: {
            // Separate React core libraries – they change infrequently
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // Add other large libraries here if needed, e.g. 'vendor-ui': ['antd', '@mui/material'],
          },
        },
      },
      // Increase the warning limit for chunk size (from 500 KB to 1000 KB)
      chunkSizeWarningLimit: 1000,
    },
    // Make the API base URL available as a global constant in your client code
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || ''),
    },
  }
})