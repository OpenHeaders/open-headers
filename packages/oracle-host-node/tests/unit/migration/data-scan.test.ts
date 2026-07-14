/**
 * Data-scan runner — fs behavior over fixture store directories. Core
 * owns the allowlist + interpretation (covered in core tests); here we
 * prove the runner lists only allowlisted directories, reads only
 * matched files, and surfaces read problems as skips.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { detectImportSource, parseInsomnia } from '@openheaders/core/import';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readInsomniaData, readPostmanBackupFile, scanToolData } from '../../../src/migration/data-scan';

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

describe('readInsomniaData', () => {
  const nedbLine = (doc: Record<string, unknown>): string => `${JSON.stringify(doc)}\n`;

  it('folds the allowlisted store files into an envelope that round-trips through the import path', async () => {
    const insomniaDir = path.join(tmpHome, '.config', 'Insomnia');
    await fs.mkdir(insomniaDir, { recursive: true });
    await fs.writeFile(
      path.join(insomniaDir, 'insomnia.Workspace.db'),
      nedbLine({ _id: 'wrk_1', type: 'Workspace', name: 'API' }),
    );
    await fs.writeFile(
      path.join(insomniaDir, 'insomnia.Request.db'),
      `${nedbLine({
        _id: 'req_1',
        type: 'Request',
        parentId: 'wrk_1',
        name: 'List sources',
        method: 'GET',
        url: 'https://api.openheaders.io/sources',
      })}{"truncated`, // an interrupted journal append drops, not fails
    );

    const result = await readInsomniaData(insomniaDir, { platform: 'linux', roots: { home: tmpHome } });
    expect(result.reason).toBeUndefined();
    expect(result.text).not.toBeNull();
    const text = result.text as string;

    expect(detectImportSource(text)).toEqual({ kind: 'insomnia' });
    const parsed = parseInsomnia(text);
    expect(parsed.collections).toHaveLength(1);
    expect(parsed.collections[0]?.name).toBe('API');
    expect(parsed.collections[0]?.requests).toHaveLength(1);
    expect(parsed.collections[0]?.requests[0]?.request.url).toBe('https://api.openheaders.io/sources');
  });

  it('refuses a directory outside the scan allowlist', async () => {
    const elsewhere = path.join(tmpHome, 'elsewhere');
    await fs.mkdir(elsewhere, { recursive: true });
    await fs.writeFile(path.join(elsewhere, 'insomnia.Workspace.db'), nedbLine({ _id: 'wrk_1', type: 'Workspace' }));

    const result = await readInsomniaData(elsewhere, { platform: 'linux', roots: { home: tmpHome } });
    expect(result.text).toBeNull();
    expect(result.reason).toBe('Not an allowlisted data directory.');
  });

  it('reports a missing allowlisted directory as unreadable with a reason', async () => {
    const missing = path.join(tmpHome, '.config', 'Insomnia');
    const result = await readInsomniaData(missing, { platform: 'linux', roots: { home: tmpHome } });
    expect(result.text).toBeNull();
    expect(result.reason).toMatch(/Unreadable data directory/);
  });

  it('reports an allowlisted directory holding no store files', async () => {
    const insomniaDir = path.join(tmpHome, '.config', 'Insomnia');
    await fs.mkdir(insomniaDir, { recursive: true });
    await fs.writeFile(path.join(insomniaDir, 'insomnia.Workspace.db.lock'), '');

    const result = await readInsomniaData(insomniaDir, { platform: 'linux', roots: { home: tmpHome } });
    expect(result.text).toBeNull();
    expect(result.reason).toMatch(/No data store files found/);
  });

  it('reports stores whose lines are all unparseable', async () => {
    const insomniaDir = path.join(tmpHome, '.config', 'Insomnia');
    await fs.mkdir(insomniaDir, { recursive: true });
    await fs.writeFile(path.join(insomniaDir, 'insomnia.Workspace.db'), '{"broken\n{"also broken\n');

    const result = await readInsomniaData(insomniaDir, { platform: 'linux', roots: { home: tmpHome } });
    expect(result.text).toBeNull();
    expect(result.reason).toMatch(/No readable records/);
  });
});
