/**
 * Script-sandbox document plugin — the served tab's script realm (the
 * Execution Place plan, Phase W) as a virtual module. The realm cannot
 * be an ordinary Vite HTML entry: it runs inside an opaque-origin
 * sandboxed iframe where a module script is fetched with CORS and
 * nothing else may load at all. And it cannot be a served page either:
 * Chromium routes no opaque-origin frame's navigation through the
 * service worker, so a served page is unreachable from an offline tab
 * (the epic's F23). So the plugin esbuild-bundles the realm entry
 * standalone as a classic script and answers
 * `virtual:openheaders-script-sandbox` with core's self-contained
 * document (the script inline, the policy as a meta tag) as a string;
 * the tab mounts it as the iframe's `srcdoc`. Dev and build share the
 * one `load`, so a dev tab runs scripts too.
 */

import * as path from 'node:path';
import { build as esbuildBuild } from 'esbuild';
import type { Plugin } from 'vite';
// A relative path on purpose: Vite bundles the config's relative
// imports with esbuild, while a bare workspace specifier would be left
// to plain Node, which cannot load the package's TypeScript source.
import { scriptSandboxDocument } from '../../packages/core/src/scripts/sandbox-document';

export const SCRIPT_SANDBOX_MODULE_ID = 'virtual:openheaders-script-sandbox';
const RESOLVED_ID = `\0${SCRIPT_SANDBOX_MODULE_ID}`;
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

export function sandboxDocumentPlugin(): Plugin {
  let rootDir = '';
  return {
    name: 'openheaders:sandbox-document',
    configResolved(config) {
      rootDir = config.root;
    },
    resolveId(id) {
      return id === SCRIPT_SANDBOX_MODULE_ID ? RESOLVED_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null;
      const script = await bundleRealm(rootDir);
      return `export default ${JSON.stringify(scriptSandboxDocument(script))};`;
    },
  };
}
