/**
 * Workspace → Org resolver (UNIFIED_ORACLE_MODEL.md §6.1 / §8.2).
 *
 * Per-surface context handles ({@link createSwContextHandle},
 * {@link createRendererContextHandle}) consult this resolver at envelope
 * mint time to stamp `orgId` from the workspace's current `orgId`. The
 * resolver is registered once per host at boot (after the workspace
 * store is hydrated) and invalidated whenever workspace metadata
 * changes — see `onWorkspaceStoreChange` wiring.
 *
 * The mint hot path reads through a {@link Map} cache so per-emit cost
 * is one lookup; cache misses fall through to the registered resolver
 * and the result is memoized until the next invalidate.
 *
 * Two sentinel workspace ids resolve specially:
 *
 *   - `EXTENSION_WORKSPACE_GLOBAL_SCOPE` (`'__global__'`) — global
 *     ExtensionWorkspace metadata. Per §6.5 two-channel propagation,
 *     these mutations ride the user's home-org channel, so the
 *     resolver returns `snapshot.user.homeOrgId`.
 *   - Anything else not registered yet — fall through to the resolver's
 *     own default (typically `snapshot.user.homeOrgId` again, since V5
 *     fresh-start has no real Orgs to disambiguate against).
 *
 * If neither the resolver nor a snapshot is installed the sentinel
 * `'pre-bootstrap'` is returned — same convention the audit log uses
 * (`packages/core/src/identity/audit.ts`). A `'pre-bootstrap'` orgId in
 * production means a mint fired before identity hydration; fix the
 * call order, don't compensate downstream.
 */

export type WorkspaceOrgResolver = (workspaceId: string) => string | undefined;

export const PRE_BOOTSTRAP_ORG_ID = 'pre-bootstrap';

let resolver: WorkspaceOrgResolver | null = null;
const cache = new Map<string, string>();

/**
 * Install the host-specific resolver. Replaces any prior registration
 * and clears the cache so the next mint reads through.
 */
export function setWorkspaceOrgResolver(fn: WorkspaceOrgResolver | null): void {
  resolver = fn;
  cache.clear();
}

/**
 * Drop a single workspace's cached binding. Called after a workspace
 * metadata mutation that may have flipped the orgId; the next mint
 * reads through.
 */
export function invalidateWorkspaceOrgCache(workspaceId: string): void {
  cache.delete(workspaceId);
}

/** Drop the entire cache. Called on `onWorkspaceStoreChange`. */
export function invalidateAllWorkspaceOrgCache(): void {
  cache.clear();
}

/**
 * Hot-path read used by the envelope mint sites. Returns the sentinel
 * `'pre-bootstrap'` if no resolver is installed or it returns
 * `undefined` for the given workspace id.
 */
export function resolveWorkspaceOrgId(workspaceId: string): string {
  const cached = cache.get(workspaceId);
  if (cached !== undefined) return cached;
  const fresh = resolver?.(workspaceId);
  if (fresh === undefined) return PRE_BOOTSTRAP_ORG_ID;
  cache.set(workspaceId, fresh);
  return fresh;
}
