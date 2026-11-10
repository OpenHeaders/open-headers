/**
 * Workspace-tree runtime — the pick plane: Cherry-Pick and Revert of
 * one commit of the log, always on the binding's chain (§8 single
 * actor). The pass itself (`../pick.ts`) decides the order and what is
 * recorded — a refused pick leaves the branch and the tree untouched,
 * and a recorded one commits the files it wrote and no other.
 */

import { logger } from '@openheaders/core/utils';
import { composeCommitMessage, countDirtyFiles, isWorkspaceRepo, resolveCommitIdentity } from '../../git';
import type { ApplyCommitResolution } from '../change-answers';
import { type ApplyCommitMode, applyWorkspaceCommit } from '../pick';
import { syntheticIdentity } from './commit';
import { type OpenBinding, type RuntimeCtx, SCOPE, TREE_SURFACE_ID } from './core';
import { localWorkFirst } from './local-work';
import type { ApplyCommitRpcResult, CommitLocalWork } from './types';

export async function runApplyCommit(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  sha: string,
  mode: ApplyCommitMode,
  resolution?: ApplyCommitResolution,
  commitLocal?: CommitLocalWork,
): Promise<ApplyCommitRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (await ctx.heldByGitOperation(binding)) return { ok: false, reason: 'op-in-progress' };
  await binding.service.hydrated;

  const identity = await resolveCommitIdentity(ctx.gitRun, rootDir, syntheticIdentity());
  const result = await applyWorkspaceCommit({
    run: ctx.gitRun,
    rootDir,
    sha,
    mode,
    ...(resolution !== undefined ? { resolution } : {}),
    workspaceUid: binding.record.workspaceId,
    readSnapshot: () => ctx.buildSnapshot(binding.record.workspaceId, binding.service),
    nextCtx: () => binding.service.context.next({ surfaceId: TREE_SURFACE_ID }),
    liveSetEntries: (entityType, id, setPath) =>
      binding.service.oracle
        .liveOrderedSetItems(entityType, id, setPath)
        .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
    apply: (batches) => ctx.applyAll(binding.service, batches),
    flush: () => binding.materializer.flush(),
    ...localWorkFirst(ctx, binding, identity.env, commitLocal),
    identityEnv: identity.env,
    bypassHooks: binding.record.bypassHooks === true,
  });
  if (!result.ok) {
    ctx.appendIssues(binding, result.issues);
    return {
      ok: false,
      reason: result.reason,
      ...(result.detail !== undefined ? { detail: result.detail } : {}),
      ...(result.localChanges !== undefined
        ? { localChanges: result.localChanges, suggestedMessage: composeCommitMessage(binding.intents) }
        : {}),
      ...(result.conflicts !== undefined ? { conflicts: result.conflicts } : {}),
      ...(result.resolve !== undefined ? { resolve: result.resolve } : {}),
      ...(result.tooLarge !== undefined ? { tooLarge: result.tooLarge } : {}),
      ...(result.file !== undefined ? { file: result.file } : {}),
      ...(result.skipped !== undefined ? { skipped: result.skipped } : {}),
      ...(result.keptLocal !== undefined ? { keptLocal: result.keptLocal } : {}),
    };
  }
  await ctx.refreshIssuesFromDisk(binding);
  // The pending draft describes uncommitted work: it is spent only when none is left.
  if ((await countDirtyFiles(ctx.gitRun, rootDir)) === 0) ctx.drainIntents(binding);
  logger.info(SCOPE, `${mode} of ${sha.slice(0, 8)} onto ${rootDir}: ${result.sha}`);
  if (result.skipped.length > 0) {
    logger.warn(
      SCOPE,
      `${mode} of ${sha.slice(0, 8)} left out: ${result.skipped.map((skip) => `${skip.path} (${skip.reason})`).join(', ')}`,
    );
  }
  if (result.keptLocal !== undefined) {
    logger.warn(SCOPE, `${mode} of ${sha.slice(0, 8)} kept the local file: ${result.keptLocal.join(', ')}`);
  }
  return {
    ok: true,
    sha: result.sha,
    ...(result.skipped.length > 0 ? { skipped: result.skipped } : {}),
    ...(result.keptLocal !== undefined ? { keptLocal: result.keptLocal } : {}),
    ...(result.committedLocal !== undefined ? { committedLocal: result.committedLocal } : {}),
  };
}
