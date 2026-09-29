import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The production build is a single self-contained index.html so the game can be
// opened straight from disk (file://), hosted on any static host, or side-loaded
// on a phone without a dev server.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 100000000,
  },
  server: { port: 5173, host: true },
});
