/**
 * Behavior of `scripts/generate-update-feed.mjs` — the release step
 * that stages the updates.openheaders.io pointer layout. Run as a
 * child process against fixture inputs: what lands on the feed is
 * exactly what these rows assert.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../../scripts/generate-update-feed.mjs');
const DOWNLOAD_BASE = 'https://github.com/OpenHeaders/open-headers/releases/download/v2026.7.2';

const LATEST_MAC_YML = [
  'version: 2026.7.2',
  'files:',
  '  - url: OpenHeaders-2026.7.2-mac-arm64.zip',
  '    sha512: abc==',
  '    size: 123',
  '  - url: OpenHeaders-2026.7.2-mac-arm64.dmg',
  '    sha512: def==',
  '    size: 456',
  'path: OpenHeaders-2026.7.2-mac-arm64.zip',
  'sha512: abc==',
  "releaseDate: '2026-07-17T00:00:00.000Z'",
  '',
].join('\n');

const VERSIONS_JSON = JSON.stringify(
  {
    desktop: { latest: '2026.7.2', tag: 'v2026.7.2', severity: 'normal' },
    daemon: { latest: '2026.7.0', tag: 'v2026.7.2', severity: 'normal' },
    cli: { latest: '2026.7.1', tag: 'v2026.7.2', severity: 'normal' },
  },
  null,
  2,
);

let workDir: string;

/** Live channel manifests as the release job hands them over (`{}` = the channel has none yet). */
type LiveManifests = { stable?: unknown; beta?: unknown };

function stage(
  tag: string,
  files: Record<string, string>,
  live: LiveManifests = {},
): { out: string; run: () => string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-update-feed-'));
  const input = path.join(workDir, 'processed_files');
  const out = path.join(workDir, 'feed');
  mkdirSync(input, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(input, name), content);
  }
  const flags: string[] = [];
  for (const channel of ['stable', 'beta'] as const) {
    if (live[channel] === undefined) continue;
    const file = path.join(workDir, `live_${channel}.json`);
    writeFileSync(file, JSON.stringify(live[channel]));
    flags.push(`--live-${channel}=${file}`);
  }
  const run = () =>
    execFileSync(process.execPath, [SCRIPT, tag, DOWNLOAD_BASE, input, out, ...flags], { encoding: 'utf8' });
  return { out, run };
}

