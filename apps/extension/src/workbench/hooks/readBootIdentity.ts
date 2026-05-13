/**
 * Mount-time fast-path reads of oracle-owned identity, wrapped so the
 * lint test (KNOWN_BOOT_COUPLING_READS, see
 * `MULTI_WORKSPACE_PER_WINDOW_OR_TAB_DESIGN.md` § 9.1) has a single import target
 * to enumerate.
 *
 * The renderer-projection rule is: post-boot reads of oracle-owned
 * identity (`OH.runtimeActive`, per-workspace shadows) MUST go
 * through projections (`useActiveWorkspaceId`, `useEditingScopeWorkspaceId`,
 * `useWorkspaces`, the live mirror). The narrow exception is the boot
 * window — before the bridge has fired and the projection would
 * resolve `null`. Those reads route through this helper.
 *
 * Adding a new mount-time identity read site means:
 *   1. Add a wrapper here.
 *   2. Add an entry to KNOWN_BOOT_COUPLING_READS in the lint test.
 *
 * The literal-string lint shape would not catch a `wsKeys(id).foo`
 * read; the structural enforcement is "import this utility from a
 * lint-allowlisted call site" rather than regex.
 */

import { hashToBoundIntent } from '@openheaders/core/workspace-intent';
import { hostStorage, OH } from '@openheaders/core/storage';

export async function readGlobalActiveWorkspaceId(): Promise<string | null> {
  try {
    const id = (await hostStorage.get(OH.runtimeActive)) as string | undefined;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Mount-time read of the URL-pinned workspace binding (`/ws/<wsId>/`
 * prefix in `window.location.hash`). Returns null when the prefix is
 * absent, malformed, or the runtime exposes no `window` (SW context).
 *
 * Existence of the workspace is NOT validated here — that costs an
 * async read and would block the resolver's fast path. The mirror
 * effect (`useUrlWorkspaceBindingMirror`) corrects an unknown id once
 * the workspace list resolves: replaceState to the actual binding +
 * seed the slice with global active.
 */
export function readUrlWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash) return null;
  try {
    const bound = hashToBoundIntent(hash);
    return bound?.workspaceId ?? null;
  } catch {
    return null;
  }
}
