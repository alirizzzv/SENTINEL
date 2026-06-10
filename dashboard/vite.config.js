import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Builds the React dashboard into extension/dashboard/ as a static bundle the
// extension loads via chrome.runtime.getURL. base './' keeps asset paths relative
// so they resolve under the chrome-extension:// origin.
export default defineConfig({
  root: here,
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(here, '..', 'extension', 'dashboard'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(here, 'index.html'),
    },
  },
});
