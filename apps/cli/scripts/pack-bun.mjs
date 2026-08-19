/**
 * Build the single-executable `oh` binary with bun (`bun build
 * --compile`) — the client-tier compile target settled in
 * the distribution plan §6. The daemon (`ohd`) stays on the Node SEA
 * idiom; this script exists only for `oh`.
 *
 * bun bundles straight from `src/cli.ts` (workspace TS included via
 * the core package's `import` export condition), minifies, embeds JSC
 * bytecode for startup, and emits one self-contained binary. The
 * source stays runtime-neutral — bun is a build target here, not a
 * dependency; reverting to Node SEA is `pack:sea`, unchanged.
 *
 * Verification replicates the pack.mjs/pack-sea.mjs probe set against
 * the binary itself: `--version` answers the manifest version, help
 * renders, and an unreachable daemon under a clean env exits 3 with
 * the honest copy — the exit-code contract observed in the exact
 * artifact that ships.
 *
 * Run via `pnpm --filter @openheaders/cli run pack:bun`. One binary
 * per platform/arch — run on the machine you target.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(packageRoot, 'dist-bun');
const require = createRequire(path.join(packageRoot, 'package.json'));
const manifest = require('./package.json');

// Port etiquette: off default 8137, desktop mcp.spec 18137, T3 18238,
// daemon pack 18437, plain pack verify + daemon pack-sea 18537,
// pack-sea 18637. Nothing listens here — the probe must fail.
const UNREACHABLE_PORT = 18737;

function fail(message) {
  console.error(`pack-bun: ${message}`);
  process.exit(1);
}

const bunProbe = spawnSync('bun', ['--version'], { encoding: 'utf-8' });
if (bunProbe.error || bunProbe.status !== 0) {
  fail('bun is not on PATH — install bun (https://bun.sh) to build the compiled `oh` binary');
}
const bunVersion = bunProbe.stdout.trim();

// ── Compile ──────────────────────────────────────────────────────────

// Mirrors src/bundling/changelog-entry.ts (the vite configs' define
// source) — node can't import the TS module here; keep in lockstep.
const entryVersion = manifest.version.replace(/-beta\.\d+$/, '');
const entryPath = path.join(
  packageRoot,
  '..',
  '..',
  'changelog',
  'cli',
  entryVersion.split('.')[0] ?? '',
  `${entryVersion}.md`,
);
const changelogEntry = existsSync(entryPath)
  ? readFileSync(entryPath, 'utf8')
      .replace(/^---\n[\s\S]*?\n---\n/, '')
      .replaceAll('](./assets/', '](https://updates.openheaders.com/changelog/assets/cli/')
      .trim()
  : '';

const binaryPath = path.join(outDir, process.platform === 'win32' ? 'oh.exe' : 'oh');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// --minify: the binary is what `strings` surfaces — same hardening
// budget as the terser'd SEA bundle. --bytecode: JSC bytecode embedded
// at build time — the startup win the bun target exists for, and the
// bundled source ships as bytecode instead of text.
const build = spawnSync(
  'bun',
  [
    'build',
    '--compile',
    '--minify',
    '--bytecode',
    '--define',
    `__CLI_VERSION__=${JSON.stringify(manifest.version)}`,
    '--define',
    `__CLI_CHANGELOG__=${JSON.stringify(changelogEntry)}`,
    '--outfile',
    binaryPath,
    path.join('src', 'cli.ts'),
  ],
  { cwd: packageRoot, stdio: 'inherit' },
);
if (build.status !== 0) fail(`bun build exited ${build.status}`);
if (!existsSync(binaryPath)) fail(`bun build produced no binary at ${binaryPath}`);

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
const cleanEnv = { ...process.env, XDG_CONFIG_HOME: mkdtempSync(path.join(os.tmpdir(), 'oh-bun-verify-')) };
delete cleanEnv.OH_DAEMON_URL;
delete cleanEnv.OH_TOKEN;
const unreachable = runBinary(['status', '--daemon', `http://127.0.0.1:${UNREACHABLE_PORT}`], cleanEnv);
rmSync(cleanEnv.XDG_CONFIG_HOME, { recursive: true, force: true });
if (unreachable.status !== 3) fail(`unreachable status probe exited ${unreachable.status}, expected 3`);
if (!unreachable.stderr.includes('no Open Headers daemon reachable')) {
  fail(`unreachable probe is missing the honest copy: ${unreachable.stderr}`);
}

const changelog = runBinary(['changelog']);
if (changelog.status !== 0) fail(`changelog exited ${changelog.status}: ${changelog.stderr}`);
if (changelogEntry !== '' && !changelog.stdout.includes(' — release notes')) {
  fail('changelog probe: an entry exists but the binary printed the no-notes fallback');
}
if (changelogEntry === '' && !changelog.stdout.includes('no release notes')) {
  fail('changelog probe: no entry exists but the binary printed notes');
}

const sizeMb = (statSync(binaryPath).size / (1024 * 1024)).toFixed(1);
console.log('pack-bun: verified — version, help, unreachable exit 3, changelog embed');
console.log(`pack-bun: binary ${binaryPath} (${sizeMb} MB, ${process.platform}-${process.arch}, bun ${bunVersion})`);
