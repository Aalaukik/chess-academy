import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    // Proxy /api calls to the local Express proxy server during dev
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split chess.js into its own chunk for better caching
        manualChunks: {
          'chess-engine': ['chess.js'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
})
