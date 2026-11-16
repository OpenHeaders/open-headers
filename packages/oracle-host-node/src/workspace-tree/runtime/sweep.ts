/**
 * Workspace-tree runtime — the reconcile plane: the rung-2 tree-wins
 * sweep, the §3.3 in-progress-op hold (with its retry timer), the
 * debounced materialize scheduler, and the issue-feed bookkeeping the
 * quarantine seam surfaces.
 */

import type { MutatorContext } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import type { TreeIssue } from '@openheaders/core/workspace-tree';
import { gitOperationInProgress, watchTreeWrites } from '../../git';
import { readWorkspaceTreeFromDisk } from '../reader';
import { type SweepWorkspaceTreeResult, sweepWorkspaceTree } from '../sweep';
import {
  MATERIALIZE_DEBOUNCE_MS,
  OP_HOLD_RETRY_MS,
  type OpenBinding,
  type RuntimeCtx,
  SCOPE,
  TREE_SURFACE_ID,
} from './core';

/**
 * §3.3 in-progress-op hold: while `.git/` carries a rebase/merge/
 * cherry-pick/revert/sequencer/bisect marker, reconcile passes stand
 * down (a mid-op tree with conflict markers must never be ingested)
 * and a retry timer re-checks until the operation concludes — an
 * abort or a finished sequence clears the marker and the next retry
 * sweeps.
 */
export async function heldByGitOperation(ctx: RuntimeCtx, binding: OpenBinding): Promise<boolean> {
  const marker = await gitOperationInProgress(binding.record.rootDir);
  if (marker === null) return false;
  logger.info(SCOPE, `reconcile held for ${binding.record.rootDir}: ${marker} in progress`);
  armHoldRetry(ctx, binding);
  return true;
}

/** One reconcile pass after the hold's wait — a pass still held arms the next. */
export function armHoldRetry(ctx: RuntimeCtx, binding: OpenBinding): void {
  if (binding.closed || binding.holdRetryTimer !== null) return;
  binding.holdRetryTimer = setTimeout(() => {
    binding.holdRetryTimer = null;
    ctx.enqueue(binding, async () => {
      await runSweep(ctx, binding);
      await binding.materializer.flush();
      await ctx.publishGitStatus(binding);
    });
  }, OP_HOLD_RETRY_MS);
}

export async function runSweep(ctx: RuntimeCtx, binding: OpenBinding): Promise<SweepWorkspaceTreeResult | null> {
  if (binding.closed) return null;
  if (await heldByGitOperation(ctx, binding)) return null;
  const { service, record } = binding;
  await service.hydrated;
  const snapshot = await ctx.buildSnapshot(record.workspaceId, service);
  const result = await sweepWorkspaceTree({
    rootDir: record.rootDir,
    workspaceUid: record.workspaceId,
    snapshot,
    nextCtx: (): MutatorContext => service.context.next({ surfaceId: TREE_SURFACE_ID }),
    liveSetEntries: (entityType, id, setPath) =>
      service.oracle
        .liveOrderedSetItems(entityType, id, setPath)
        .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
    apply: (batches) => ctx.applyAll(service, batches),
    watchTreeWrites: () => watchTreeWrites(record.rootDir),
  });
  // Git was replacing files as the tree was read: the reading is void,
  // held like an operation in progress and taken again. The command's
  // own events bring a pass sooner; the retry is for one they do not.
  if (result.ok && result.heldRemovals !== undefined) {
    logger.info(
      SCOPE,
      `sweep held for ${record.rootDir}: ${result.heldRemovals} file(s) gone while git wrote the tree`,
    );
    armHoldRetry(ctx, binding);
    return null;
  }
  if (result.ok) {
    binding.issues = result.issues;
    if (result.applied > 0 || result.changed > 0 || result.removed > 0) {
      logger.info(
        SCOPE,
        `sweep ${record.rootDir}: ${result.applied} batches (${result.changed} changed, ${result.removed} removed, ${result.issues.length} issues)`,
      );
    }
  } else {
    binding.issues = result.issues;
    logger.warn(SCOPE, `sweep refused for ${record.rootDir}: ${result.reason}`);
  }
  return result;
}

/** Merge refusal issues into the feed, path-deduped — refused passes explain bytes that never reached the tree. */
export function appendIssues(binding: OpenBinding, issues: readonly TreeIssue[]): void {
  if (issues.length === 0) return;
  const known = new Set(binding.issues.map((issue) => issue.path));
  binding.issues = [...binding.issues, ...issues.filter((issue) => !known.has(issue.path))];
}

/**
 * Re-derive the issue feed from the tree on disk after a successful
 * integrate pass. Quarantined foreign bytes live in the worktree, so
 * the honest local read re-reports them — and a foreign file that
 * now parses clean drops its stale row on the very gesture that
 * integrated the fix, instead of lingering until the next sweep.
 */
export async function refreshIssuesFromDisk(binding: OpenBinding): Promise<void> {
  binding.issues = (await readWorkspaceTreeFromDisk(binding.record.rootDir)).issues;
}

export function scheduleMaterialize(ctx: RuntimeCtx, binding: OpenBinding): void {
  if (binding.closed) return;
  if (binding.materializeTimer) clearTimeout(binding.materializeTimer);
  binding.materializeTimer = setTimeout(() => {
    binding.materializeTimer = null;
    ctx.enqueue(binding, async () => {
      await binding.materializer.flush();
      await ctx.publishGitStatus(binding);
    });
  }, MATERIALIZE_DEBOUNCE_MS);
}
