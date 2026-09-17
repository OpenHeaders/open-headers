/**
 * Script-sandbox page build plugin — the served tab's script realm
 * (the Execution Place plan, Phase W). The page cannot be an ordinary
 * Vite HTML entry: it is loaded inside an opaque-origin sandboxed
 * iframe, where a module script (Vite's only HTML output) is fetched
 * with CORS and fails against the daemon's static handler, and where
 * nothing else may load at all (the page ships under
 * `default-src 'none'`). So the plugin esbuild-bundles the realm entry
 * standalone as a classic script and emits `sandbox.html` with that
 * script INLINE — one self-contained document, un-hashed at the
 * bundle root so the tab mounts it by its fixed path
 * (`WEB_SANDBOX_PAGE`). The daemon serves the built page under the
 * sandbox CSP header (`static-web.ts`); the dev server serves the same
 * page under the same header from this plugin, so a dev tab runs
 * scripts too. Runs before the service-worker plugin so the emitted
 * page lands in the precache list.
 */

import * as path from 'node:path';
import { build as esbuildBuild } from 'esbuild';
import type { Plugin } from 'vite';
// A relative path on purpose: Vite bundles the config's relative
// imports with esbuild, while a bare workspace specifier would be left
// to plain Node, which cannot load the package's TypeScript source.
import { WEB_SANDBOX_CSP, WEB_SANDBOX_PAGE } from '../../packages/core/src/scripts/sandbox-page';

const SANDBOX_ENTRY = 'src/sandbox/sandbox.ts';

async function bundleRealm(rootDir: string): Promise<string> {
  const result = await esbuildBuild({
    entryPoints: [path.resolve(rootDir, SANDBOX_ENTRY)],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
  });
  return result.outputFiles[0].text;
}

/** The self-contained page: the realm script inline, nothing referenced. */
function sandboxHtml(script: string): string {
  // An inline script must never contain the closing tag; the realm's
  // source carries none, but the escape costs nothing.
  const inline = script.replace(/<\/script/gi, '<\\/script');
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<title>Open Headers — script sandbox</title>',
    '</head>',
    '<body>',
    `<script>${inline}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export function sandboxPagePlugin(): Plugin {
  let rootDir = '';
  return {
    name: 'openheaders:sandbox-page',
    configResolved(config) {
      rootDir = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestPath = (req.url ?? '').split('?', 1)[0];
        if (requestPath !== `/${WEB_SANDBOX_PAGE}`) {
          next();
          return;
        }
        void bundleRealm(rootDir).then(
          (script) => {
            res.statusCode = 200;
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.setHeader('cache-control', 'no-cache');
            res.setHeader('content-security-policy', WEB_SANDBOX_CSP);
            res.end(sandboxHtml(script));
          },
          (err: unknown) => next(err),
        );
      });
    },
    async generateBundle() {
      const script = await bundleRealm(rootDir);
      this.emitFile({ type: 'asset', fileName: WEB_SANDBOX_PAGE, source: sandboxHtml(script) });
    },
  };
}
