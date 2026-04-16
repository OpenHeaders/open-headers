/**
 * DragIntentContext — publishes the current drag state so child
 * components (InspectorTabBar, SortableTab) can adjust their visuals
 * without prop-drilling. Same pattern as the workspace's drag-intent.
 */

import { createContext, useContext } from 'react';
import type { InspectorTab } from './inspector-tab';

export interface DragIntent {
  draggingTabId: string | null;
  draggingTab: InspectorTab | null;
  overDropZone: boolean;
  insertion: { leafId: string; index: number } | null;
}

const EMPTY: DragIntent = {
  draggingTabId: null,
  draggingTab: null,
  overDropZone: false,
  insertion: null,
};

export const DragIntentContext = createContext<DragIntent>(EMPTY);

export function useDragIntent(): DragIntent {
  return useContext(DragIntentContext);
}
