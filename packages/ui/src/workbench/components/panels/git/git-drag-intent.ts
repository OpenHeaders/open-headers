/**
 * GitDragIntentContext — the git panel's instance of the shared
 * pane-drag-intent channel (source-placeholder collapse + cross-leaf
 * insertion marker signals from the group renderer to the strips).
 *
 * Provider: GitGroupRenderer.
 * Consumer: GitTabStrip's sortable pills + insertion marker.
 */

import { createPaneDragIntent, type PaneDragIntent } from '../pane-tabs/pane-drag-intent';

export type GitDragIntent = PaneDragIntent;

const handle = createPaneDragIntent();

export const GitDragIntentContext = handle.Context;

export function useGitDragIntent(): GitDragIntent {
  return handle.useIntent();
}
