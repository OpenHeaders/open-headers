/**
 * Single-surface resolution — the pure core of the narrow layout mode.
 *
 * Below `SINGLE_SURFACE_MAX_PX` the shell shows exactly one surface at
 * a time: the editor, or one tool region (whose docks still stack
 * vertically inside it). The user's preferred surface is view-local
 * state; this module resolves it against the live dock layout so the
 * shell never presents an empty column (a preferred region with no
 * active window falls back to the editor).
 *
 * Kept free of React so the resolution rules are unit-testable.
 */

import type { ShellSurface, ToolLayoutState, ToolRegion } from '@openheaders/ui/shared/dock-layout';
import { regionDocks } from '@openheaders/ui/shared/dock-layout';

/** Panel-side alias of the shell's surface vocabulary. */
export type SingleSurface = ShellSurface;

/** Does the region have at least one dock with an active window? */
export function regionHasContent<T extends string>(region: ToolRegion, state: ToolLayoutState<T>): boolean {
  const [first, second] = regionDocks(region);
  return state.docks[first].active !== null || state.docks[second].active !== null;
}

/** Resolve the preferred surface against the live layout — a content-
 *  less region yields to the editor (which always exists, even empty). */
export function resolveSingleSurface<T extends string>(
  preferred: SingleSurface,
  state: ToolLayoutState<T>,
): SingleSurface {
  if (preferred === 'editor') return 'editor';
  return regionHasContent(preferred, state) ? preferred : 'editor';
}

/** The surface to land on when the layout first goes narrow: stay on
 *  the open document if there is one, else the first region with
 *  content, else the editor's empty state. */
export function initialSingleSurface<T extends string>(hasOpenTabs: boolean, state: ToolLayoutState<T>): SingleSurface {
  if (hasOpenTabs) return 'editor';
  for (const region of ['left', 'bottom', 'right'] as const) {
    if (regionHasContent(region, state)) return region;
  }
  return 'editor';
}
