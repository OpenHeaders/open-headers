/**
 * Sync service — `applySyncRequest`: routes a mutation batch to the
 * global oracle or the per-workspace oracle named by the batch, with
 * a refcount bracket around the apply.
 */

import type { SyncApplyRequest, SyncApplyResponse } from '@openheaders/core/protocol';
import { isGlobalScopeEntityType } from '@openheaders/core/sync';
import { handleSyncApply } from '../bridge';
import { getGlobalOracle } from '../global-service';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from './lifecycle';
import { currentActive, services } from './state';

/**
 * Apply a `SyncApplyRequest` against the oracle indicated by
 * `request.batch.workspaceId`. Lazily materializes the workspace's
 * service if it isn't resident, brackets a refcount around the apply,
 * and awaits `service.hydrated` before touching the oracle.
 *
 * Routing rules:
 *   - Empty batches use the runtime-Active oracle (no workspaceId in
 *     payload to dispatch on; legacy invariant preserved).
 *   - Mixed-scope batches (global + per-workspace) are rejected — the
 *     all-or-nothing per-batch contract requires a single lock domain.
 *   - Global-scope envelopes (the workspace list, this host's active
 *     pointer — `isGlobalScopeEntityType`) target the GLOBAL oracle; a
 *     delete of the active workspace bundles both types in one batch.
 *   - Every other entity type routes to the per-workspace oracle named
 *     by `batch.workspaceId`.
 */
export function applySyncRequest(request: SyncApplyRequest): Promise<SyncApplyResponse> {
  if (request.batch.mutations.length === 0) {
    if (currentActive === null) {
      throw new Error('SyncService.applySyncRequest called before init');
    }
    const svc = services.get(currentActive);
    if (!svc) {
      throw new Error('SyncService.applySyncRequest: Active workspace has no resident service');
    }
    return svc.hydrated.then(() => handleSyncApply(svc.oracle, request));
  }

  const isGlobal = isGlobalScopeEntityType(request.batch.mutations[0].body.type);
  for (const env of request.batch.mutations) {
    const envIsGlobal = isGlobalScopeEntityType(env.body.type);
    if (envIsGlobal !== isGlobal) {
      throw new Error(
        'SyncService.applySyncRequest: mixed-scope batch (global + per-workspace) — split into separate batches',
      );
    }
  }

  if (isGlobal) {
    const globalOracle = getGlobalOracle();
    if (!globalOracle) {
      throw new Error('SyncService.applySyncRequest: global service not initialized');
    }
    return handleSyncApply(globalOracle, request);
  }

  // Per-workspace path: dispatch on the first mutation's workspaceId.
  // The all-or-nothing per-batch contract requires a single lock domain;
  // mixed-workspace batches are rejected for the same reason mixed-scope
  // ones are.
  const wsId = request.batch.mutations[0].workspaceId;
  for (const env of request.batch.mutations) {
    if (env.workspaceId !== wsId) {
      throw new Error(
        'SyncService.applySyncRequest: mixed-workspace batch — split into separate batches per workspace',
      );
    }
  }
  const svc = getOrCreateWorkspaceService(wsId);
  return svc.hydrated.then(() => handleSyncApply(svc.oracle, request)).finally(() => releaseWorkspaceService(wsId));
}
