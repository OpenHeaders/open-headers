/**
 * Daemon shell build — two Node bundles: `dist/main.js` (the daemon)
 * and `dist/cli.js` (the `ohd` lifecycle CLI, shebanged for the bin
 * entry). Shared modules (config, no-cipher) split into chunks both
 * import.
 *
 * Everything is statically packed (workspace packages included) except
 * `better-sqlite3`, whose native binding must load from `node_modules`
 * for the running Node's ABI — only `main.js` reaches it; the CLI
 * stays sqlite-free by construction. No CDN, no runtime fetch, no
 * remote code — the enterprise packing constraint applies to every
 * distribution.
 */

import { defineConfig } from 'vite';
import { readBuildInfo } from './vite.build-info';

// Build metadata captured once at config-load time.
const buildInfo = readBuildInfo(__dirname);

export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  build: {
    target: 'node22',
    ssr: true,
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        main: 'src/main.ts',
        cli: 'src/cli.ts',
      },
      external: ['better-sqlite3'],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        banner: (chunk) => (chunk.name === 'cli' ? '#!/usr/bin/env node\n' : ''),
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
