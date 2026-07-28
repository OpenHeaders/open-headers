import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import copy from 'rollup-plugin-copy';
import type { Plugin } from 'vite';

function git(args: string, fallback: string): string {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const pkgVersion = (JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string })
  .version;
const buildInfo = {
  version: pkgVersion,
  commit: git('rev-parse --short=7 HEAD', '0000000'),
  build: Number.parseInt(git('rev-list --count HEAD', '0'), 10) || 0,
  date: new Date().toISOString(),
  channel: 'stable' as const,
};

// Shipped-artifact hardening, set by the release workflow only — local
// production builds (incl. the Playwright e2e target) stay untouched.
const isReleaseChannel = process.env.OH_DESKTOP_CHANNEL === 'release';

/**
 * Release-channel build-time twin of the strip-testid jsx-runtime shim:
 * removes `'data-testid'` object properties from module code, so the
 * selector strings never reach the bundle text at all (the runtime shim
 * still covers ids arriving through computed spreads). AST-based — a
 * property is removed only when its key is exactly the literal
 * `data-testid`, wherever the object appears.
 */
function stripTestIdPropsPlugin(): Plugin {
  interface AstNode {
    type: string;
    start: number;
    end: number;
    [key: string]: unknown;
  }
  const isNode = (value: unknown): value is AstNode =>
    typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';
  const walk = (node: unknown, visit: (n: AstNode) => void): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, visit);
      return;
    }
    if (!isNode(node)) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key !== 'loc') walk(node[key], visit);
    }
  };
  return {
    name: 'strip-testid-props',
    enforce: 'post',
    transform(code, id) {
      if ((id.includes('node_modules') && !id.includes('@openheaders')) || !code.includes('data-testid')) return null;
      const ranges: Array<[number, number]> = [];
      walk(this.parse(code), (node) => {
        // Object LITERALS only — a `'data-testid'` key in a destructuring
        // pattern is a read/exclusion (the runtime shim's own), not an
        // attribute definition.
        if (node.type !== 'ObjectExpression' || !Array.isArray(node.properties)) return;
        for (const property of node.properties) {
          if (!isNode(property) || property.type !== 'Property') continue;
          const key = property.key;
          if (isNode(key) && key.type === 'Literal' && (key as { value?: unknown }).value === 'data-testid') {
            ranges.push([property.start, property.end]);
          }
        }
      });
      if (ranges.length === 0) return null;
      let out = code;
      for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) {
        // Take the following comma (or the preceding one for a last
        // property) so the object literal stays valid.
        let sliceEnd = end;
        let sliceStart = start;
        while (sliceEnd < out.length && /\s/.test(out[sliceEnd])) sliceEnd++;
        if (out[sliceEnd] === ',') {
          sliceEnd++;
        } else {
          let before = start - 1;
          while (before >= 0 && /\s/.test(out[before])) before--;
          if (out[before] === ',') sliceStart = before;
        }
        out = out.slice(0, sliceStart) + out.slice(sliceEnd);
      }
      return { code: out, map: null };
    },
  };
}
/**
 * Bundles the running version's canonical changelog entry
 * (`changelog/desktop/<year>/<version>.md`, CHANGELOG_PLAN.md §4.3) as
 * the `virtual:whats-new` module: frontmatter stripped, relative asset
 * refs rewritten to `whats-new-assets/…` with the files emitted beside
 * the renderer bundle — never fetched at runtime. A version without an
 * entry resolves to the empty string (entry-existence law: bumps from
 * shared-internals rebuilds ship no notes) and the What's New tab
 * affordances stay hidden.
 */
