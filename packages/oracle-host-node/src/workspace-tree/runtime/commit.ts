/**
 * Workspace-tree runtime — the commit plane: identity resolution
 * (§11.3 git-config-first), §23.6 contributor attribution, the one
 * commit pass (temp-index, always on the binding's chain), and the
 * cadence machinery (quiescence, blur, wall-clock intervals).
 */

import { getIdentitySnapshot } from '@openheaders/core/identity';
import { logger } from '@openheaders/core/utils';
import {
  type CommitUserAttribution,
  commitWorkspaceTree,
  composeCommitMessage,
  ensureWorkspaceRepo,
  isWorkspaceRepo,
  resolveCommitIdentity,
  userIndexHasStagedChanges,
  withCommitAttribution,
} from '../../git';
import { CADENCE_INTERVAL_MS, COMMIT_QUIESCENCE_MS, type OpenBinding, type RuntimeCtx, SCOPE } from './core';
import type { CommitWorkspaceTreeRpcResult } from './types';

/** The synthetic fallback for commits nothing in git config covers (§11.3). */
export function syntheticIdentity(): { name: string; email: null } {
  return {
    name: getIdentitySnapshot()?.user.displayName ?? 'OpenHeaders',
    email: null,
  };
}

/** Drain the pending-work ledgers together — intents and contributors describe the same batch set. */
export function drainIntents(binding: OpenBinding): void {
  binding.intents = [];
  binding.contributors.clear();
}

/**
 * Resolve the pending contributors to git-author identities (§23.6).
 * Unresolvable users drop silently — their work stays under the
 * operator author, which is the honest remainder.
 */
export async function resolveContributors(ctx: RuntimeCtx, binding: OpenBinding): Promise<CommitUserAttribution[]> {
  const resolve = ctx.options.resolveUserAttribution;
  if (!resolve || binding.contributors.size === 0) return [];
  const resolved: CommitUserAttribution[] = [];
  for (const userId of binding.contributors) {
    try {
      const attribution = await resolve(userId);
      if (attribution !== null) resolved.push(attribution);
    } catch (err) {
      logger.warn(SCOPE, `attribution resolve failed for user ${userId}`, err);
    }
  }
  return resolved;
}

/**
 * One commit pass — always on the binding's chain (§8 single actor).
 * Flushes the materializer first so the commit sees the latest tree;
 * drains the intent ring only when the commit lands.
 */
export async function runCommit(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  messageOverride?: string,
): Promise<CommitWorkspaceTreeRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) {
    const repo = await ensureWorkspaceRepo(ctx.gitRun, rootDir);
    if (!repo.ok) return { ok: false, reason: 'not-a-repo', detail: repo.detail };
  }
  await binding.materializer.flush();
  const identity = await resolveCommitIdentity(ctx.gitRun, rootDir, syntheticIdentity());
  const trimmed = messageOverride?.trim();
  const draft = trimmed !== undefined && trimmed.length > 0 ? trimmed : composeCommitMessage(binding.intents);
  // §23.6: a sole contributing user authors the commit (committer
  // stays the operator); several contributors ride as trailers.
  const attributed = withCommitAttribution(identity.env, draft, await resolveContributors(ctx, binding));
  const result = await commitWorkspaceTree({
    run: ctx.gitRun,
    rootDir,
    message: attributed.message,
    identityEnv: attributed.env,
    bypassHooks: binding.record.bypassHooks === true,
  });
  if (!result.ok) return { ok: false, reason: result.reason, detail: result.detail };
  drainIntents(binding);
  if (result.committed) {
    logger.info(SCOPE, `committed ${binding.record.rootDir}: ${attributed.message}`);
    return { ok: true, committed: true, sha: result.sha };
  }
  return { ok: true, committed: false };
}

/**
 * One automated commit pass, shared by every cadence trigger
 * (quiescence, blur, interval): pauses while the user's own index is
 * non-empty (§3.3), then runs the ordinary commit path (no-op trees
 * never produce empty commits).
 */
export function enqueueAutoCommit(ctx: RuntimeCtx, binding: OpenBinding, trigger: string): void {
  ctx.enqueue(binding, async () => {
    const availability = await ctx.ensureGitAvailability(binding.record.rootDir);
    if (!availability.available) return;
    if (
      (await isWorkspaceRepo(ctx.gitRun, binding.record.rootDir)) &&
      (await userIndexHasStagedChanges(ctx.gitRun, binding.record.rootDir))
    ) {
      logger.info(SCOPE, `${trigger} commit paused for ${binding.record.rootDir}: user index is non-empty`);
      return;
    }
    const result = await runCommit(ctx, binding);
    if (!result.ok) logger.warn(SCOPE, `${trigger} commit failed for ${binding.record.rootDir}: ${result.reason}`);
    else if (result.committed) await ctx.maybeAutoPush(binding);
    await ctx.publishGitStatus(binding);
  });
}

/** Cadence `auto`: commit after quiescence, pausing while the user's index is non-empty (§3.3). */
export function scheduleAutoCommit(ctx: RuntimeCtx, binding: OpenBinding): void {
  if (binding.closed || (binding.record.commitCadence ?? 'off') !== 'auto') return;
  if (binding.commitTimer) clearTimeout(binding.commitTimer);
  binding.commitTimer = setTimeout(() => {
    binding.commitTimer = null;
    enqueueAutoCommit(ctx, binding, 'auto');
  }, COMMIT_QUIESCENCE_MS);
}

/**
 * Reconcile the binding's cadence timers with its record — the
 * quiescence timer only ever arms from `scheduleAutoCommit`; the
 * wall-clock interval lives here (`every-Nm`), started on open and
 * on every cadence change, cleared for every other value.
 */
export function applyCadenceTimers(ctx: RuntimeCtx, binding: OpenBinding): void {
  const cadence = binding.record.commitCadence ?? 'off';
  if (cadence !== 'auto' && binding.commitTimer) {
    clearTimeout(binding.commitTimer);
    binding.commitTimer = null;
  }
  if (binding.commitInterval) {
    clearInterval(binding.commitInterval);
    binding.commitInterval = null;
  }
  const intervalMs = CADENCE_INTERVAL_MS[cadence];
  if (intervalMs !== undefined && !binding.closed) {
    binding.commitInterval = setInterval(() => {
      enqueueAutoCommit(ctx, binding, 'interval');
    }, intervalMs);
  }
}
