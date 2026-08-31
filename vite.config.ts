import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      // Proxy API and WebSocket requests to the FastAPI backend (Port 8000)
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: 'ws://127.0.0.1:8000',
          ws: true,
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true, or ignore runtime config and data dirs to prevent automatic page reloads
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/config/**',
          '**/presets/**',
          '**/cache/**',
          '**/outputs/**',
          '**/logs/**',
          '**/dataset_cache/**',
          '**/models/**',
          '**/*.json',
          '**/*.txt'
        ]
      },
    },
  };
});
