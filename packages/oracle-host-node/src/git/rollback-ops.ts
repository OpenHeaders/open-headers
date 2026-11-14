/**
 * Rollback of working changes (the Commit window's Rollback Changes):
 * each named file goes back to what HEAD holds.
 *
 *   a file HEAD holds, changed or deleted  → its index entry and its
 *                                            working file are HEAD's again;
 *   an added file (HEAD does not hold it)  → it leaves the index and stays
 *                                            on disk, unversioned — or is
 *                                            deleted when the caller asks;
 *   a renamed file                         → the file under its new name
 *                                            goes, the one under its old
 *                                            name comes back from HEAD.
 *
 * What is done is decided from the rows git itself lists, before
 * anything is written (`planRollback`): a path with no change row, an
 * unversioned or an ignored one is not the verb's and is left alone.
 * The index is written under the real index's lock, in the copy the lock
 * holds, and published once every step is through — a busy lock refuses
 * with nothing written, and no other git process sees a half-done
 * rollback in the index. Paths are literal, never patterns. Nothing here
 * is recoverable: the working bytes that are rolled back are gone.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { GitRunner } from './git-exec';
import { withIndexLock } from './index-lock';
import {
  failureDetail,
  listWorkingChanges,
  localHeadSha,
  nulSeparatedPaths,
  repoArgs,
  type WorkingChange,
} from './repo';

export interface RollbackOptions {
  /** Delete an added file from disk instead of leaving it unversioned. */
  deleteAdded?: boolean;
}

export type RollbackResult =
  | { ok: true; rolledBack: number }
  | { ok: false; reason: 'index-locked' | 'rollback-failed'; detail: string };

/** What a rollback does, path by path. */
export interface RollbackPlan {
  /** Paths HEAD holds — the index entry and the working file return to HEAD's. */
  restore: string[];
  /** Paths HEAD does not hold — they leave the index. */
  unadd: string[];
  /** Files removed from disk: a rename's new name, and added files when asked. */
  remove: string[];
  /** The change rows the plan rolls back. */
  rolledBack: number;
}

/**
 * Decide the rollback of `paths` from the working changes as git lists
 * them and from which paths HEAD holds. A rename's origin is restored
 * only when it is gone — an origin with a row of its own is a file that
 * still stands (a copy), and its changes are its own row's to roll back.
 */
export function planRollback(
  changes: readonly WorkingChange[],
  inHead: ReadonlySet<string>,
  paths: readonly string[],
  options: RollbackOptions = {},
): RollbackPlan {
  const rows = new Map(changes.map((change) => [change.path, change]));
  const restore = new Set<string>();
  const unadd = new Set<string>();
  const remove = new Set<string>();
  let rolledBack = 0;
  for (const filePath of new Set(paths)) {
    const row = rows.get(filePath);
    if (row === undefined || row.unversioned || row.ignored) continue;
    rolledBack += 1;
    if (inHead.has(filePath)) {
      restore.add(filePath);
    } else {
      unadd.add(filePath);
      if (row.renamedFrom !== undefined || options.deleteAdded === true) remove.add(filePath);
    }
    const origin = row.renamedFrom;
    if (origin !== undefined && inHead.has(origin) && !rows.has(origin)) restore.add(origin);
  }
  return { restore: [...restore], unadd: [...unadd], remove: [...remove], rolledBack };
}

/** The paths of `candidates` that HEAD's tree holds; none on an unborn branch. */
async function heldByHead(
  run: GitRunner,
  rootDir: string,
  candidates: readonly string[],
): Promise<ReadonlySet<string> | { detail: string }> {
  if (candidates.length === 0 || (await localHeadSha(run, rootDir)) === null) return new Set();
  const listed = await run([...repoArgs(rootDir), 'ls-tree', '-z', '--name-only', 'HEAD', '--', ...candidates], {
    cwd: rootDir,
  });
  if (listed.code !== 0) return { detail: failureDetail(listed) };
  return new Set(nulSeparatedPaths(listed.stdout));
}

/** Roll the working changes at `paths` back to HEAD. */
export async function rollbackWorkingPaths(
  run: GitRunner,
  rootDir: string,
  paths: readonly string[],
  options: RollbackOptions = {},
): Promise<RollbackResult> {
  const changes = await listWorkingChanges(run, rootDir);
  if (changes === null)
    return { ok: false, reason: 'rollback-failed', detail: 'the working changes could not be read' };
  const asked = new Set(paths);
  const origins = changes.flatMap((change) =>
    asked.has(change.path) && change.renamedFrom !== undefined ? [change.renamedFrom] : [],
  );
  const inHead = await heldByHead(run, rootDir, [...new Set([...paths, ...origins])]);
  if ('detail' in inHead) return { ok: false, reason: 'rollback-failed', detail: inHead.detail };
  const plan = planRollback(changes, inHead, paths, options);
  if (plan.rolledBack === 0) return { ok: true, rolledBack: 0 };

  return withIndexLock<RollbackResult>(
    run,
    rootDir,
    (refusal) => ({
      ok: false,
      reason: refusal.reason === 'index-locked' ? 'index-locked' : 'rollback-failed',
      detail: refusal.detail,
    }),
    async (lock) => {
      const env = { ...lock.env, GIT_LITERAL_PATHSPECS: '1' };
      if (plan.unadd.length > 0) {
        // Forced: git refuses to drop an entry that differs from both HEAD and the working file; the file stays.
        const dropped = await run([...repoArgs(rootDir), 'rm', '--cached', '-f', '--quiet', '--', ...plan.unadd], {
          cwd: rootDir,
          env,
        });
        if (dropped.code !== 0) return { ok: false, reason: 'rollback-failed', detail: failureDetail(dropped) };
      }
      if (plan.restore.length > 0) {
        const restored = await run([...repoArgs(rootDir), 'checkout', 'HEAD', '--', ...plan.restore], {
          cwd: rootDir,
          env,
        });
        if (restored.code !== 0) return { ok: false, reason: 'rollback-failed', detail: failureDetail(restored) };
      }
      for (const filePath of plan.remove) {
        try {
          await fs.rm(path.join(rootDir, filePath), { force: true });
        } catch (err) {
          return { ok: false, reason: 'rollback-failed', detail: err instanceof Error ? err.message : String(err) };
        }
      }
      if (!(await lock.publish())) {
        return { ok: false, reason: 'rollback-failed', detail: 'the index could not be replaced' };
      }
      return { ok: true, rolledBack: plan.rolledBack };
    },
  );
}
