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
 * Fresh-profile seed. `http-rules` is activated on mount so the user
 * lands on the rules list; the shared normalizer re-seats the rest of
 * the registry (`api-requests`, `variables`, `docs`, `var-scope`,
 * `page-traffic`, `test-runs`) into their declared `defaultSlot`.
 */
const WORKSPACE_FRESH_LAYOUT: Partial<ToolLayoutState<ToolWindowId>> = {
  docks: {
    'left-top': { windows: ['http-rules'], active: 'http-rules' },
    'left-bottom': { windows: [], active: null },
    'right-top': { windows: [], active: null },
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
