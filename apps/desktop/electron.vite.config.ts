import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import copy from 'rollup-plugin-copy';

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
  commitFull: git('rev-parse HEAD', '0'.repeat(40)),
  build: Number.parseInt(git('rev-list --count HEAD', '0'), 10) || 0,
  date: new Date().toISOString(),
  channel: 'stable' as const,
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
      sourcemap: process.env.NODE_ENV !== 'production',
    },
    plugins: [
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
