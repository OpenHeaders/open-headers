import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './vite.sw-plugin';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

// Build metadata captured once at config-load time. Reading git is
// best-effort — dev clones without git (rare) get '-dev' placeholders
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
  build: Number.parseInt(git('rev-list --count HEAD', '0'), 10) || 0,
  date: new Date().toISOString(),
  channel: 'stable' as const,
};

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin({ cacheKey: `oh-web-${buildInfo.version}-${buildInfo.commit}` })],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    // Vendor (React + Ant Design) and index (Workbench + tab oracle)
    // chunks are large — expected for a single-page Workbench bundle
    // that hosts its own engine.
    chunkSizeWarningLimit: 2200,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep every node_module in a single `vendor` chunk except
        // monaco-editor, which is huge (~5 MB parsed) and must stay a
        // dedicated lazy chunk. Vite's `__vitePreload` helper is pinned
        // to `vendor` — rollup's default places it in the largest shared
        // chunk (monaco), which would make every surface with a dynamic
        // import evaluate Monaco just to reach the helper.
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) return 'vendor';
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/prettier/')) return undefined;
          if (id.includes('/monaco-editor/') || id.includes('/@monaco-editor/')) return 'monaco';
          return 'vendor';
        },
      },
    },
  },

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },

  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
});
