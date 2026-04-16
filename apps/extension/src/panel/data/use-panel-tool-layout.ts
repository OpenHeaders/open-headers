/**
 * usePanelToolLayout — dockable tool-window state machine for the
 * DevTools Inspector panel. Thin wrapper around the shared useDockLayout.
 */

import type { DockLayoutApi } from '@/shared/dock-layout';
import { useDockLayout } from '@/shared/dock-layout';
import { focusStore } from './focus-store';
import { PANEL_TOOL_WINDOW_MAP, PANEL_TOOL_WINDOWS, type PanelToolWindowId } from './tool-windows';

export type PanelToolLayoutApi = DockLayoutApi<PanelToolWindowId>;

export function usePanelToolLayout(): PanelToolLayoutApi {
  return useDockLayout<PanelToolWindowId>({
    windowDefs: PANEL_TOOL_WINDOWS,
    windowMap: PANEL_TOOL_WINDOW_MAP,
    focusStore,
  });
}