function whatsNewEntryPlugin(): Plugin {
  const entryDir = resolve(__dirname, '../../changelog/desktop', pkgVersion.split('.')[0]);
  const entryPath = resolve(entryDir, `${pkgVersion}.md`);
  const assetsDir = resolve(entryDir, 'assets', pkgVersion);
  const virtualId = 'virtual:whats-new';
  const resolvedVirtualId = `\0${virtualId}`;
  let isBuild = false;
  return {
    name: 'whats-new-entry',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    resolveId(id) {
      return id === virtualId ? resolvedVirtualId : undefined;
    },
    load(id) {
      if (id !== resolvedVirtualId) return undefined;
      let body = '';
      if (existsSync(entryPath)) {
        body = readFileSync(entryPath, 'utf8')
          .replace(/^---\n[\s\S]*?\n---\n/, '')
          .replaceAll(`./assets/${pkgVersion}/`, 'whats-new-assets/')
          .trim();
      }
      if (isBuild && existsSync(assetsDir)) {
        for (const file of readdirSync(assetsDir)) {
          this.emitFile({
            type: 'asset',
            fileName: `whats-new-assets/${file}`,
            source: readFileSync(resolve(assetsDir, file)),
          });
        }
      }
      return `export default ${JSON.stringify(body)};`;
    },
  };
}

/**
 * License-enforcement modules are emitted as their own main-process
 * chunk (`license-core.js`) in every build, so the graph shape never
 * differs between channels; release builds then compile that chunk to
 * V8 bytecode (`scripts/build/compile-license-bytecode.mjs`) and leave
 * a require stub in its place. Matches both source and dist paths of
 * the workspace packages (vite resolves the `import` condition to
 * `src/`, but keep `dist/` covered).
 */
const licenseModulePatterns = [
  /[\\/](?:packages|@openheaders)[\\/]core[\\/](?:src|dist)[\\/]licensing[\\/]/,
  /[\\/](?:packages|@openheaders)[\\/]core[\\/](?:src|dist)[\\/]identity[\\/]daemon-users\.(?:ts|js)/,
  /[\\/](?:packages|@openheaders)[\\/]oracle-host-node[\\/](?:src|dist)[\\/]daemon[\\/]license-(?:slot|refresh-agent)\.(?:ts|js)/,
];
const isLicenseModule = (id: string): boolean => licenseModulePatterns.some((pattern) => pattern.test(id));

const releaseTerserOptions = {
  compress: {
    passes: 2,
    drop_debugger: true,
    // Debug-level console calls compile out; warn/error stay for user
    // bug reports. File diagnostics go through electron-log, untouched.
    pure_funcs: ['console.log', 'console.debug', 'console.info'],
  },
};

