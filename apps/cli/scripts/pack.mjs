/**
 * Stage the npm distribution of the `oh` CLI (the CLI plan §6).
 *
 * The workspace manifest stays `private: true` forever — publishing
 * only ever happens from the staged `dist-package/`, whose generated
 * manifest carries the deliberate-release gate: `prepublishOnly`
 * refuses without OH_RELEASE=1, and access stays restricted so a
 * forced attempt still can't land public by accident.
 *
 * The bundle is fully static (workspace packages included, zero
 * runtime dependencies), so the stage is just the built file plus
 * docs. Verification runs the staged binary under plain `node`:
 * `--version` answers, help renders, and an unreachable daemon exits 3
 * with the honest copy — the exit-code contract observed in the exact
 * artifact that ships. A verified stage is packed into the tarball,
 * which a leak gate restricts to the curated file set.
 *
 * Run via `pnpm --filter @openheaders/cli run pack` (builds first —
 * and it must be `run pack`: bare `pack` is pnpm's built-in, which
 * tarballs the raw workspace sources instead).
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const stageDir = path.join(packageRoot, 'dist-package');
const require = createRequire(path.join(packageRoot, 'package.json'));
const manifest = require('./package.json');

// Port etiquette: off default 8137, desktop mcp.spec 18137, T3 18238,
// daemon pack 18437. Nothing listens here — the probe must fail.
const UNREACHABLE_PORT = 18537;

function fail(message) {
  console.error(`pack: ${message}`);
  process.exit(1);
}

// ── Stage ─────────────────────────────────────────────────────────────

rmSync(stageDir, { recursive: true, force: true });
cpSync(path.join(packageRoot, 'dist'), path.join(stageDir, 'dist'), { recursive: true });
chmodSync(path.join(stageDir, 'dist', 'cli.js'), 0o755);
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
      bin: { oh: './dist/cli.js' },
      files: ['dist'],
      engines: { node: '>=22' },
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
console.log(`pack: staged ${stageDir}`);

// ── Verify: the staged binary honors its contract under plain node ──

function runStaged(args, env) {
  return spawnSync(process.execPath, ['dist/cli.js', ...args], { cwd: stageDir, encoding: 'utf-8', env });
}

const version = runStaged(['--version']);
if (version.status !== 0) fail(`--version exited ${version.status}: ${version.stderr}`);
if (version.stdout.trim() !== manifest.version) {
  fail(`--version printed '${version.stdout.trim()}', manifest says '${manifest.version}'`);
}

const help = runStaged(['--help']);
if (help.status !== 0) fail(`--help exited ${help.status}: ${help.stderr}`);
if (!help.stdout.includes('Usage: oh')) fail('--help output is missing the usage banner');

// Exit-code contract, unreachable class: a clean env (no OH_* overrides,
// an empty config home) probing a dead port must exit 3.
const cleanEnv = { ...process.env, XDG_CONFIG_HOME: mkdtempSync(path.join(os.tmpdir(), 'oh-cli-pack-verify-')) };
delete cleanEnv.OH_DAEMON_URL;
delete cleanEnv.OH_TOKEN;
const unreachable = runStaged(['status', '--daemon', `http://127.0.0.1:${UNREACHABLE_PORT}`], cleanEnv);
rmSync(cleanEnv.XDG_CONFIG_HOME, { recursive: true, force: true });
if (unreachable.status !== 3) fail(`unreachable status probe exited ${unreachable.status}, expected 3`);
if (!unreachable.stderr.includes('no Open Headers daemon reachable')) {
  fail(`unreachable probe is missing the honest copy: ${unreachable.stderr}`);
}

console.log(`pack: verified — version, help, unreachable exit 3 (node ${process.version})`);

// ── Tarball: the npm-publishable artifact (verified stage only) ──────
// `npm pack` honors `files` — dist + README/LICENSE/NOTICE/package.json
// land in the tarball and nothing else ever may.

const packed = spawnSync('npm', ['pack', '--json'], { cwd: stageDir, encoding: 'utf-8' });
if (packed.status !== 0) fail(`npm pack exited ${packed.status}: ${packed.stderr}`);
const [tarball] = JSON.parse(packed.stdout);

// Leak gate: the tarball may contain ONLY the curated set — the built
// bundle plus the manifest/docs files. Source maps and anything
// npm's default includes might sweep in (logs, dotfiles, lockfiles)
// fail the pack outright.
const allowedTop = new Set(['package.json', 'README.md', 'LICENSE', 'NOTICE']);
const contraband = tarball.files
  .map((entry) => entry.path)
  .filter((file) => !(allowedTop.has(file) || (file.startsWith('dist/') && !file.endsWith('.map'))));
if (contraband.length > 0) fail(`tarball contains unexpected files: ${contraband.join(', ')}`);

console.log(`pack: tarball ${path.join(stageDir, tarball.filename)} (${tarball.files.length} files, leak gate clean)`);
