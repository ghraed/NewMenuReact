import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add this line
  ],
  server: {
    host: true,
    allowedHosts: [
      '2d447bf9e7144f.lhr.lifelife',
      'localhost',
    ],
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/storage': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
