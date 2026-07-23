/**
 * TerminalDragIntentContext — publishes terminal-tab drag state from
 * TerminalGroupRenderer to each leaf strip, the terminal twin of the
 * editor's DragIntentContext (same three signals, same consumers:
 * source-placeholder collapse + cross-leaf insertion marker). Kept
 * separate because the editor context carries a full WorkbenchTab;
 * terminal tabs only need the dragged pill's label.
 *
 * Provider: TerminalGroupRenderer.
 * Consumer: TerminalTabStrip's SortableTerminalTab + insertion marker.
 */

import { createContext, useContext } from 'react';

export interface TerminalDragIntent {
  /** Id of the tab currently being dragged, or null when no drag is active. */
  draggingTabId: string | null;
  /** Display label of the dragged tab — the insertion marker renders
   *  the same pill (label-sized) as the source placeholder. */
  draggingLabel: string | null;
  /** True when the cursor sits over a leaf-drop zone (center or edge) —
   *  the source placeholder collapses. */
  overDropZone: boolean;
  /** Cross-leaf strip insertion intent: destination leaf + index where
   *  the dragged tab would land if released now. Null for same-leaf
   *  drags and while not over a tab. */
  insertion: { leafId: string; index: number } | null;
}

const DEFAULT: TerminalDragIntent = {
  draggingTabId: null,
  draggingLabel: null,
  overDropZone: false,
  insertion: null,
};

export const TerminalDragIntentContext = createContext<TerminalDragIntent>(DEFAULT);

export function useTerminalDragIntent(): TerminalDragIntent {
  return useContext(TerminalDragIntentContext);
}
