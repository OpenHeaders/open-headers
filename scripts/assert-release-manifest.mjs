/**
 * Asserts the release job's `processed_files` directory holds every
 * asset the tag's channel ships, BEFORE the first upload. The expected
 * set is derived from the tag shape alone (stable: every desktop
 * target on both arches, every update-info pointer, the standalone
 * oh/ohd set; beta: the trimmed arm64/x64 set the beta legs build),
 * so a leg that succeeded without producing a file, an artifact whose
 * naming drifted, or a job the workflow gate missed all fail here
 * with the missing names — never as a published pointer to a 404.
 *
 * Pointer families must agree: every update-info file present carries
 * the tag's version, so `desktop/<channel>/*.yml` and
 * `versions/<channel>.json` can never name two different releases.
 *
 * The standalone binary names carry the cli/daemon versions from their
 * own package.json files — the same source the versions manifest
 * reads, so the manifest can only ever name bytes that were staged.
 *
 * Lockstep: the five shipping apps (desktop, cli, daemon, extension,
 * web) share the tag's base version — the runbook's suite-tag law,
 * which the build legs check for the desktop alone. packages/* and
 * apps/nm-host keep their own CalVer by policy and are not asserted.
 *
 * Runs in the release job, which installs nothing: node builtins only.
 *
 * Usage: node scripts/assert-release-manifest.mjs [--repo-root=<dir>] <tag> <processed-dir>
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCKSTEP_APPS = ['desktop', 'cli', 'daemon', 'extension', 'web'];

function fail(message) {
  console.error(`assert-release-manifest: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const repoRootArg = args.find((arg) => arg.startsWith('--repo-root='));
const repoRoot = repoRootArg
  ? path.resolve(repoRootArg.slice('--repo-root='.length))
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function appVersion(app) {
  return JSON.parse(readFileSync(path.join(repoRoot, 'apps', app, 'package.json'), 'utf8')).version;
}

const baseOf = (version) => version.replace(/-beta\.\d+$/, '');

/** The asset names a tag's channel ships, by the tag shape alone. */
function expectedAssets(tag, versions) {
  const version = tag.slice(1);
  const beta = /-beta[.0-9]*$/.test(tag);
  const app = `OpenHeaders-${version}`;
  const mac = (arch, targets) => targets.map((target) => `${app}-mac-${arch}.${target}`);
  if (beta) {
    return [
      ...mac('arm64', ['dmg', 'zip', 'zip.blockmap']),
      `${app}-Setup.exe`,
      `${app}-Setup.exe.blockmap`,
      `${app}-x86_64.AppImage`,
      `open-headers_${version}_amd64.deb`,
      'beta.yml',
      'beta-mac.yml',
      'beta-linux.yml',
    ];
  }
  return [
    ...mac('arm64', ['dmg', 'pkg', 'zip', 'zip.blockmap']),
    ...mac('x64', ['dmg', 'pkg', 'zip', 'zip.blockmap']),
    `${app}-Setup.exe`,
    `${app}-Setup.exe.blockmap`,
    `${app}.msi`,
    `${app}-x86_64.AppImage`,
    `${app}-arm64.AppImage`,
    `open-headers_${version}_amd64.deb`,
    `open-headers_${version}_arm64.deb`,
    `open-headers-${version}.x86_64.rpm`,
    `open-headers-${version}.aarch64.rpm`,
    'latest.yml',
    'latest-mac.yml',
    'latest-linux.yml',
    'latest-linux-arm64.yml',
    `oh-${versions.cli}-mac-arm64`,
    `oh-${versions.cli}-linux-x64`,
    `oh-${versions.cli}-win-x64.exe`,
    `ohd-${versions.daemon}-mac-arm64`,
    `ohd-${versions.daemon}-linux-x64`,
    'SHA256SUMS.txt',
    'THIRD-PARTY-NOTICES-oh-ohd.txt',
    'install-oh.sh',
    'install-oh.ps1',
  ];
}

const [tag, processedDir] = args.filter((arg) => !arg.startsWith('--'));
if (!tag?.startsWith('v')) fail(`expected the release tag as first argument, got '${tag}'`);
if (!processedDir) fail('usage: assert-release-manifest.mjs [--repo-root=<dir>] <tag> <processed-dir>');

const version = tag.slice(1);
const tagBase = baseOf(version);

// Lockstep: every shipping app's package.json base equals the tag base
// (the desktop's is compared by base too — the build legs pin their
// own copy to the full tag; the release job reads the checkout's).
const appVersions = Object.fromEntries(LOCKSTEP_APPS.map((app) => [app, appVersion(app)]));
const lockstepMismatch = LOCKSTEP_APPS.filter((app) => baseOf(appVersions[app]) !== tagBase).map(
  (app) => `apps/${app}/package.json is ${appVersions[app]}, the tag base is ${tagBase}`,
);

const expected = expectedAssets(tag, { cli: appVersions.cli, daemon: appVersions.daemon });
let present;
try {
  present = new Set(readdirSync(processedDir));
} catch {
  fail(`${processedDir} is not a readable directory`);
}

const missing = expected.filter((name) => !present.has(name));
const empty = expected.filter((name) => present.has(name) && statSync(path.join(processedDir, name)).size === 0);
const extra = [...present].filter((name) => !expected.includes(name)).sort();

// Every update-info file present (expected or not) must carry the
// tag's version — electron-builder writes it from package.json, which
// the build leg pinned to the tag.
const versionMismatch = [];
for (const name of present) {
  if (!/^(latest|beta)(-[a-z0-9-]+)?\.yml$/.test(name)) continue;
  const found = readFileSync(path.join(processedDir, name), 'utf8').match(/^version:\s*(\S+)\s*$/m)?.[1];
  if (found !== version) versionMismatch.push(`${name} (version: ${found ?? 'missing'})`);
}

console.log(`assert-release-manifest: ${tag} expects ${expected.length} assets, ${present.size} files staged`);
if (extra.length > 0) console.log(`assert-release-manifest: staged but not expected: ${extra.join(', ')}`);
if (lockstepMismatch.length === 0) {
  console.log(`assert-release-manifest: apps/{${LOCKSTEP_APPS.join(',')}} in lockstep at ${tagBase}`);
}

const problems = [
  ...lockstepMismatch.map((entry) => `lockstep: ${entry}`),
  ...missing.map((name) => `missing: ${name}`),
  ...empty.map((name) => `empty: ${name}`),
  ...versionMismatch.map((entry) => `version mismatch: ${entry}`),
];
if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::assert-release-manifest: ${problem}`);
  fail(`${problems.length} problem(s) — nothing uploaded`);
}
console.log(`assert-release-manifest: every expected asset for ${tag} is staged`);
