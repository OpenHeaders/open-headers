/**
 * Workspace-tree runtime — the pick plane: Cherry-Pick and Revert of
 * one commit of the log, always on the binding's chain (§8 single
 * actor). The pass itself (`../pick.ts`) decides the order — it
 * commits the local uncommitted work only once it knows the change
 * applies, so a refused pick leaves the branch and the tree untouched.
 */

import { logger } from '@openheaders/core/utils';
import { isWorkspaceRepo, resolveCommitIdentity } from '../../git';
import { type ApplyCommitMode, type ApplyCommitResolution, applyWorkspaceCommit } from '../pick';
import { syntheticIdentity } from './commit';
import { type OpenBinding, type RuntimeCtx, SCOPE, TREE_SURFACE_ID } from './core';
import type { ApplyCommitRpcResult } from './types';

export async function runApplyCommit(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  sha: string,
  mode: ApplyCommitMode,
  resolution?: ApplyCommitResolution,
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
    commitLocalWork: async () => {
      const pre = await ctx.runCommit(binding);
      return pre.ok ? { ok: true } : { ok: false, detail: pre.detail ?? pre.reason };
    },
    identityEnv: identity.env,
    bypassHooks: binding.record.bypassHooks === true,
  });
  if (!result.ok) {
    ctx.appendIssues(binding, result.issues);
    return {
      ok: false,
      reason: result.reason,
      ...(result.detail !== undefined ? { detail: result.detail } : {}),
      ...(result.conflicts !== undefined ? { conflicts: result.conflicts } : {}),
      ...(result.resolve !== undefined ? { resolve: result.resolve } : {}),
      ...(result.tooLarge !== undefined ? { tooLarge: result.tooLarge } : {}),
      ...(result.file !== undefined ? { file: result.file } : {}),
      ...(result.skipped !== undefined ? { skipped: result.skipped } : {}),
      ...(result.keptLocal !== undefined ? { keptLocal: result.keptLocal } : {}),
    };
  }
  await ctx.refreshIssuesFromDisk(binding);
  ctx.drainIntents(binding);
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
  };
}
