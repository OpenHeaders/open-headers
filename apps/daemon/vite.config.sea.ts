/**
 * SEA bundle build — one CommonJS file (`dist-sea/ohd.cjs`) holding the
 * whole distribution: the CLI entry plus the daemon spine behind ohd run.. Node's single-executable injection requires a CJS
 * entry, and the blob resolves no sibling files, so chunking is off
 * and every dynamic import is inlined.
 *
 * `better-sqlite3` is not external here (nothing beside the blob to
 * require) — the specifier is aliased to the lazy SEA shim, which
 * unpacks the embedded native payload on first construction. The
 * enterprise packing constraint holds: everything the binary runs is
 * inside the binary.
 */

import * as path from 'node:path';
import { defineConfig } from 'vite';
import { resolveChangelogEntry } from './src/bundling/changelog-entry';
import { readBuildInfo } from './vite.build-info';

const buildInfo = readBuildInfo(__dirname);

export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
    __DAEMON_CHANGELOG__: JSON.stringify(resolveChangelogEntry(buildInfo.version)),
  },
  resolve: {
    alias: {
      'better-sqlite3': path.resolve(__dirname, 'src/sea/sqlite-shim.ts'),
    },
  },
  build: {
    target: 'node22',
    ssr: true,
    outDir: 'dist-sea',
    emptyOutDir: true,
    // Terser over esbuild: the bundle ships embedded in the binary and
    // is what `strings` surfaces — full mangling + an extra pass is the
    // hardening budget here. Console stays: operational logs are a
    // server feature.
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2 },
    },
    // Same as the dist build: keep undici's lazy `require('node:sqlite')`
    // at its call site instead of hoisting it into a startup require —
    // otherwise every ohd command prints Node's experimental-SQLite
    // warning. The CJS output has a native `require` for the rare case
    // undici's feature detection actually runs.
    commonjsOptions: {
      ignore: ['node:sqlite'],
    },
    rollupOptions: {
      input: { ohd: 'src/cli.ts' },
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
