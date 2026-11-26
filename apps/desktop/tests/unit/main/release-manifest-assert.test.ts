/**
 * Behavior of `scripts/assert-release-manifest.mjs` — the release step
 * that proves every asset the tag's channel ships is staged before the
 * first upload. Run as a child process against fixture directories,
 * like the feed staging suites, with a fixture repo root
 * (`--repo-root`) holding the five shipping apps' package.json files:
 * the standalone binary names carry the cli/daemon versions read from
 * there, and every app's base must equal the tag base (lockstep).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../../scripts/assert-release-manifest.mjs');
const LOCKSTEP_APPS = ['desktop', 'cli', 'daemon', 'extension', 'web'];

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
  'OpenHeaders-2026.9.0-arm64-Setup.exe',
  'OpenHeaders-2026.9.0-arm64-Setup.exe.blockmap',
  'OpenHeaders-2026.9.0.msi',
  'OpenHeaders-2026.9.0-x86_64.AppImage',
  'OpenHeaders-2026.9.0-arm64.AppImage',
  'open-headers_2026.9.0_amd64.deb',
  'open-headers_2026.9.0_arm64.deb',
  'open-headers-2026.9.0.x86_64.rpm',
  'open-headers-2026.9.0.aarch64.rpm',
  'oh-2026.9.0-mac-arm64',
  'oh-2026.9.0-linux-x64',
  'oh-2026.9.0-win-x64.exe',
  'ohd-2026.9.0-mac-arm64',
  'ohd-2026.9.0-linux-x64',
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
  'OpenHeaders-2026.9.1-beta.1-arm64-Setup.exe',
  'OpenHeaders-2026.9.1-beta.1-arm64-Setup.exe.blockmap',
  'OpenHeaders-2026.9.1-beta.1-x86_64.AppImage',
  'open-headers_2026.9.1-beta.1_amd64.deb',
];
const BETA_YMLS = ['beta.yml', 'beta-mac.yml', 'beta-linux.yml'];

/** Releases past the first that ships a Windows package (`scripts/lib/versions.mjs`). */
const PACKAGE_STABLE_VERSION = '2027.1.0';
const PACKAGE_BETA_VERSION = '2027.1.1-beta.1';

function atVersion(assets: string[], from: string, to: string): string[] {
  return assets.map((name) => name.replace(from, to));
}

function windowsPackages(version: string): string[] {
  return [`OpenHeaders-${version}-x64.msix`, `OpenHeaders-${version}-arm64.msix`];
}

let workDir: string;

interface StageOptions {
  ymlVersion?: string;
  appVersions?: Partial<Record<string, string>>;
}

