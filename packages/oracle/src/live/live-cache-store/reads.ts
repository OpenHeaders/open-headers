import type { WorkflowRunCache } from '@openheaders/core/types';
import { readBlob, resolveWorkspaceId, runKey } from './blob';

// ── Reads ──────────────────────────────────────────────────────────

export async function getWorkflowRunCache(
  workflowUid: string,
  environmentId: string | null,
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const blob = await readBlob(wsId);
  return blob.runs[runKey(workflowUid, environmentId)] ?? null;
}

/**
 * Snapshot every cached workflow run for a workspace. Used by:
 *   - Phase C scheduler — iterate overdue caches on SW wake.
 *   - Phase E resolver — build the `LiveRegistry` passed to
 *     `VariableResolver.setLiveRegistry`.
 *
 * Returns the raw `runs` map (cheap pass-through — the caller may
 * mutate freely; the in-memory blob is re-read on every call).
 */
export async function listWorkflowRunCaches(workspaceId?: string): Promise<WorkflowRunCache[]> {
  const wsId = resolveWorkspaceId(workspaceId);
  const blob = await readBlob(wsId);
  return Object.values(blob.runs);
}

/** Every cached run for one workflow (all env-keyed entries). */
export async function listCachesForWorkflow(workflowUid: string, workspaceId?: string): Promise<WorkflowRunCache[]> {
  const wsId = resolveWorkspaceId(workspaceId);
  const blob = await readBlob(wsId);
  return Object.values(blob.runs).filter((r) => r.workflowUid === workflowUid);
}
