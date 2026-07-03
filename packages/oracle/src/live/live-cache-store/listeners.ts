import type { WorkflowRunCache } from '@openheaders/core/types';

// ── Change listeners ────────────────────────────────────────────────

/**
 * Listeners receive `(workspaceId, workflowUid, runs)` so subscribers
 * can update their own mirrors synchronously from the `runs` snapshot
 * instead of racing an async re-read of `chrome.storage.local`.
 *
 * - `workflowUid === null` signals a full-workspace mutation
 *   (workspace purge, bulk clear).
 * - `runs` is the complete post-write run list for the workspace;
 *   subscribers that only care about a subset (e.g. the resolver's
 *   active-workspace mirror) should filter by `workspaceId`.
 *
 * The earlier signature omitted `runs`, forcing the resolver's mirror
 * to refresh via a separate async `listWorkflowRunCaches` call. That
 * kicked off in parallel with the background listener's DNR rebuild,
 * and the rebuild usually won the race — so a freshly-cached capture
 * would reach the UI via broadcast while DNR kept shipping the
 * previous value.
 */
type ChangeListener = (workspaceId: string, workflowUid: string | null, runs: readonly WorkflowRunCache[]) => void;
const listeners: Set<ChangeListener> = new Set();

export function onLiveCacheStoreChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyChange(workspaceId: string, workflowUid: string | null, runs: readonly WorkflowRunCache[]): void {
  for (const fn of listeners) fn(workspaceId, workflowUid, runs);
}
