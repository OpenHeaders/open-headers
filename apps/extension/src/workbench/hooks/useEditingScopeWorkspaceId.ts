/**
 * useEditingScopeWorkspaceId — single seam for "which workspace is this workbench
 * tab editing right now?"
 *
 * Workbench tabs are always per-tab: their editing-scope workspace is
 * pinned by the URL hash (`#/ws/<wsId>/...`) and mirrored into the
 * tab's slice. Switching workspace inside a tab rewrites that tab's
 * URL only — other tabs are unaffected unless the user separately
 * promotes the workspace to ACTIVE.
 *
 * The fall-through order is:
 *   1. The tab's slice binding — populated from the URL on cold mount,
 *      updated by in-tab switcher gestures.
 *   2. The runtime-Active workspace — used by tabs that have no slice
 *      binding yet (legacy bookmarks without `/ws/<wsId>/`, or fresh
 *      tabs whose URL parse failed).
 *
 * Popup, side-panel, and devtools-panel surfaces use
 * `useActiveWorkspaceId()` instead — they're system-scoped and always
 * reflect ACTIVE (per design § 5.2 + § 5.4).
 */

import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import type { WorkbenchViewState } from './useToolLayout';

export function useEditingScopeWorkspaceId(perTab: EditingScopeViewStateApi<WorkbenchViewState>): string | null {
  const globalActive = useActiveWorkspaceId();
  const tabBound = perTab.initial.workspace?.workspaceId ?? null;
  return tabBound ?? globalActive;
}
