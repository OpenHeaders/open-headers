/**
 * Behavior of `scripts/assert-release-manifest.mjs` — the release step
 * that proves every asset the tag's channel ships is staged before the
 * first upload. Run as a child process against fixture directories,
 * like the feed staging suites; the standalone binary names carry the
 * cli/daemon versions the script reads from their package.json files.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const SCRIPT = path.join(REPO_ROOT, 'scripts/assert-release-manifest.mjs');

function appVersion(app: string): string {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, 'apps', app, 'package.json'), 'utf8')).version;
}

const CLI = appVersion('cli');
const DAEMON = appVersion('daemon');

function updateInfo(version: string): string {
  const lines = [
    `version: ${version}`,
    'files:',
    '  - url: x.zip',
    '    sha512: a==',
    'path: x.zip',
    'sha512: a==',
    '',
  ];
  return lines.join('\n');
}

const STABLE_VERSION = '2026.9.0';
const STABLE_ASSETS = [
  'OpenHeaders-2026.9.0-mac-arm64.dmg',
  'OpenHeaders-2026.9.0-mac-arm64.pkg',
  'OpenHeaders-2026.9.0-mac-arm64.zip',
  'OpenHeaders-2026.9.0-mac-arm64.zip.blockmap',
  'OpenHeaders-2026.9.0-mac-x64.dmg',
  'OpenHeaders-2026.9.0-mac-x64.pkg',
  'OpenHeaders-2026.9.0-mac-x64.zip',
  'OpenHeaders-2026.9.0-mac-x64.zip.blockmap',
  'OpenHeaders-2026.9.0-Setup.exe',
  'OpenHeaders-2026.9.0-Setup.exe.blockmap',
  'OpenHeaders-2026.9.0.msi',
  'OpenHeaders-2026.9.0-x86_64.AppImage',
  'OpenHeaders-2026.9.0-arm64.AppImage',
  'open-headers_2026.9.0_amd64.deb',
  'open-headers_2026.9.0_arm64.deb',
  'open-headers-2026.9.0.x86_64.rpm',
  'open-headers-2026.9.0.aarch64.rpm',
  `oh-${CLI}-mac-arm64`,
  `oh-${CLI}-linux-x64`,
  `oh-${CLI}-win-x64.exe`,
  `ohd-${DAEMON}-mac-arm64`,
  `ohd-${DAEMON}-linux-x64`,
  'SHA256SUMS.txt',
  'THIRD-PARTY-NOTICES-oh-ohd.txt',
  'install-oh.sh',
  'install-oh.ps1',
];
const STABLE_YMLS = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml', 'latest-linux-arm64.yml'];

const BETA_VERSION = '2026.9.1-beta.1';
const BETA_ASSETS = [
  'OpenHeaders-2026.9.1-beta.1-mac-arm64.dmg',
  'OpenHeaders-2026.9.1-beta.1-mac-arm64.zip',
  'OpenHeaders-2026.9.1-beta.1-mac-arm64.zip.blockmap',
  'OpenHeaders-2026.9.1-beta.1-Setup.exe',
  'OpenHeaders-2026.9.1-beta.1-Setup.exe.blockmap',
  'OpenHeaders-2026.9.1-beta.1-x86_64.AppImage',
  'open-headers_2026.9.1-beta.1_amd64.deb',
];
const BETA_YMLS = ['beta.yml', 'beta-mac.yml', 'beta-linux.yml'];

let workDir: string;

function stage(version: string, assets: string[], ymls: string[], ymlVersion = version): { run: () => string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-release-manifest-'));
  const dir = path.join(workDir, 'processed_files');
  mkdirSync(dir);
  for (const name of assets) writeFileSync(path.join(dir, name), 'bytes');
  for (const name of ymls) writeFileSync(path.join(dir, name), updateInfo(ymlVersion));
  const run = () => execFileSync(process.execPath, [SCRIPT, `v${version}`, dir], { encoding: 'utf8' });
  return { run };
}

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('assert-release-manifest', () => {
  it('passes a complete stable set and reports the count', () => {
    const { run } = stage(STABLE_VERSION, STABLE_ASSETS, STABLE_YMLS);

    expect(run()).toContain('expects 30 assets, 30 files staged');
  });

  it('passes the trimmed beta set', () => {
    const { run } = stage(BETA_VERSION, BETA_ASSETS, BETA_YMLS);

    expect(run()).toContain('expects 10 assets, 10 files staged');
  });

  it('fails a stable set missing one arch (the 2026.9.0 shape) and names the files', () => {
    const withoutX64 = STABLE_ASSETS.filter((name) => !name.includes('mac-x64'));
    const { run } = stage(STABLE_VERSION, withoutX64, STABLE_YMLS);

    expect(run).toThrow(/missing: OpenHeaders-2026\.9\.0-mac-x64\.dmg[\s\S]*4 problem\(s\)/);
  });

  it('fails a stable set without the standalone binaries', () => {
    const desktopOnly = STABLE_ASSETS.filter((name) => !/^(oh|ohd)-|SHA256SUMS|THIRD-PARTY|install-oh/.test(name));
    const { run } = stage(STABLE_VERSION, desktopOnly, STABLE_YMLS);

    expect(run).toThrow(new RegExp(`missing: oh-${CLI.replaceAll('.', '\\.')}-mac-arm64`));
  });

  it('fails a beta set missing a pointer', () => {
    const { run } = stage(BETA_VERSION, BETA_ASSETS, ['beta.yml', 'beta-mac.yml']);

    expect(run).toThrow(/missing: beta-linux\.yml/);
  });

  it('fails an empty asset', () => {
    const { run } = stage(STABLE_VERSION, STABLE_ASSETS, STABLE_YMLS);
    writeFileSync(path.join(workDir, 'processed_files', 'OpenHeaders-2026.9.0.msi'), '');

    expect(run).toThrow(/empty: OpenHeaders-2026\.9\.0\.msi/);
  });

  it('fails when an update-info file carries another version', () => {
    const { run } = stage(STABLE_VERSION, STABLE_ASSETS, STABLE_YMLS, '2026.8.3');

    expect(run).toThrow(/version mismatch: latest\.yml \(version: 2026\.8\.3\)/);
  });

  it('reports unexpected files without failing', () => {
    const { run } = stage(STABLE_VERSION, [...STABLE_ASSETS, 'builder-debug.yml'], STABLE_YMLS);

    expect(run()).toContain('staged but not expected: builder-debug.yml');
  });
});
