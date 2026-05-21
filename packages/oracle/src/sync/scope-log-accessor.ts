/**
 * Resolve the mutation log for a handshake scope.
 *
 * The handshake readers (state-vector / snapshot / delta-stream /
 * threshold) are scope-agnostic: a STATE_VECTOR frame names either a
 * per-workspace id or the `__global__` workspace-list sentinel. Per-
 * workspace scopes live in the refcounted `service.ts` map; the
 * `__global__` scope lives in the singleton `global-service.ts`. This
 * accessor hides that split behind one acquire/release handle so each
 * reader has a single entry point.
 */
import { EXTENSION_WORKSPACE_GLOBAL_SCOPE } from '@openheaders/core/sync';
import { getGlobalMutationLog } from './global-service';
import type { MutationLog } from './mutation-log';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from './service';

export interface ScopeLogHandle {
  /** The scope's append-only mutation log. */
  log: MutationLog;
  /** Resolves once the scope is ready to be read. */
  hydrated: Promise<void>;
  /** Drops the reference acquired here. Always call in `finally`. */
  release: () => void;
}

/**
 * Acquire the mutation log for `workspaceId`. For a per-workspace id
 * this bumps the service refcount (the caller MUST `release()`); for
 * the `__global__` sentinel it returns the singleton's log and a no-op
 * release. The global service has no cache-hydration gate, so its
 * `hydrated` resolves immediately — the log read is independent of the
 * caches in both scopes.
 */
export function acquireScopeLog(workspaceId: string): ScopeLogHandle {
  if (workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) {
    const log = getGlobalMutationLog();
    if (!log) {
      throw new Error('acquireScopeLog: global sync service not initialized');
    }
    return { log, hydrated: Promise.resolve(), release: () => {} };
  }
  const svc = getOrCreateWorkspaceService(workspaceId);
  return {
    log: svc.log,
    hydrated: svc.hydrated,
    release: () => releaseWorkspaceService(workspaceId),
  };
}
