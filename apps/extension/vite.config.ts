import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, build as viteBuild } from 'vite';

const browser = process.env.BROWSER || 'chrome';
const isDev = process.argv.includes('--watch');
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

// CalVer / semver string from package.json, possibly with `-beta.N` suffix.
const pkgVersion = pkg.version;
// Numeric-only form for Chrome's manifest.version (no `-beta.N`).
// Replaces `X.Y.Z-beta.N` → `X.Y.Z.N`; leaves already-numeric versions alone.
const manifestNumericVersion = pkgVersion.replace(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/, '$1.$2');
const isBeta = /-beta\.\d+$/.test(pkgVersion);
const channel = isBeta ? 'beta' : 'stable';

// Build metadata captured once at config-load time so every plugin sees
// the same values. Reading git is best-effort — dev clones without git
// (rare) get '-dev' placeholders instead of crashing the build.
function git(cmd: string, fallback: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: __dirname, encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}
const buildInfo = {
  version: pkgVersion,
  commit: git('rev-parse --short=7 HEAD', '0000000'),
  commitFull: git('rev-parse HEAD', '0'.repeat(40)),
  build: Number.parseInt(git('rev-list --count HEAD', '0'), 10) || 0,
  date: new Date().toISOString(),
  channel,
};

/**
 * Firefox-only: keep the ~8 MB `ts.worker` (the bundled TS compiler +
 * lib.*.d.ts) out of the build — Firefox add-on validation rejects any
 * single file over 5 MB. Two swaps are needed because the worker enters
 * the graph from two directions:
 *
 *   1. `./ts-language-service` — our explicit TS service setup + worker
 *      import. Swapped to a no-op stub.
 *   2. Monaco's `language/typescript/monaco.contribution` — side-effect
 *      imported by Monaco's full `editor.main` entry; its `tsMode` does
 *      `new Worker(new URL('./ts.worker', …))`, which Vite bundles on its
 *      own. Swapped to an empty stub so the TS service never registers.
 *
 * Firefox keeps JS/TS syntax highlighting (the `basic-languages`
 * tokenizers); only the worker-backed language service is dropped.
 * Chrome/Edge/Safari are untouched and keep full type-aware completions.
 *
 * Done as a `resolveId` swap rather than `resolve.alias` because alias
 * does not reliably match the relative `./ts-language-service` specifier
 * across the workspace package boundary.
 */
function firefoxTsServiceStubPlugin(): Plugin {
  const serviceStub = path.resolve(
    __dirname,
    '../../packages/ui/src/workbench/components/monaco/ts-language-service.firefox.ts',
  );
  const contributionStub = path.resolve(
    __dirname,
    '../../packages/ui/src/workbench/components/monaco/monaco-ts-contribution.firefox.ts',
  );
  return {
    name: 'firefox-ts-service-stub',
    enforce: 'pre',
    resolveId(source) {
      if (source === './ts-language-service') return serviceStub;
      if (source.includes('language/typescript/monaco.contribution')) return contributionStub;
      return null;
    },
  };
}

/**
 * Vite plugin to ensure Chrome Web Store compliance.
 * Replaces webpack's Function constructor usage and removes source map references.
 */
function chromeSafePlugin() {
  return {
    name: 'chrome-safe-plugin',
    generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      for (const [, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.code) {
          chunk.code = chunk.code
            .replace(
              /return this \|\| new Function\('return this'\)\(\)/g,
              'return this || globalThis || self || window',
            )
            .replace(/\/\/# sourceMappingURL=.+$/gm, '');
        }
      }
    },
  };
}

/**
 * Simple plugin to copy static assets to the dist folder with flat paths.
 */
