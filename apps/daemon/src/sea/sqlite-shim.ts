/**
 * better-sqlite3 stand-in for the SEA bundle — `vite.config.sea.ts`
 * aliases the `better-sqlite3` specifier here, so every construction
 * site in the bundle lands on this lazy loader instead of a require
 * the blob could never satisfy (SEA's own `require` reaches builtins
 * only, and a native addon must load from disk regardless).
 *
 * On first construction the embedded `native` payload is unpacked
 * (see `payload.ts`) and the real package is loaded through a
 * filesystem `createRequire` anchored inside the unpacked tree — the
 * documented escape hatch for native addons in single-executable
 * builds. Laziness matters twice over: sqlite-free commands
 * (`ohd status`, `show-token`) never unpack anything, and the CLI
 * keeps loading even if the unpack target is unwritable.
 *
 * Construction is the only value-level use in the codebase (every
 * `Database.Statement` etc. is a type position), so a plain function
 * returning the real instance covers the whole surface.
 */

import { createRequire } from 'node:module';
import * as path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';
import { ensureSeaPayload } from './payload';

type DatabaseConstructor = typeof BetterSqlite3;

let realDatabase: DatabaseConstructor | null = null;

function loadDatabase(): DatabaseConstructor {
  if (realDatabase === null) {
    const nativeDir = ensureSeaPayload('native');
    if (nativeDir === null) {
      throw new Error('this build carries no native sqlite payload — better-sqlite3 is unavailable');
    }
    const requireFromPayload = createRequire(path.join(nativeDir, 'noop.js'));
    realDatabase = requireFromPayload('better-sqlite3') as DatabaseConstructor;
  }
  return realDatabase;
}

export default function Database(filename?: string | Buffer, options?: BetterSqlite3.Options): BetterSqlite3.Database {
  return new (loadDatabase())(filename, options);
}
