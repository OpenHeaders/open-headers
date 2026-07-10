/**
 * At-rest permission posture — everything the Node hosts persist is
 * owner-only on POSIX: the host-storage envelope (encrypted secrets +
 * credential hashes), the SQLite database (sync payloads + audit log),
 * and blob bytes. Skipped on Windows, where modes are advisory and
 * ACLs inherit from the profile directory.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { storageKey } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemBlobBackend } from '../../src/files/fs-blob-backend';
import { FileBackedHostStorage } from '../../src/host-storage/file-backed-host-storage';
import { createSqliteSyncPersistence } from '../../src/sync/sqlite-sync-persistence';

const posixOnly = it.runIf(process.platform !== 'win32');

const plainKey = storageKey<string>('oh.test.plain');

async function fileMode(target: string): Promise<number> {
  return (await fs.stat(target)).mode & 0o777;
}

let tmpDir: string;

describe('at-rest permissions', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-at-rest-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  posixOnly('writes the host-storage envelope owner-only, tightening a wider pre-existing file', async () => {
    const filePath = path.join(tmpDir, 'state', 'storage.json');
    const cipher = { isAvailable: () => false, encrypt: (s: string) => s, decrypt: (s: string) => s };
    const store = new FileBackedHostStorage({ filePath, secretCipher: cipher });
    await store.set(plainKey, 'value');
    expect(await fileMode(filePath)).toBe(0o600);
    expect(await fileMode(path.dirname(filePath))).toBe(0o700);

    await fs.chmod(filePath, 0o644);
    await store.set(plainKey, 'value-2');
    expect(await fileMode(filePath)).toBe(0o600);
  });

  posixOnly('creates the SQLite database owner-only, re-tightening on reopen', async () => {
    const dbPath = path.join(tmpDir, 'data', 'oracle.db');
    const persistence = createSqliteSyncPersistence({ dbPath });
    persistence.close();
    expect(await fileMode(dbPath)).toBe(0o600);
    expect(await fileMode(path.dirname(dbPath))).toBe(0o700);

    await fs.chmod(dbPath, 0o644);
    createSqliteSyncPersistence({ dbPath }).close();
    expect(await fileMode(dbPath)).toBe(0o600);
  });

  posixOnly('writes blob bytes owner-only under an owner-only workspace dir', async () => {
    const persistence = createSqliteSyncPersistence({ dbPath: path.join(tmpDir, 'oracle.db') });
    const backend = new FileSystemBlobBackend({ rootDir: path.join(tmpDir, 'blobs'), db: persistence.db });
    const ref = await backend.put('ws-1', { blob: new Blob(['payload']), filename: 'payload.bin' });
    const blobPath = path.join(tmpDir, 'blobs', 'ws-1', `${ref.fileId}.bin`);
    expect(await fileMode(blobPath)).toBe(0o600);
    expect(await fileMode(path.dirname(blobPath))).toBe(0o700);
    persistence.close();
  });
});
