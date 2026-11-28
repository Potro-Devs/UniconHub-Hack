/**
 * Compilación del pitch como un solo archivo: todo el JavaScript en un bloque y las imágenes
 * incrustadas como data URI. scripts/build-pitch-zip.mjs mete el JS y el CSS dentro del HTML.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    outDir: path.resolve(__dirname, '../output/pitch/build'),
    emptyOutDir: true,
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'pitch.html'),
      output: { inlineDynamicImports: true },
    },
  },
});
