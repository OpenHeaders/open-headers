/**
 * Workspace-tree runtime — the Commit window's verbs over working
 * files: Add to VCS tracks unversioned paths as intent-to-add (`git
 * add -N`) so the rows move to Changes as added with nothing staged;
 * Delete… removes files from disk (a tracked file then reads as
 * deleted until committed, an unversioned one is gone). Both run on
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
import { intentToAddPaths, isWorkspaceRepo } from '../../git';
import { type OpenBinding, type RuntimeCtx, SCOPE } from './core';
import type { WorkspaceTreeAddToVcsRpcResult, WorkspaceTreeDeletePathsRpcResult } from './types';

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
