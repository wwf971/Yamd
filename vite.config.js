import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/home/',
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    rollupOptions: {
      input: '/Users/timwang/project/2025/Yamd/index.html',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5179,
  },
});
