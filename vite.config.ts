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
      tailwindcss(),
    ],
    build: {
      // Keep warnings actionable while avoiding noise from intentionally large 3D/kitchen assets.
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('/react/') || id.includes('react-dom') || id.includes('react-router-dom')) return 'react';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
            if (id.includes('laravel-echo') || id.includes('pusher-js')) return 'realtime';
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('@google/model-viewer')) return 'model-viewer';
            if (id.includes('/three/')) return 'three';
            if (id.includes('axios')) return 'http';

            return;
          },
        },
      },
    },
    server: {
      host: true,
      allowedHosts: [
        '2d447bf9e7144f.lhr.lifelife',
        'localhost',
        'rozer.localhost',
        'alpha.localhost',
        'sigma.localhost',
        'www.rozer.pro',
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
