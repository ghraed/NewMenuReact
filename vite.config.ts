import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';

  return {
  plugins: [
    react(),
    tailwindcss(), // Add this line
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          i18n: ['i18next', 'react-i18next'],
          realtime: ['laravel-echo', 'pusher-js'],
          three: ['three', '@google/model-viewer'],
          charts: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      '2d447bf9e7144f.lhr.lifelife',
      'localhost',
    ],
    proxy: {
      '/api': proxyTarget,
      '/storage': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      }
    }
  }
  };
})
