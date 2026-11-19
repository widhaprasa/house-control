import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// The standalone editor build. It emits editor.html with its assets and the demo plans,
// ready to upload to any static web server. The panel build (vite.config.js) is untouched.
export default defineConfig({
  base: './',
  server: { port: Number(process.env.PORT) || 5200, strictPort: true },
  resolve: {
    alias: [
      // The editor has no connections; keep the real module out of this build.
      {
        find: /^\.\/connections\.js$/,
        replacement: fileURLToPath(new URL('./src/editor/connections-off.js', import.meta.url)),
      },
    ],
  },
  build: {
    target: 'safari17',
    outDir: 'dist-editor',
    emptyOutDir: true,
    rollupOptions: { input: { editor: 'editor.html' } },
    chunkSizeWarningLimit: 1800,
  },
});
