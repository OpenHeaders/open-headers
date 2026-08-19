/**
 * Stage the plain-Node distribution (the daemon plan §6 channels).
 *
 * The monorepo's better-sqlite3 is compiled for Electron's ABI and
 * must stay that way (desktop dev depends on it), so the distribution
 * gets its own copy: this script stages `dist-package/` with the built
 * bundles and a standalone manifest, runs `npm install` there — the
 * system Node resolves the prebuilt binding for ITS ABI (or falls back
 * to node-gyp) — then verifies the result boots headless under plain
 * `node`: /healthz answers, `ohd status` sees it, SIGTERM exits 0.
 * A verified stage is finally packed into the npm-publishable tarball.
 *
 * Run via `pnpm --filter @openheaders/daemon pack` (builds first).
 */

import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
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
// Web bundle (Phase 4a) — loose coupling: staged into dist/web when the
// web app has been built (`files: ['dist']` keeps the tarball whitelist
// intact), skipped otherwise. The daemon serves it when present.
const webDist = path.join(repoRoot, 'apps', 'web', 'dist');
const webStaged = existsSync(path.join(webDist, 'index.html'));
if (webStaged) cpSync(webDist, path.join(stageDir, 'dist', 'web'), { recursive: true });
else console.log('pack: apps/web/dist not built — staging without the web ui');
// HTTP/3 helper — stage every per-target build present under the
// crate's dist (`scripts/build-h3-helper.mjs` output); the daemon
// resolves the running platform's dir at the first `'3'` send, and a
// platform whose dir wasn't staged keeps the honest not-bundled
// failure. Loose coupling like the web bundle: no builds, no helper.
const helperDist = path.join(repoRoot, 'native', 'h3-helper', 'dist');
const helperTargets = existsSync(helperDist)
  ? readdirSync(helperDist, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : [];
if (helperTargets.length > 0) {
  for (const target of helperTargets) {
    cpSync(path.join(helperDist, target), path.join(stageDir, 'dist', 'h3-helper', target), { recursive: true });
  }
  console.log(`pack: staged HTTP/3 helper targets ${helperTargets.join(' ')}`);
} else {
  console.log('pack: native/h3-helper/dist not built — staging without the HTTP/3 helper');
}
cpSync(path.join(packageRoot, 'README.md'), path.join(stageDir, 'README.md'));
cpSync(path.join(repoRoot, 'LICENSE'), path.join(stageDir, 'LICENSE'));
cpSync(path.join(repoRoot, 'NOTICE'), path.join(stageDir, 'NOTICE'));
writeFileSync(
  path.join(stageDir, 'package.json'),
  `${JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      license: 'Apache-2.0',
      homepage: 'https://openheaders.com',
      type: 'module',
      bin: { ohd: './dist/cli.js' },
      files: ['dist'],
      engines: { node: '>=22' },
      dependencies: { 'better-sqlite3': sqliteVersion },
      // Publish gates: a release is a deliberate act. `prepublishOnly`
      // refuses without OH_RELEASE=1, and access stays restricted so a
      // forced attempt still can't land public by accident.
      publishConfig: { access: 'restricted' },
      scripts: {
        prepublishOnly:
          'node -e "if(process.env.OH_RELEASE!==\'1\'){console.error(\'refusing to publish: set OH_RELEASE=1 for a deliberate release\');process.exit(1)}"',
      },
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

if (webStaged) {
  const index = await fetch(`http://127.0.0.1:${VERIFY_PORT}/`, { signal: AbortSignal.timeout(1000) });
  if (index.status !== 200 || !(index.headers.get('content-type') ?? '').includes('text/html')) {
    daemon.kill('SIGKILL');
    fail(`staged web ui not served: / answered ${index.status} ${index.headers.get('content-type')}`);
  }
}

const status = spawnSync(process.execPath, ['dist/cli.js', 'status', '--bind-port', String(VERIFY_PORT)], {
  cwd: stageDir,
  encoding: 'utf-8',
});
if (status.status !== 0) fail(`ohd status exited ${status.status}: ${status.stderr}`);

daemon.kill('SIGTERM');
const exitCode = await daemonExited;
rmSync(dataDir, { recursive: true, force: true });
if (exitCode !== 0) {
  console.error(daemonLog.join(''));
  fail(`daemon exited ${exitCode} on SIGTERM`);
}

console.log(`pack: verified — /healthz 200, status OK, SIGTERM exit 0 (node ${process.version})`);

// ── Tarball: the npm-publishable artifact (verified stage only) ──────
// `npm pack` honors `files` — dist + README/LICENSE/NOTICE/package.json
// land in the tarball; the stage's own node_modules never does. The end
// user's `npm install` resolves better-sqlite3 for THEIR machine.

const packed = spawnSync('npm', ['pack', '--json'], { cwd: stageDir, encoding: 'utf-8' });
if (packed.status !== 0) fail(`npm pack exited ${packed.status}: ${packed.stderr}`);
const [tarball] = JSON.parse(packed.stdout);

// Leak gate: the tarball may contain ONLY the curated set — the built
// bundles plus the manifest/docs files. Source maps and anything
// npm's default includes might sweep in (logs, dotfiles, lockfiles)
// fail the pack outright.
const allowedTop = new Set(['package.json', 'README.md', 'LICENSE', 'NOTICE']);
const contraband = tarball.files
  .map((entry) => entry.path)
  .filter((file) => !(allowedTop.has(file) || (file.startsWith('dist/') && !file.endsWith('.map'))));
if (contraband.length > 0) fail(`tarball contains unexpected files: ${contraband.join(', ')}`);

console.log(`pack: distribution ready at ${stageDir}`);
console.log(`pack: tarball ${path.join(stageDir, tarball.filename)} (${tarball.files.length} files, leak gate clean)`);
