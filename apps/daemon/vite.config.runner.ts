/**
 * Script-runner build — one SELF-CONTAINED bundle
 * (`dist/script-runner.js`) beside the daemon entries. Deliberately a
 * separate pass from the main build: the runner child executes under
 * `--permission` with a file-scoped read grant, so it must not import
 * shared chunks (the grant would widen to the whole dist) and must
 * never share a chunk with `better-sqlite3`-touching modules (native
 * addons are denied inside the sandbox). Its module graph is the
 * shared runner core from `@openheaders/core/scripts/runner` only.
 */

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node22',
    ssr: true,
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    rollupOptions: {
      input: { 'script-runner': 'src/script-sandbox/runner/script-runner.ts' },
      output: {
        entryFileNames: '[name].js',
        inlineDynamicImports: true,
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
