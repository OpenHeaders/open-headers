/**
 * Daemon shell build — two Node bundles: `dist/main.js` (the daemon)
 * and `dist/cli.js` (the `oh` lifecycle CLI, shebanged for the bin
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

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

// Build metadata captured once at config-load time. Reading git is
// best-effort — dev clones without git (rare) get placeholders
// instead of crashing the build.
function git(cmd: string, fallback: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: __dirname, encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}
const buildInfo = {
  version: pkg.version,
  commit: git('rev-parse --short=7 HEAD', '0000000'),
  commitFull: git('rev-parse HEAD', '0'.repeat(40)),
  build: Number.parseInt(git('rev-list --count HEAD', '0'), 10) || 0,
  date: new Date().toISOString(),
  channel: 'stable' as const,
};

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
