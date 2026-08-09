/**
 * Workspace-tree runtime — the branch plane (§6 + the IDE-log activity
 * bar): the wrapped switch, create-from (dialog semantics), safe
 * delete, per-branch upstream update, merge, and the §6.3 log-pointer
 * sync. Every mutating pass runs on the binding's chain; caller-
 * supplied targets are validated SHAPES with membership checks —
 * never revision expressions.
 */

import { logger } from '@openheaders/core/utils';
import {
  createLocalBranch,
  currentBranch,
  deleteLocalBranch,
  isCommitSha,
  isSafeRefName,
  isWorkspaceRepo,
  listLocalBranches,
  listRepoRefs,
  resolveCommitIdentity,
  resolveRefSha,
  updateBranchFromUpstream,
} from '../../git';
import { supportsBranchScope } from '../../sync/sqlite-mutation-log';
import { mergeWorkspaceBranch } from '../merge';
import { type SwitchDirtyAction, switchWorkspaceBranch } from '../switch';
import { syntheticIdentity } from './commit';
import { type OpenBinding, type RuntimeCtx, SCOPE, TREE_SURFACE_ID } from './core';
import type {
  CreateBranchOptions,
  CreateBranchRpcResult,
  DeleteBranchRpcResult,
  MergeBranchRpcResult,
  SwitchBranchRpcResult,
  UpdateBranchRpcResult,
} from './types';

/**
 * Keep the §6.3 per-branch log pointer in step with HEAD — called at
 * bind-open (once the repo exists) and after every checkout, in-app
 * or external. Non-SQLite logs (tests' in-memory doubles) simply
 * don't scope; the pointer is remembered either way so the HEAD
 * watcher can tell a real move from an echo.
 */
export async function syncLogBranch(ctx: RuntimeCtx, binding: OpenBinding): Promise<boolean> {
  const branch = await currentBranch(ctx.gitRun, binding.record.rootDir);
  const changed = branch !== binding.logBranch;
  binding.logBranch = branch;
  if (supportsBranchScope(binding.service.log)) {
    binding.service.log.setActiveBranch(branch ?? '');
  }
  return changed;
}

/**
 * One branch-switch pass — always on the binding's chain (§8). The
 * wrapped checkout runs with the user's §6.2 answer; a successful
 * switch flips the §6.3 log pointer, then converges the engine to
 * the new branch's tree through the same rung-2 tree-wins sweep an
 * external checkout takes (a bare HEAD move between identical trees
 * sweeps as a no-op via the hashed baseline).
 */
export async function runSwitchBranch(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  branch: string,
  dirtyAction?: SwitchDirtyAction,
): Promise<SwitchBranchRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  await binding.service.hydrated;
  const result = await switchWorkspaceBranch({
    run: ctx.gitRun,
    rootDir,
    branch,
    ...(dirtyAction !== undefined ? { dirtyAction } : {}),
    commit: async () => {
      const committed = await ctx.runCommit(binding);
      if (committed.ok && committed.committed) await ctx.maybeAutoPush(binding);
      return committed.ok ? { ok: true } : { ok: false, detail: committed.detail ?? committed.reason };
    },
  });
  if (!result.ok) return result;
  if (result.switched) {
    // Stash/discard emptied the tree's uncommitted delta and the
    // sweep below re-derives engine state from the new branch — the
    // old branch's pending intents describe mutations that are no
    // longer this branch's story.
    ctx.drainIntents(binding);
    await syncLogBranch(ctx, binding);
    await ctx.runSweep(binding);
    await binding.materializer.flush();
    logger.info(SCOPE, `switched ${rootDir} to ${branch}`);
  }
  return result;
}

/**
 * One create-branch pass — the New Branch dialog's semantics: start
 * point `from` (ref name from the tree or a full sha), optional
 * checkout (default true, the historic `checkout -b` gesture — dirty
 * work rides along), optional overwrite (`-B` / `branch -f`; the
 * current branch refuses — that would be a history edit under HEAD).
 * A checkout to a non-HEAD start point moves the tree, so the engine
 * converges through the same sweep a switch runs.
 */
export async function runCreateBranch(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  branch: string,
  options?: CreateBranchOptions,
): Promise<CreateBranchRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };

  const checkout = options?.checkout ?? true;
  const overwrite = options?.overwrite ?? false;
  const from = options?.from;
  if (from !== undefined) {
    // A start point is a ref NAME the tree lists or a FULL sha (the
    // Restore path) — never a revision expression.
    if (!isSafeRefName(from) && !isCommitSha(from)) return { ok: false, reason: 'unknown-ref' };
    if (!isCommitSha(from)) {
      const refs = await listRepoRefs(ctx.gitRun, rootDir);
      if (refs === null || !refs.some((ref) => ref.name === from)) return { ok: false, reason: 'unknown-ref' };
    } else if ((await resolveRefSha(ctx.gitRun, rootDir, from)) === null) {
      return { ok: false, reason: 'unknown-ref' };
    }
  }

  const current = await currentBranch(ctx.gitRun, rootDir);
  const exists = (await resolveRefSha(ctx.gitRun, rootDir, `refs/heads/${branch}`)) !== null;
  if (exists && !overwrite) return { ok: false, reason: 'exists' };
  if (exists && overwrite && branch === current) return { ok: false, reason: 'current-branch' };

  const created = await createLocalBranch(ctx.gitRun, rootDir, branch, {
    ...(from !== undefined ? { from } : {}),
    checkout,
    overwrite,
  });
  if (!created.ok) return { ok: false, reason: 'create-failed', detail: created.detail };
  if (checkout) {
    await syncLogBranch(ctx, binding);
    if (from !== undefined) {
      // The checkout moved the tree to the start point — converge the
      // engine exactly like a switch (no-op via the hashed baseline
      // when the trees are identical). The intent ring stays: dirty
      // work rode along and is still this tree's story.
      await ctx.runSweep(binding);
      await binding.materializer.flush();
    }
  }
  logger.info(SCOPE, `created branch ${branch} at ${rootDir}${from !== undefined ? ` from ${from}` : ''}`);
  return { ok: true, branch, checkedOut: checkout };
}

