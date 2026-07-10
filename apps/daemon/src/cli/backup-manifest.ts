/**
 * `oh daemon backup / restore` — the sqlite-free core (Phase 6). A
 * backup is a plain snapshot DIRECTORY of the daemon's state files —
 * `storage.json`, `oracle.db`, `blobs/**` — plus a `manifest.json`
 * carrying sha256 checksums, written last so a torn backup is
 * detectable by its absence. Config (`daemon.json`) and `logs/` are
 * deliberately NOT state: a snapshot restores onto any machine without
 * dragging bind addresses or OIDC secrets along.
 *
 * The one sqlite touch — producing a consistent `oracle.db` copy — is
 * injected as {@link SqliteSnapshotFn}, so this module (and its tests)
 * stays plain-Node like every other CLI path; the real implementation
 * lives in `@openheaders/oracle-host-node/sync/sqlite-snapshot` and is
 * loaded only by the lazily-imported command chunk.
 *
 * Restore is the inverse under the same offline gate: verify every
 * checksum first, then REPLACE the state files wholesale (stale
 * `oracle.db-wal`/`-shm` and leftover `blobs/` are dropped — a restore
 * is a rewind, not a merge).
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';

export const BACKUP_FORMAT_VERSION = 1;
export const MANIFEST_FILE = 'manifest.json';

const STORAGE_FILE = 'storage.json';
const ORACLE_DB_FILE = 'oracle.db';
const BLOBS_DIR = 'blobs';
/** Connection-lifetime sidecars; never part of a snapshot, purged on restore. */
const ORACLE_DB_SIDECARS = ['oracle.db-wal', 'oracle.db-shm'];

export interface BackupFileEntry {
  /** Snapshot-relative POSIX path, e.g. `blobs/<wsId>/<fileId>.bin`. */
  path: string;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  formatVersion: number;
  createdAt: string;
  daemonVersion: string;
  files: BackupFileEntry[];
}

export type SqliteSnapshotFn = (sourcePath: string, destPath: string) => Promise<void>;

export interface WriteSnapshotInput {
  dataDir: string;
  destDir: string;
  daemonVersion: string;
  snapshotDatabase: SqliteSnapshotFn;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

/** All files under `blobs/`, as snapshot-relative POSIX paths. */
async function listBlobFiles(dataDir: string): Promise<string[]> {
  const blobsRoot = path.join(dataDir, BLOBS_DIR);
  if (!(await pathExists(blobsRoot))) return [];
  const entries = await fs.readdir(blobsRoot, { recursive: true, withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    files.push(path.relative(dataDir, absolute).split(path.sep).join('/'));
  }
  return files;
}

function toNativePath(root: string, relPosixPath: string): string {
  return path.join(root, ...relPosixPath.split('/'));
}

/**
 * Snapshot the data dir's state files into `destDir` (created; must
 * not already hold anything) and return the manifest that was written.
 */
export async function writeSnapshot(input: WriteSnapshotInput): Promise<BackupManifest> {
  const { dataDir, destDir, daemonVersion, snapshotDatabase } = input;
  const hasStorage = await pathExists(path.join(dataDir, STORAGE_FILE));
  const hasOracleDb = await pathExists(path.join(dataDir, ORACLE_DB_FILE));
  if (!hasStorage && !hasOracleDb) {
    throw new Error(`nothing to back up — ${dataDir} holds no storage.json or oracle.db (never booted?).`);
  }
  if (await pathExists(destDir)) {
    const existing = await fs.readdir(destDir);
    if (existing.length > 0) {
      throw new Error(`destination ${destDir} already exists and is not empty — back up into a fresh directory.`);
    }
  }
  await fs.mkdir(destDir, { recursive: true });

  const relPaths: string[] = [];
  if (hasStorage) {
    await fs.copyFile(path.join(dataDir, STORAGE_FILE), path.join(destDir, STORAGE_FILE));
    relPaths.push(STORAGE_FILE);
  }
  if (hasOracleDb) {
    await snapshotDatabase(path.join(dataDir, ORACLE_DB_FILE), path.join(destDir, ORACLE_DB_FILE));
    relPaths.push(ORACLE_DB_FILE);
  }
  for (const relPath of await listBlobFiles(dataDir)) {
    const dest = toNativePath(destDir, relPath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(toNativePath(dataDir, relPath), dest);
    relPaths.push(relPath);
  }

  const files: BackupFileEntry[] = [];
  for (const relPath of relPaths.sort()) {
    const absolute = toNativePath(destDir, relPath);
    const stat = await fs.stat(absolute);
    files.push({ path: relPath, bytes: stat.size, sha256: await sha256File(absolute) });
  }
  const manifest: BackupManifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    daemonVersion,
    files,
  };
  await fs.writeFile(path.join(destDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  return manifest;
}

function parseFileEntry(value: unknown, index: number): BackupFileEntry {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`manifest.json: files[${index}] is not an object.`);
  }
  const record = value as Record<string, unknown>;
  const { path: relPath, bytes, sha256 } = record;
  if (typeof relPath !== 'string' || typeof bytes !== 'number' || typeof sha256 !== 'string') {
    throw new Error(`manifest.json: files[${index}] must carry string path, number bytes, string sha256.`);
  }
  if (path.isAbsolute(relPath) || relPath.split('/').some((seg) => seg === '..' || seg === '')) {
    throw new Error(`manifest.json: files[${index}] path '${relPath}' escapes the snapshot directory.`);
  }
  return { path: relPath, bytes, sha256 };
}

function parseManifest(text: string): BackupManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('manifest.json is not valid JSON.');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('manifest.json is not an object.');
  const record = raw as Record<string, unknown>;
  const { formatVersion, createdAt, daemonVersion, files } = record;
  if (formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `manifest.json: unsupported formatVersion ${String(formatVersion)} (this oh reads ${BACKUP_FORMAT_VERSION}).`,
    );
  }
  if (typeof createdAt !== 'string' || typeof daemonVersion !== 'string' || !Array.isArray(files)) {
    throw new Error('manifest.json: expected string createdAt, string daemonVersion, array files.');
  }
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt,
    daemonVersion,
    files: files.map(parseFileEntry),
  };
}

