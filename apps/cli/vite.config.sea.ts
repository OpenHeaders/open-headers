/**
 * SEA bundle build — one CommonJS file (`dist-sea/oh.cjs`) holding the
 * whole CLI. Node's single-executable injection requires a CJS entry,
 * and the blob resolves no sibling files, so chunking is off and every
 * dynamic import is inlined. Unlike `ohd`, there is no native addon
 * and no unpack-at-first-run payload: the client is pure protocol, so
 * the blob is the entire distribution.
 */

import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { resolveChangelogEntry } from './src/bundling/changelog-entry';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
    __CLI_CHANGELOG__: JSON.stringify(resolveChangelogEntry(pkg.version)),
  },
  build: {
    target: 'node22',
    ssr: true,
    outDir: 'dist-sea',
    emptyOutDir: true,
    // Terser over esbuild: the bundle ships embedded in the binary and
    // is what `strings` surfaces — full mangling + an extra pass is the
    // hardening budget here. Console stays: stdout is the CLI's UI.
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2 },
    },
    rollupOptions: {
      input: { oh: 'src/cli.ts' },
      output: {
        format: 'cjs',
        entryFileNames: '[name].cjs',
        inlineDynamicImports: true,
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
