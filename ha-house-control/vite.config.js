import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// Builds the Home Assistant custom card only. The source reuses the existing renderer
// from ../web/src, so that code stays in one place.
export default defineConfig({
  base: './',
  server: {
    port: Number(process.env.PORT) || 5300,
    strictPort: true,
    fs: { allow: ['..'] },
  },
  build: {
    target: 'safari17',
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/card.js', import.meta.url)),
      formats: ['es'],
      fileName: () => 'house-control-card.js',
    },
    chunkSizeWarningLimit: 1800,
  },
});
