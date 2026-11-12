/**
 * runEntitiesAtCommit — the read that names a commit's files by what
 * they belonged to THEN: each path's entity, and the collection and
 * folders above it, from the commit's own manifests (`commit-entities`).
 * The surfaces ask it only for files the workspace holds no entity for.
 * A pure repo read off the per-binding chain; the commit is a full sha
 * and every path a validated shape, never a revision expression.
 */

import { isCommitSha, isSafeTreePath, isWorkspaceRepo } from '../../git';
import { readCommitEntities } from '../commit-entities';
import type { RuntimeCtx } from './core';
import type { WorkspaceTreeEntitiesAtCommitRpcResult } from './types';

/** One commit's files in one ask — past any commit a person reads row by row. */
const MAX_PATHS = 2000;

export async function runEntitiesAtCommit(
  ctx: RuntimeCtx,
  workspaceId: string,
  sha: string,
  paths: readonly string[],
): Promise<WorkspaceTreeEntitiesAtCommitRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (!isCommitSha(sha)) return { ok: false, reason: 'unknown-commit' };
  if (paths.length > MAX_PATHS || !paths.every((path) => isSafeTreePath(path))) {
    return { ok: false, reason: 'unknown-path' };
  }
  const entities = await readCommitEntities(ctx.gitRun, rootDir, sha, paths);
  return entities === null ? { ok: false, reason: 'unknown-commit' } : { ok: true, entities };
}
