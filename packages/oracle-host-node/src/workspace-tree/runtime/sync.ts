/**
 * Workspace-tree runtime — the remote-sync plane: background and
 * explicit fetch, the pull/push gestures, the auto-push opt-in rider,
 * and the §16 force-push resolution pass. Every mutating pass runs on
 * the binding's chain (§8 single actor); fetch never mutates the
 * working tree (§3.2).
 */

import { logger } from '@openheaders/core/utils';
import {
  currentBranch,
  fetchAllRemotes,
  fetchWorkspaceRemote,
  isWorkspaceRepo,
  pushWorkspaceBranch,
  resolveCommitIdentity,
  resolveUpstream,
} from '../../git';
import type { ForcePushChoice } from '../force-push';
import { resolveForcePushWorkspaceTree } from '../force-push';
import { pullWorkspaceTree } from '../pull';
import { syntheticIdentity } from './commit';
import { type OpenBinding, type RuntimeCtx, SCOPE, TREE_SURFACE_ID } from './core';
import type {
  FetchWorkspaceTreeRpcResult,
  PullWorkspaceTreeRpcResult,
  PushWorkspaceTreeRpcResult,
  ResolveForcePushRpcResult,
} from './types';

/**
 * One background fetch pass (§3.2: fetch always on, non-mutating) —
 * refreshes the remote-tracking ref so ahead/behind is honest, then
 * republishes the status. Skipped without a repo or an upstream;
 * failures (offline, credentials) log and keep the last-known counts.
 */
export function enqueueFetch(ctx: RuntimeCtx, binding: OpenBinding, trigger: string): void {
  ctx.enqueue(binding, async () => {
    const { rootDir } = binding.record;
    const availability = await ctx.ensureGitAvailability(rootDir);
    if (!availability.available) return;
    if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return;
    if ((await resolveUpstream(ctx.gitRun, rootDir)) === null) return;
    binding.lastFetchAt = Date.now();
    const fetched = await fetchWorkspaceRemote(ctx.gitRun, rootDir);
    if (!fetched.ok) {
      logger.warn(SCOPE, `${trigger} fetch failed for ${rootDir}: ${fetched.detail}`);
      return;
    }
    await ctx.publishGitStatus(binding);
  });
}

/**
 * The explicit Fetch gesture (IDE-log activity bar) — every remote,
 * pruned. Unlike the background pass this one answers typed failures:
 * the user clicked a button and deserves the honest refusal.
 */
export async function runFetchAll(ctx: RuntimeCtx, binding: OpenBinding): Promise<FetchWorkspaceTreeRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  binding.lastFetchAt = Date.now();
  const result = await fetchAllRemotes(ctx.gitRun, rootDir);
  if (!result.ok) {
    return result.reason === 'no-remote'
      ? { ok: false, reason: 'no-remote' }
      : { ok: false, reason: 'fetch-failed', ...(result.detail !== undefined ? { detail: result.detail } : {}) };
  }
  return { ok: true };
}

/**
 * One pull pass — always on the binding's chain (§8 single actor).
 * Local uncommitted work commits FIRST under its own semantic draft
 * (the merge commit stays a pure merge); the intent ring drains with
 * the merge since everything applied is now committed.
 */
