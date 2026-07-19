/**
 * `.oh/` sidecar — the engine's per-tree working directory
 * (SYNC_ENGINE_DESIGN.md §23.8; GIT_PLAN.md §3.1 rung 3: disposable,
 * rebuildable, never committed).
 *
 * This slice owns three sidecar artifacts:
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
 *                            (the watcher slice ingests it instead).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { OH_SIDECAR_DIR, type TreeUnknownFields } from '@openheaders/core/workspace-tree';

const LOCK_FILE = 'lock';
const UNKNOWN_FIELDS_FILE = 'unknown-fields.json';
const MATERIALIZED_INDEX_FILE = 'materialized-index.json';

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

// ── Materialized index ───────────────────────────────────────────────

export async function readMaterializedIndex(rootDir: string): Promise<string[]> {
  const value = await readJsonFile<string[]>(path.join(sidecarDir(rootDir), MATERIALIZED_INDEX_FILE));
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export async function writeMaterializedIndex(rootDir: string, paths: readonly string[]): Promise<void> {
  await ensureSidecarDir(rootDir);
  await writeJsonFileAtomic(path.join(sidecarDir(rootDir), MATERIALIZED_INDEX_FILE), [...paths].sort());
}
