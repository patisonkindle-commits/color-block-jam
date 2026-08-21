import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/color-block-jam/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: 'index.html', // use our hand-edited index.html, not src/game.ts
    },
  },
  server: {
    port: 5173,
  },
});