function stage(version: string, assets: string[], ymls: string[], options: StageOptions = {}): { run: () => string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-release-manifest-'));
  const dir = path.join(workDir, 'processed_files');
  mkdirSync(dir);
  for (const name of assets) writeFileSync(path.join(dir, name), 'bytes');
  for (const name of ymls) writeFileSync(path.join(dir, name), updateInfo(options.ymlVersion ?? version));
  const root = path.join(workDir, 'repo');
  const base = version.replace(/-beta\.\d+$/, '');
  for (const app of LOCKSTEP_APPS) {
    mkdirSync(path.join(root, 'apps', app), { recursive: true });
    writeFileSync(
      path.join(root, 'apps', app, 'package.json'),
      JSON.stringify({ version: options.appVersions?.[app] ?? base }),
    );
  }
  // stderr piped, never inherited: the failing cases' `::error::` lines
  // would otherwise reach the CI job log and render as annotations.
  const run = () =>
    execFileSync(process.execPath, [SCRIPT, `--repo-root=${root}`, `v${version}`, dir], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  return { run };
}

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('assert-release-manifest', () => {
  it('passes a complete stable set and reports the count and the lockstep', () => {
    const { run } = stage(STABLE_VERSION, STABLE_ASSETS, STABLE_YMLS);

    const output = run();
    expect(output).toContain('expects 32 assets, 32 files staged');
    expect(output).toContain('apps/{desktop,cli,daemon,extension,web} in lockstep at 2026.9.0');
  });

  it('passes the trimmed beta set', () => {
    const { run } = stage(BETA_VERSION, BETA_ASSETS, BETA_YMLS);

    expect(run()).toContain('expects 12 assets, 12 files staged');
  });

  it('fails a stable set missing one arch (the 2026.9.0 shape) and names the files', () => {
    const withoutX64 = STABLE_ASSETS.filter((name) => !name.includes('mac-x64'));
    const { run } = stage(STABLE_VERSION, withoutX64, STABLE_YMLS);

    expect(run).toThrow(/missing: OpenHeaders-2026\.9\.0-mac-x64\.dmg[\s\S]*4 problem\(s\)/);
  });

  it('fails a stable set without the standalone binaries', () => {
    const desktopOnly = STABLE_ASSETS.filter((name) => !/^(oh|ohd)-|SHA256SUMS|THIRD-PARTY|install-oh/.test(name));
    const { run } = stage(STABLE_VERSION, desktopOnly, STABLE_YMLS);

    expect(run).toThrow(/missing: oh-2026\.9\.0-mac-arm64/);
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
    const { run } = stage(STABLE_VERSION, STABLE_ASSETS, STABLE_YMLS, { ymlVersion: '2026.8.3' });

    expect(run).toThrow(/version mismatch: latest\.yml \(version: 2026\.8\.3\)/);
  });

  it('fails when a shipping app is not in lockstep with the tag base', () => {
    const { run } = stage(STABLE_VERSION, STABLE_ASSETS, STABLE_YMLS, { appVersions: { web: '2026.8.4' } });

    expect(run).toThrow(/lockstep: apps\/web\/package\.json is 2026\.8\.4, the tag base is 2026\.9\.0/);
  });

  it('compares the desktop by base, so a leg-pinned beta version still passes', () => {
    const { run } = stage(BETA_VERSION, BETA_ASSETS, BETA_YMLS, { appVersions: { desktop: BETA_VERSION } });

    expect(run()).toContain('in lockstep at 2026.9.1');
  });

  it('fails a staged Windows package on either channel below the first release that ships one', () => {
    const stable = stage(STABLE_VERSION, [...STABLE_ASSETS, 'OpenHeaders-2026.9.0-arm64.msix'], STABLE_YMLS);
    expect(stable.run).toThrow(
      /a Windows package is staged that v2026\.9\.0 does not ship: OpenHeaders-2026\.9\.0-arm64\.msix[\s\S]*1 problem\(s\)/,
    );
    rmSync(workDir, { recursive: true, force: true });

    const beta = stage(BETA_VERSION, [...BETA_ASSETS, 'OpenHeaders-2026.9.1-beta.1-x64.msix'], BETA_YMLS);
    expect(beta.run).toThrow(/does not ship: OpenHeaders-2026\.9\.1-beta\.1-x64\.msix/);
  });

  it('expects both Windows packages on either channel from the first release that ships one', () => {
    const stable = stage(
      PACKAGE_STABLE_VERSION,
      [...atVersion(STABLE_ASSETS, STABLE_VERSION, PACKAGE_STABLE_VERSION), ...windowsPackages(PACKAGE_STABLE_VERSION)],
      STABLE_YMLS,
    );
    expect(stable.run()).toContain('expects 34 assets, 34 files staged');
    rmSync(workDir, { recursive: true, force: true });

    const beta = stage(
      PACKAGE_BETA_VERSION,
      [...atVersion(BETA_ASSETS, BETA_VERSION, PACKAGE_BETA_VERSION), ...windowsPackages(PACKAGE_BETA_VERSION)],
      BETA_YMLS,
    );
    expect(beta.run()).toContain('expects 14 assets, 14 files staged');
  });

  it('fails such a release without its packages, or with one arch alone', () => {
    const none = stage(PACKAGE_BETA_VERSION, atVersion(BETA_ASSETS, BETA_VERSION, PACKAGE_BETA_VERSION), BETA_YMLS);
    expect(none.run).toThrow(
      /missing: OpenHeaders-2027\.1\.1-beta\.1-x64\.msix[\s\S]*missing: OpenHeaders-2027\.1\.1-beta\.1-arm64\.msix[\s\S]*2 problem\(s\)/,
    );
    rmSync(workDir, { recursive: true, force: true });

    const [x64] = windowsPackages(PACKAGE_STABLE_VERSION);
    const oneArch = stage(
      PACKAGE_STABLE_VERSION,
      [...atVersion(STABLE_ASSETS, STABLE_VERSION, PACKAGE_STABLE_VERSION), x64],
      STABLE_YMLS,
    );
    expect(oneArch.run).toThrow(/missing: OpenHeaders-2027\.1\.0-arm64\.msix[\s\S]*1 problem\(s\)/);
  });

  it("fails a package that is not the release's own", () => {
    const { run } = stage(
      PACKAGE_STABLE_VERSION,
      [
        ...atVersion(STABLE_ASSETS, STABLE_VERSION, PACKAGE_STABLE_VERSION),
        ...windowsPackages(PACKAGE_STABLE_VERSION),
        'OpenHeaders-2026.12.0-x64.msix',
      ],
      STABLE_YMLS,
    );

    expect(run).toThrow(
      /a Windows package is staged that v2027\.1\.0 does not ship: OpenHeaders-2026\.12\.0-x64\.msix/,
    );
  });

  it('reports unexpected files without failing', () => {
    const { run } = stage(STABLE_VERSION, [...STABLE_ASSETS, 'builder-debug.yml'], STABLE_YMLS);

    expect(run()).toContain('staged but not expected: builder-debug.yml');
  });
});
