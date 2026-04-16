/**
 * usePanelToolLayout — dockable tool-window state machine for the
 * DevTools Inspector panel. Thin wrapper around the shared useDockLayout
 * with storage-backed persistence.
 */

import type { DockLayoutApi, DockState, ToolLayoutState } from '@/shared/dock-layout';
import { useDockLayout, useDockLayoutStorage } from '@/shared/dock-layout';
import { focusStore } from './focus-store';
import { PANEL_TOOL_WINDOW_MAP, PANEL_TOOL_WINDOWS, type PanelToolWindowId } from './tool-windows';

export type PanelToolLayoutApi = DockLayoutApi<PanelToolWindowId>;

const PANEL_FRESH_LAYOUT: Partial<ToolLayoutState<PanelToolWindowId>> = {
  docks: {
    'left-top': { windows: ['network'], active: 'network' },
    'left-bottom': { windows: [], active: null },
    'right-top': { windows: [], active: null },
    'right-bottom': { windows: [], active: null },
    'bottom-left': { windows: [], active: null },
    'bottom-right': { windows: [], active: null },
  } satisfies Record<string, DockState<PanelToolWindowId>>,
};

export function usePanelToolLayout(): PanelToolLayoutApi {
  const persisted = useDockLayoutStorage<PanelToolWindowId>('panelDockLayout');

  return useDockLayout<PanelToolWindowId>({
    windowDefs: PANEL_TOOL_WINDOWS,
    windowMap: PANEL_TOOL_WINDOW_MAP,
    focusStore,
    initial: persisted.initial ?? PANEL_FRESH_LAYOUT,
    onPersist: persisted.onPersist,
  });
}
