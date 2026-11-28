/**
 * Build + stage the Windows installer program (`native/windows-installer`)
 * — the file a person downloads to install the desktop app — into
 * `native/windows-installer/dist/<target>/OpenHeaders-Installer-<arch>.exe`,
 * the layout the desktop's afterPack hook reads: a Windows tree carries
 * the program of its own arch, and the published file is a copy of the
 * one in the signed tree.
 *
 *   node scripts/build-windows-installer.mjs            # both arches
 *   node scripts/build-windows-installer.mjs win-arm64  # one
 *
 * The program is built for the release the desktop's `package.json`
 * names: a release leg runs this after the tag's version is pinned
 * there, so a beta's installer knows it is a beta's. The crate's own
 * version is that release's base, and the build fails when the two
 * differ.
 *
 * On Windows both arches build with the compiler and linker Visual
 * Studio carries. On a Mac or on Linux the same targets build through
 * `cargo xwin` (the `cargo-xwin` tool, which fetches Microsoft's
 * libraries): a developer's cross-build, never a release's.
 * `rustup target add` is run per build and is a no-op when already
 * installed; a cargo without rustup just skips it.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const crateRoot = path.join(repoRoot, 'native', 'windows-installer');
const manifestPath = path.join(crateRoot, 'Cargo.toml');

/** target name → { triple, arch } — the arch is the one the published file's name carries. */
const TARGETS = {
  'win-x64': { triple: 'x86_64-pc-windows-msvc', arch: 'x64' },
  'win-arm64': { triple: 'aarch64-pc-windows-msvc', arch: 'arm64' },
};

function fail(message) {
  console.error(`build-windows-installer: ${message}`);
  process.exit(1);
}

function run(command, args, env) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: crateRoot, env });
  return result.status === 0;
}

const targets = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(TARGETS);
for (const target of targets) {
  if (TARGETS[target] === undefined) fail(`unknown target ${target} (known: ${Object.keys(TARGETS).join(' ')})`);
}

const release = JSON.parse(readFileSync(path.join(repoRoot, 'apps', 'desktop', 'package.json'), 'utf8')).version;
const env = { ...process.env, OPENHEADERS_INSTALLER_VERSION: release };
const build = process.platform === 'win32' ? ['build'] : ['xwin', 'build'];

for (const target of targets) {
  const { triple, arch } = TARGETS[target];
  // No-op when installed; absent rustup is not fatal — the build itself is the arbiter.
  run('rustup', ['target', 'add', triple]);
  if (!run('cargo', [...build, '--release', '--manifest-path', manifestPath, '--target', triple], env)) {
    fail(`cargo ${build.join(' ')} failed for ${target} (${triple})`);
  }

  const built = path.join(crateRoot, 'target', triple, 'release', 'openheaders-installer.exe');
  const stageDir = path.join(crateRoot, 'dist', target);
  const staged = `OpenHeaders-Installer-${arch}.exe`;
  mkdirSync(stageDir, { recursive: true });
  copyFileSync(built, path.join(stageDir, staged));
  console.log(`build-windows-installer: staged dist/${target}/${staged} for ${release}`);
}
