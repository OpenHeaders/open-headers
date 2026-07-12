/**
 * Data-scan coverage — the pure half of migration ladder rung 2:
 * target allowlist, store file-name policy, NeDB journal reading, and
 * the interpretation of read store contents into a findings inventory.
 */

import { describe, expect, it } from 'vitest';
import {
  interpretInsomniaStores,
  interpretPostmanBackups,
  listDataScanTargets,
  matchesDataScanFile,
  parseNedbLines,
  type ScannedFile,
} from '../../src/import/data-scan';

const HOME = '/Users/dev';

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

function file(path: string, text: string, mtimeMs = 1000): ScannedFile {
  return { path, mtimeMs, text };
}

describe('listDataScanTargets', () => {
  it('darwin lists exactly the two app-support store roots', () => {
    expect(listDataScanTargets('darwin', { home: HOME })).toEqual([
      { tool: 'postman', store: 'postman-backup', dir: `${HOME}/Library/Application Support/Postman` },
      { tool: 'insomnia', store: 'insomnia-nedb', dir: `${HOME}/Library/Application Support/Insomnia` },
    ]);
  });

  it('win32 needs the roaming app-data root and yields nothing without it', () => {
    expect(listDataScanTargets('win32', { home: 'C:\\Users\\dev' })).toEqual([]);
    const targets = listDataScanTargets('win32', {
      home: 'C:\\Users\\dev',
      appData: 'C:\\Users\\dev\\AppData\\Roaming',
    });
    expect(targets.map((target) => target.dir)).toEqual([
      'C:\\Users\\dev\\AppData\\Roaming\\Postman',
      'C:\\Users\\dev\\AppData\\Roaming\\Insomnia',
    ]);
  });

  it('returns no targets for an unknown platform', () => {
    expect(listDataScanTargets('freebsd', { home: HOME })).toEqual([]);
  });
});

describe('matchesDataScanFile', () => {
  it('accepts only backup-*.json for the backup store', () => {
    expect(matchesDataScanFile('postman-backup', 'backup-2026-03-18.json')).toBe(true);
    expect(matchesDataScanFile('postman-backup', 'backup.json')).toBe(false);
    expect(matchesDataScanFile('postman-backup', 'userPartitionData.json')).toBe(false);
    expect(matchesDataScanFile('postman-backup', 'backup-x.json.bak')).toBe(false);
  });

  it('accepts only insomnia.*.db for the NeDB store', () => {
    expect(matchesDataScanFile('insomnia-nedb', 'insomnia.Request.db')).toBe(true);
    expect(matchesDataScanFile('insomnia-nedb', 'insomnia.db')).toBe(false);
    expect(matchesDataScanFile('insomnia-nedb', 'Cookies')).toBe(false);
  });
});

describe('interpretPostmanBackups', () => {
  it('keeps the newest file per schema version and skips superseded siblings with reasons', () => {
    const older = file('/scan/backup-1.json', backupText({ headerPresets: [{ name: 'Old', headers: [] }] }), 100);
    const newer = file(
      '/scan/backup-2.json',
      backupText({ headerPresets: [{ name: 'New', headers: [{ key: 'X-Env', value: 'staging' }] }] }),
      200,
    );
    const { findings, skipped } = interpretPostmanBackups([older, newer]);
    expect(findings).toEqual([
      {
        tool: 'postman',
        store: 'postman-backup',
        path: '/scan/backup-2.json',
        mtimeMs: 200,
        counts: { collections: 0, environments: 0, globals: 0, headerPresets: 1 },
      },
    ]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.path).toBe('/scan/backup-1.json');
    expect(skipped[0]?.reason).toMatch(/superseded/i);
  });

  it('skips invalid JSON and unsupported versions with reasons, keeping readable findings', () => {
    const good = file('/scan/backup-good.json', backupText());
    const junk = file('/scan/backup-junk.json', 'not json');
    const future = file('/scan/backup-future.json', backupText({ version: 9 }));
    const { findings, skipped } = interpretPostmanBackups([good, junk, future]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.path).toBe('/scan/backup-good.json');
    expect(skipped.map((skip) => skip.path).sort()).toEqual(['/scan/backup-future.json', '/scan/backup-junk.json']);
    for (const skip of skipped) expect(skip.reason.length).toBeGreaterThan(0);
  });
});

describe('parseNedbLines', () => {
  it('keeps the last occurrence per _id and honors $$deleted markers', () => {
    const text = [
      JSON.stringify({ _id: 'req_1', _type: 'request', name: 'v1' }),
      JSON.stringify({ _id: 'req_1', _type: 'request', name: 'v2' }),
      JSON.stringify({ _id: 'req_2', _type: 'request', name: 'gone' }),
      JSON.stringify({ _id: 'req_2', $$deleted: true }),
    ].join('\n');
    const { docs, badLines } = parseNedbLines(text);
    expect(badLines).toBe(0);
    expect(docs).toEqual([{ _id: 'req_1', _type: 'request', name: 'v2' }]);
  });

  it('counts unparseable lines instead of failing (interrupted journal tail)', () => {
    const text = `${JSON.stringify({ _id: 'wrk_1', _type: 'workspace', name: 'W' })}\n{"_id":"trunc`;
    const { docs, badLines } = parseNedbLines(text);
    expect(docs).toHaveLength(1);
    expect(badLines).toBe(1);
  });
});

describe('interpretInsomniaStores', () => {
  const dir = `${HOME}/Library/Application Support/Insomnia`;

  it('folds all store files into one finding with combined counts', () => {
    const workspaceDb = file(
      `${dir}/insomnia.Workspace.db`,
      JSON.stringify({ _id: 'wrk_1', _type: 'workspace', name: 'API' }),
    );
    const requestDb = file(
      `${dir}/insomnia.Request.db`,
      [
        JSON.stringify({
          _id: 'req_1',
          _type: 'request',
          parentId: 'wrk_1',
          name: 'Ping',
          method: 'GET',
          url: 'https://api.openheaders.io/ping',
        }),
        JSON.stringify({
          _id: 'env_1',
          _type: 'environment',
          parentId: 'wrk_1',
          name: 'Base Environment',
          data: { host: 'api.openheaders.io' },
        }),
      ].join('\n'),
    );
    const { findings, skipped } = interpretInsomniaStores(dir, [workspaceDb, requestDb]);
    expect(skipped).toEqual([]);
    expect(findings).toEqual([
      {
        tool: 'insomnia',
        store: 'insomnia-nedb',
        dir,
        files: [`${dir}/insomnia.Workspace.db`, `${dir}/insomnia.Request.db`],
        counts: { collections: 1, environments: 1, requests: 1 },
      },
    ]);
  });

  it('yields no finding for an empty file set', () => {
    expect(interpretInsomniaStores(dir, [])).toEqual({ findings: [], skipped: [] });
  });

  it('reports bad journal lines as skips while still counting readable docs', () => {
    const store = file(
      `${dir}/insomnia.Request.db`,
      `garbage\n${JSON.stringify({ _id: 'wrk_1', _type: 'workspace', name: 'W' })}`,
    );
    const { findings, skipped } = interpretInsomniaStores(dir, [store]);
    expect(findings[0]?.counts.collections).toBe(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.reason).toMatch(/1 unparseable line /);
  });
});
