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
      '/api': 'http://192.168.10.203:8001',
      '/storage': {
        target: 'http://192.168.10.203:8001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})