function copyAssetsPlugin() {
  const copies: Array<{ from: string; to: string }> = [
    { from: `manifests/${browser}/manifest.json`, to: 'manifest.json' },
    // PERMISSIONS.md — ships inside the packed extension so store
    // reviewers and security-conscious users can read the justification
    // for every permission the manifest requests. See the file header
    // for the invariant: new permissions require a PERMISSIONS.md entry.
    { from: 'PERMISSIONS.md', to: 'PERMISSIONS.md' },
    // Images
    { from: 'src/assets/images/icon16.png', to: 'images/icon16.png' },
    { from: 'src/assets/images/icon48.png', to: 'images/icon48.png' },
    { from: 'src/assets/images/icon128.png', to: 'images/icon128.png' },
    { from: 'src/assets/images/companion-app.png', to: 'images/companion-app.png' },
    { from: 'src/assets/images/logo-pixel.svg', to: 'images/logo-pixel.svg' },
    // Fonts — the bundled PressStart2P .woff2 lives in @openheaders/ui
    // (next to the style files that reference it) and is emitted by
    // Vite through the CSS pipeline. Only its license file needs an
    // explicit copy.
    { from: '../../packages/ui/src/assets/fonts/OFL.txt', to: 'fonts/OFL.txt' },
  ];

  // Safari-specific
  if (browser === 'safari') {
    copies.push({ from: 'manifests/safari/SafariAPIs.js', to: 'js/safari/SafariAPIs.js' });
  }

  return {
    name: 'copy-assets',
    writeBundle() {
      const outDir = path.resolve(__dirname, `dist/${browser}`);
      for (const { from, to } of copies) {
        const src = path.resolve(__dirname, from);
        const dest = path.resolve(outDir, to);
        if (fs.existsSync(src)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          if (to === 'manifest.json') {
            const manifest = JSON.parse(fs.readFileSync(src, 'utf8'));
            // Chrome's manifest.version must be dotted integers (no
            // `-beta.N`), so betas land as `X.Y.Z.N`. The free-text
            // `version_name` field carries the real label users see in
            // `chrome://extensions` so `2026.6.3-beta.1` is not silently
            // displayed as `2026.6.3.1`.
            manifest.version = manifestNumericVersion;
            if (isBeta) {
              manifest.version_name = pkgVersion;
            } else {
              delete manifest.version_name;
            }
            fs.writeFileSync(dest, `${JSON.stringify(manifest, null, 2)}\n`);
          } else {
            fs.copyFileSync(src, dest);
          }
        }
      }
      // Emit build metadata for the runtime About surface + log
      // prefixes. Lives next to manifest.json so it's reachable via
      // `chrome.runtime.getURL('build-info.json')`.
      fs.writeFileSync(
        path.resolve(outDir, 'build-info.json'),
        `${JSON.stringify(buildInfo, null, 2)}\n`,
      );
    },
  };
}

/**
 * Build the always-on ISOLATED-world fire bridge content script as a
 * self-contained IIFE. Registered via manifest.json content_scripts for
 * `<all_urls>` at document_start, so it runs on every page the extension
 * has host access to. Listens for `oh:fire` CustomEvents dispatched from
 * MAIN-world generated scripts and forwards them to the background as
 * `tabFire` messages. The background filters by per-tab tracking state.
 */
function buildFireBridgePlugin() {
  return {
    name: 'build-fire-bridge',
    async writeBundle() {
      await viteBuild({
        configFile: false,
        // Standalone sub-build must not re-copy the main app's publicDir
        // into its own nested outDir — doing so would shove every asset
        // (including the pre-mount theme initializer) inside the content
        // script's JS output directory for no reason.
        publicDir: false,
        // Match the main build's aliases so this standalone bundle can
        // import shared modules (e.g. @utils/bridge) by name.
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'src'),
            '@utils': path.resolve(__dirname, 'src/utils'),
          },
        },
        build: {
          outDir: `dist/${browser}/js/content/fire-bridge`,
          emptyOutDir: false,
          minify: isDev ? false : 'terser',
          sourcemap: false,
          lib: {
            entry: path.resolve(__dirname, 'src/background/fire-bridge-content.ts'),
            formats: ['iife'],
            name: 'OhFireBridge',
            fileName: () => 'index.js',
          },
          rollupOptions: {},
        },
        define: {
          globalThis: 'globalThis',
        },
      });
    },
  };
}

/**
 * Build the ISOLATED-world Resource-Timing observer content script as a
 * self-contained IIFE. Registered via manifest.json content_scripts for
 * `<all_urls>` at document_start. Uses PerformanceObserver to report
 * subresource URLs — including memory-cache hits and bfcache restores
 * that webRequest can't see — to the background as `perfResourceEntries`
 * batch messages. Covers the observability gap that leaves rules
 * appearing "not firing" on cached reloads.
 */
