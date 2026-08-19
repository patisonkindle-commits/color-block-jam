import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/color-block-jam/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
  },
});
