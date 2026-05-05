/**
 * Mount-time fast-path reads of oracle-owned identity, wrapped so the
 * lint test (KNOWN_BOOT_COUPLING_READS, see
 * `MULTI_WORKSPACE_PER_TAB_DESIGN.md` § 9.1) has a single import target
 * to enumerate.
 *
 * The renderer-projection rule is: post-boot reads of oracle-owned
 * identity (`OH.activeWorkspaceId`, per-workspace shadows) MUST go
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

import { extensionStorage, OH } from '@/shared/storage';

export async function readGlobalActiveWorkspaceId(): Promise<string | null> {
  try {
    const id = (await extensionStorage.get(OH.activeWorkspaceId)) as string | undefined;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}
