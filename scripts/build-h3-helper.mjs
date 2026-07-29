/**
 * Build + stage the HTTP/3 helper (`native/h3-helper`) for one or more
 * of the five distribution-matrix targets, into
 * `native/h3-helper/dist/<target>/oh-h3-helper[.exe]` — the layout the
 * desktop afterPack hook, the daemon pack scripts, and the dev-tree
 * runtime candidates all read.
 *
 *   node scripts/build-h3-helper.mjs                 # host target only
 *   node scripts/build-h3-helper.mjs --platform-all  # every matrix target this OS can build
 *   node scripts/build-h3-helper.mjs mac-x64 …       # explicit targets
 *
 * Cross legs the release matrix relies on: the mac (arm64) runner adds
 * the x86_64-apple-darwin target; the linux (x64) runner adds
 * aarch64-unknown-linux-gnu with the `gcc-aarch64-linux-gnu` cross
 * linker (apt). `rustup target add` is run per build and is a no-op
 * when already installed; a cargo without rustup (distro toolchains)
 * just skips it.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const crateRoot = path.join(repoRoot, 'native', 'h3-helper');
const manifestPath = path.join(crateRoot, 'Cargo.toml');

/** target name → { triple, platform } — the five-target matrix. */
const TARGETS = {
  'mac-arm64': { triple: 'aarch64-apple-darwin', platform: 'darwin' },
  'mac-x64': { triple: 'x86_64-apple-darwin', platform: 'darwin' },
  'win-x64': { triple: 'x86_64-pc-windows-msvc', platform: 'win32' },
  'linux-x64': { triple: 'x86_64-unknown-linux-gnu', platform: 'linux' },
  'linux-arm64': { triple: 'aarch64-unknown-linux-gnu', platform: 'linux' },
};

function fail(message) {
  console.error(`build-h3-helper: ${message}`);
  process.exit(1);
}

function hostTarget() {
  const os = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
  return `${os}-${process.arch}`;
}

function run(command, args, env) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: crateRoot, env });
  return result.status === 0;
}

const args = process.argv.slice(2);
let targets;
if (args.includes('--platform-all')) {
  targets = Object.keys(TARGETS).filter((name) => TARGETS[name].platform === process.platform);
} else if (args.length > 0) {
  targets = args;
} else {
  targets = [hostTarget()];
}

for (const target of targets) {
  const spec = TARGETS[target];
  if (spec === undefined) fail(`unknown target ${target} (known: ${Object.keys(TARGETS).join(' ')})`);
  if (spec.platform !== process.platform) {
    fail(`target ${target} needs ${spec.platform}; this is ${process.platform} — cross-OS builds are not a thing here`);
  }
}

for (const target of targets) {
  const { triple } = TARGETS[target];
  // No-op when installed; absent rustup (distro cargo) is not fatal —
  // the build itself is the arbiter.
  run('rustup', ['target', 'add', triple]);

  const env = { ...process.env };
  if (target === 'linux-arm64' && process.arch !== 'arm64') {
    env.CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER ??= 'aarch64-linux-gnu-gcc';
  }
  if (!run('cargo', ['build', '--release', '--manifest-path', manifestPath, '--target', triple], env)) {
    fail(`cargo build failed for ${target} (${triple})`);
  }

  const binaryName = target.startsWith('win-') ? 'oh-h3-helper.exe' : 'oh-h3-helper';
  const built = path.join(crateRoot, 'target', triple, 'release', binaryName);
  const stageDir = path.join(crateRoot, 'dist', target);
  mkdirSync(stageDir, { recursive: true });
  copyFileSync(built, path.join(stageDir, binaryName));
  console.log(`build-h3-helper: staged dist/${target}/${binaryName}`);
}
