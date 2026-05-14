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

export const DOCK_LABELS: Record<DockSlot, string> = {
  'left-top': 'Left Top',
  'left-bottom': 'Left Bottom',
  'right-top': 'Right Top',
  'right-bottom': 'Right Bottom',
  'bottom-left': 'Bottom Left',
  'bottom-right': 'Bottom Right',
};

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
