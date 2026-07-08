/**
 * Daemon shell build — one Node bundle at `dist/main.js`.
 *
 * Everything is statically packed (workspace packages included) except
 * `better-sqlite3`, whose native binding must load from `node_modules`
 * for the running Node's ABI. No CDN, no runtime fetch, no remote code
 * — the enterprise packing constraint applies to every distribution.
 */

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node22',
    ssr: 'src/main.ts',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      external: ['better-sqlite3'],
      output: {
        entryFileNames: 'main.js',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
