/**
 * Tooltip-style popover positioning. Centers the popover above the
 * anchor (like AntD's `placement="top"`); flips below when there
 * isn't enough room above; clamps inside the viewport so it never
 * spills off-screen.
 *
 * Anchor element should be a NARROW trigger (a button, span, etc.)
 * so the centered placement lands where the user is actually pointing.
 */

export interface PopoverPlacement {
  top: number;
  left: number;
  /** Which vertical side the popover landed on. Exposed so callers
   *  can flip animation direction or arrow style if they need to. */
  side: 'above' | 'below';
}

// Hairline gap between popover and anchor. Wider gaps create dead
// space the cursor crosses on the way into a hover popover, which
// triggers `mouseleave` on the anchor and starts the close-grace
// timer — auto-closing the popover before the cursor reaches it.
const EDGE_GAP = 2;
const VIEWPORT_PAD = 8;

export function computeAnchoredPosition(anchorEl: HTMLElement, width: number, height = 220): PopoverPlacement {
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Above first; flip below if there isn't enough room. "Enough room"
  // means the popover's height + gap fits between the anchor and the
  // viewport top, with viewport padding to spare.
  const roomAbove = rect.top - VIEWPORT_PAD;
  const roomBelow = vh - rect.bottom - VIEWPORT_PAD;
  const side: 'above' | 'below' = roomAbove >= height + EDGE_GAP || roomAbove >= roomBelow ? 'above' : 'below';

  const top =
    side === 'above'
      ? Math.max(VIEWPORT_PAD, rect.top - EDGE_GAP - height)
      : Math.min(vh - height - VIEWPORT_PAD, rect.bottom + EDGE_GAP);

  // Left-align with the anchor — the popover starts where the
  // hovered text starts and extends to the right. Centering on a
  // narrow anchor would put the popover ~half-width to the LEFT of
  // the text, covering content the user is reading. Clamped inside
  // the viewport so it never overflows the right edge.
  let left = Math.round(rect.left);
  if (left + width > vw - VIEWPORT_PAD) left = vw - width - VIEWPORT_PAD;
  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

  return { top, left, side };
}
