/**
 * usePanelToolLayout — DevTools Inspector tool-window state machine.
 *
 * Per-tab view state lives in `useEditingScopeViewState` (see
 * the per-window/tab view-state design); this hook adapts the perTab
 * snapshot to `useDockLayout`'s `initial` + `onPersist`.
 *
 * The host calls `usePanelEditingScopeViewState` first (gate on `ready`), then
 * passes the resolved `perTab` into `usePanelToolLayout`.
 */

import type { PersistedTabSession } from '@openheaders/core/storage';
import type { DockLayoutApi, DockState, ToolLayoutState } from '@openheaders/ui/shared/dock-layout';
import { normalizeDockLayout, useDockLayout } from '@openheaders/ui/shared/dock-layout';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { useEditingScopeViewState } from '@openheaders/ui/shared/editing-scope-view-state';
import type { InspectorTab } from './inspector-tab';
import { focusStore } from './stores/focus-store';
import { PANEL_TOOL_WINDOW_MAP, PANEL_TOOL_WINDOWS, type PanelToolWindowId } from './tool-windows';

export type PanelToolLayoutApi = DockLayoutApi<PanelToolWindowId>;

/**
 * Per-tab inspector tab session — flat (no workspace concept on the
 * panel surface). Inspector tab ids are panel-local strings tied to
 * captured network requests, not workspace-scoped entity uids, so the
 * v2.1 cross-workspace carve-out doesn't apply here.
 *
 * `sessionToken` stamps which DevTools session opened these tabs. Open
 * editor tabs are bound to a session's captured requests, so they are
 * restored only when the live token still matches; a reopen (new token)
 * starts with an empty editor. Absent on a fresh factory session.
 */
export interface PersistedInspectorTabSession extends PersistedTabSession<InspectorTab> {
  sessionToken?: string;
}

export interface PanelViewState {
  dockLayout: ToolLayoutState<PanelToolWindowId>;
  editorTabs: PersistedInspectorTabSession;
}

const PANEL_FRESH_DOCK_LAYOUT: ToolLayoutState<PanelToolWindowId> = normalizeDockLayout(
  {
    docks: {
      'left-top': { windows: ['network'], active: 'network' },
      // Storage opens with the panel so the second capture surface is
      // visible without a rail click (mirrors Request Rules below).
      'left-bottom': { windows: ['storage'], active: 'storage' },
      'right-top': { windows: [], active: null },
      'right-bottom': { windows: [], active: null },
      'bottom-left': { windows: [], active: null },
      // Request Rules stays docked but collapsed on a fresh profile so
      // the request inspect pane gets the full column height; the rail
      // icon (and the footprint chip) opens it on demand.
      'bottom-right': { windows: ['matched-rules'], active: null },
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
