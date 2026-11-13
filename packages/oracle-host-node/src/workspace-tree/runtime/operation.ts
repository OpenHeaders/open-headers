/**
 * Workspace-tree runtime — the way out of a git operation started
 * outside the app (a rebase, a merge, a cherry-pick, a revert, a
 * bisect). While one stands every reconcile pass holds; this pass ends
 * it with git's own abort and then reconciles exactly as the hold's
 * retry does once the marker is gone: a tree-wins sweep, a flush, a
 * status frame. On the per-binding chain.
 */

import { logger } from '@openheaders/core/utils';
import { abortGitOperation, isWorkspaceRepo } from '../../git';
import { type OpenBinding, type RuntimeCtx, SCOPE } from './core';
import type { AbortOperationRpcResult } from './types';

export async function runAbortOperation(ctx: RuntimeCtx, binding: OpenBinding): Promise<AbortOperationRpcResult> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const aborted = await abortGitOperation(ctx.gitRun, rootDir);
  if (!aborted.ok) {
    if (aborted.reason === 'abort-failed') logger.warn(SCOPE, `abort of ${aborted.operation} refused at ${rootDir}`);
    return aborted;
  }
  logger.info(SCOPE, `aborted ${aborted.operation} at ${rootDir}`);
  await ctx.runSweep(binding);
  await binding.materializer.flush();
  return aborted;
}
