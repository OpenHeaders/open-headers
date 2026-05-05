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
 * Sidebar tree expansions slice — keys for expanded sections (rules /
 * templates / environments / …) and expanded entity rows (collection
 * uids, folder uids). Set<string> is serialized as string[] so the
 * snapshot is JSON-safe; component callers convert at the edge.
 *
 * No workspace-keyed shadow exists for sidebar expansions (design § 2.2):
 * cross-workspace fall-through restores factory defaults rather than
 * the workspace's last-known expansions. Re-expanding a folder is a
 * second-cost operation; v2.2 may revisit.
 */
export interface SidebarExpansionsState {
  sectionsExpanded: Record<string, boolean>;
  expandedKeys: string[];
}

/**
 * Workspace-scoped slice payload. v3 carries editor tabs + sidebar
 * expansions; both reference workspace-scoped entity uids and must be
 * rebuilt on cross-workspace inheritance.
 */
export interface WorkbenchWorkspaceData {
  editorTabs: PersistedTabSession<WorkbenchTab>;
  sidebarExpansions: SidebarExpansionsState;
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

const WORKBENCH_SCHEMA_VERSION = 3;

const FACTORY_EDITOR_TABS: PersistedTabSession<WorkbenchTab> = { tabs: [], activeTabId: null };

/**
 * Factory defaults for sidebar expansions. Dense across every view's
 * section keys so the lifted state covers any Sidebar mount without a
 * second-mount initialization step. The `sys-tpl-*` row keys keep the
 * built-in template collection visually expanded on the http-rules
 * view's first open — matches v1 component-local `useState` defaults.
 */
export const FACTORY_SIDEBAR_EXPANSIONS: SidebarExpansionsState = {
  sectionsExpanded: {
    rules: true,
    templates: true,
    'api-requests': true,
    vault: true,
    'workspace-vars': true,
    'live-variables': true,
    workflows: true,
    environments: false,
  },
  expandedKeys: ['sys-tpl-col', 'sys-tpl-header'],
};

/** Read the workspace's legacy `tabSession` shadow as the fall-through
 *  for editor tabs. Settings gate (`general.openTo === 'last' &&
 *  general.restoreTabsOnStartup`) carries from v1's useEditorGroups
 *  cold-start logic — disabling restore yields an empty session.
 *  Sidebar expansions return factory defaults (no workspace-keyed
 *  shadow per design § 2.2).
 *
 *  Exported so `useWorkbenchWorkspaceSlice` (the in-tab workspace-
 *  binding owner) shares the same builder as the resolver — single
 *  source of truth for "rebuild the slice for workspace X" across
 *  cross-workspace inheritance AND in-tab workspace switch. */
export async function readWorkspaceFallThrough(workspaceId: string): Promise<WorkbenchWorkspaceData> {
  let shouldRestore = false;
  try {
    shouldRestore = getSetting('general.openTo') === 'last' && getSetting('general.restoreTabsOnStartup');
  } catch {
    shouldRestore = false;
  }
  if (!shouldRestore) {
    return { editorTabs: FACTORY_EDITOR_TABS, sidebarExpansions: FACTORY_SIDEBAR_EXPANSIONS };
  }
  try {
    const session = (await extensionStorage.get(wsKeys(workspaceId).tabSession)) as
      | PersistedTabSession<WorkbenchTab>
      | undefined;
    return {
      editorTabs: session ?? FACTORY_EDITOR_TABS,
      sidebarExpansions: FACTORY_SIDEBAR_EXPANSIONS,
    };
  } catch {
    return { editorTabs: FACTORY_EDITOR_TABS, sidebarExpansions: FACTORY_SIDEBAR_EXPANSIONS };
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
