/**
 * CLI shell build — one Node bundle, `dist/cli.js`, shebanged for the
 * `oh` bin entry. Everything is statically packed (workspace packages
 * included): no CDN, no runtime fetch, no remote code — the enterprise
 * packing constraint applies to every distribution.
 */

import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'node22',
    ssr: true,
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        cli: 'src/cli.ts',
      },
      output: {
        entryFileNames: '[name].js',
        banner: '#!/usr/bin/env node\n',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