/**
 * Read a snapshot's manifest and verify every listed file exists with
 * matching size and sha256 — the integrity gate restore runs before
 * touching the data dir.
 */
export async function verifySnapshot(snapshotDir: string): Promise<BackupManifest> {
  const manifestPath = path.join(snapshotDir, MANIFEST_FILE);
  if (!(await pathExists(manifestPath))) {
    throw new Error(`${snapshotDir} is not a backup — no ${MANIFEST_FILE} (torn backup or wrong directory).`);
  }
  const manifest = parseManifest(await fs.readFile(manifestPath, 'utf-8'));
  for (const entry of manifest.files) {
    const absolute = toNativePath(snapshotDir, entry.path);
    if (!(await pathExists(absolute))) {
      throw new Error(`snapshot is incomplete — ${entry.path} is listed in the manifest but missing.`);
    }
    const stat = await fs.stat(absolute);
    if (stat.size !== entry.bytes || (await sha256File(absolute)) !== entry.sha256) {
      throw new Error(`snapshot is corrupt — ${entry.path} does not match its manifest checksum.`);
    }
  }
  return manifest;
}

/** State files already in the data dir that a restore would replace. */
export async function existingStateFiles(dataDir: string): Promise<string[]> {
  const found: string[] = [];
  for (const relPath of [STORAGE_FILE, ORACLE_DB_FILE, BLOBS_DIR]) {
    if (await pathExists(path.join(dataDir, relPath))) found.push(relPath);
  }
  return found;
}

/**
 * Replace the data dir's state with the (already verified) snapshot.
 * Returns the restored snapshot-relative paths.
 */
export async function restoreSnapshot(
  snapshotDir: string,
  dataDir: string,
  manifest: BackupManifest,
): Promise<string[]> {
  await fs.mkdir(dataDir, { recursive: true });
  for (const relPath of [STORAGE_FILE, ORACLE_DB_FILE, ...ORACLE_DB_SIDECARS]) {
    await fs.rm(path.join(dataDir, relPath), { force: true });
  }
  await fs.rm(path.join(dataDir, BLOBS_DIR), { recursive: true, force: true });
  const restored: string[] = [];
  for (const entry of manifest.files) {
    const dest = toNativePath(dataDir, entry.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(toNativePath(snapshotDir, entry.path), dest);
    restored.push(entry.path);
  }
  return restored;
}