export async function runPull(ctx: RuntimeCtx, binding: OpenBinding): Promise<PullWorkspaceTreeRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (await ctx.heldByGitOperation(binding)) return { ok: false, reason: 'op-in-progress' };
  await binding.service.hydrated;

  const pre = await ctx.runCommit(binding);
  if (!pre.ok) return { ok: false, reason: 'commit-failed', detail: pre.detail ?? pre.reason };

  const identity = await resolveCommitIdentity(ctx.gitRun, rootDir, syntheticIdentity());
  const pullWatermark = ctx.watermarkFor(binding, await currentBranch(ctx.gitRun, rootDir));
  const result = await pullWorkspaceTree({
    run: ctx.gitRun,
    rootDir,
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
    ...(pullWatermark !== undefined ? { lastSyncedRemoteSha: pullWatermark } : {}),
  });
  binding.lastFetchAt = Date.now();
  if (!result.ok) {
    ctx.appendIssues(binding, result.issues);
    return { ok: false, reason: result.reason, detail: result.detail };
  }
  await ctx.refreshIssuesFromDisk(binding);
  // §16 watermark: this remote head is now integrated — the next
  // fetch compares ancestry against it.
  await ctx.recordWatermark(binding, result.remoteSha);
  if (result.upToDate) return { ok: true, upToDate: true };
  ctx.drainIntents(binding);
  logger.info(SCOPE, `pulled ${rootDir}: merge ${result.sha} (${result.applied} batches)`);
  return { ok: true, upToDate: false, sha: result.sha, applied: result.applied };
}

/**
 * One push pass — always on the binding's chain. Push is only ever
 * this explicit gesture or the auto-push-on-commit opt-in (§3.2);
 * a detected history rewrite refuses until the §16 trichotomy
 * resolves it.
 */
export async function runPush(ctx: RuntimeCtx, binding: OpenBinding): Promise<PushWorkspaceTreeRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const pushBranch = await currentBranch(ctx.gitRun, rootDir);
  const rewrite = await ctx.detectForcePush(binding, pushBranch, await resolveUpstream(ctx.gitRun, rootDir));
  if (rewrite !== null) return { ok: false, reason: 'force-push', detail: rewrite.remoteSha };
  const result = await pushWorkspaceBranch(ctx.gitRun, rootDir);
  if (!result.ok) return result;
  await ctx.recordWatermark(binding, result.remoteSha);
  if (result.pushed) logger.info(SCOPE, `pushed ${rootDir}: ${result.remoteSha}`);
  return result;
}

/** The auto-push-on-commit opt-in — rides a successful commit pass; failures log, never block. */
export async function maybeAutoPush(ctx: RuntimeCtx, binding: OpenBinding): Promise<void> {
  if (binding.record.autoPushOnCommit !== true) return;
  const result = await runPush(ctx, binding);
  if (!result.ok) logger.warn(SCOPE, `auto-push failed for ${binding.record.rootDir}: ${result.reason}`);
}

/**
 * One §16 resolution pass — always on the binding's chain. Local
 * uncommitted work commits first (under its own semantic draft) so
 * every choice — including the rescue branch — operates on complete
 * local material; the watermark advances to the accepted head.
 */
export async function runResolveForcePush(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  choice: ForcePushChoice,
): Promise<ResolveForcePushRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const lastSyncedSha = ctx.watermarkFor(binding, await currentBranch(ctx.gitRun, rootDir));
  if (lastSyncedSha === undefined) return { ok: false, reason: 'not-rewritten' };
  await binding.service.hydrated;

  const pre = await ctx.runCommit(binding);
  if (!pre.ok) return { ok: false, reason: 'commit-failed', detail: pre.detail ?? pre.reason };

  const identity = await resolveCommitIdentity(ctx.gitRun, rootDir, syntheticIdentity());
  const result = await resolveForcePushWorkspaceTree({
    run: ctx.gitRun,
    rootDir,
    choice,
    workspaceUid: binding.record.workspaceId,
    lastSyncedRemoteSha: lastSyncedSha,
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
  binding.lastFetchAt = Date.now();
  if (!result.ok) {
    ctx.appendIssues(binding, result.issues);
    return { ok: false, reason: result.reason, detail: result.detail };
  }
  await ctx.refreshIssuesFromDisk(binding);
  ctx.drainIntents(binding);
  await ctx.recordWatermark(binding, result.remoteSha);
  logger.info(SCOPE, `force-push resolved (${choice}) for ${rootDir}: ${result.sha}`);
  return { ok: true, sha: result.sha, rescueBranch: result.rescueBranch };
}
