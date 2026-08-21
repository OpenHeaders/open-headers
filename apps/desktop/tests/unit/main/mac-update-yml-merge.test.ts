/**
 * Behavior of `scripts/merge-mac-update-yml.mjs` — the release step
 * that unions the per-arch macOS update-info files the split desktop
 * legs produce into the single `latest-mac.yml` the feed serves. Run
 * as a child process against fixture inputs, like the feed staging
 * suites.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../../scripts/merge-mac-update-yml.mjs');

const ARM64_YML = [
  'version: 2026.8.3',
  'files:',
  '  - url: OpenHeaders-2026.8.3-mac-arm64.zip',
  '    sha512: armzip==',
  '    size: 111',
  'path: OpenHeaders-2026.8.3-mac-arm64.zip',
  'sha512: armzip==',
  "releaseDate: '2026-08-21T01:00:00.000Z'",
  '',
].join('\n');

const X64_YML = [
  'version: 2026.8.3',
  'files:',
  '  - url: OpenHeaders-2026.8.3-mac-x64.zip',
  '    sha512: x64zip==',
  '    size: 222',
  'path: OpenHeaders-2026.8.3-mac-x64.zip',
  'sha512: x64zip==',
  "releaseDate: '2026-08-21T01:05:00.000Z'",
  '',
].join('\n');

let workDir: string;

function merge(files: Record<string, string>, inputNames: string[]): { out: string; run: () => string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-mac-yml-merge-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(workDir, name), content);
  }
  const out = path.join(workDir, 'merged', 'latest-mac.yml');
  const run = () =>
    execFileSync(process.execPath, [SCRIPT, out, ...inputNames.map((name) => path.join(workDir, name))], {
      encoding: 'utf8',
    });
  return { out, run };
}

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('merge-mac-update-yml', () => {
  it('unions per-arch files with x64 first and x64 as the default path', () => {
    // arm64 listed first on the command line — base selection comes
    // from the docs, not the argument order.
    const { out, run } = merge({ 'arm64.yml': ARM64_YML, 'x64.yml': X64_YML }, ['arm64.yml', 'x64.yml']);
    run();

    const merged = readFileSync(out, 'utf8');
    expect(merged).toBe(
      [
        'version: 2026.8.3',
        'files:',
        '  - url: OpenHeaders-2026.8.3-mac-x64.zip',
        '    sha512: x64zip==',
        '    size: 222',
        '  - url: OpenHeaders-2026.8.3-mac-arm64.zip',
        '    sha512: armzip==',
        '    size: 111',
        'path: OpenHeaders-2026.8.3-mac-x64.zip',
        'sha512: x64zip==',
        "releaseDate: '2026-08-21T01:05:00.000Z'",
        '',
      ].join('\n'),
    );
  });

  it('passes a single input through byte-identical (the beta lane)', () => {
    const { out, run } = merge({ 'arm64.yml': ARM64_YML }, ['arm64.yml']);
    run();

    expect(readFileSync(out, 'utf8')).toBe(ARM64_YML);
  });

  it('deduplicates identical entries across inputs', () => {
    const withShared = [
      'version: 2026.8.3',
      'files:',
      '  - url: OpenHeaders-2026.8.3-mac-x64.zip',
      '    sha512: x64zip==',
      '    size: 222',
      '  - url: OpenHeaders-2026.8.3-mac-arm64.zip',
      '    sha512: armzip==',
      '    size: 111',
      'path: OpenHeaders-2026.8.3-mac-x64.zip',
      'sha512: x64zip==',
      '',
    ].join('\n');
    const { out, run } = merge({ 'a.yml': withShared, 'b.yml': ARM64_YML }, ['a.yml', 'b.yml']);
    run();

    const merged = readFileSync(out, 'utf8');
    expect(merged.match(/mac-arm64\.zip/g)).toHaveLength(1);
  });

  it('fails on the same asset name with different hashes', () => {
    const conflicting = ARM64_YML.replace('armzip==', 'other==');
    const { run } = merge({ 'a.yml': X64_YML, 'b.yml': ARM64_YML, 'c.yml': conflicting }, ['a.yml', 'b.yml', 'c.yml']);

    expect(run).toThrow(/conflicting entries/);
  });

  it('fails when inputs disagree on version', () => {
    const older = ARM64_YML.replace(/2026\.8\.3/g, '2026.8.2');
    const { run } = merge({ 'a.yml': X64_YML, 'b.yml': older }, ['a.yml', 'b.yml']);

    expect(run).toThrow(/disagree on version/);
  });

  it('creates the output directory and reports what it merged', () => {
    const { run } = merge({ 'a.yml': X64_YML, 'b.yml': ARM64_YML }, ['a.yml', 'b.yml']);

    expect(run()).toContain('merged 2 inputs (2 file entries)');
  });
});
