/**
 * pane-drag-intent — the shared drag-state channel from a panel's
 * group renderer to its leaf strips (the editor DragIntentContext law
 * generalized): three signals driving the source-placeholder collapse
 * and the cross-leaf insertion marker. Each panel mints its OWN
 * context instance via {@link createPaneDragIntent} — provider and
 * consumers share it, panels never cross.
 */

import { createContext, useContext } from 'react';

export interface PaneDragIntent {
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

export const PANE_DRAG_IDLE: PaneDragIntent = {
  draggingTabId: null,
  draggingLabel: null,
  overDropZone: false,
  insertion: null,
};

export interface PaneDragIntentHandle {
  Context: React.Context<PaneDragIntent>;
  useIntent: () => PaneDragIntent;
}

export function createPaneDragIntent(): PaneDragIntentHandle {
  const Context = createContext<PaneDragIntent>(PANE_DRAG_IDLE);
  return { Context, useIntent: () => useContext(Context) };
}
