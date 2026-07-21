/**
 * Postinstall native-addon rebuild — one better-sqlite3 binary per
 * runtime ABI, so Electron and Node consumers stop fighting over the
 * single copy pnpm links into every workspace package.
 *
 * The monorepo runs better-sqlite3 under two ABIs at once: desktop
 * (and the desktop/oracle-host-node vitest scripts, which run under
 * `ELECTRON_RUN_AS_NODE=1 electron`) needs Electron's ABI, while the
 * daemon and any plain `vitest` invocation need the system Node ABI.
 * A bare `electron-rebuild` recompiles the shared copy in place,
 * breaking whichever side rebuilt last.
 *
 * Sequence:
 *   1. `electron-rebuild` better-sqlite3 + node-pty from source, as
 *      before. node-pty has only Electron consumers, so its in-place
 *      binary stays Electron-ABI.
 *   2. Stash the Electron-ABI better_sqlite3.node into the package's
 *      `prebuilds/` dir, keyed by Electron's NODE_MODULE_VERSION.
 *   3. Restore the system-Node binary in place (prebuild-install
 *      download, node-gyp fallback) and stash it under Node's ABI too.
 *
 * `openSqliteDatabase` (oracle-host-node) picks the stash matching
 * `process.versions.modules` at construction time and falls back to
 * the default binary — which after this script is always Node-ABI, so
 * direct better-sqlite3 imports keep working everywhere Node runs.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopRequire = createRequire(path.join(desktopDir, 'noop.js'));

const sqlitePkgDir = path.dirname(desktopRequire.resolve('better-sqlite3/package.json'));
const builtBinary = path.join(sqlitePkgDir, 'build', 'Release', 'better_sqlite3.node');
const prebuildsDir = path.join(sqlitePkgDir, 'prebuilds');

// Resolve through the package's REALPATH: the symlinked path's walk-up
// chain misses pnpm's hidden hoist dir (`node_modules/.pnpm/node_modules`),
// so on a store without a root-hoisted node-gyp the literal path can't
// see @electron/rebuild's own dependency.
const electronRebuildCli = fs.realpathSync(
  path.join(desktopDir, 'node_modules', '@electron', 'rebuild', 'lib', 'cli.js'),
);
const nodeGypCli = createRequire(electronRebuildCli).resolve('node-gyp/bin/node-gyp.js');
const prebuildInstallCli = createRequire(path.join(sqlitePkgDir, 'noop.js')).resolve('prebuild-install/bin.js');
const electronBinary = desktopRequire('electron');

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} exited with status ${result.status}`);
}

function stash(abi) {
  fs.mkdirSync(prebuildsDir, { recursive: true });
  fs.copyFileSync(builtBinary, path.join(prebuildsDir, `better_sqlite3-abi${abi}.node`));
}

run(
  'electron-rebuild',
  process.execPath,
  [electronRebuildCli, '-f', '-o', 'better-sqlite3,node-pty', '--build-from-source'],
  { cwd: desktopDir },
);

const abiProbe = spawnSync(electronBinary, ['-p', 'process.versions.modules'], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  encoding: 'utf8',
});
const electronAbi = abiProbe.stdout?.trim();
if (abiProbe.status !== 0 || !electronAbi) throw new Error('failed to probe Electron ABI');
stash(electronAbi);

const restored = spawnSync(process.execPath, [prebuildInstallCli], { cwd: sqlitePkgDir, stdio: 'inherit' });
if (restored.status !== 0) {
  run('node-gyp rebuild', process.execPath, [nodeGypCli, 'rebuild', '--release'], { cwd: sqlitePkgDir });
}
stash(process.versions.modules);

console.log(`better-sqlite3: node ABI ${process.versions.modules} in place, electron ABI ${electronAbi} stashed`);
