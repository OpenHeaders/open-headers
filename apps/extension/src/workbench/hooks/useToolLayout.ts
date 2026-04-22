/**
 * useToolLayout — workbench.html tool-window state machine.
 *
 * Thin wrapper over the shared `useDockLayout<ToolWindowId>` bound to
 * the workspace's tool-window registry. The fresh-profile default
 * activates `http-workbench` on `left-top` — the workspace landing surface.
 * All other slots come from `TOOL_WINDOW_MAP.defaultSlot` via the
 * shared normalizer.
 */

import type { DockLayoutApi, ToolLayoutState } from '@/shared/dock-layout';
import { useDockLayout } from '@/shared/dock-layout';
import { focusStore } from '../stores/focus-region-store';
import { TOOL_WINDOW_MAP, TOOL_WINDOWS } from '../tool-windows';
import type { ToolWindowId } from '../types';

export type ToolLayoutApi = DockLayoutApi<ToolWindowId>;

/**
 * Fresh-profile seed. Three panels are active on first open:
 *   - `http-rules` in `left-top` (rules list + templates + environments).
 *   - `api-requests` in `left-bottom` (workflows joins as a sibling tab
 *     via the normalizer).
 *   - `var-scope` in `right-top` (docs joins as a sibling tab via the
 *     normalizer) — the tab-scoped variable inspector.
 * The shared normalizer fills in the remaining `defaultSlot` registry
 * entries (`workflows`, `docs`, `variables`, `page-traffic`, `test-runs`)
 * without activating them — `variables` lands as a `right-bottom` tab
 * but the pane stays collapsed so the right inspector starts focused on
 * Scope only.
 */
const WORKSPACE_FRESH_LAYOUT: Partial<ToolLayoutState<ToolWindowId>> = {
  docks: {
    'left-top': { windows: ['http-rules'], active: 'http-rules' },
    'left-bottom': { windows: ['api-requests'], active: 'api-requests' },
    'right-top': { windows: ['var-scope'], active: 'var-scope' },
    'right-bottom': { windows: [], active: null },
    'bottom-left': { windows: [], active: null },
    'bottom-right': { windows: [], active: null },
  },
};

export interface UseToolLayoutOptions {
  initial?: Partial<ToolLayoutState<ToolWindowId>>;
  onPersist?: (state: ToolLayoutState<ToolWindowId>) => void;
}

export function useToolLayout({ initial, onPersist }: UseToolLayoutOptions = {}): ToolLayoutApi {
  return useDockLayout<ToolWindowId>({
    windowDefs: TOOL_WINDOWS,
    windowMap: TOOL_WINDOW_MAP,
    focusStore,
    initial: initial ?? WORKSPACE_FRESH_LAYOUT,
    onPersist,
  });
}
