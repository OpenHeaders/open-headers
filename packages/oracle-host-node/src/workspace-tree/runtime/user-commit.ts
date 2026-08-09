/**
 * Workspace-tree runtime — the Commit tool window's user plane: the
 * working-changes read, the HEAD-vs-worktree file diff, and the
 * user-driven pathspec commit (checked files, Amend, Sign-off,
 * per-commit hooks). §3.3 posture throughout: the user's REAL index is
 * never read or written — the commit rides the same throwaway
 * temp-index pass as the engine's, scoped to the checked paths. Amend
 * is the USER-surface carve-out of the never-amend law, guarded by
 * typed refusals: an unborn HEAD, a merge commit, and a HEAD already
 * reachable from its upstream (amending published history would force
 * a force-push the engine never performs) all refuse.
 */

import { logger } from '@openheaders/core/utils';
import {
  commitParents,
  commitWorkspaceTree,
  ensureWorkspaceRepo,
  isAncestorOf,
  isSafeTreePath,
  isWorkspaceRepo,
  listWorkingChanges,
  localHeadSha,
  readWorkingFileDiff,
  resolveCommitIdentity,
  resolveUpstream,
} from '../../git';
import { type OpenBinding, type RuntimeCtx, SCOPE } from './core';
import type {
  WorkspaceTreeChangesRpcResult,
  WorkspaceTreeFileDiffRpcResult,
  WorkspaceTreeUserCommitInput,
  WorkspaceTreeUserCommitRpcResult,
} from './types';

/** Checked-set cap — beyond this the gesture is a whole-tree commit anyway. */
export const USER_COMMIT_MAX_PATHS = 1_000;

/**
 * The Commit window's changes rows — a pure porcelain read OFF the
 * per-binding chain (the history-read posture): it never queues behind
 * a commit/pull pass, and the window refetches on status frames.
 */
export async function runListChanges(
  ctx: RuntimeCtx,
  workspaceId: string,
  includeIgnored?: boolean,
): Promise<WorkspaceTreeChangesRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const changes = await listWorkingChanges(ctx.gitRun, rootDir, {
    ...(includeIgnored === true ? { includeIgnored: true } : {}),
  });
  if (changes === null) return { ok: false, reason: 'status-failed' };
  return { ok: true, changes };
}

/** One file's HEAD-vs-worktree diff — validated tree path, typed refusals. */
export async function runWorkingFileDiff(
  ctx: RuntimeCtx,
  workspaceId: string,
  filePath: string,
): Promise<WorkspaceTreeFileDiffRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (!isSafeTreePath(filePath)) return { ok: false, reason: 'unknown-path' };
  return readWorkingFileDiff(ctx.gitRun, rootDir, filePath);
}

/** Shape validation of the user-commit input — typed refusals before any git spawn. */
export function validateUserCommitInput(
  input: WorkspaceTreeUserCommitInput,
): { ok: true } | { ok: false; reason: 'empty-message' | 'invalid-paths' | 'no-paths' } {
  if (input.message.trim().length === 0) return { ok: false, reason: 'empty-message' };
  if (input.paths.length > USER_COMMIT_MAX_PATHS || !input.paths.every((path) => isSafeTreePath(path))) {
    return { ok: false, reason: 'invalid-paths' };
  }
  // Zero checked files is only meaningful as a message-only Amend.
  if (input.paths.length === 0 && input.amend !== true) return { ok: false, reason: 'no-paths' };
  return { ok: true };
}

/**
 * One user commit pass — on the binding's chain (§8 single actor, like
 * every write). Flushes the materializer first so the checked paths'
 * bytes are current, resolves identity the §11.3 way (the user's own
 * git config first), and commits the checked set through the
 * temp-index pass. No contributor attribution — this is the operator's
 * own explicit gesture, and the message is theirs verbatim.
 */
export async function runUserCommit(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  input: WorkspaceTreeUserCommitInput,
): Promise<WorkspaceTreeUserCommitRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) {
    const repo = await ensureWorkspaceRepo(ctx.gitRun, rootDir);
    if (!repo.ok) return { ok: false, reason: 'not-a-repo', detail: repo.detail };
  }

  if (input.amend === true) {
    const head = await localHeadSha(ctx.gitRun, rootDir);
    if (head === null) return { ok: false, reason: 'amend-unborn' };
    const parents = await commitParents(ctx.gitRun, rootDir, head);
    if (parents !== null && parents.length > 1) return { ok: false, reason: 'amend-merge' };
    const upstream = await resolveUpstream(ctx.gitRun, rootDir);
    if (upstream !== null && (await isAncestorOf(ctx.gitRun, rootDir, head, upstream.sha))) {
      return { ok: false, reason: 'amend-pushed' };
    }
  }

  await binding.materializer.flush();
  const identity = await resolveCommitIdentity(ctx.gitRun, rootDir, ctx.syntheticIdentity());
  const result = await commitWorkspaceTree({
    run: ctx.gitRun,
    rootDir,
    message: input.message.trim(),
    identityEnv: identity.env,
    paths: input.paths,
    ...(input.amend === true ? { amend: true } : {}),
    ...(input.signOff === true ? { signOff: true } : {}),
    bypassHooks: input.bypassHooks === true,
  });
  if (!result.ok) return { ok: false, reason: result.reason, detail: result.detail };
  if (result.committed) {
    logger.info(SCOPE, `user commit ${rootDir}: ${input.paths.length || 'amend'} paths`);
    return { ok: true, committed: true, sha: result.sha };
  }
  return { ok: true, committed: false };
}
