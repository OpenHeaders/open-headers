/**
 * Suggestion-popover placement math. Picks a side (below by default,
 * above when the field sits low and below can't fit) and caps the scroll
 * list to the room on that side, so the dropdown never opens straight
 * into a panel footer. Row / footer sizes are approximations — they only
 * seed the open-time side choice; the list's own scroll absorbs any error
 * past the cap.
 */

const POPOVER_GAP = 4;
const POPOVER_VIEWPORT_MARGIN = 8;
const POPOVER_LIST_MAX = 320; // mirrors `.oh-template-popover-list` max-height
const POPOVER_FOOTER_H = 34; // approx `.oh-template-popover-footer` height
const POPOVER_ROW_H = 30; // approx row height, for the open-time fit estimate
const POPOVER_LIST_MIN = 72; // keep a couple of rows visible even when cramped

export interface PopoverCoords {
  left: number;
  /** Anchors a downward popover (mutually exclusive with `bottom`). */
  top?: number;
  /** Anchors an upward popover — grows up from just above the field. */
  bottom?: number;
  /** Caps the scroll list to the room on the chosen side. */
  maxListHeight: number;
}

export function computePopoverCoords(rect: DOMRect, suggestionsLen: number, viewportHeight: number): PopoverCoords {
  const wantHeight = Math.min(Math.max(suggestionsLen, 1) * POPOVER_ROW_H, POPOVER_LIST_MAX) + POPOVER_FOOTER_H;
  const roomBelow = viewportHeight - rect.bottom - POPOVER_GAP - POPOVER_VIEWPORT_MARGIN;
  const roomAbove = rect.top - POPOVER_GAP - POPOVER_VIEWPORT_MARGIN;
  // Below by default; flip above when below can't fit the list and above
  // has more room. Re-evaluated on every call (not frozen at open), so a
  // window/pane resize re-picks the side live.
  const placeAbove = roomBelow < wantHeight && roomAbove > roomBelow;
  const room = placeAbove ? roomAbove : roomBelow;
  const maxListHeight = Math.max(POPOVER_LIST_MIN, Math.min(POPOVER_LIST_MAX, room - POPOVER_FOOTER_H));
  return placeAbove
    ? { left: rect.left, bottom: viewportHeight - rect.top + POPOVER_GAP, maxListHeight }
    : { left: rect.left, top: rect.bottom + POPOVER_GAP, maxListHeight };
}
