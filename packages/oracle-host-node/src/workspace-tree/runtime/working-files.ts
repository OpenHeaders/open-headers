/**
 * Workspace-tree runtime — the Commit window's verbs over working
 * files: Add to VCS tracks unversioned paths as intent-to-add (`git
 * add -N`) so the rows move to Changes as added with nothing staged;
 * Delete… removes files from disk (a tracked file then reads as
 * deleted until committed, an unversioned one is gone); Rollback
 * Changes puts any changed file back as HEAD holds it (`rollback-ops`)
 * and then sweeps, so the engine follows the files the way it follows
 * an outside checkout. All run on
 * the per-binding chain like every write, and the verb wiring
 * publishes a status frame after, so the window refetches and the
 * rows move between groups on their own. Paths are validated tree
 * paths (no `..`, no absolute) resolved under the binding's root;
 * Delete… never recurses — a directory path is refused by the
 * platform, which is the guard against a row that is not a file.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '@openheaders/core/utils';
import {
  countDirtyFiles,
  gitOperationInProgress,
  intentToAddPaths,
  isWorkspaceRepo,
  rollbackWorkingPaths,
} from '../../git';
import { TREE_HELD_DETAIL } from '../materializer';
import { type OpenBinding, type RuntimeCtx, SCOPE } from './core';
import type {
  WorkspaceTreeAddToVcsRpcResult,
  WorkspaceTreeDeletePathsRpcResult,
  WorkspaceTreeRollbackPathsRpcResult,
} from './types';

/** One Add to VCS pass — availability/repo guards, then the intent-to-add. */
export async function runAddToVcs(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  paths: readonly string[],
): Promise<WorkspaceTreeAddToVcsRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const result = await intentToAddPaths(ctx.gitRun, rootDir, paths);
  if (!result.ok) return { ok: false, reason: 'add-failed', detail: result.detail };
  logger.info(SCOPE, `${paths.length} path(s) added to vcs (intent-to-add) for ${rootDir}`);
  return { ok: true };
}

/**
 * One Rollback Changes pass. What the engine still holds unwritten goes
 * to disk first, so the rows git lists are the whole of the uncommitted
 * work; the named files then return to HEAD's, and the sweep takes them
 * in — a rolled-back document is the engine's again as HEAD has it. The
 * commit draft describes work that may be gone: it is spent when nothing
 * is left uncommitted. Refused while a git operation started outside
 * stands (its files are not ours to put back), and like a busy index
 * while git's writing holds what the engine has unwritten.
 */
export async function runRollbackPaths(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  paths: readonly string[],
  deleteAdded: boolean,
): Promise<WorkspaceTreeRollbackPathsRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const operation = await gitOperationInProgress(rootDir);
  if (operation !== null) return { ok: false, reason: 'op-in-progress', detail: operation };
  await binding.service.hydrated;
  if ((await binding.materializer.flushCurrent()).held !== undefined) {
    return { ok: false, reason: 'index-locked', detail: TREE_HELD_DETAIL };
  }
  const result = await rollbackWorkingPaths(ctx.gitRun, rootDir, paths, { deleteAdded });
  if (!result.ok) return { ok: false, reason: result.reason, detail: result.detail };
  if ((await countDirtyFiles(ctx.gitRun, rootDir)) === 0) ctx.drainIntents(binding);
  await ctx.runSweep(binding);
  await binding.materializer.flush();
  logger.info(SCOPE, `${result.rolledBack} change(s) rolled back to HEAD for ${rootDir}`);
  return { ok: true, rolledBack: result.rolledBack };
}

/** One Delete… pass — files removed in order; the first refusal stops the pass and is reported. */
export async function runDeletePaths(
  binding: OpenBinding,
  paths: readonly string[],
): Promise<WorkspaceTreeDeletePathsRpcResult> {
  const { rootDir } = binding.record;
  let deleted = 0;
  for (const filePath of paths) {
    try {
      await fs.rm(path.join(rootDir, filePath));
      deleted += 1;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger.warn(SCOPE, `delete refused for ${filePath} under ${rootDir}: ${detail}`);
      return { ok: false, reason: 'delete-failed', deleted, detail };
    }
  }
  logger.info(SCOPE, `${deleted} file(s) deleted for ${rootDir}`);
  return { ok: true, deleted };
}
