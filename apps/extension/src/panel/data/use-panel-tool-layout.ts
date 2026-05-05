/**
 * usePanelToolLayout — DevTools Inspector tool-window state machine.
 *
 * Per-tab view state lives in `usePerTabState` (see
 * `docs/PER_TAB_VIEW_STATE_DESIGN.md`); this hook adapts the perTab
 * snapshot to `useDockLayout`'s `initial` + `onPersist`.
 *
 * The host calls `usePanelPerTabState` first (gate on `ready`), then
 * passes the resolved `perTab` into `usePanelToolLayout`.
 */

import type { DockLayoutApi, DockState, ToolLayoutState } from '@/shared/dock-layout';
import { normalizeDockLayout, useDockLayout } from '@/shared/dock-layout';
import type { PerTabStateApi } from '@/shared/per-tab-state';
import { usePerTabState } from '@/shared/per-tab-state';
import { focusStore } from './focus-store';
import { PANEL_TOOL_WINDOW_MAP, PANEL_TOOL_WINDOWS, type PanelToolWindowId } from './tool-windows';

export type PanelToolLayoutApi = DockLayoutApi<PanelToolWindowId>;

export interface PanelViewState {
  dockLayout: ToolLayoutState<PanelToolWindowId>;
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

const PANEL_FACTORY_DEFAULT: PanelViewState = {
  dockLayout: PANEL_FRESH_DOCK_LAYOUT,
};

const PANEL_SCHEMA_VERSION = 1;

export function usePanelPerTabState(): PerTabStateApi<PanelViewState> {
  return usePerTabState<PanelViewState>({
    surface: 'panel',
    schemaVersion: PANEL_SCHEMA_VERSION,
    factoryDefault: PANEL_FACTORY_DEFAULT,
    normalize: (raw) => ({
      dockLayout: normalizeDockLayout(raw.dockLayout, PANEL_TOOL_WINDOWS, PANEL_TOOL_WINDOW_MAP),
    }),
  });
}

export function usePanelToolLayout(perTab: PerTabStateApi<PanelViewState>): PanelToolLayoutApi {
  return useDockLayout<PanelToolWindowId>({
    windowDefs: PANEL_TOOL_WINDOWS,
    windowMap: PANEL_TOOL_WINDOW_MAP,
    focusStore,
    initial: perTab.initial.dockLayout,
    onPersist: (next) => perTab.onPersist((prev) => ({ ...prev, dockLayout: next })),
  });
}
