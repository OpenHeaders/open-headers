/**
 * `snapshotSqliteDatabase` — the online-backup copy behind
 * `oh daemon backup`. Proves the property the daemon relies on: the
 * copy is a single self-contained db file whose rows include
 * everything still sitting in an uncheckpointed WAL, and a missing
 * source refuses instead of minting an empty db.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { snapshotSqliteDatabase } from '@openheaders/oracle-host-node/sync/sqlite-snapshot';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];

function makeDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-sqlite-snapshot-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('snapshotSqliteDatabase', () => {
  it('copies rows still sitting in an uncheckpointed WAL', async () => {
    const dir = makeDir();
    const sourcePath = path.join(dir, 'oracle.db');
    const destPath = path.join(dir, 'copy.db');
    const source = new Database(sourcePath);
    try {
      source.pragma('journal_mode = WAL');
      source.exec('CREATE TABLE rows (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
      source.prepare('INSERT INTO rows (value) VALUES (?)').run('https://openheaders.io');
      // The writer stays open, so the insert lives in oracle.db-wal —
      // a filesystem copy of oracle.db alone would miss it.
      expect(fs.existsSync(`${sourcePath}-wal`)).toBe(true);
      await snapshotSqliteDatabase(sourcePath, destPath);
    } finally {
      source.close();
    }
    expect(fs.existsSync(`${destPath}-wal`)).toBe(false);
    const copy = new Database(destPath, { readonly: true });
    try {
      const rows = copy.prepare('SELECT value FROM rows').all() as Array<{ value: string }>;
      expect(rows).toEqual([{ value: 'https://openheaders.io' }]);
    } finally {
      copy.close();
    }
  });

  it('refuses a missing source instead of minting an empty db', async () => {
    const dir = makeDir();
    await expect(snapshotSqliteDatabase(path.join(dir, 'absent.db'), path.join(dir, 'copy.db'))).rejects.toThrow();
    expect(fs.existsSync(path.join(dir, 'copy.db'))).toBe(false);
  });
});
