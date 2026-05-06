/**
 * useEditingScopeWorkspaceId — single seam for "which workspace is this workbench
 * tab editing right now?"
 *
 * In **global mode** (`general.workspaceSwitchScope === 'global'`,
 * default) the answer is the global active workspace id — every tab
 * tracks the oracle.
 *
 * In **per-window-or-tab mode** the answer is the tab's slice binding,
 * which may differ from the global default if the user has switched
 * workspaces in this tab without affecting other tabs.
 *
 * See `MULTI_WORKSPACE_PER_WINDOW_OR_TAB_DESIGN.md` § 6.2. Workbench-only — popup,
 * side-panel, and devtools-panel surfaces continue to use
 * `useActiveWorkspaceId()` (system-scoped per design § 5.2 + § 5.4).
 */

import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import type { EditingScopeViewStateApi } from '@/shared/editing-scope-view-state';
import { useSettingValue } from '../settings/hooks';
import type { WorkbenchViewState } from './useToolLayout';

export function useEditingScopeWorkspaceId(perTab: EditingScopeViewStateApi<WorkbenchViewState>): string | null {
  const mode = useSettingValue('general.workspaceSwitchScope');
  const globalActive = useActiveWorkspaceId();
  const tabBound = perTab.initial.workspace?.workspaceId ?? null;
  if (mode === 'per-window-or-tab') return tabBound ?? globalActive;
  return globalActive;
}
