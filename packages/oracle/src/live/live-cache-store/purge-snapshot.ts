import type { WorkflowRunCache } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { hostStorage, OH, wsKeys } from '@openheaders/oracle/storage';
import { readBlob, withCacheLock } from './blob';
import { notifyChange } from './listeners';

// ── Purge (workspace delete) ────────────────────────────────────────

export async function purgeLiveCacheForWorkspace(workspaceId: string): Promise<void> {
  await withCacheLock(workspaceId, async () => {
    await hostStorage.remove(wsKeys(workspaceId).liveCache);
    logger.info('LiveCacheStore', `Purged all workflow-run caches for workspace ${workspaceId}`);
  });
  notifyChange(workspaceId, null, []);
}

// ── Scheduler snapshot ──────────────────────────────────────────────

/**
 * Flat snapshot across every workspace — Phase C scheduler uses this
 * on SW wake to reconcile overdue alarms. Mirrors the shape of
 * `listAllWorkspaceCredentials` in `oauth-token-store.ts`.
 */
export interface WorkspaceCacheEntry {
  workspaceId: string;
  run: WorkflowRunCache;
}

export async function listAllWorkspaceCaches(): Promise<WorkspaceCacheEntry[]> {
  const workspaces = (await hostStorage.get(OH.workspaces)) ?? [];
  const out: WorkspaceCacheEntry[] = [];
  for (const ws of workspaces) {
    const blob = await readBlob(ws.id);
    for (const run of Object.values(blob.runs)) {
      out.push({ workspaceId: ws.id, run });
    }
  }
  return out;
}