function buildPerfObserverPlugin() {
  return {
    name: 'build-perf-observer',
    async writeBundle() {
      await viteBuild({
        configFile: false,
        publicDir: false,
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'src'),
            '@utils': path.resolve(__dirname, 'src/utils'),
          },
        },
        build: {
          outDir: `dist/${browser}/js/content/perf-observer`,
          emptyOutDir: false,
          minify: isDev ? false : 'terser',
          sourcemap: false,
          lib: {
            entry: path.resolve(__dirname, 'src/background/perf-observer-content.ts'),
            formats: ['iife'],
            name: 'OhPerfObserver',
            fileName: () => 'index.js',
          },
          rollupOptions: {},
        },
        define: {
          globalThis: 'globalThis',
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [
    ...(browser === 'firefox' ? [firefoxTsServiceStubPlugin()] : []),
    react(),
    chromeSafePlugin(),
    copyAssetsPlugin(),
    buildFireBridgePlugin(),
    buildPerfObserverPlugin(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },

  build: {
    outDir: `dist/${browser}`,
    emptyOutDir: true,
    // All MV3 browsers (Chrome 109+, Firefox 109+, Edge 109+, Safari 16.4+) support ES2022
    target: 'es2022',
    // Vendor chunk is large (React + Ant Design) — this is expected for a popup-only bundle
    chunkSizeWarningLimit: 1200,
    // Dev: skip minification for fast rebuilds
    // Production: Terser with preserved class/function names for Chrome Web Store compliance
    minify: isDev ? false : 'terser',
    ...(!isDev && {
      terserOptions: {
        compress: {
          passes: 1,
          drop_console: false,
          drop_debugger: false,
        },
        mangle: {
          keep_classnames: true,
          keep_fnames: true,
        },
        format: {
          beautify: false,
          comments: false,
        },
      } as Record<string, unknown>,
    }),
    sourcemap: false,
    // Disable module preload polyfill — it references `document` which
    // crashes the background service worker.
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        sidepanel: path.resolve(__dirname, 'sidepanel.html'),
        workspace: path.resolve(__dirname, 'workbench.html'),
        delay: path.resolve(__dirname, 'delay.html'),
        devtools: path.resolve(__dirname, 'devtools.html'),
        panel: path.resolve(__dirname, 'panel.html'),
        // Offscreen document + sandboxed script runner (ARCHITECTURE §19).
        // `sandbox.html` is declared in manifest.json > `sandbox.pages`,
        // which serves it with a unique origin and a relaxed CSP so
        // user-provided pre-request / test scripts can compile via
        // `new Function(...)` without undermining the rest of the
        // extension's `script-src 'self'`.
        offscreen: path.resolve(__dirname, 'offscreen.html'),
        sandbox: path.resolve(__dirname, 'sandbox.html'),
        // Developer-only showcase page for the merge-conflict editor.
        // Bundled so it's reachable at
        // `chrome-extension://<id>/merge-showcase.html` for visual
        // regression review without manually reproducing each
        // conflict shape. Not surfaced from any UI; users find it
        // by URL only. See `src/dev/merge-showcase.tsx`.
        'merge-showcase': path.resolve(__dirname, 'merge-showcase.html'),
        background: path.resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: 'js/[name]/index.js',
        chunkFileNames: 'js/chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.[0]?.endsWith('.css')) {
            return 'css/[name][extname]';
          }
          return 'assets/[name][extname]';
        },
        // Keep every node_module in a single `vendor` chunk — splitting
        // antd/react into separate chunks creates circular dependencies
        // (antd → react → antd etc.) without any byte savings.
        //
        // Exceptions:
        //   • Prettier (+ its plugins) is lazy-loaded on first Format
        //     call via `rules/languages/formatter.ts`; keep it out of
        //     vendor so rollup can emit it as its own lazy chunk.
        //   • `monaco-editor` is huge (~5 MB parsed) and shared across
        //     CodeEditor / ScriptEditor / CodeViewer. Pinning it to a
        //     dedicated `monaco` chunk means incremental rebuilds don't
        //     re-inline Monaco into every consumer chunk (otherwise the
        //     side-effect import graph drags Monaco into RuleContext,
        //     turning that chunk into a 7 MB payload that regenerates
        //     on every edit).
        manualChunks(id) {
          // Vite emits a `__vitePreload` runtime helper at a virtual
          // module id so every dynamic `import()` can go through one
          // path (dep preload, CSS link injection, CSP nonce handling).
          // Rollup's default is to bundle this helper into the largest
          // shared chunk — which ends up being `monaco`. Any surface
          // that uses dynamic imports (prettier in the panel, React.lazy
          // in the request detail views) then statically imports monaco
          // just to reach the helper, forcing Monaco's 4 MB of top-level
          // code to evaluate on surfaces that never render an editor.
          // Pinning the helper to `vendor` — already loaded by every
          // entry — keeps monaco reachable only from surfaces that
          // actually touch the editor.
          if (id.includes('vite/preload-helper')) return 'vendor';
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/prettier/')) return undefined;
          if (id.includes('/monaco-editor/') || id.includes('/@monaco-editor/')) return 'monaco';
          return 'vendor';
        },
      },
    },
  },

  // Build-time constants.
  // __APP_VERSION__ uses the numeric manifest-style version (e.g. 2026.6.3.1 instead of 2026.6.3-beta.1)
  // so callers reading runtime.getManifest().version line up with this constant exactly.
  // globalThis override prevents Vite from using detection code that violates CSP.
  define: {
    __APP_VERSION__: JSON.stringify(manifestNumericVersion),
    __BUILD_INFO__: JSON.stringify(buildInfo),
    globalThis: 'globalThis',
  },

  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
});
