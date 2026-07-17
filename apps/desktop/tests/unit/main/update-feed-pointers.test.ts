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
const DOWNLOAD_BASE = 'https://github.com/OpenHeaders/open-headers-releases/releases/download/v2026.7.2';

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

function stage(tag: string, files: Record<string, string>): { out: string; run: () => string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-update-feed-'));
  const input = path.join(workDir, 'processed_files');
  const out = path.join(workDir, 'feed');
  mkdirSync(input, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(input, name), content);
  }
  const run = () => execFileSync(process.execPath, [SCRIPT, tag, DOWNLOAD_BASE, input, out], { encoding: 'utf8' });
  return { out, run };
}

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('generate-update-feed', () => {
  it('stages stable pointers with absolute asset URLs', () => {
    const { out, run } = stage('v2026.7.2', { 'latest-mac.yml': LATEST_MAC_YML, 'versions.json': VERSIONS_JSON });
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

  it('is idempotent over already-absolute URLs', () => {
    const absolute = LATEST_MAC_YML.replaceAll(
      'url: OpenHeaders-2026.7.2-mac-arm64.zip',
      `url: ${DOWNLOAD_BASE}/OpenHeaders-2026.7.2-mac-arm64.zip`,
    );
    const { out, run } = stage('v2026.7.2', { 'latest-mac.yml': absolute, 'versions.json': VERSIONS_JSON });
    run();

    const yml = readFileSync(path.join(out, 'desktop/stable/latest-mac.yml'), 'utf8');
    expect(yml).not.toContain(`${DOWNLOAD_BASE}/${DOWNLOAD_BASE}`);
    expect(yml).toContain(`  - url: ${DOWNLOAD_BASE}/OpenHeaders-2026.7.2-mac-arm64.zip`);
  });

  it('still stages the severity manifest when no desktop legs produced feed files', () => {
    const { out, run } = stage('v2026.7.2', { 'versions.json': VERSIONS_JSON });
    run();

    expect(existsSync(path.join(out, 'desktop'))).toBe(false);
    expect(existsSync(path.join(out, 'versions/stable.json'))).toBe(true);
  });

  it('fails without a versions manifest', () => {
    const { run } = stage('v2026.7.2', { 'latest-mac.yml': LATEST_MAC_YML });
    expect(run).toThrow();
  });
});
