/**
 * Data-scan runner — fs behavior over fixture store directories. Core
 * owns the allowlist + interpretation (covered in core tests); here we
 * prove the runner lists only allowlisted directories, reads only
 * matched files, and surfaces read problems as skips.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readPostmanBackupFile, scanToolData } from '../../../src/migration/data-scan';

let tmpHome: string;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-data-scan-'));
});

afterEach(async () => {
  await fs.rm(tmpHome, { recursive: true, force: true });
});

function backupText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    collections: [],
    environments: [],
    headerPresets: [],
    globals: [],
    ...overrides,
  });
}

describe('scanToolData', () => {
  it('reads matched store files and folds them into findings', async () => {
    const postmanDir = path.join(tmpHome, '.config', 'Postman');
    const insomniaDir = path.join(tmpHome, '.config', 'Insomnia');
    await fs.mkdir(postmanDir, { recursive: true });
    await fs.mkdir(insomniaDir, { recursive: true });
    await fs.writeFile(
      path.join(postmanDir, 'backup-2026-03-18.json'),
      backupText({ headerPresets: [{ name: 'Auth', headers: [{ key: 'X-Token', value: 'abc' }] }] }),
    );
    await fs.writeFile(path.join(postmanDir, 'userPartitionData.json'), '{"forbidden":true}');
    await fs.writeFile(
      path.join(insomniaDir, 'insomnia.Workspace.db'),
      JSON.stringify({ _id: 'wrk_1', _type: 'workspace', name: 'API' }),
    );

    const { findings, skipped } = await scanToolData({ platform: 'linux', roots: { home: tmpHome } });

    expect(skipped).toEqual([]);
    expect(findings).toHaveLength(2);
    const postman = findings.find((finding) => finding.tool === 'postman');
    expect(postman?.counts).toEqual({ collections: 0, environments: 0, globals: 0, headerPresets: 1 });
    const insomnia = findings.find((finding) => finding.tool === 'insomnia');
    expect(insomnia?.counts).toEqual({ collections: 1, environments: 0, requests: 0 });
  });

  it('yields nothing when the store directories do not exist', async () => {
    const result = await scanToolData({ platform: 'linux', roots: { home: tmpHome } });
    expect(result).toEqual({ findings: [], skipped: [] });
  });

  it('surfaces unreadable candidates as skips with reasons', async () => {
    const postmanDir = path.join(tmpHome, '.config', 'Postman');
    await fs.mkdir(path.join(postmanDir, 'backup-imadir.json'), { recursive: true });
    const { findings, skipped } = await scanToolData({ platform: 'linux', roots: { home: tmpHome } });
    expect(findings).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.path).toBe(path.join(postmanDir, 'backup-imadir.json'));
    expect(skipped[0]?.reason).toMatch(/Unreadable store file/);
  });
});

describe('readPostmanBackupFile', () => {
  it('reads a backup file that sits in the allowlisted store directory', async () => {
    const postmanDir = path.join(tmpHome, '.config', 'Postman');
    await fs.mkdir(postmanDir, { recursive: true });
    const backupPath = path.join(postmanDir, 'backup-2026-03-18.json');
    await fs.writeFile(backupPath, backupText());

    const result = await readPostmanBackupFile(backupPath, { platform: 'linux', roots: { home: tmpHome } });
    expect(result).toEqual({ text: backupText() });
  });

  it('refuses a non-store file even inside the allowlisted directory', async () => {
    const postmanDir = path.join(tmpHome, '.config', 'Postman');
    await fs.mkdir(postmanDir, { recursive: true });
    const forbiddenPath = path.join(postmanDir, 'userPartitionData.json');
    await fs.writeFile(forbiddenPath, '{"forbidden":true}');

    const result = await readPostmanBackupFile(forbiddenPath, { platform: 'linux', roots: { home: tmpHome } });
    expect(result.text).toBeNull();
    expect(result.reason).toBe('Not an allowlisted backup file.');
  });

  it('refuses a matching file name outside the allowlisted directory', async () => {
    const elsewhere = path.join(tmpHome, 'elsewhere');
    await fs.mkdir(elsewhere, { recursive: true });
    const strayPath = path.join(elsewhere, 'backup-2026-03-18.json');
    await fs.writeFile(strayPath, backupText());

    const result = await readPostmanBackupFile(strayPath, { platform: 'linux', roots: { home: tmpHome } });
    expect(result.text).toBeNull();
    expect(result.reason).toBe('Not an allowlisted backup file.');
  });

  it('reports a missing allowlisted file as unreadable with a reason', async () => {
    const missing = path.join(tmpHome, '.config', 'Postman', 'backup-gone.json');
    const result = await readPostmanBackupFile(missing, { platform: 'linux', roots: { home: tmpHome } });
    expect(result.text).toBeNull();
    expect(result.reason).toMatch(/Unreadable store file/);
  });
});
