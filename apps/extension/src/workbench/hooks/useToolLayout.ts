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
 */

import type { DockLayoutApi, ToolLayoutState } from '@/shared/dock-layout';
import { normalizeDockLayout, useDockLayout } from '@/shared/dock-layout';
import type { PerTabStateApi } from '@/shared/per-tab-state';
import { usePerTabState } from '@/shared/per-tab-state';
import { focusStore } from '../stores/focus-region-store';
import { TOOL_WINDOW_MAP, TOOL_WINDOWS } from '../tool-windows';
import type { ToolWindowId } from '../types';

export type ToolLayoutApi = DockLayoutApi<ToolWindowId>;

/**
 * View-state snapshot owned by `usePerTabState<WorkbenchViewState>`.
 * v1 ships dock-layout-only (design § 2.1); v2 additions (editor tabs,
 * sidebar expansions) extend this type without renaming the hook
 * generic.
 */
export interface WorkbenchViewState {
  dockLayout: ToolLayoutState<ToolWindowId>;
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
};

const WORKBENCH_SCHEMA_VERSION = 1;

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
      dockLayout: normalizeDockLayout(raw.dockLayout, TOOL_WINDOWS, TOOL_WINDOW_MAP),
    }),
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
