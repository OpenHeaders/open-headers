/**
 * Wait for a workspace the host just minted to reach this surface's
 * live list. A host-side create (the workspace-tree adopt verb, an
 * import) answers its RPC on its own channel while the record arrives
 * on the sync plane, so a switch issued straight off the response can
 * find the mirror one broadcast behind. Resolves true once the id is
 * listed, false when the settle window elapses.
 */

import { getActiveExtensionWorkspaceSyncMirror } from '@openheaders/ui/context';

const SETTLE_TIMEOUT_MS = 8_000;

export function whenWorkspaceListed(id: string, timeoutMs: number = SETTLE_TIMEOUT_MS): Promise<boolean> {
  const mirror = getActiveExtensionWorkspaceSyncMirror();
  const listed = (): boolean => mirror.liveWorkspaces().some((workspace) => workspace.id === id);
  if (listed()) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (found: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(found);
    };
    const timer = setTimeout(() => finish(listed()), timeoutMs);
    const unsubscribe = mirror.subscribeMirror(() => {
      if (listed()) finish(true);
    });
  });
}
