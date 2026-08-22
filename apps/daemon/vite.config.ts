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
import { resolveChangelogEntry } from './src/bundling/changelog-entry';
import { readBuildInfo } from './vite.build-info';

// Build metadata captured once at config-load time.
const buildInfo = readBuildInfo(__dirname);

// undici's SOCKS5 tunnel lazily `require`s node:tls at dial time (and
// only then), so the bundled CJS survives into this ESM output as a
// bare `require` call. Hand every chunk a real one — the SEA build is
// CJS and has its own.
const REQUIRE_SHIM =
  "import { createRequire as __ohCreateRequire } from 'node:module'; const require = __ohCreateRequire(import.meta.url);";

export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
    __DAEMON_CHANGELOG__: JSON.stringify(resolveChangelogEntry(buildInfo.version)),
  },
  build: {
    target: 'node22',
    ssr: true,
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    // undici's runtime-features map `require('node:sqlite')`s lazily —
    // for feature detection, on demand. The CJS conversion would hoist
    // that literal require into a static top-level import, making Node
    // print its experimental-SQLite warning on every ohd invocation;
    // ignoring the specifier keeps the require at its call site (the
    // shim above hands every chunk a real `require`), loaded only if
    // undici ever actually asks.
    commonjsOptions: {
      ignore: ['node:sqlite'],
    },
    rollupOptions: {
      input: {
        main: 'src/main.ts',
        cli: 'src/cli.ts',
      },
      external: ['better-sqlite3'],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        banner: (chunk) => `${chunk.name === 'cli' ? '#!/usr/bin/env node\n' : ''}${REQUIRE_SHIM}\n`,
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
