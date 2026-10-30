import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` makes one self-contained HTML file (dist-single/index.html)
// that you can open from your desktop or host anywhere.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  base: './',
  build: { chunkSizeWarningLimit: 900, outDir: mode === 'single' ? 'dist-single' : 'dist' },
}));
