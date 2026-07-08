/**
 * Stage the plain-Node distribution (DAEMON_PLAN.md §6 channels).
 *
 * The monorepo's better-sqlite3 is compiled for Electron's ABI and
 * must stay that way (desktop dev depends on it), so the distribution
 * gets its own copy: this script stages `dist-package/` with the built
 * bundles and a standalone manifest, runs `npm install` there — the
 * system Node resolves the prebuilt binding for ITS ABI (or falls back
 * to node-gyp) — then verifies the result boots headless under plain
 * `node`: /healthz answers, `oh daemon status` sees it, SIGTERM exits 0.
 *
 * Run via `pnpm --filter @openheaders/daemon pack` (builds first).
 */

import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stageDir = path.join(packageRoot, 'dist-package');
const require = createRequire(path.join(packageRoot, 'package.json'));
const manifest = require('./package.json');
const sqliteVersion = require('better-sqlite3/package.json').version;

// Port etiquette: off default 8137, desktop mcp.spec 18137, T3 18238.
const VERIFY_PORT = 18437;

function fail(message) {
  console.error(`pack: ${message}`);
  process.exit(1);
}

// ── Stage ─────────────────────────────────────────────────────────────

rmSync(stageDir, { recursive: true, force: true });
cpSync(path.join(packageRoot, 'dist'), path.join(stageDir, 'dist'), { recursive: true });
chmodSync(path.join(stageDir, 'dist', 'cli.js'), 0o755);
writeFileSync(
  path.join(stageDir, 'package.json'),
  `${JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      type: 'module',
      bin: { oh: './dist/cli.js' },
      engines: { node: '>=22' },
      dependencies: { 'better-sqlite3': sqliteVersion },
    },
    null,
    2,
  )}\n`,
);
console.log(`pack: staged ${stageDir} (better-sqlite3 ${sqliteVersion})`);

// ── Install the native module for the system Node's ABI ──────────────

const install = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
  cwd: stageDir,
  stdio: 'inherit',
});
if (install.status !== 0) fail(`npm install exited ${install.status}`);

// ── Verify: boots under plain node, /healthz answers, clean SIGTERM ──

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'oh-daemon-pack-verify-'));
const daemon = spawn(
  process.execPath,
  ['dist/main.js', '--data-dir', dataDir, '--bind-address', '127.0.0.1', '--bind-port', String(VERIFY_PORT)],
  { cwd: stageDir, stdio: ['ignore', 'pipe', 'pipe'] },
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
  fail('daemon never answered /healthz under the system node');
}

const status = spawnSync(process.execPath, ['dist/cli.js', 'daemon', 'status', '--bind-port', String(VERIFY_PORT)], {
  cwd: stageDir,
  encoding: 'utf-8',
});
if (status.status !== 0) fail(`oh daemon status exited ${status.status}: ${status.stderr}`);

daemon.kill('SIGTERM');
const exitCode = await daemonExited;
rmSync(dataDir, { recursive: true, force: true });
if (exitCode !== 0) {
  console.error(daemonLog.join(''));
  fail(`daemon exited ${exitCode} on SIGTERM`);
}

console.log(`pack: verified — /healthz 200, status OK, SIGTERM exit 0 (node ${process.version})`);
console.log(`pack: distribution ready at ${stageDir}`);
