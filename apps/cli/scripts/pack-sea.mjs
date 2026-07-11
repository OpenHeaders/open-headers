/**
 * Build the single-executable `oh` binary from the SEA bundle
 * (`vite.config.sea.ts` → `dist-sea/oh.cjs`).
 *
 * The daemon's pack-sea idiom, minus what `oh` doesn't need: no native
 * addon staging, no payload manifest, no unpack-at-first-run — the
 * blob is the whole distribution, so the script is config → blob →
 * postject → verify. postject is resolved from the daemon package
 * (the one place it's declared) rather than declared again here.
 *
 * Verification replicates `pack.mjs`'s probe set against the binary
 * itself: `--version` answers the manifest version, help renders, and
 * an unreachable daemon under a clean env exits 3 with the honest
 * copy — the exit-code contract observed in the exact artifact that
 * ships.
 *
 * Run via `pnpm --filter @openheaders/cli run pack:sea` (builds first).
 * One binary per platform/arch — run on the machine you target.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const outDir = path.join(packageRoot, 'dist-sea');
const require = createRequire(path.join(packageRoot, 'package.json'));
const manifest = require('./package.json');
const daemonRequire = createRequire(path.join(repoRoot, 'apps', 'daemon', 'package.json'));
const postjectCli = daemonRequire.resolve('postject/dist/cli.js');

// Port etiquette: off default 8137, desktop mcp.spec 18137, T3 18238,
// daemon pack 18437, plain pack verify + daemon pack-sea 18537.
// Nothing listens here — the probe must fail.
const UNREACHABLE_PORT = 18637;
const SEA_SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

function fail(message) {
  console.error(`pack-sea: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited ${result.status}`);
}

if (!existsSync(path.join(outDir, 'oh.cjs'))) {
  fail('dist-sea/oh.cjs missing — run via `pnpm --filter @openheaders/cli run pack:sea`');
}

// ── SEA config + blob + injection ─────────────────────────────────────

writeFileSync(
  path.join(outDir, 'sea-config.json'),
  `${JSON.stringify(
    {
      main: path.join(outDir, 'oh.cjs'),
      output: path.join(outDir, 'oh.blob'),
      disableExperimentalSEAWarning: true,
    },
    null,
    2,
  )}\n`,
);

run(process.execPath, ['--experimental-sea-config', path.join(outDir, 'sea-config.json')], { cwd: packageRoot });

const binaryPath = path.join(outDir, process.platform === 'win32' ? 'oh.exe' : 'oh');
rmSync(binaryPath, { force: true });
copyFileSync(process.execPath, binaryPath);
chmodSync(binaryPath, 0o755);
if (process.platform === 'darwin') {
  run('codesign', ['--remove-signature', binaryPath]);
}
run(process.execPath, [
  postjectCli,
  binaryPath,
  'NODE_SEA_BLOB',
  path.join(outDir, 'oh.blob'),
  '--sentinel-fuse',
  SEA_SENTINEL_FUSE,
  ...(process.platform === 'darwin' ? ['--macho-segment-name', 'NODE_SEA'] : []),
], { cwd: packageRoot });
if (process.platform === 'darwin') {
  run('codesign', ['--sign', '-', binaryPath]);
}

// ── Verify: the binary honors its contract (pack.mjs's probe set) ────

function runBinary(args, env) {
  return spawnSync(binaryPath, args, { encoding: 'utf-8', env });
}

const version = runBinary(['--version']);
if (version.status !== 0) fail(`--version exited ${version.status}: ${version.stderr}`);
if (version.stdout.trim() !== manifest.version) {
  fail(`--version printed '${version.stdout.trim()}', manifest says '${manifest.version}'`);
}

const help = runBinary(['--help']);
if (help.status !== 0) fail(`--help exited ${help.status}: ${help.stderr}`);
if (!help.stdout.includes('Usage: oh')) fail('--help output is missing the usage banner');

// Exit-code contract, unreachable class: a clean env (no OH_* overrides,
// an empty config home) probing a dead port must exit 3.
const cleanEnv = { ...process.env, XDG_CONFIG_HOME: mkdtempSync(path.join(os.tmpdir(), 'oh-sea-verify-')) };
delete cleanEnv.OH_DAEMON_URL;
delete cleanEnv.OH_TOKEN;
const unreachable = runBinary(['status', '--daemon', `http://127.0.0.1:${UNREACHABLE_PORT}`], cleanEnv);
rmSync(cleanEnv.XDG_CONFIG_HOME, { recursive: true, force: true });
if (unreachable.status !== 3) fail(`unreachable status probe exited ${unreachable.status}, expected 3`);
if (!unreachable.stderr.includes('no Open Headers daemon reachable')) {
  fail(`unreachable probe is missing the honest copy: ${unreachable.stderr}`);
}

const sizeMb = (statSync(binaryPath).size / (1024 * 1024)).toFixed(1);
console.log('pack-sea: verified — version, help, unreachable exit 3');
console.log(`pack-sea: binary ${binaryPath} (${sizeMb} MB, ${process.platform}-${process.arch}, node ${process.version})`);
