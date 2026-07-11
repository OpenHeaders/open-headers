/**
 * Build the single-executable ohd binary (DAEMON_PLAN.md §8) from the
 * SEA bundle (`vite.config.sea.ts` → `dist-sea/ohd.cjs`).
 *
 * A native addon cannot run from inside the SEA blob, so the script
 * stages better-sqlite3 for the system Node's ABI (own `npm install`,
 * exactly like `pack.mjs` — the monorepo copy is Electron-ABI) and
 * embeds the pruned package tree as SEA assets, together with the
 * built web app when present. The binary unpacks them on first use
 * (`src/sea/payload.ts`). The result is verified end-to-end before
 * the script reports success: the binary boots headless, /healthz
 * answers (which proves the unpacked addon loaded — the spine opens
 * oracle.db during boot), the status probe sees it, and SIGTERM
 * exits 0.
 *
 * Run via `pnpm --filter @openheaders/daemon pack:sea` (builds first).
 * One binary per platform/arch — run on the machine you target.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const outDir = path.join(packageRoot, 'dist-sea');
const require = createRequire(path.join(packageRoot, 'package.json'));
const manifest = require('./package.json');
const sqliteVersion = require('better-sqlite3/package.json').version;

// Port etiquette: off default 8137, plain pack verify 18437.
const VERIFY_PORT = 18537;
const SEA_SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

function fail(message) {
  console.error(`pack-sea: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited ${result.status}`);
}

if (process.platform !== 'darwin' && process.platform !== 'linux') {
  fail(`SEA packing supports darwin/linux; ${process.platform} is not a packaged target`);
}
if (!existsSync(path.join(outDir, 'ohd.cjs'))) {
  fail('dist-sea/ohd.cjs missing — run via `pnpm --filter @openheaders/daemon pack:sea`');
}

// ── Stage better-sqlite3 for the system Node's ABI ────────────────────

const stageDir = path.join(outDir, 'native-stage');
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
writeFileSync(
  path.join(stageDir, 'package.json'),
  `${JSON.stringify({ name: 'oh-sea-native-stage', private: true, dependencies: { 'better-sqlite3': sqliteVersion } })}\n`,
);
run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: stageDir });

// ── Collect payload files ─────────────────────────────────────────────

/** Every file under dir, as `/`-separated paths relative to it. */
function walk(dir, prefix = '') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

/**
 * The runtime slice of the staged install. better-sqlite3 resolves its
 * addon via `require('bindings')('better_sqlite3.node')`, so the
 * payload needs the package manifest + lib JS + compiled addon, plus
 * the two packages on that require chain (`prebuild-install` and the
 * rest of the tree are install-time only).
 */
function nativePayloadFiles() {
  const stageModules = path.join(stageDir, 'node_modules');
  const addon = path.join(stageModules, 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  if (!existsSync(addon)) fail('staged install has no build/Release/better_sqlite3.node');
  const files = ['node_modules/better-sqlite3/package.json', 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'];
  for (const rel of walk(path.join(stageModules, 'better-sqlite3', 'lib'))) {
    files.push(`node_modules/better-sqlite3/lib/${rel}`);
  }
  for (const dep of ['bindings', 'file-uri-to-path']) {
    if (!existsSync(path.join(stageModules, dep))) fail(`staged install misses ${dep}`);
    for (const rel of walk(path.join(stageModules, dep))) {
      files.push(`node_modules/${dep}/${rel}`);
    }
  }
  return files.map((rel) => ({ rel, abs: path.join(stageDir, ...rel.split('/')) }));
}

const webDist = path.join(repoRoot, 'apps', 'web', 'dist');
const webStaged = existsSync(path.join(webDist, 'index.html'));
if (!webStaged) console.log('pack-sea: apps/web/dist not built — packing without the web ui');
const webFiles = webStaged ? walk(webDist).map((rel) => ({ rel, abs: path.join(webDist, ...rel.split('/')) })) : [];
const nativeFiles = nativePayloadFiles();

// ── Manifest + SEA config ─────────────────────────────────────────────

function gitShortCommit() {
  const result = spawnSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: packageRoot, encoding: 'utf-8' });
  return result.status === 0 ? result.stdout.trim() : '0000000';
}

function fileEntry({ rel, abs }) {
  const bytes = readFileSync(abs);
  return { path: rel, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength };
}

const payloadManifest = {
  buildKey: `${manifest.version}-${gitShortCommit()}`,
  kinds: {
    native: nativeFiles.map(fileEntry),
    ...(webStaged ? { web: webFiles.map(fileEntry) } : {}),
  },
};
writeFileSync(path.join(outDir, 'oh-payload.json'), `${JSON.stringify(payloadManifest)}\n`);

