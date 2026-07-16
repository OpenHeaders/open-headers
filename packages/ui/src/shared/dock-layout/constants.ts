/**
 * Shared constants for the dockable tool-window layout system.
 */

import type { DockSlot, ToolRegion } from './types';

export const ALL_DOCK_SLOTS: readonly DockSlot[] = [
  'left-top',
  'left-bottom',
  'right-top',
  'right-bottom',
  'bottom-left',
  'bottom-right',
];

/** Map from a dock slot to the high-level screen region that contains it. */
export function dockRegion(slot: DockSlot): ToolRegion {
  if (slot === 'left-top' || slot === 'left-bottom') return 'left';
  if (slot === 'right-top' || slot === 'right-bottom') return 'right';
  return 'bottom';
}

/** Return the two dock slots belonging to a region. */
export function regionDocks(region: ToolRegion): [DockSlot, DockSlot] {
  if (region === 'left') return ['left-top', 'left-bottom'];
  if (region === 'right') return ['right-top', 'right-bottom'];
  return ['bottom-left', 'bottom-right'];
}

// Activity-bar size constants — kept in one place so the Pane min/max,
// the host settings schema, and the render path agree. Compact (icon-
// only) mode pins the bar; labeled mode allows free resize within
// [BAR_LABELED_MIN, BAR_LABELED_MAX] driven by the user's settings.
export const BAR_COMPACT_WIDTH = 36;
export const BAR_LABELED_MIN = 64;
// Wide enough that the longest tool-window label ("Deep Network
// Inspection") renders untruncated after rail + tab padding, with slack
// for larger UI scales. 160 clipped it even at full stretch.
export const BAR_LABELED_MAX = 280;
