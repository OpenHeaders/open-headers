/**
 * Cache invalidation — whole-workflow and per-environment row drops,
 * plus definitional-staleness flagging (rows kept, marked wrong-recipe).
 */

import type { WorkflowRunCache } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { envKey, type LiveCacheBlob, readBlob, resolveWorkspaceId, runKey, withCacheLock, writeBlob } from './blob';
import { notifyChange } from './listeners';
import { remover } from './propagation';

export interface ClearWorkflowRunCacheOptions {
  /**
   * When set, the cache row for THIS environment is preserved and only
   * the workflow's OTHER env-keyed rows are dropped. Used by the
   * definitional-staleness path: a material request edit invalidates
   * every env's cached value, but the active env keeps serving its
   * (now stale) value until an immediate refresh lands — so it is
   * preserved here while the inactive envs re-warm on the next switch.
   *
   * `null` is a valid value — it preserves the "No environment" row.
   * Omitting the whole options object drops every row (the default).
   */
  keepEnvironmentId: string | null;
}

/**
 * Drop cached runs for one workflow. With no options, every env-keyed
 * entry is removed — called when a workflow definition is deleted, or
 * when the user hits "Clear cache" from the editor. With
 * `keepEnvironmentId`, every entry EXCEPT that env's row is removed.
 */
export async function clearWorkflowRunCache(
  workflowUid: string,
  workspaceId?: string,
  opts?: ClearWorkflowRunCacheOptions,
): Promise<number> {
  const wsId = resolveWorkspaceId(workspaceId);
  let removed = 0;
  const removedKeys: string[] = [];
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const nextRuns: Record<string, WorkflowRunCache> = {};
    for (const [key, entry] of Object.entries(current.runs)) {
      if (entry.workflowUid === workflowUid) {
        if (opts && entry.environmentId === opts.keepEnvironmentId) {
          nextRuns[key] = entry;
          continue;
        }
        removed++;
        removedKeys.push(key);
        continue;
      }
      nextRuns[key] = entry;
    }
    if (removed === 0) return;
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: nextRuns,
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    logger.debug('LiveCacheStore', `Cleared ${removed} cache entry(ies) for workflow ${workflowUid}`);
  });
  if (removed > 0) {
    notifyChange(wsId, workflowUid, postWriteRuns);
    // Drop the synced value rows too, so a paired peer stops serving an
    // orphaned value for a workflow that no longer exists here.
    remover?.(removedKeys, wsId);
  }
  return removed;
}

/**
 * Flag every env-keyed cache row for one workflow as definitionally
 * stale — an input to the cached value's production recipe changed (a
 * material request edit, a workflow-definition change) but the value
 * has not been re-extracted. Unlike {@link clearWorkflowRunCache} the
 * rows are KEPT — the (now wrong-recipe) value keeps serving so live
 * traffic doesn't gap; the flag drives a "needs re-run" badge instead.
 *
 * Used for MANUAL-trigger workflows: a material edit must not auto-run
 * them, but must not silently keep serving a wrong-recipe token either.
 * A successful {@link putWorkflowRunCache} writes a row without the
 * flag, clearing it. No-op (returns 0) when the workflow has no cached
 * rows, or when every row is already flagged.
 */
export async function markWorkflowDefinitionallyStale(workflowUid: string, workspaceId?: string): Promise<number> {
  const wsId = resolveWorkspaceId(workspaceId);
  const now = Date.now();
  let flagged = 0;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const nextRuns: Record<string, WorkflowRunCache> = {};
    for (const [key, entry] of Object.entries(current.runs)) {
      if (entry.workflowUid === workflowUid && entry.definitionallyStale !== true) {
        // Stamp the recipe-change time so a deferring consumer can clear the
        // flag against a provably-post-edit synced value (audit C-1).
        nextRuns[key] = { ...entry, definitionallyStale: true, definitionallyStaleSince: now };
        flagged++;
        continue;
      }
      nextRuns[key] = entry;
    }
    if (flagged === 0) return;
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: nextRuns,
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    logger.debug('LiveCacheStore', `Flagged ${flagged} cache row(s) definitionally stale for workflow ${workflowUid}`);
  });
  if (flagged > 0) notifyChange(wsId, workflowUid, postWriteRuns);
  return flagged;
}

/**
 * Drop the cached run for ONE `(workflow, environment)` pair. Unlike
 * {@link clearWorkflowRunCache} (whole-workflow) this targets a single
 * env-keyed row — the LF2 path uses it when a variable edit makes one
 * NON-active environment's cached value definitionally stale: the row
 * is dropped so it re-warms on the next switch instead of serving a
 * wrong-recipe token. Returns `true` when a row was removed, `false`
 * when the workflow had no cached run for that env.
 */
export async function clearWorkflowRunCacheForEnvironment(
  workflowUid: string,
  environmentId: string | null,
  workspaceId?: string,
): Promise<boolean> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  let removed = false;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    if (!(key in current.runs)) return;
    const nextRuns: Record<string, WorkflowRunCache> = {};
    for (const [k, entry] of Object.entries(current.runs)) {
      if (k !== key) nextRuns[k] = entry;
    }
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: nextRuns,
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    removed = true;
    logger.debug('LiveCacheStore', `Cleared cache entry for ${workflowUid} (env=${envKey(environmentId)}, ws=${wsId})`);
  });
  if (removed) {
    notifyChange(wsId, workflowUid, postWriteRuns);
    remover?.([key], wsId);
  }
  return removed;
}

/**
 * Flag ONE `(workflow, environment)` cache row as definitionally stale.
 * The per-env counterpart of {@link markWorkflowDefinitionallyStale}
 * (whole-workflow): the LF2 path uses it when a variable edit makes a
 * MANUAL-trigger workflow's value in one specific environment
 * wrong-recipe — only that env's resolution carried the changed
 * variable, so only its row is flagged "needs re-run". The row is KEPT
 * (it keeps serving so live traffic doesn't gap); a successful
 * {@link putWorkflowRunCache} clears the flag. No-op (returns `false`)
 * when the workflow has no cached run for that env, or the row is
 * already flagged.
 */
export async function markRunDefinitionallyStale(
  workflowUid: string,
  environmentId: string | null,
  workspaceId?: string,
): Promise<boolean> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  const now = Date.now();
  let flagged = false;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous || previous.definitionallyStale === true) return;
    // Stamp the recipe-change time so a deferring consumer can clear the
    // flag against a provably-post-edit synced value (audit C-1).
    const latest: WorkflowRunCache = { ...previous, definitionallyStale: true, definitionallyStaleSince: now };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    flagged = true;
    logger.debug(
      'LiveCacheStore',
      `Flagged cache row definitionally stale for ${workflowUid} (env=${envKey(environmentId)}, ws=${wsId})`,
    );
  });
  if (flagged) notifyChange(wsId, workflowUid, postWriteRuns);
  return flagged;
}
