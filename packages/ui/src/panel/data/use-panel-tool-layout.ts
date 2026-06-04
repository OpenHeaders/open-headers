/**
 * usePanelToolLayout — DevTools Inspector tool-window state machine.
 *
 * Per-tab view state lives in `useEditingScopeViewState` (see
 * `docs/PER_WINDOW_OR_TAB_VIEW_STATE_DESIGN.md`); this hook adapts the perTab
 * snapshot to `useDockLayout`'s `initial` + `onPersist`.
 *
 * The host calls `usePanelEditingScopeViewState` first (gate on `ready`), then
 * passes the resolved `perTab` into `usePanelToolLayout`.
 */

import type { DockLayoutApi, DockState, ToolLayoutState } from '@openheaders/ui/shared/dock-layout';
import { normalizeDockLayout, useDockLayout } from '@openheaders/ui/shared/dock-layout';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { useEditingScopeViewState } from '@openheaders/ui/shared/editing-scope-view-state';
import type { PersistedTabSession } from '@openheaders/core/storage';
import { focusStore } from './focus-store';
import type { InspectorTab } from './inspector-tab';
import { PANEL_TOOL_WINDOW_MAP, PANEL_TOOL_WINDOWS, type PanelToolWindowId } from './tool-windows';

export type PanelToolLayoutApi = DockLayoutApi<PanelToolWindowId>;

/**
 * Per-tab inspector tab session — flat (no workspace concept on the
 * panel surface). Inspector tab ids are panel-local strings tied to
 * captured network requests, not workspace-scoped entity uids, so the
 * v2.1 cross-workspace carve-out doesn't apply here.
 */
export type PersistedInspectorTabSession = PersistedTabSession<InspectorTab>;

export interface PanelViewState {
  dockLayout: ToolLayoutState<PanelToolWindowId>;
  editorTabs: PersistedInspectorTabSession;
}

const PANEL_FRESH_DOCK_LAYOUT: ToolLayoutState<PanelToolWindowId> = normalizeDockLayout(
  {
    docks: {
      'left-top': { windows: ['network'], active: 'network' },
      'left-bottom': { windows: [], active: null },
      'right-top': { windows: [], active: null },
      'right-bottom': { windows: [], active: null },
      'bottom-left': { windows: [], active: null },
      'bottom-right': { windows: [], active: null },
    } satisfies Record<string, DockState<PanelToolWindowId>>,
  },
  PANEL_TOOL_WINDOWS,
  PANEL_TOOL_WINDOW_MAP,
);

export const FACTORY_INSPECTOR_TABS: PersistedInspectorTabSession = { tabs: [], activeTabId: null };

const PANEL_FACTORY_DEFAULT: PanelViewState = {
  dockLayout: PANEL_FRESH_DOCK_LAYOUT,
  editorTabs: FACTORY_INSPECTOR_TABS,
};

const PANEL_SCHEMA_VERSION = 2;

export function usePanelEditingScopeViewState(): EditingScopeViewStateApi<PanelViewState> {
  return useEditingScopeViewState<PanelViewState>({
    surface: 'panel',
    schemaVersion: PANEL_SCHEMA_VERSION,
    factoryDefault: PANEL_FACTORY_DEFAULT,
    normalize: (raw) => ({
      ...raw,
      dockLayout: normalizeDockLayout(raw.dockLayout, PANEL_TOOL_WINDOWS, PANEL_TOOL_WINDOW_MAP),
      editorTabs: raw.editorTabs ?? FACTORY_INSPECTOR_TABS,
    }),
    // Open editor tabs are bound to this DevTools session's captured
    // requests — a fresh browser tab must not inherit them. The donor
    // record carries only the shareable dock layout; editor tabs reset.
    projectForDonor: (snapshot) => ({ ...snapshot, editorTabs: FACTORY_INSPECTOR_TABS }),
  });
}

export function usePanelToolLayout(perTab: EditingScopeViewStateApi<PanelViewState>): PanelToolLayoutApi {
  return useDockLayout<PanelToolWindowId>({
    windowDefs: PANEL_TOOL_WINDOWS,
    windowMap: PANEL_TOOL_WINDOW_MAP,
    focusStore,
    initial: perTab.initial.dockLayout,
    onPersist: (next) => perTab.onPersist((prev) => ({ ...prev, dockLayout: next })),
  });
}