/**
 * One delete-branch pass — safe delete of a NON-current local branch
 * (`git branch -d`; unmerged work refuses through git's own guard).
 * The pre-delete sha rides the answer for the Restore toast.
 */
export async function runDeleteBranch(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  branch: string,
): Promise<DeleteBranchRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (!isSafeRefName(branch)) return { ok: false, reason: 'unknown-branch' };
  const locals = await listLocalBranches(ctx.gitRun, rootDir);
  if (!locals.includes(branch)) return { ok: false, reason: 'unknown-branch' };
  if (branch === (await currentBranch(ctx.gitRun, rootDir))) return { ok: false, reason: 'current-branch' };
  const result = await deleteLocalBranch(ctx.gitRun, rootDir, branch);
  if (!result.ok) return { ok: false, reason: 'delete-failed', detail: result.detail };
  logger.info(SCOPE, `deleted branch ${branch} at ${rootDir} (was ${result.sha.slice(0, 8)})`);
  return { ok: true, branch, sha: result.sha };
}

/**
 * One update-branch pass (IDE-log Update Selected): fast-forward a
 * NON-current local branch from its own upstream without touching the
 * working tree. The current branch refuses — its honest in-app update
 * is the pull gesture, which the surface routes to instead.
 */
export async function runUpdateBranch(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  branch: string,
): Promise<UpdateBranchRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (!isSafeRefName(branch)) return { ok: false, reason: 'unknown-branch' };
  const locals = await listLocalBranches(ctx.gitRun, rootDir);
  if (!locals.includes(branch)) return { ok: false, reason: 'unknown-branch' };
  if (branch === (await currentBranch(ctx.gitRun, rootDir))) return { ok: false, reason: 'current-branch' };
  binding.lastFetchAt = Date.now();
  const result = await updateBranchFromUpstream(ctx.gitRun, rootDir, branch);
  if (!result.ok) {
    return result.reason === 'no-upstream'
      ? { ok: false, reason: 'no-upstream' }
      : { ok: false, reason: 'update-failed', ...(result.detail !== undefined ? { detail: result.detail } : {}) };
  }
  logger.info(SCOPE, `updated branch ${branch} from upstream at ${rootDir}`);
  return { ok: true, branch };
}

/**
 * One branch-merge pass — always on the binding's chain. Local
 * uncommitted work commits FIRST under its own semantic draft
 * (exactly like pull: the merge commit stays a pure merge); the
 * watermark is untouched — merging a local ref is not a remote sync.
 */
export async function runMergeBranch(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  ref: string,
): Promise<MergeBranchRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (await ctx.heldByGitOperation(binding)) return { ok: false, reason: 'op-in-progress' };
  await binding.service.hydrated;

  const pre = await ctx.runCommit(binding);
  if (!pre.ok) return { ok: false, reason: 'commit-failed', detail: pre.detail ?? pre.reason };

  const identity = await resolveCommitIdentity(ctx.gitRun, rootDir, syntheticIdentity());
  const result = await mergeWorkspaceBranch({
    run: ctx.gitRun,
    rootDir,
    ref,
    workspaceUid: binding.record.workspaceId,
    readSnapshot: () => ctx.buildSnapshot(binding.record.workspaceId),
    nextCtx: () => binding.service.context.next({ surfaceId: TREE_SURFACE_ID }),
    liveSetEntries: (entityType, id, setPath) =>
      binding.service.oracle
        .liveOrderedSetItems(entityType, id, setPath)
        .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
    apply: (batches) => ctx.applyAll(binding.service, batches),
    flush: () => binding.materializer.flush(),
    identityEnv: identity.env,
    bypassHooks: binding.record.bypassHooks === true,
  });
  if (!result.ok) {
    ctx.appendIssues(binding, result.issues);
    return { ok: false, reason: result.reason, detail: result.detail };
  }
  if (result.upToDate) return { ok: true, upToDate: true };
  await ctx.refreshIssuesFromDisk(binding);
  ctx.drainIntents(binding);
  logger.info(SCOPE, `merged ${ref} into ${rootDir}: ${result.sha} (${result.applied} batches)`);
  return { ok: true, upToDate: false, sha: result.sha, applied: result.applied };
}