function readJson(file: string): Record<string, Record<string, unknown>> {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const LIVE_BETA_OLDER = {
  desktop: { latest: '2026.7.2-beta.3', tag: 'v2026.7.2-beta.3', severity: 'normal' },
  daemon: { latest: '2026.7.0', tag: 'v2026.7.1', severity: 'normal' },
  cli: { latest: '2026.7.1', tag: 'v2026.7.1', severity: 'normal' },
};

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('generate-update-feed', () => {
  it('stages stable pointers with absolute asset URLs', () => {
    const { out, run } = stage('v2026.7.2', {
      'latest-mac.yml': LATEST_MAC_YML,
      'versions.json': VERSIONS_JSON,
      'install-oh.ps1': '# signed artifact copy',
    });
    run();

    const yml = readFileSync(path.join(out, 'desktop/stable/latest-mac.yml'), 'utf8');
    expect(yml).toContain(`  - url: ${DOWNLOAD_BASE}/OpenHeaders-2026.7.2-mac-arm64.zip`);
    expect(yml).toContain(`  - url: ${DOWNLOAD_BASE}/OpenHeaders-2026.7.2-mac-arm64.dmg`);
    expect(yml).toContain(`path: ${DOWNLOAD_BASE}/OpenHeaders-2026.7.2-mac-arm64.zip`);
    // Hashes, sizes, and dates ride through untouched.
    expect(yml).toContain('sha512: abc==');
    expect(yml).toContain('size: 456');

    expect(JSON.parse(readFileSync(path.join(out, 'versions/stable.json'), 'utf8'))).toEqual(JSON.parse(VERSIONS_JSON));
    expect(existsSync(path.join(out, 'install.sh'))).toBe(true);
    expect(existsSync(path.join(out, 'install.ps1'))).toBe(true);
  });

  it('stages the signed install-oh.ps1 release artifact as the feed copy', () => {
    const { out, run } = stage('v2026.7.2', {
      'latest-mac.yml': LATEST_MAC_YML,
      'versions.json': VERSIONS_JSON,
      'install-oh.ps1': '# signed artifact copy',
    });
    run();

    expect(readFileSync(path.join(out, 'install.ps1'), 'utf8')).toBe('# signed artifact copy');
  });

  it('fails a stable tag without the signed install-oh.ps1 instead of staging the checkout copy', () => {
    const { run } = stage('v2026.7.2', { 'latest-mac.yml': LATEST_MAC_YML, 'versions.json': VERSIONS_JSON });

    expect(run).toThrow(/install-oh\.ps1 .* is missing/);
  });

  it('a beta tag never touches stable paths', () => {
    const { out, run } = stage('v2026.8.0-beta.1', {
      'latest-mac.yml': LATEST_MAC_YML,
      'versions.json': VERSIONS_JSON,
    });
    run();

    expect(readdirSync(path.join(out, 'desktop'))).toEqual(['beta']);
    expect(readdirSync(path.join(out, 'versions'))).toEqual(['beta.json']);
    expect(existsSync(path.join(out, 'desktop/stable'))).toBe(false);
    expect(existsSync(path.join(out, 'install.sh'))).toBe(false);
    expect(existsSync(path.join(out, 'install.ps1'))).toBe(false);
  });

  it('normalizes beta-named channel files to the latest names clients request', () => {
    const { out, run } = stage('v2026.8.0-beta.1', {
      'beta-mac.yml': LATEST_MAC_YML,
      'beta.yml': LATEST_MAC_YML,
      'builder-debug.yml': 'not: a feed file',
      'versions.json': VERSIONS_JSON,
    });
    run();

    expect(readdirSync(path.join(out, 'desktop/beta')).sort()).toEqual(['latest-mac.yml', 'latest.yml']);
    const yml = readFileSync(path.join(out, 'desktop/beta/latest-mac.yml'), 'utf8');
    expect(yml).toContain(`  - url: ${DOWNLOAD_BASE}/OpenHeaders-2026.7.2-mac-arm64.zip`);
  });

  it('fails when both channel spellings of one feed file are present', () => {
    const { run } = stage('v2026.8.0-beta.1', {
      'beta-mac.yml': LATEST_MAC_YML,
      'latest-mac.yml': LATEST_MAC_YML,
      'versions.json': VERSIONS_JSON,
    });
    expect(run).toThrow();
  });

  it('is idempotent over already-absolute URLs', () => {
    const absolute = LATEST_MAC_YML.replaceAll(
      'url: OpenHeaders-2026.7.2-mac-arm64.zip',
      `url: ${DOWNLOAD_BASE}/OpenHeaders-2026.7.2-mac-arm64.zip`,
    );
    const { out, run } = stage('v2026.7.2', {
      'latest-mac.yml': absolute,
      'versions.json': VERSIONS_JSON,
      'install-oh.ps1': '# signed',
    });
    run();

    const yml = readFileSync(path.join(out, 'desktop/stable/latest-mac.yml'), 'utf8');
    expect(yml).not.toContain(`${DOWNLOAD_BASE}/${DOWNLOAD_BASE}`);
    expect(yml).toContain(`  - url: ${DOWNLOAD_BASE}/OpenHeaders-2026.7.2-mac-arm64.zip`);
  });

  it('still stages the severity manifest when no desktop legs produced feed files', () => {
    const { out, run } = stage('v2026.7.2', { 'versions.json': VERSIONS_JSON, 'install-oh.ps1': '# signed' });
    run();

    expect(existsSync(path.join(out, 'desktop'))).toBe(false);
    expect(existsSync(path.join(out, 'versions/stable.json'))).toBe(true);
  });

  it('fails without a versions manifest', () => {
    const { run } = stage('v2026.7.2', { 'latest-mac.yml': LATEST_MAC_YML });
    expect(run).toThrow();
  });

  describe('stable overtakes beta', () => {
    it('stages the stable pointers under desktop/beta and moves the beta entries it is newer than', () => {
      const { out, run } = stage(
        'v2026.7.2',
        { 'latest-mac.yml': LATEST_MAC_YML, 'versions.json': VERSIONS_JSON, 'install-oh.ps1': '# signed' },
        { beta: LIVE_BETA_OLDER },
      );
      run();

      expect(readFileSync(path.join(out, 'desktop/beta/latest-mac.yml'), 'utf8')).toBe(
        readFileSync(path.join(out, 'desktop/stable/latest-mac.yml'), 'utf8'),
      );
      const beta = readJson(path.join(out, 'versions/beta.json'));
      expect(beta.desktop).toEqual({ latest: '2026.7.2', tag: 'v2026.7.2', severity: 'normal' });
      // daemon and cli are not newer on stable: the beta entries stay byte-exact.
      expect(beta.daemon).toEqual(LIVE_BETA_OLDER.daemon);
      expect(beta.cli).toEqual(LIVE_BETA_OLDER.cli);
      expect(beta.extension).toBeUndefined();
      expect(readJson(path.join(out, 'versions/stable.json'))).toEqual(JSON.parse(VERSIONS_JSON));
    });

    it('leaves a newer beta channel untouched', () => {
      const newerBeta = {
        ...LIVE_BETA_OLDER,
        desktop: { latest: '2026.7.3-beta.1', tag: 'v2026.7.3-beta.1', severity: 'normal' },
      };
      const { out, run } = stage(
        'v2026.7.2',
        { 'latest-mac.yml': LATEST_MAC_YML, 'versions.json': VERSIONS_JSON, 'install-oh.ps1': '# signed' },
        { beta: newerBeta },
      );
      run();

      expect(existsSync(path.join(out, 'desktop/beta'))).toBe(false);
      expect(existsSync(path.join(out, 'versions/beta.json'))).toBe(false);
    });

    it('creates the beta channel from the stable when none exists yet', () => {
      const withExtension = JSON.stringify({
        ...JSON.parse(VERSIONS_JSON),
        extension: { latest: '2026.7.2', tag: 'v2026.7.2', severity: 'normal', stores: { chrome: '2026.7.1' } },
      });
      const { out, run } = stage(
        'v2026.7.2',
        { 'latest-mac.yml': LATEST_MAC_YML, 'versions.json': withExtension, 'install-oh.ps1': '# signed' },
        { beta: {} },
      );
      run();

      const beta = readJson(path.join(out, 'versions/beta.json'));
      expect(Object.keys(beta).sort()).toEqual(['cli', 'daemon', 'desktop']);
      expect(beta.desktop).toEqual({ latest: '2026.7.2', tag: 'v2026.7.2', severity: 'normal' });
      expect(existsSync(path.join(out, 'desktop/beta/latest-mac.yml'))).toBe(true);
    });

    it('never moves the beta desktop entry without pointer files to serve it', () => {
      const { out, run } = stage(
        'v2026.7.2',
        { 'versions.json': VERSIONS_JSON, 'install-oh.ps1': '# signed' },
        { beta: { ...LIVE_BETA_OLDER, cli: { latest: '2026.7.0', tag: 'v2026.7.0', severity: 'normal' } } },
      );
      run();

      const beta = readJson(path.join(out, 'versions/beta.json'));
      expect(beta.desktop).toEqual(LIVE_BETA_OLDER.desktop);
      expect(beta.cli).toEqual({ latest: '2026.7.1', tag: 'v2026.7.2', severity: 'normal' });
      expect(existsSync(path.join(out, 'desktop/beta'))).toBe(false);
    });

    it('does nothing without the live beta manifest', () => {
      const { out, run } = stage('v2026.7.2', {
        'latest-mac.yml': LATEST_MAC_YML,
        'versions.json': VERSIONS_JSON,
        'install-oh.ps1': '# signed',
      });
      run();

      expect(existsSync(path.join(out, 'desktop/beta'))).toBe(false);
      expect(existsSync(path.join(out, 'versions/beta.json'))).toBe(false);
    });
  });

  describe('beta never behind stable', () => {
    const betaVersions = JSON.stringify({
      desktop: { latest: '2026.7.1-beta.2', tag: 'v2026.7.1-beta.2', severity: 'normal' },
    });

    it('fails a beta tag older than the live stable', () => {
      const { run } = stage(
        'v2026.7.1-beta.2',
        { 'beta-mac.yml': LATEST_MAC_YML, 'versions.json': betaVersions },
        { stable: { desktop: { latest: '2026.7.2', tag: 'v2026.7.2', severity: 'normal' } } },
      );
      expect(run).toThrow(/older than the live stable 2026.7.2/);
    });

    it('stages a beta newer than the live stable', () => {
      const { out, run } = stage(
        'v2026.7.1-beta.2',
        { 'beta-mac.yml': LATEST_MAC_YML, 'versions.json': betaVersions },
        { stable: { desktop: { latest: '2026.7.0', tag: 'v2026.7.0', severity: 'normal' } } },
      );
      run();
      expect(existsSync(path.join(out, 'desktop/beta/latest-mac.yml'))).toBe(true);
    });
  });
});
