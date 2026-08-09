/**
 * TerminalDragIntentContext — the terminal instance of the shared
 * pane-drag-intent channel (source-placeholder collapse + cross-leaf
 * insertion marker signals from the group renderer to the strips).
 *
 * Provider: TerminalGroupRenderer.
 * Consumer: TerminalTabStrip's SortableTerminalTab + insertion marker.
 */

import { createPaneDragIntent, type PaneDragIntent } from '../pane-tabs/pane-drag-intent';

export type TerminalDragIntent = PaneDragIntent;

const handle = createPaneDragIntent();

export const TerminalDragIntentContext = handle.Context;

export function useTerminalDragIntent(): TerminalDragIntent {
  return handle.useIntent();
}
