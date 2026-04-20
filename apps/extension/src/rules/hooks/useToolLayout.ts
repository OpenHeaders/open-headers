/**
 * useToolLayout — workspace.html tool-window state machine.
 *
 * Thin wrapper over the shared `useDockLayout<ToolWindowId>` bound to
 * the workspace's tool-window registry. The fresh-profile default
 * activates `http-rules` on `left-top` — the workspace landing surface.
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
 * Fresh-profile seed. Three panels are visible on first open:
 *   - `http-rules` in `left-top` (rules list + templates + environments).
 *   - `api-requests` in `left-bottom` with `variables` as the sibling tab
 *     — the activity bar's bottom group exposes both; requests is 1st.
 *   - `var-scope` in `right-bottom` — the right-side Variables inspector
 *     showing resolved scopes for the active rule / request.
 * The shared normalizer fills in the remaining `defaultSlot` registry
 * entries (`docs`, `page-traffic`, `test-runs`) without activating them.
 */
const WORKSPACE_FRESH_LAYOUT: Partial<ToolLayoutState<ToolWindowId>> = {
  docks: {
    'left-top': { windows: ['http-rules'], active: 'http-rules' },
    'left-bottom': { windows: ['api-requests', 'variables'], active: 'api-requests' },
    'right-top': { windows: [], active: null },
    'right-bottom': { windows: ['var-scope'], active: 'var-scope' },
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
