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
  /** Room the popover may occupy on its chosen side — the trigger-to-footer
   *  gap (below) or trigger-to-viewport-top gap (above). Callers cap their
   *  height to this and scroll inside, so the popover stays anchored to the
   *  trigger and shrinks to clear the footer instead of overflowing. */
  maxHeight: number;
}

/** Viewport-space rectangle the popover must stay within. Defaults to the
 *  window; pass a scroll-pane's rect (e.g. the inspector root) so the cap
 *  and clamps follow the PANE — which can be shorter than the window and
 *  carries its own footer — instead of overflowing past it. */
export interface AnchorBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Hairline gap between popover and anchor. Wider gaps create dead
// space the cursor crosses on the way into a hover popover, which
// triggers `mouseleave` on the anchor and starts the close-grace
// timer — auto-closing the popover before the cursor reaches it.
const EDGE_GAP = 2;
const VIEWPORT_PAD = 8;
// Clears the pane's bottom footer status bar plus a breathing gap for a
// popover that opens downward (mirrors `usePopoverViewportFit`).
const FOOTER_RESERVE = 64;
// Floor so the popover stays a usable strip even on a very short panel.
const MIN_POPOVER_HEIGHT = 120;

export function computeAnchoredPosition(
  anchorEl: HTMLElement,
  width: number,
  height = 220,
  bounds?: AnchorBounds,
): PopoverPlacement {
  const rect = anchorEl.getBoundingClientRect();
  const bTop = bounds?.top ?? 0;
  const bBottom = bounds?.bottom ?? window.innerHeight;
  const bLeft = bounds?.left ?? 0;
  const bRight = bounds?.right ?? window.innerWidth;

  // Pick the side with more room. Critically this does NOT consult the
  // popover's measured `height`: doing so created a feedback loop on
  // resize-down — a smaller cap shrank the popover, the shrink flipped the
  // side, the flip recomputed a larger cap, so the cap never settled
  // smaller (only resize-up, which never shrinks, updated). Room-only keeps
  // the side stable, so the cap tracks the viewport in both directions, and
  // an anchor near the bottom correctly opens above instead of overflowing.
  const roomAbove = rect.top - bTop - VIEWPORT_PAD;
  const roomBelow = bBottom - rect.bottom - VIEWPORT_PAD;
  const side: 'above' | 'below' = roomAbove > roomBelow ? 'above' : 'below';

  // Cap to the room on the chosen side: below → down to the footer reserve,
  // above → up to the bounds top. The popover hugs the trigger and scrolls
  // inside when content exceeds this, rather than spilling past the pane.
  const maxHeight = Math.max(
    side === 'above' ? rect.top - bTop - EDGE_GAP - VIEWPORT_PAD : bBottom - rect.bottom - EDGE_GAP - FOOTER_RESERVE,
    MIN_POPOVER_HEIGHT,
  );

  // Position for the height the popover ACTUALLY renders at — capped to
  // `maxHeight`. Using the raw (uncapped) height here would clamp `top` with
  // a stale, too-tall value and let the bottom slide under the always-on-top
  // footer on resize. With the capped height: below sits at the trigger and
  // its bottom lands at `bBottom - FOOTER_RESERVE` (sticky above the footer,
  // shrinking as the pane shortens); above lands just over the trigger.
  const effectiveHeight = Math.min(height, maxHeight);

  const top =
    side === 'above'
      ? Math.max(bTop + VIEWPORT_PAD, rect.top - EDGE_GAP - effectiveHeight)
      : rect.bottom + EDGE_GAP;

  // Left-align with the anchor — the popover starts where the
  // hovered text starts and extends to the right. Centering on a
  // narrow anchor would put the popover ~half-width to the LEFT of
  // the text, covering content the user is reading. Clamped inside
  // the bounds so it never overflows the right edge.
  let left = Math.round(rect.left);
  if (left + width > bRight - VIEWPORT_PAD) left = bRight - width - VIEWPORT_PAD;
  if (left < bLeft + VIEWPORT_PAD) left = bLeft + VIEWPORT_PAD;

  return { top, left, side, maxHeight };
}
