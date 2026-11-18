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
 *
 * And one file that is git's to read: `.gitignore`, holding `*` — the
 * sidecar keeps itself out of the user's own git whatever the folder's
 * root `.gitignore` has come to say (a line that takes the entry back,
 * a link at its name, no file at all).
 *
 * The sidecar is a real directory, asked at its own name before every
 * read and write. A commit can put something else there — a branch whose
 * tree holds a link or a file at the name, checked out by git, which
 * takes the directory away for it. A link would hand the engine a
 * baseline of a peer's making: the materializer removes what its
 * baseline lists, so a file of the user's named there by its hash would
 * go. A file would leave the engine no sidecar at all, and no pass could
 * run — after a checkout from a terminal, which no door of ours can
 * refuse. Either is taken away by the name, a link never followed and
 * never read, and the sidecar is made anew beside the documents, empty,
 * which reads as no baseline at all — and holds no lock: an open binding
 * asks for its own again after every pass (`runtime/lock.ts`). The
 * commit still holds what was taken, and git lists it as deleted. What
 * stands there and is none of the three is not the engine's to take
 * away: a read answers nothing, and a write fails, saying so.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { GITIGNORE_FILE, OH_SIDECAR_DIR, type TreeUnknownFields } from '@openheaders/core/workspace-tree';
import { failureCode, isGone, putRegularFile, readRegularFile, TreeBoundary } from '../git';

const LOCK_FILE = 'lock';
const UNKNOWN_FIELDS_FILE = 'unknown-fields.json';
const MATERIALIZED_INDEX_FILE = 'materialized-index.json';
const QUARANTINE_INDEX_FILE = 'quarantined-files.json';

/** The sidecar's own ignore file: everything in it, itself included. */
const SIDECAR_IGNORE_CONTENT = '*\n';

export function sidecarDir(rootDir: string): string {
  return path.join(rootDir, OH_SIDECAR_DIR);
}

/**
 * What stands at the sidecar's name: the directory, nothing, or what is
 * there instead. A link or a file at the name is taken away — by the
 * name, never through it — and nothing stands then.
 */
async function lookAtSidecar(rootDir: string): Promise<'directory' | 'absent' | 'not-a-directory'> {
  const dir = sidecarDir(rootDir);
  const stat = await fs.lstat(dir).catch((err: unknown) => {
    if (isGone(failureCode(err))) return null;
    throw err;
  });
  if (stat === null) return 'absent';
  if (stat.isDirectory()) return 'directory';
  if (!stat.isSymbolicLink() && !stat.isFile()) return 'not-a-directory';
  await fs.unlink(dir);
  return 'absent';
}

/** The sidecar, made where it is not there — before a write. Fails where its name is taken by what is no directory. */
async function ensureSidecarDir(rootDir: string): Promise<void> {
  const stands = await lookAtSidecar(rootDir);
  if (stands === 'directory') return;
  if (stands === 'not-a-directory') throw new Error(`"${OH_SIDECAR_DIR}" is not a directory`);
  await fs.mkdir(sidecarDir(rootDir), { recursive: true });
}

/**
 * Keep the sidecar's own ignore file: authored where it is not there or
 * holds anything else, a regular file like the folder's (`git/regular-file.ts`)
 * — a link at its name is replaced, never written through.
 */
export async function ensureSidecarIgnore(rootDir: string): Promise<void> {
  await ensureSidecarDir(rootDir);
  const dir = sidecarDir(rootDir);
  const standing = await readRegularFile(path.join(dir, GITIGNORE_FILE));
  if (standing.kind === 'unread') return;
  if (standing.kind === 'text' && standing.text === SIDECAR_IGNORE_CONTENT) return;
  await putRegularFile(new TreeBoundary(dir), GITIGNORE_FILE, SIDECAR_IGNORE_CONTENT);
}

/** One of the sidecar's JSON files, null where it is not there or does not parse — or the sidecar itself is not. */
async function readSidecarJson<T>(rootDir: string, file: string): Promise<T | null> {
  if ((await lookAtSidecar(rootDir)) !== 'directory') return null;
  try {
    return JSON.parse(await fs.readFile(path.join(sidecarDir(rootDir), file), 'utf-8')) as T;
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
  const holder = await readSidecarJson<TreeLockHolder>(rootDir, LOCK_FILE);
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
  const holder = await readSidecarJson<TreeLockHolder>(rootDir, LOCK_FILE);
  if (holder && holder.pid === process.pid && holder.hostId === hostId) {
    await fs.rm(lockPath(rootDir), { force: true });
  }
}

// ── Unknown-field rows ───────────────────────────────────────────────

export async function readTreeUnknownFields(rootDir: string): Promise<TreeUnknownFields> {
  const value = await readSidecarJson<TreeUnknownFields>(rootDir, UNKNOWN_FIELDS_FILE);
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
  const value = await readSidecarJson<unknown>(rootDir, MATERIALIZED_INDEX_FILE);
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
  const value = await readSidecarJson<unknown>(rootDir, QUARANTINE_INDEX_FILE);
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
