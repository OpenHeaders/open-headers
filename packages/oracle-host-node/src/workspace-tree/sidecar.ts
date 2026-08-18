/**
 * `.oh/` sidecar — the engine's per-tree working directory
 * (the sync-engine design §23.8; the git-sync plan §3.1 rung 3: disposable,
 * rebuildable, never committed).
 *
 * This slice owns four sidecar artifacts:
 *   - `lock`               — the exclusive-bind lockfile (§3.5: one
 *                            working tree, one engine instance);
 *   - `unknown-fields.json` — per-document unknown-field rows captured
 *                            on tree reads, re-attached on materialize
 *                            so hand-added / newer-client fields survive
 *                            the engine round-trip;
 *   - `materialized-index.json` — the path set the last materialize
 *                            wrote. Deletion authority: the materializer
 *                            only ever removes paths it previously wrote
 *                            itself — a hand-added entity file is never
 *                            swept by a snapshot that doesn't know it yet
 *                            (the watcher slice ingests it instead);
 *   - `quarantined-files.json` — the foreign bytes the integrate passes
 *                            quarantined into the worktree (§13.3), so a
 *                            later pass can tell its own machine write
 *                            from a user hand edit at the same path.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { OH_SIDECAR_DIR, type TreeUnknownFields } from '@openheaders/core/workspace-tree';

const LOCK_FILE = 'lock';
const UNKNOWN_FIELDS_FILE = 'unknown-fields.json';
const MATERIALIZED_INDEX_FILE = 'materialized-index.json';
const QUARANTINE_INDEX_FILE = 'quarantined-files.json';

export function sidecarDir(rootDir: string): string {
  return path.join(rootDir, OH_SIDECAR_DIR);
}

async function ensureSidecarDir(rootDir: string): Promise<void> {
  await fs.mkdir(sidecarDir(rootDir), { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

// ── Exclusive-bind lockfile ──────────────────────────────────────────

export interface TreeLockHolder {
  pid: number;
  hostId: string;
  acquiredAt: string;
}

export type TreeLockResult = { ok: true } | { ok: false; holder: TreeLockHolder };

function lockPath(rootDir: string): string {
  return path.join(sidecarDir(rootDir), LOCK_FILE);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Acquire the exclusive tree lock. Re-entrant for the same
 * `(pid, hostId)`; a lock whose holder process is gone is stale and
 * replaced (crash recovery — a dead engine must not brick its tree).
 */
export async function acquireTreeLock(rootDir: string, hostId: string): Promise<TreeLockResult> {
  await ensureSidecarDir(rootDir);
  const payload: TreeLockHolder = { pid: process.pid, hostId, acquiredAt: new Date().toISOString() };
  const body = JSON.stringify(payload, null, 2);
  try {
    await fs.writeFile(lockPath(rootDir), body, { encoding: 'utf-8', flag: 'wx' });
    return { ok: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
  }
  const holder = await readJsonFile<TreeLockHolder>(lockPath(rootDir));
  if (holder && holder.pid === process.pid && holder.hostId === hostId) return { ok: true };
  if (holder && typeof holder.pid === 'number' && isPidAlive(holder.pid)) {
    return { ok: false, holder };
  }
  // Stale (unreadable payload or dead holder) — replace.
  await fs.writeFile(lockPath(rootDir), body, 'utf-8');
  return { ok: true };
}

/** Release the tree lock if this process holds it; no-op otherwise. */
export async function releaseTreeLock(rootDir: string, hostId: string): Promise<void> {
  const holder = await readJsonFile<TreeLockHolder>(lockPath(rootDir));
  if (holder && holder.pid === process.pid && holder.hostId === hostId) {
    await fs.rm(lockPath(rootDir), { force: true });
  }
}

// ── Unknown-field rows ───────────────────────────────────────────────

export async function readTreeUnknownFields(rootDir: string): Promise<TreeUnknownFields> {
  const value = await readJsonFile<TreeUnknownFields>(path.join(sidecarDir(rootDir), UNKNOWN_FIELDS_FILE));
  return value ?? {};
}

export async function writeTreeUnknownFields(rootDir: string, unknowns: TreeUnknownFields): Promise<void> {
  await ensureSidecarDir(rootDir);
  await writeJsonFileAtomic(path.join(sidecarDir(rootDir), UNKNOWN_FIELDS_FILE), unknowns);
}

// ── Materialized index (the three-way baseline) ──────────────────────

/**
 * `path → sha256(content)` of what the materializer last wrote. The
 * hash is what upgrades the index from a deletion authority into the
 * sweep's THREE-WAY baseline: a disk file whose bytes still match its
 * baseline hash was last touched by the engine (stale materialization
 * at worst — never an external edit), while a mismatch or an
 * off-baseline file is rung-2 external input.
 */
export type MaterializedIndex = Record<string, string>;

/** Canonical content hash for baseline entries. */
export function hashTreeContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export async function readMaterializedIndex(rootDir: string): Promise<MaterializedIndex> {
  const value = await readJsonFile<unknown>(path.join(sidecarDir(rootDir), MATERIALIZED_INDEX_FILE));
  // Pre-hash format (S3): a bare path array. Empty hashes make every
  // present file read as externally changed, which is the safe
  // tree-wins direction for a one-time upgrade of a disposable cache.
  if (Array.isArray(value)) {
    const index: MaterializedIndex = {};
    for (const entry of value) {
      if (typeof entry === 'string') index[entry] = '';
    }
    return index;
  }
  if (value !== null && typeof value === 'object') {
    const index: MaterializedIndex = {};
    for (const [key, hash] of Object.entries(value as Record<string, unknown>)) {
      if (typeof hash === 'string') index[key] = hash;
    }
    return index;
  }
  return {};
}

export async function writeMaterializedIndex(rootDir: string, index: MaterializedIndex): Promise<void> {
  await ensureSidecarDir(rootDir);
  const sorted: MaterializedIndex = {};
  for (const key of Object.keys(index).sort()) sorted[key] = index[key];
  await writeJsonFileAtomic(path.join(sidecarDir(rootDir), MATERIALIZED_INDEX_FILE), sorted);
}

// ── Quarantine index (§13.3 machine-write provenance) ────────────────

/**
 * `path → sha256(content)` of the foreign bytes the last integrate
 * passes wrote into the worktree as quarantine. Bytes that still match
 * their record are the engine's own write — safe to re-adopt into the
 * baseline once a later foreign head reads clean at that path. A user
 * hand edit never matches and stays protected rung-2 input.
 */
export type QuarantineIndex = Record<string, string>;

export async function readQuarantineIndex(rootDir: string): Promise<QuarantineIndex> {
  const value = await readJsonFile<unknown>(path.join(sidecarDir(rootDir), QUARANTINE_INDEX_FILE));
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  const index: QuarantineIndex = {};
  for (const [key, hash] of Object.entries(value as Record<string, unknown>)) {
    if (typeof hash === 'string') index[key] = hash;
  }
  return index;
}

export async function writeQuarantineIndex(rootDir: string, index: QuarantineIndex): Promise<void> {
  await ensureSidecarDir(rootDir);
  const sorted: QuarantineIndex = {};
  for (const key of Object.keys(index).sort()) sorted[key] = index[key];
  await writeJsonFileAtomic(path.join(sidecarDir(rootDir), QUARANTINE_INDEX_FILE), sorted);
}
