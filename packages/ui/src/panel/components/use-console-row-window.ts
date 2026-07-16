/**
 * Console row virtualization — mounts only the visible slice of the log.
 *
 * The console's row set is unbounded: the entry buffer caps at 1000, but
 * the "Log XMLHttpRequests" rows derive one-per-request from the network
 * plane, so a heavy capture grows the list without limit. Rendering the
 * full list makes every append re-render and re-lay-out the whole log.
 *
 * Unlike the traffic table's fixed 20px rows (`use-row-window`), console
 * items have variable-but-KNOWN heights — a row is one pinned-height line,
 * and an expanded row adds a stack ladder whose height is a closed formula
 * of its frame count (all pinned in panel-console.css). Windowing therefore
 * runs on prefix sums + binary search instead of index division; nothing is
 * ever measured.
 *
 * The window computation itself lives in the shared
 * `virtual-window/use-virtual-row-window` (this recipe, lifted when the
 * workbench SSE event list needed it); this module keeps the console's
 * pinned-height vocabulary and its original API names.
 */

import { computeRowWindow, useVirtualRowWindow, type VirtualRowWindowApi } from '../../shared/virtual-window';

/** Pinned `.dt-console-row` height (border-box, incl. its bottom border). */
export const CONSOLE_ROW_PX = 17;
/** Pinned `.dt-console-frame` line height inside an expanded stack. */
export const CONSOLE_FRAME_PX = 13;

/** Height of an expanded `.dt-console-stack` block: 1px top + 3px bottom
 *  padding, 1px bottom border, N frames of 13px with 1px gaps between. */
export function consoleStackPx(frameCount: number): number {
  if (frameCount <= 0) return 0;
  return frameCount * (CONSOLE_FRAME_PX + 1) + 4;
}

export type ConsoleRowWindowApi = VirtualRowWindowApi;

/** Pure window computation over a prefix-sum array. Exported for tests. */
export const computeConsoleWindow = computeRowWindow;

export const useConsoleRowWindow = useVirtualRowWindow;
