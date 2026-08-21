import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/color-block-jam/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5173,
  },
});
