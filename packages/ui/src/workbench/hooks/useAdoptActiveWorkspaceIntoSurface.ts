/**
 * useAdoptActiveWorkspaceIntoSurface — re-pin the current workbench tab
 * to the active workspace after a back-end (daemon) switch.
 *
 * The switch commits `backend.mode`, the transport reconnects to the new
 * host, and on first join the data plane promotes that host's workspace
 * to active (`sync-handshake.ts` → `setActiveWorkspaceById`). This hook
 * waits for that new active to land in the live workspace list, then
 * rewrites this tab's per-tab slice binding to it — the same write an
 * in-tab workspace switch makes, so the URL follows via
 * `useUrlWorkspaceBindingMirror`. Quiet by design: no dirty-draft prompt
 * (drafts from the previous host's workspace are out of scope after a
 * switch) and no toast (the switch flow owns the success toast).
 *
 * See `SurfaceWorkspaceAdoptContext` for who provides/consumes this.
 */

import { getActiveExtensionWorkspaceSyncMirror } from '@openheaders/ui/context';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { useCallback } from 'react';
import { readWorkspaceFallThrough, type WorkbenchViewState } from './useToolLayout';

/**
 * Upper bound on how long the switch overlay waits for the new host's
 * active workspace to sync down before giving up and re-pinning to
 * whatever active resolves to (or leaving the surface as-is).
 */
const SETTLE_TIMEOUT_MS = 8_000;

export function useAdoptActiveWorkspaceIntoSurface(
  perTab: EditingScopeViewStateApi<WorkbenchViewState>,
): () => Promise<void> {
  return useCallback(async () => {
    const mirror = getActiveExtensionWorkspaceSyncMirror();
    // Active before the switch — wait until it repoints to a workspace
    // that's actually present in the (new host's) live list.
    const before = mirror.liveActiveWorkspaceId();
    const inList = (id: string | null): id is string => id !== null && mirror.liveWorkspaces().some((w) => w.id === id);

    const target = await new Promise<string | null>((resolve) => {
      const current = mirror.liveActiveWorkspaceId();
      if (inList(current) && current !== before) {
        resolve(current);
        return;
      }
      let settled = false;
      const finish = (id: string | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsub();
        resolve(id);
      };
      const timer = setTimeout(() => finish(mirror.liveActiveWorkspaceId()), SETTLE_TIMEOUT_MS);
      const unsub = mirror.subscribeMirror(() => {
        const id = mirror.liveActiveWorkspaceId();
        if (inList(id) && id !== before) finish(id);
      });
    });

    if (!inList(target)) return;
    // Already rendering the new active (e.g. the tab was bound to it
    // before the switch) — nothing to do.
    if (perTab.initial.workspace?.workspaceId === target) return;
    const data = await readWorkspaceFallThrough(target);
    perTab.onPersist((prev) => ({ ...prev, workspace: { workspaceId: target, data } }));
  }, [perTab]);
}
