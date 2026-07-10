/**
 * Service-worker build plugin (Phase 6 PWA shell). The worker cannot be
 * an ordinary Vite entry: it must land un-hashed at the bundle root
 * (`/sw.js` — a hashed name would orphan every installed worker), as a
 * classic script (module service workers are still not universal), and
 * it needs the FINAL asset list — which only exists once the main
 * bundle is generated. So the plugin runs at `generateBundle`: collect
 * every emitted file plus the `public/` copies, then esbuild-bundle
 * `src/sw/sw.ts` standalone with the precache list and build-stamp
 * cache key injected as compile-time constants.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { build as esbuildBuild } from 'esbuild';
import type { Plugin } from 'vite';

export interface ServiceWorkerPluginOptions {
  /** Cache name for this build — the version+commit stamp; a new stamp purges older caches. */
  readonly cacheKey: string;
}

const SW_ENTRY = 'src/sw/sw.ts';
const SW_FILE_NAME = 'sw.js';

/** Walk `public/` — Vite copies it verbatim, so its files never appear in the rollup bundle. */
function publicFileUrls(publicDir: string): string[] {
  if (!fs.existsSync(publicDir)) return [];
  const urls: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) urls.push(`/${path.relative(publicDir, full).split(path.sep).join('/')}`);
    }
  };
  walk(publicDir);
  return urls;
}

export function serviceWorkerPlugin(options: ServiceWorkerPluginOptions): Plugin {
  let rootDir = '';
  let publicDir = '';
  return {
    name: 'openheaders:service-worker',
    apply: 'build',
    configResolved(config) {
      rootDir = config.root;
      publicDir = config.publicDir;
    },
    async generateBundle(_outputOptions, bundle) {
      // '/' stands in for index.html — navigations are matched against it.
      const precache = new Set<string>(['/']);
      for (const fileName of Object.keys(bundle)) {
        if (fileName === 'index.html' || fileName === SW_FILE_NAME) continue;
        if (fileName.endsWith('.map')) continue;
        precache.add(`/${fileName}`);
      }
      for (const url of publicFileUrls(publicDir)) precache.add(url);

      const result = await esbuildBuild({
        entryPoints: [path.resolve(rootDir, SW_ENTRY)],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        minify: true,
        define: {
          __OH_SW_CACHE_KEY__: JSON.stringify(options.cacheKey),
          __OH_SW_PRECACHE__: JSON.stringify([...precache].sort()),
        },
      });
      this.emitFile({ type: 'asset', fileName: SW_FILE_NAME, source: result.outputFiles[0].text });
    },
  };
}