export default defineConfig({
  // Main process
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@openheaders/core'],
      }),
      copy({
        targets: [
          {
            src: 'build/linux/install-open-headers.sh',
            dest: 'dist-webpack/main',
          },
        ],
        hook: 'writeBundle',
      }),
    ],
    build: {
      outDir: 'dist-webpack/main',
      lib: {
        // `index` is the app's main-process entry; `script-worker` is
        // the Developer-mode script runtime, forked as a utilityProcess
        // by `src/main/script-sandbox/worker-transport.ts`. Output names
        // follow the entry names, so Electron keeps loading
        // `main/index.js`.
        entry: {
          index: 'src/main.ts',
          'script-worker': 'src/main/script-sandbox/worker/script-worker.ts',
        },
      },
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
          // The bytecode compile step needs a stable filename to find.
          chunkFileNames: (chunk) => (chunk.name === 'license-core' ? 'license-core.js' : '[name]-[hash].js'),
          manualChunks: (id) => (isLicenseModule(id) ? 'license-core' : undefined),
        },
        onwarn(warning, warn) {
          // Suppress mixed static/dynamic import warnings — these are intentional lazy-load patterns
          if (
            warning.message?.includes('dynamically imported by') &&
            warning.message?.includes('but also statically imported by')
          )
            return;
          warn(warning);
        },
      },
      minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
      ...(isReleaseChannel && { terserOptions: releaseTerserOptions }),
      sourcemap: process.env.NODE_ENV !== 'production',
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        chokidar: resolve(__dirname, 'node_modules/chokidar'),
      },
    },
    define: {
      'process.env.RUNNING_IN_PRODUCTION': JSON.stringify(true),
    },
  },

  // Preload script
  preload: {
    plugins: [
      // `electron-log` must be inlined: sandboxed preloads can only
      // `require` electron / events / timers / url, so an externalized
      // `electron-log/preload` would fail to load at runtime.
      externalizeDepsPlugin({
        exclude: ['@openheaders/core', 'electron-log'],
      }),
    ],
    build: {
      outDir: 'dist-webpack/preload',
      lib: {
        // `index` is the workbench windows' bridge; `sandbox` is the
        // minimal IPC ⇄ postMessage bridge for the hidden script-sandbox
        // window. Output names follow the entry names, so the main
        // window keeps loading `preload/index.js`.
        entry: {
          index: 'src/preload.ts',
          sandbox: 'src/preload/sandbox.ts',
        },
      },
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
        },
      },
      minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
      ...(isReleaseChannel && { terserOptions: releaseTerserOptions }),
      sourcemap: process.env.NODE_ENV !== 'production',
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    define: {
      'process.env.RUNNING_IN_PRODUCTION': JSON.stringify(true),
    },
  },

  // Renderer process (React)
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: resolve('dist-webpack/renderer'),
      // Electron loads renderer assets from local disk, not over a network —
      // the default 500KB web-app limit is not meaningful here. The Monaco
      // ts.worker and the main index chunk both sit near 7MB.
      chunkSizeWarningLimit: 8000,
      rollupOptions: {
        // `sandbox.html` is the hidden script-sandbox page — a second,
        // React-free entry whose CSP allows `new Function` for user
        // scripts. It ships beside index.html in the renderer bundle.
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          sandbox: resolve(__dirname, 'src/renderer/sandbox.html'),
        },
        onwarn(warning, warn) {
          if (
            warning.message?.includes('dynamically imported by') &&
            warning.message?.includes('but also statically imported by')
          )
            return;
          // Suppress antd "use client" directive warnings
          if (warning.message?.includes('"use client"') && warning.message?.includes('was ignored')) return;
          warn(warning);
        },
        output: {
          manualChunks:
            process.env.NODE_ENV === 'production'
              ? (id: string) => {
                  if (id.includes('node_modules')) {
                    // Match only actual react/react-dom/scheduler packages,
                    // not paths that contain "react" (e.g. rc-util/es/React/)
                    if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
                      return 'react';
                    }
                    if (id.includes('antd') || id.includes('@ant-design') || id.match(/rc-[^/]+/)) {
                      return 'antd';
                    }
                  }
                  return undefined;
                }
              : undefined,
        },
      },
      minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
      ...(isReleaseChannel && { terserOptions: releaseTerserOptions }),
      sourcemap: process.env.NODE_ENV !== 'production',
    },
    plugins: [
      whatsNewEntryPlugin(),
      ...(isReleaseChannel ? [stripTestIdPropsPlugin()] : []),
      copy({
        targets: [
          {
            src: 'src/renderer/images/*',
            dest: 'dist-webpack/renderer/images',
          },
        ],
        hook: 'writeBundle',
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // Release packages route element creation through the
        // strip-testid shim so e2e selectors never ship; the -actual
        // alias gives the shim the real runtime without self-resolving.
        ...(isReleaseChannel && {
          'react/jsx-runtime-actual': resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
          'react/jsx-runtime': resolve(__dirname, 'src/renderer/bundling/strip-testid-jsx-runtime.ts'),
        }),
        react: resolve(__dirname, 'node_modules/react'),
        'react-dom': resolve(__dirname, 'node_modules/react-dom'),
        scheduler: resolve(__dirname, 'node_modules/scheduler'),
      },
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          math: 'always',
          modifyVars: {
            '@primary-color': '#0071e3',
            '@link-color': '#0071e3',
            '@success-color': '#34c759',
            '@warning-color': '#ff9f0a',
            '@error-color': '#ff3b30',
            '@font-size-base': '14px',
            '@heading-color': '#1d1d1f',
            '@text-color': '#1d1d1f',
            '@text-color-secondary': '#86868b',
            '@disabled-color': '#d2d2d7',
            '@border-radius-base': '6px',
            '@border-color-base': '#d2d2d7',
            '@box-shadow-base': '0 1px 2px rgba(0, 0, 0, 0.08)',
            '@font-family':
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
          },
        },
      },
    },
    define: {
      'process.env.RUNNING_IN_PRODUCTION': JSON.stringify(true),
      __BUILD_INFO__: JSON.stringify(buildInfo),
      // Used by @openheaders/ui's StatusBar / PanelStatusBar. The
      // extension's vite.config.ts injects this from its manifest
      // version; desktop uses its own package.json version (CalVer).
      __APP_VERSION__: JSON.stringify(pkgVersion),
    },
  },
});
