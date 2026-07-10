/**
 * `oh daemon backup / restore` — the sqlite-free core
 * (`backup-manifest.ts`): snapshot writing with a checksummed
 * manifest, the never-booted and non-empty-destination refusals,
 * integrity verification (tamper, truncation, traversal, format
 * version), and the replace-wholesale restore that drops stale WAL
 * sidecars and leftover blobs while leaving config and logs alone.
 * The sqlite touch is injected — a plain copy stands in for the
 * oracle-host-node snapshot helper, which is proven under the
 * Electron ABI in its own package.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT_VERSION,
  type BackupManifest,
  existingStateFiles,
  MANIFEST_FILE,
  restoreSnapshot,
  verifySnapshot,
  writeSnapshot,
} from '../../src/cli/backup-manifest';

const tempDirs: string[] = [];

function makeDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const copySnapshot = (source: string, dest: string) => fs.promises.copyFile(source, dest);

function seedDataDir(): string {
  const dataDir = makeDir('oh-backup-data-');
  fs.writeFileSync(path.join(dataDir, 'storage.json'), '{"envelope":true}\n');
  fs.writeFileSync(path.join(dataDir, 'oracle.db'), 'sqlite-bytes');
  fs.mkdirSync(path.join(dataDir, 'blobs', 'ws-1'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'blobs', 'ws-1', 'file-1.bin'), 'blob-one');
  fs.writeFileSync(path.join(dataDir, 'daemon.json'), '{"bindPort":8137}\n');
  fs.mkdirSync(path.join(dataDir, 'logs'));
  fs.writeFileSync(path.join(dataDir, 'logs', 'daemon.log'), 'log line\n');
  return dataDir;
}

async function writeSeededSnapshot(dataDir: string): Promise<{ destDir: string; manifest: BackupManifest }> {
  const destDir = path.join(makeDir('oh-backup-dest-'), 'snap');
  const manifest = await writeSnapshot({ dataDir, destDir, daemonVersion: '2026.7.0', snapshotDatabase: copySnapshot });
  return { destDir, manifest };
}

describe('writeSnapshot', () => {
  it('captures state files with checksums and skips config/logs', async () => {
    const dataDir = seedDataDir();
    const { destDir, manifest } = await writeSeededSnapshot(dataDir);
    expect(manifest.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(manifest.daemonVersion).toBe('2026.7.0');
    expect(manifest.files.map((f) => f.path)).toEqual(['blobs/ws-1/file-1.bin', 'oracle.db', 'storage.json']);
    for (const entry of manifest.files) {
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.bytes).toBeGreaterThan(0);
    }
    expect(fs.readFileSync(path.join(destDir, 'storage.json'), 'utf-8')).toBe('{"envelope":true}\n');
    expect(fs.existsSync(path.join(destDir, 'daemon.json'))).toBe(false);
    expect(fs.existsSync(path.join(destDir, 'logs'))).toBe(false);
    const onDisk = JSON.parse(fs.readFileSync(path.join(destDir, MANIFEST_FILE), 'utf-8')) as BackupManifest;
    expect(onDisk.files).toEqual(manifest.files);
  });

  it('routes oracle.db through the injected sqlite snapshot', async () => {
    const dataDir = seedDataDir();
    const calls: Array<[string, string]> = [];
    const destDir = path.join(makeDir('oh-backup-dest-'), 'snap');
    await writeSnapshot({
      dataDir,
      destDir,
      daemonVersion: '2026.7.0',
      snapshotDatabase: (source, dest) => {
        calls.push([source, dest]);
        return copySnapshot(source, dest);
      },
    });
    expect(calls).toEqual([[path.join(dataDir, 'oracle.db'), path.join(destDir, 'oracle.db')]]);
  });

  it('refuses a never-booted data dir', async () => {
    const dataDir = makeDir('oh-backup-empty-');
    const destDir = path.join(makeDir('oh-backup-dest-'), 'snap');
    await expect(
      writeSnapshot({ dataDir, destDir, daemonVersion: '2026.7.0', snapshotDatabase: copySnapshot }),
    ).rejects.toThrow(/nothing to back up/);
  });

  it('refuses a non-empty destination', async () => {
    const dataDir = seedDataDir();
    const destDir = makeDir('oh-backup-dest-');
    fs.writeFileSync(path.join(destDir, 'unrelated.txt'), 'x');
    await expect(
      writeSnapshot({ dataDir, destDir, daemonVersion: '2026.7.0', snapshotDatabase: copySnapshot }),
    ).rejects.toThrow(/not empty/);
  });

  it('snapshots a storage-only dir (no oracle.db yet)', async () => {
    const dataDir = makeDir('oh-backup-data-');
    fs.writeFileSync(path.join(dataDir, 'storage.json'), '{}');
    const { manifest } = await writeSeededSnapshot(dataDir);
    expect(manifest.files.map((f) => f.path)).toEqual(['storage.json']);
  });
});

describe('verifySnapshot', () => {
  it('round-trips a snapshot it just wrote', async () => {
    const { destDir, manifest } = await writeSeededSnapshot(seedDataDir());
    const verified = await verifySnapshot(destDir);
    expect(verified.files).toEqual(manifest.files);
  });

  it('rejects a directory without a manifest', async () => {
    await expect(verifySnapshot(makeDir('oh-backup-nomanifest-'))).rejects.toThrow(/not a backup/);
  });

  it('detects a tampered file', async () => {
    const { destDir } = await writeSeededSnapshot(seedDataDir());
    fs.appendFileSync(path.join(destDir, 'storage.json'), 'tamper');
    await expect(verifySnapshot(destDir)).rejects.toThrow(/corrupt.*storage\.json/);
  });

  it('detects a missing listed file', async () => {
    const { destDir } = await writeSeededSnapshot(seedDataDir());
    fs.rmSync(path.join(destDir, 'oracle.db'));
    await expect(verifySnapshot(destDir)).rejects.toThrow(/incomplete.*oracle\.db/);
  });

  it('rejects an unsupported format version', async () => {
    const { destDir } = await writeSeededSnapshot(seedDataDir());
    const manifestPath = path.join(destDir, MANIFEST_FILE);
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as BackupManifest;
    fs.writeFileSync(manifestPath, JSON.stringify({ ...raw, formatVersion: 99 }));
    await expect(verifySnapshot(destDir)).rejects.toThrow(/unsupported formatVersion 99/);
  });

  it('rejects manifest paths that escape the snapshot', async () => {
    const { destDir } = await writeSeededSnapshot(seedDataDir());
    const manifestPath = path.join(destDir, MANIFEST_FILE);
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as BackupManifest;
    raw.files[0] = { ...raw.files[0], path: '../escape.bin' };
    fs.writeFileSync(manifestPath, JSON.stringify(raw));
    await expect(verifySnapshot(destDir)).rejects.toThrow(/escapes the snapshot/);
  });
});

describe('restoreSnapshot', () => {
  it('replaces state wholesale, drops WAL sidecars and leftover blobs, keeps config/logs', async () => {
    const { destDir, manifest } = await writeSeededSnapshot(seedDataDir());
    const dataDir = makeDir('oh-restore-data-');
    fs.writeFileSync(path.join(dataDir, 'storage.json'), '{"newer":true}');
    fs.writeFileSync(path.join(dataDir, 'oracle.db'), 'newer-db');
    fs.writeFileSync(path.join(dataDir, 'oracle.db-wal'), 'wal');
    fs.writeFileSync(path.join(dataDir, 'oracle.db-shm'), 'shm');
    fs.mkdirSync(path.join(dataDir, 'blobs', 'ws-2'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'blobs', 'ws-2', 'orphan.bin'), 'orphan');
    fs.writeFileSync(path.join(dataDir, 'daemon.json'), '{"bindPort":9000}');

    const restored = await restoreSnapshot(destDir, dataDir, manifest);
    expect(restored.sort()).toEqual(['blobs/ws-1/file-1.bin', 'oracle.db', 'storage.json']);
    expect(fs.readFileSync(path.join(dataDir, 'storage.json'), 'utf-8')).toBe('{"envelope":true}\n');
    expect(fs.readFileSync(path.join(dataDir, 'oracle.db'), 'utf-8')).toBe('sqlite-bytes');
    expect(fs.existsSync(path.join(dataDir, 'oracle.db-wal'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'oracle.db-shm'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'blobs', 'ws-2'))).toBe(false);
    expect(fs.readFileSync(path.join(dataDir, 'blobs', 'ws-1', 'file-1.bin'), 'utf-8')).toBe('blob-one');
    expect(fs.readFileSync(path.join(dataDir, 'daemon.json'), 'utf-8')).toBe('{"bindPort":9000}');
  });

  it('restores into a data dir that does not exist yet', async () => {
    const { destDir, manifest } = await writeSeededSnapshot(seedDataDir());
    const dataDir = path.join(makeDir('oh-restore-fresh-'), 'state');
    await restoreSnapshot(destDir, dataDir, manifest);
    expect(fs.existsSync(path.join(dataDir, 'storage.json'))).toBe(true);
  });
});

describe('existingStateFiles', () => {
  it('lists only the state files present', async () => {
    const dataDir = makeDir('oh-clobber-');
    expect(await existingStateFiles(dataDir)).toEqual([]);
    fs.writeFileSync(path.join(dataDir, 'storage.json'), '{}');
    fs.mkdirSync(path.join(dataDir, 'blobs'));
    fs.writeFileSync(path.join(dataDir, 'daemon.json'), '{}');
    expect(await existingStateFiles(dataDir)).toEqual(['storage.json', 'blobs']);
  });
});
