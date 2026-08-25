/**
 * Workspace-visibility provider (the access-foundation plan §8 F5) —
 * the identity layer's window onto the host's workspace records, so the
 * per-peer snapshot builder can fold "which workspaces are `internal`"
 * into the capability snapshot without core depending on the oracle
 * workspace store (dependency flow: packages ← apps, oracle ← core).
 *
 * Mirrors the `setWorkspaceOrgResolver` idiom: the host installs one
 * function at boot (after its workspace store is hydrated) that answers
 * the live id → visibility map; hosts that never serve directory peers
 * (extension SW, desktop-as-client) install nothing and every snapshot
 * resolves an empty internal set — deny-by-default holds.
 *
 * No cache: the provider is consulted once per snapshot build, which is
 * already per-frame (the peer-read-filter freshness contract), and the
 * host's read is an in-memory store walk.
 */

import { resolveWorkspaceVisibility } from '../schemas/workspace';

export type WorkspaceVisibilityProvider = () => ReadonlyMap<string, string | undefined>;

let provider: WorkspaceVisibilityProvider | null = null;

/** Install (or clear) the host's workspace-visibility provider. */
export function setWorkspaceVisibilityProvider(fn: WorkspaceVisibilityProvider | null): void {
  provider = fn;
}

/**
 * The ids of workspaces whose stored visibility narrows to `internal`.
 * Raw values go through `resolveWorkspaceVisibility`, so absent and
 * unknown future values resolve `private` and never widen the set.
 */
export function resolveInternalWorkspaceIds(): ReadonlySet<string> {
  if (!provider) return new Set();
  const internal = new Set<string>();
  for (const [workspaceId, visibility] of provider()) {
    if (resolveWorkspaceVisibility(visibility) === 'internal') internal.add(workspaceId);
  }
  return internal;
}