const assets = { 'oh-payload.json': path.join(outDir, 'oh-payload.json') };
for (const file of nativeFiles) assets[`payload/native/${file.rel}`] = file.abs;
for (const file of webFiles) assets[`payload/web/${file.rel}`] = file.abs;

writeFileSync(
  path.join(outDir, 'sea-config.json'),
  `${JSON.stringify(
    {
      main: path.join(outDir, 'ohd.cjs'),
      output: path.join(outDir, 'ohd.blob'),
      disableExperimentalSEAWarning: true,
      assets,
    },
    null,
    2,
  )}\n`,
);

// ── Blob generation + injection ───────────────────────────────────────

run(process.execPath, ['--experimental-sea-config', path.join(outDir, 'sea-config.json')], { cwd: packageRoot });

const binaryPath = path.join(outDir, 'ohd');
rmSync(binaryPath, { force: true });
copyFileSync(process.execPath, binaryPath);
chmodSync(binaryPath, 0o755);
if (process.platform === 'darwin') {
  run('codesign', ['--remove-signature', binaryPath]);
}
run('pnpm', [
  'exec',
  'postject',
  binaryPath,
  'NODE_SEA_BLOB',
  path.join(outDir, 'ohd.blob'),
  '--sentinel-fuse',
  SEA_SENTINEL_FUSE,
  ...(process.platform === 'darwin' ? ['--macho-segment-name', 'NODE_SEA'] : []),
], { cwd: packageRoot });
if (process.platform === 'darwin') {
  run('codesign', ['--sign', '-', binaryPath]);
}

// ── Verify: boots, /healthz answers, addon unpacked, clean SIGTERM ───

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'oh-sea-verify-data-'));
const unpackDir = mkdtempSync(path.join(os.tmpdir(), 'oh-sea-verify-unpack-'));
const verifyEnv = { ...process.env, OH_DAEMON_UNPACK_DIR: unpackDir };

const version = spawnSync(binaryPath, ['--version'], { encoding: 'utf-8', env: verifyEnv });
if (version.status !== 0 || !version.stdout.includes(manifest.version)) {
  fail(`ohd --version answered '${version.stdout.trim()}' (exit ${version.status})`);
}

const daemon = spawn(
  binaryPath,
  ['run', '--data-dir', dataDir, '--bind-address', '127.0.0.1', '--bind-port', String(VERIFY_PORT)],
  { stdio: ['ignore', 'pipe', 'pipe'], env: verifyEnv },
);
const daemonLog = [];
daemon.stdout.on('data', (chunk) => daemonLog.push(chunk.toString()));
daemon.stderr.on('data', (chunk) => daemonLog.push(chunk.toString()));
const daemonExited = new Promise((resolve) => daemon.once('exit', (code) => resolve(code)));

let healthy = false;
for (let attempt = 0; attempt < 60 && !healthy; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    const res = await fetch(`http://127.0.0.1:${VERIFY_PORT}/healthz`, { signal: AbortSignal.timeout(1000) });
    healthy = res.status === 200;
  } catch {
    // not up yet
  }
}
if (!healthy) {
  daemon.kill('SIGKILL');
  console.error(daemonLog.join(''));
  fail('daemon never answered /healthz from the SEA binary');
}

const unpackedAddon = path.join(
  unpackDir,
  payloadManifest.buildKey,
  'native',
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node',
);
if (!existsSync(unpackedAddon)) {
  daemon.kill('SIGKILL');
  fail('native payload was not unpacked where the manifest says');
}

if (webStaged) {
  const index = await fetch(`http://127.0.0.1:${VERIFY_PORT}/`, { signal: AbortSignal.timeout(1000) });
  if (index.status !== 200 || !(index.headers.get('content-type') ?? '').includes('text/html')) {
    daemon.kill('SIGKILL');
    fail(`embedded web ui not served: / answered ${index.status} ${index.headers.get('content-type')}`);
  }
}

const status = spawnSync(binaryPath, ['status', '--bind-port', String(VERIFY_PORT)], {
  encoding: 'utf-8',
  env: verifyEnv,
});
if (status.status !== 0) fail(`ohd status exited ${status.status}: ${status.stderr}`);

daemon.kill('SIGTERM');
const exitCode = await daemonExited;
rmSync(dataDir, { recursive: true, force: true });
rmSync(unpackDir, { recursive: true, force: true });
if (exitCode !== 0) {
  console.error(daemonLog.join(''));
  fail(`daemon exited ${exitCode} on SIGTERM`);
}

const sizeMb = (statSync(binaryPath).size / (1024 * 1024)).toFixed(1);
console.log(`pack-sea: verified — --version, /healthz 200, addon unpacked, status OK, SIGTERM exit 0`);
console.log(`pack-sea: binary ${binaryPath} (${sizeMb} MB, ${process.platform}-${process.arch}, node ${process.version})`);
