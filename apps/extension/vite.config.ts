import * as fs from 'node:fs';
import * as path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, build as viteBuild } from 'vite';

const browser = process.env.BROWSER || 'chrome';
const isDev = process.argv.includes('--watch');
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

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
    // Images
    { from: 'src/assets/images/icon16.png', to: 'images/icon16.png' },
    { from: 'src/assets/images/icon48.png', to: 'images/icon48.png' },
    { from: 'src/assets/images/icon128.png', to: 'images/icon128.png' },
    { from: 'src/assets/images/companion-app.png', to: 'images/companion-app.png' },
    { from: 'src/assets/images/logo-pixel.svg', to: 'images/logo-pixel.svg' },
    // Fonts — the .woff2 is emitted by Vite through the CSS pipeline
    // (see the relative url() in popup.less / rules.less). Only the
    // license file needs an explicit copy.
    { from: 'src/assets/fonts/OFL.txt', to: 'fonts/OFL.txt' },
    // Recording
    { from: 'src/assets/recording/inject/recorder-rrweb.js', to: 'js/recording/inject/recorder.js' },
    { from: 'src/assets/recording/inject/recording-widget.js', to: 'js/recording/inject/recording-widget.js' },
    // Vendored libs
    { from: 'src/assets/lib/rrweb.js', to: 'js/lib/rrweb.js' },
    { from: 'src/assets/lib/rrweb-player.js', to: 'js/lib/rrweb-player.js' },
    { from: 'src/assets/lib/rrweb-player.css', to: 'css/rrweb-player.css' },
    {
      from: 'src/assets/lib/assets/image-bitmap-data-url-worker-IJpC7g_b.js',
      to: 'js/lib/assets/image-bitmap-data-url-worker-IJpC7g_b.js',
    },
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
            // Inject version from package.json into the output manifest
            const manifest = JSON.parse(fs.readFileSync(src, 'utf8'));
            manifest.version = pkg.version.replace(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/, '$1.$2');
            fs.writeFileSync(dest, `${JSON.stringify(manifest, null, 2)}\n`);
          } else {
            fs.copyFileSync(src, dest);
          }
        }
      }
    },
  };
}

/**
 * Plugin to build the content script as a separate self-contained IIFE bundle.
 * Content scripts injected via chrome.scripting.executeScript cannot use
 * ES module imports, so they must be bundled into a single file.
 */
function buildContentScriptPlugin() {
  return {
    name: 'build-content-script',
    async writeBundle() {
      await viteBuild({
        configFile: false,
        // Standalone sub-build must not re-copy the main app's publicDir
        // into its own nested outDir — doing so would shove every asset
        // (including the pre-mount theme initializer) inside the content
        // script's JS output directory for no reason.
        publicDir: false,
        // Match the main build's path aliases so this standalone bundle
        // can import shared modules (e.g. @utils/bridge) by name instead
        // of reaching through brittle relative paths.
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'src'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@assets': path.resolve(__dirname, 'src/assets'),
            '@styles': path.resolve(__dirname, 'src/assets/styles'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@context': path.resolve(__dirname, 'src/context'),
            '@hooks': path.resolve(__dirname, 'src/hooks'),
          },
        },
        build: {
          outDir: `dist/${browser}/js/content/workflow-recorder`,
          emptyOutDir: false,
          minify: isDev ? false : 'terser',
          sourcemap: browser === 'firefox' ? 'inline' : false,
          lib: {
            entry: path.resolve(__dirname, 'src/assets/recording/content/workflow-recorder.js'),
            formats: ['iife'],
            name: 'WorkflowRecorder',
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
        // into its own nested outDir — see the workflow-recorder plugin
        // for the same rationale.
        publicDir: false,
        // Match the main build's aliases so this standalone bundle can
        // import shared modules (e.g. @utils/bridge) by name.
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'src'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@assets': path.resolve(__dirname, 'src/assets'),
            '@styles': path.resolve(__dirname, 'src/assets/styles'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@context': path.resolve(__dirname, 'src/context'),
            '@hooks': path.resolve(__dirname, 'src/hooks'),
          },
        },
        build: {
          outDir: `dist/${browser}/js/content/fire-bridge`,
          emptyOutDir: false,
          minify: isDev ? false : 'terser',
          sourcemap: browser === 'firefox' ? 'inline' : false,
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

export default defineConfig({
  plugins: [react(), chromeSafePlugin(), copyAssetsPlugin(), buildContentScriptPlugin(), buildFireBridgePlugin()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@styles': path.resolve(__dirname, 'src/assets/styles'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@context': path.resolve(__dirname, 'src/context'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
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
    sourcemap: browser === 'firefox' ? 'inline' : false,
    // Disable module preload polyfill — it references `document` which
    // crashes the background service worker.
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        workspace: path.resolve(__dirname, 'workspace.html'),
        delay: path.resolve(__dirname, 'delay.html'),
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
        // antd/react/codemirror into separate chunks creates circular
        // dependencies (antd → react → antd etc.) without any byte
        // savings.
        //
        // Exceptions: packages that every entry accesses through a
        // dynamic `() => import(...)` boundary MUST stay outside the
        // vendor bucket so rollup can keep them as separate lazy chunks.
        // Prettier (+ its plugins) and the CodeMirror language packs are
        // both loaded on demand via `rules/languages/registry.ts` and
        // `rules/languages/formatter.ts`; pulling them into vendor would
        // merge them back into the workspace's first-paint payload and
        // defeat the lazy load.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/prettier/')) return undefined;
          if (id.includes('@codemirror/lang-')) return undefined;
          return 'vendor';
        },
      },
    },
  },

  // Build-time constants.
  // __APP_VERSION__ uses the numeric manifest-style version (e.g. 4.1.0.1 instead of 4.1.0-beta.1).
  // globalThis override prevents Vite from using detection code that violates CSP.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version.replace(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/, '$1.$2')),
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
