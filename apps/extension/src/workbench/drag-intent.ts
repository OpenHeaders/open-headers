/**
 * DragIntentContext — publishes editor-tab drag state (what's being
 * dragged + whether the current drop intent is a leaf-drop zone vs a
 * tab-bar reorder) from EditorGroupRenderer to any descendant that
 * needs to react to it.
 *
 * The drop-zone state is computed via cursor hit-testing inside
 * EditorGroupRenderer and can't be derived from dnd-kit's `over` alone
 * (we don't register dnd-kit droppables for leaf zones). Rather than
 * prop-drilling a flag through TabBar just so SortableTab can collapse
 * its own placeholder, we publish the state once and let any subtree
 * consume it.
 *
 * Provider: EditorGroupRenderer.
 * Consumer: SortableTab (via `useDragIntent`).
 */

import { createContext, useContext } from 'react';
import type { WorkbenchTab } from './types';

export interface DragIntent {
  /** Id of the tab currently being dragged, or null when no drag is active. */
  draggingTabId: string | null;
  /** The full WorkbenchTab being dragged, or null. Consumed by the cross-leaf
   *  insertion marker so it can render the exact same pill (icon + label)
   *  as the source placeholder instead of a generic blue bar. */
  draggingTab: WorkbenchTab | null;
  /**
   * True when the cursor has left every tab bar and now sits over a
   * leaf-drop zone (center or edge). SortableTab treats this as a
   * signal to hide the dragged tab's original placeholder.
   */
  overDropZone: boolean;
  /**
   * Cross-leaf tab-bar insertion intent. Set when the dnd-kit `over`
   * target is a tab in a DIFFERENT leaf from the drag source — the
   * leafId is the destination and the index is where the dragged tab
   * would land if released now. Used by the destination leaf's TabBar
   * to render an insertion marker, and by the source leaf's
   * SortableTab to hide its own placeholder.
   *
   * Null for same-leaf drags (handled natively by SortableContext) and
   * when the cursor is not currently over a tab.
   */
  insertion: { leafId: string; index: number } | null;
}

const DEFAULT: DragIntent = {
  draggingTabId: null,
  draggingTab: null,
  overDropZone: false,
  insertion: null,
};

export const DragIntentContext = createContext<DragIntent>(DEFAULT);

export function useDragIntent(): DragIntent {
  return useContext(DragIntentContext);
}
