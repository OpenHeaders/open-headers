/**
 * useToolLayout — workbench tool-window state machine.
 *
 * Per-tab view state lives in `usePerTabState` (see
 * `docs/PER_TAB_VIEW_STATE_DESIGN.md`); `useToolLayout` is the surface
 * wrapper that adapts the perTab snapshot to `useDockLayout`'s
 * `initial` + `onPersist` API.
 *
 * The host calls `useWorkbenchPerTabState` first (gate on `ready`),
 * then passes the resolved `perTab` into `useToolLayout`.
 *
 * v2.1 carve-out (design § 2.2): the snapshot now also carries a
 * workspace-scoped slice for editor tabs (and, in a follow-up,
 * sidebar expansions). The slice is rebuilt via `fallThrough` when
 * the donor record was captured in a different workspace — this
 * file wires the workspace-aware resolver into `usePerTabState`.
 */

import type { DockLayoutApi, ToolLayoutState } from '@/shared/dock-layout';
import { normalizeDockLayout, useDockLayout } from '@/shared/dock-layout';
import type { PerTabStateApi, WorkspaceSlice } from '@/shared/per-tab-state';
import { createWorkspaceAwareResolver, usePerTabState } from '@/shared/per-tab-state';
import { extensionStorage, OH, type PersistedTabSession, wsKeys } from '@/shared/storage';
import { get as getSetting } from '../settings/store';
import { focusStore } from '../stores/focus-region-store';
import { TOOL_WINDOW_MAP, TOOL_WINDOWS } from '../tool-windows';
import type { ToolWindowId, WorkbenchTab } from '../types';

export type ToolLayoutApi = DockLayoutApi<ToolWindowId>;

/**
 * Workspace-scoped slice payload. v2.1 carries editor tabs only;
 * sidebar expansions land in v2.1.1 alongside the Sidebar.tsx state
 * lift.
 */
export interface WorkbenchWorkspaceData {
  editorTabs: PersistedTabSession<WorkbenchTab>;
}

/**
 * View-state snapshot owned by `usePerTabState<WorkbenchViewState>`.
 *
 * The shape is split into:
 *   - **`dockLayout`** — universal across workspaces (registry ids
 *     only). New tabs can inherit this from any donor regardless of
 *     workspace.
 *   - **`workspace`** — workspace-scoped slice (entity uids). Inherited
 *     only when the donor was captured in the same workspace; rebuilt
 *     via fall-through otherwise. See § 2.2.
 */
export interface WorkbenchViewState {
  dockLayout: ToolLayoutState<ToolWindowId>;
  workspace: WorkspaceSlice<WorkbenchWorkspaceData> | null;
}

/**
 * Fresh-profile seed (design § 8). Three panels active on first open:
 *   - `http-rules` in `left-top`
 *   - `api-requests` in `left-bottom`
 *   - `var-scope` in `right-top`
 * The shared normalizer fills in remaining `defaultSlot` registry
 * entries without activating them.
 */
const WORKSPACE_FRESH_DOCK_LAYOUT: ToolLayoutState<ToolWindowId> = normalizeDockLayout(
  {
    docks: {
      'left-top': { windows: ['http-rules'], active: 'http-rules' },
      'left-bottom': { windows: ['api-requests'], active: 'api-requests' },
      'right-top': { windows: ['var-scope'], active: 'var-scope' },
      'right-bottom': { windows: [], active: null },
      'bottom-left': { windows: [], active: null },
      'bottom-right': { windows: [], active: null },
    },
  },
  TOOL_WINDOWS,
  TOOL_WINDOW_MAP,
);

const WORKBENCH_FACTORY_DEFAULT: WorkbenchViewState = {
  dockLayout: WORKSPACE_FRESH_DOCK_LAYOUT,
  workspace: null,
};

const WORKBENCH_SCHEMA_VERSION = 2;

const FACTORY_EDITOR_TABS: PersistedTabSession<WorkbenchTab> = { tabs: [], activeTabId: null };

/** Read the workspace's legacy `tabSession` shadow as the fall-through
 *  for editor tabs. Settings gate (`general.openTo === 'last' &&
 *  general.restoreTabsOnStartup`) carries from v1's useEditorGroups
 *  cold-start logic — disabling restore yields an empty session. */
async function readWorkspaceFallThrough(workspaceId: string): Promise<WorkbenchWorkspaceData> {
  let shouldRestore = false;
  try {
    shouldRestore = getSetting('general.openTo') === 'last' && getSetting('general.restoreTabsOnStartup');
  } catch {
    shouldRestore = false;
  }
  if (!shouldRestore) return { editorTabs: FACTORY_EDITOR_TABS };
  try {
    const session = (await extensionStorage.get(wsKeys(workspaceId).tabSession)) as
      | PersistedTabSession<WorkbenchTab>
      | undefined;
    return { editorTabs: session ?? FACTORY_EDITOR_TABS };
  } catch {
    return { editorTabs: FACTORY_EDITOR_TABS };
  }
}

const workbenchResolveSnapshot = createWorkspaceAwareResolver<WorkbenchViewState, WorkbenchWorkspaceData>({
  getActiveWorkspaceId: async () => {
    try {
      const id = (await extensionStorage.get(OH.activeWorkspaceId)) as string | undefined;
      return typeof id === 'string' && id.length > 0 ? id : null;
    } catch {
      return null;
    }
  },
  getSlice: (snap) => snap.workspace,
  withSlice: (snap, slice) => ({ ...snap, workspace: slice }),
  fallThrough: readWorkspaceFallThrough,
});

/**
 * Mount the per-tab view-state for the workbench surface. Call at the
 * gate component level (alongside `useResponsiveLayout`); render the
 * shell only when `perTab.ready === true` so `useDockLayout`
 * initializes from the resolved snapshot, not factory defaults.
 */
export function useWorkbenchPerTabState(): PerTabStateApi<WorkbenchViewState> {
  return usePerTabState<WorkbenchViewState>({
    surface: 'workbench',
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    factoryDefault: WORKBENCH_FACTORY_DEFAULT,
    normalize: (raw) => ({
      ...raw,
      dockLayout: normalizeDockLayout(raw.dockLayout, TOOL_WINDOWS, TOOL_WINDOW_MAP),
    }),
    resolveSnapshot: workbenchResolveSnapshot,
  });
}

export function useToolLayout(perTab: PerTabStateApi<WorkbenchViewState>): ToolLayoutApi {
  return useDockLayout<ToolWindowId>({
    windowDefs: TOOL_WINDOWS,
    windowMap: TOOL_WINDOW_MAP,
    focusStore,
    initial: perTab.initial.dockLayout,
    onPersist: (next) => perTab.onPersist((prev) => ({ ...prev, dockLayout: next })),
  });
}
