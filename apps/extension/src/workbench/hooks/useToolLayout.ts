/**
 * useToolLayout — workbench tool-window state machine.
 *
 * Per-tab view state lives in `useEditingScopeViewState` (see
 * `docs/PER_WINDOW_OR_TAB_VIEW_STATE_DESIGN.md`); `useToolLayout` is the surface
 * wrapper that adapts the perTab snapshot to `useDockLayout`'s
 * `initial` + `onPersist` API.
 *
 * The host calls `useWorkbenchEditingScopeViewState` first (gate on `ready`),
 * then passes the resolved `perTab` into `useToolLayout`.
 *
 * v2.1 carve-out (design § 2.2): the snapshot now also carries a
 * workspace-scoped slice for editor tabs (and, in a follow-up,
 * sidebar expansions). The slice is rebuilt via `fallThrough` when
 * the donor record was captured in a different workspace — this
 * file wires the workspace-aware resolver into `useEditingScopeViewState`.
 */

import type { DockLayoutApi, ToolLayoutState } from '@/shared/dock-layout';
import { normalizeDockLayout, useDockLayout } from '@/shared/dock-layout';
import type { EditingScopeViewStateApi, WorkspaceSlice } from '@/shared/editing-scope-view-state';
import { createWorkspaceAwareResolver, useEditingScopeViewState } from '@/shared/editing-scope-view-state';
import { extensionStorage, type PersistedTabSession, wsKeys } from '@/shared/storage';
import type { SidebarView } from '../components/sidebar/types';
import { get as getSetting } from '../settings/store';
import { focusStore } from '../stores/focus-region-store';
import { TOOL_WINDOW_MAP, TOOL_WINDOWS } from '../tool-windows';
import type { ToolWindowId, WorkbenchTab } from '../types';
import { readGlobalActiveWorkspaceId, readUrlWorkspaceId } from './readBootIdentity';

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
/**
 * Section-expansion state is per-view: each `SidebarView` owns its
 * own slice keyed by section name. Multiple Sidebar instances can
 * render at the same time (e.g. `http-rules` in left-top and
 * `api-requests` in right-bottom), and shared section names
 * (ENVIRONMENTS appears in three views; collection roots can recur)
 * would otherwise leak collapse state across panels. Per-view slices
 * remove the leak at the schema layer — no string-prefix gymnastics
 * needed in the Sidebar component itself.
 */
export type SidebarSectionsByView = Record<SidebarView, Record<string, boolean>>;

export interface SidebarExpansionsState {
  sectionsExpanded: SidebarSectionsByView;
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
 * View-state snapshot owned by `useEditingScopeViewState<WorkbenchViewState>`.
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
 * Fresh-profile seed (design § 8). On first open:
 *   - `http-rules` is active in `left-top`
 *   - `right-top` stacks `docs`, `var-scope` (active), `variables`
 *     as sibling tabs — Scope leads because it annotates the active
 *     editor tab, which is what users reach for first
 *   - `right-bottom` hosts `api-requests` (active)
 * The shared normalizer fills in remaining `defaultSlot` registry
 * entries without activating them.
 */
const WORKSPACE_FRESH_DOCK_LAYOUT: ToolLayoutState<ToolWindowId> = normalizeDockLayout(
  {
    docks: {
      'left-top': { windows: ['http-rules'], active: 'http-rules' },
      'left-bottom': { windows: [], active: null },
      'right-top': {
        windows: ['docs', 'var-scope', 'variables'],
        active: 'var-scope',
      },
      'right-bottom': { windows: ['api-requests'], active: 'api-requests' },
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
 * built-in template collection — and every rule-type folder beneath
 * it — visually expanded on the http-rules view's first open.
 */
export const FACTORY_SIDEBAR_EXPANSIONS: SidebarExpansionsState = {
  sectionsExpanded: {
    'http-rules': { rules: true, templates: true, environments: false },
    'api-requests': { 'api-requests': true, environments: false },
    workflows: { workflows: true },
    variables: {
      vault: true,
      'workspace-vars': true,
      'live-variables': true,
      environments: true,
    },
  },
  expandedKeys: [
    'sys-tpl-col',
    'sys-tpl-header',
    'sys-tpl-block',
    'sys-tpl-redirect',
    'sys-tpl-query-param',
    'sys-tpl-inject',
    'sys-tpl-delay',
    'sys-tpl-body',
    'sys-tpl-mock',
  ],
};

/** Read the workspace's legacy `tabSession` shadow as the fall-through
 *  for editor tabs. The `general.restoreTabsOnStartup` setting gates
 *  whether to bring the previous tab list back; when disabled, the
 *  workspace cold-starts with no editor tabs. Sidebar expansions return
 *  factory defaults (no workspace-keyed shadow per design § 2.2).
 *
 *  Exported so `useWorkbenchWorkspaceSlice` (the in-tab workspace-
 *  binding owner) shares the same builder as the resolver — single
 *  source of truth for "rebuild the slice for workspace X" across
 *  cross-workspace inheritance AND in-tab workspace switch. */
export async function readWorkspaceFallThrough(workspaceId: string): Promise<WorkbenchWorkspaceData> {
  let shouldRestore = false;
  try {
    shouldRestore = getSetting('general.restoreTabsOnStartup');
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
  // Mount-time read of oracle-owned identity — wrapped via
  // `readGlobalActiveWorkspaceId` so KNOWN_BOOT_COUPLING_READS has a
  // single import target to enumerate (design § 9.1). New tabs always
  // boot on the global default even in MWPT per-tab mode (R4).
  //
  // URL precedence: when the tab's URL hash carries a `/ws/<wsId>/`
  // binding (every freshly-opened tab from the navigator does, plus
  // every restored bookmark in the new format), trust it as the boot
  // identity. The mirror effect downstream validates against the
  // workspace list and replaceStates+reseeds if the URL points at a
  // deleted workspace, so we don't pay a sync existence-check here.
  getActiveWorkspaceId: async () => {
    const fromUrl = readUrlWorkspaceId();
    if (fromUrl) return fromUrl;
    return readGlobalActiveWorkspaceId();
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
export function useWorkbenchEditingScopeViewState(): EditingScopeViewStateApi<WorkbenchViewState> {
  return useEditingScopeViewState<WorkbenchViewState>({
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

export function useToolLayout(perTab: EditingScopeViewStateApi<WorkbenchViewState>): ToolLayoutApi {
  return useDockLayout<ToolWindowId>({
    windowDefs: TOOL_WINDOWS,
    windowMap: TOOL_WINDOW_MAP,
    focusStore,
    initial: perTab.initial.dockLayout,
    onPersist: (next) => perTab.onPersist((prev) => ({ ...prev, dockLayout: next })),
  });
}
