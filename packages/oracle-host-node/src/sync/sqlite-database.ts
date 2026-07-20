/**
 * ABI-aware better-sqlite3 construction — the one seam every
 * database open in this package goes through.
 *
 * The monorepo runs better-sqlite3 under two ABIs at once: Electron
 * (desktop main, and the vitest scripts that run under
 * `ELECTRON_RUN_AS_NODE=1 electron`) and the system Node (daemon,
 * plain vitest). pnpm links a single copy of the package everywhere,
 * so its in-place binary can only ever satisfy one of them. The
 * desktop postinstall (`apps/desktop/scripts/rebuild-native.mjs`)
 * compiles both and stashes each under `<pkg>/prebuilds/`, keyed by
 * NODE_MODULE_VERSION; construction here picks the stash matching the
 * running ABI via better-sqlite3's `nativeBinding` option.
 *
 * Detection keys on `process.versions.modules` — the actual ABI
 * number — not `process.versions.electron`, which `ELECTRON_RUN_AS_NODE`
 * leaves unset despite the Electron ABI applying.
 *
 * When no stash matches (packaged desktop, daemon SEA bundle, a
 * standalone install), construction falls back to the package's
 * default binary, which those builds ship correctly for their own
 * runtime.
 */

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import Database from 'better-sqlite3';

let resolvedBinding: string | null | undefined;

function nativeBindingForCurrentAbi(): string | null {
  if (resolvedBinding === undefined) {
    resolvedBinding = null;
    try {
      const requireFromHere = createRequire(import.meta.url);
      const pkgDir = path.dirname(requireFromHere.resolve('better-sqlite3/package.json'));
      const candidate = path.join(pkgDir, 'prebuilds', `better_sqlite3-abi${process.versions.modules}.node`);
      if (fs.existsSync(candidate)) {
        resolvedBinding = candidate;
      }
    } catch {
      // No resolvable package dir (SEA bundle) — the default binary applies.
    }
  }
  return resolvedBinding;
}

export function openSqliteDatabase(filename: string | Buffer, options?: Database.Options): Database.Database {
  const nativeBinding = nativeBindingForCurrentAbi();
  return nativeBinding === null
    ? new Database(filename, options)
    : new Database(filename, { ...options, nativeBinding });
}
