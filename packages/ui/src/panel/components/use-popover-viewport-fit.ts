import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** Reserve below the trigger: clears the 24px footer status bar plus the
 * popover's own offset + inner padding (~8px) and a breathing gap, so the
 * menu's bottom edge lands just above the footer's grey zone instead of
 * overlapping it. */
const BOTTOM_RESERVE_PX = 64;

/** Reserve above the trigger when a flipped popover opens upward — clears
 * the pane's tab strip / toolbar chrome plus the popover offset. */
const TOP_RESERVE_PX = 48;

/** Absolute floor — one row's worth, so the menu always stays a usable
 * scroll strip yet keeps shrinking with the panel down to a single row
 * rather than flooring early and sliding its bottom over the footer. */
const MIN_MENU_PX = 24;

/** Below-room a form-sized popover considers comfortable. Under it (and
 * with more room above) the flip-enabled variant opens upward instead of
 * squashing into the strip left under a bottom row. */
const FLIP_MIN_PX = 400;

/**
 * Caps a toolbar-style popover (`.dt-morefilters-menu`) to the room beneath its
 * trigger, so it stays anchored to the button and shrinks + scrolls internally
 * as the panel gets shorter — the same behaviour the top-toolbar popovers get
 * for free from the static `calc(100vh - 96px)` cap, but correct for a popover
 * that opens lower in the detail pane (where a fixed reserve would either
 * overrun the viewport or, with antd's auto-adjust, slide the menu off its
 * anchor). The trigger offset is re-read on open and on panel resize, so the
 * cap tracks the live panel height.
 *
 * `flip: true` (for form-sized popovers triggered from arbitrary rows, e.g.
 * the cookie jar editor) also measures the room ABOVE the trigger: when the
 * space below is too small for the form and above is larger, `flipUp` comes
 * back true — the caller swaps its `bottom*` placement for the `top*` twin —
 * and `maxHeight` caps to the room above instead. Menus triggered from the
 * top toolbars never need this and keep the plain below-only behaviour.
 */
export function usePopoverViewportFit<T extends HTMLElement = HTMLElement>(options?: { flip?: boolean }): {
  triggerRef: RefObject<T | null>;
  onOpenChange: (open: boolean) => void;
  maxHeight: number | undefined;
  flipUp: boolean;
} {
  const flip = options?.flip === true;
  const triggerRef = useRef<T | null>(null);
  const [open, setOpen] = useState(false);
  // Persisted across closes so a reopen paints with the last good cap
  // immediately, before the on-open re-measure refreshes it.
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  const [flipUp, setFlipUp] = useState(false);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - BOTTOM_RESERVE_PX;
    const above = rect.top - TOP_RESERVE_PX;
    const up = flip && below < FLIP_MIN_PX && above > below;
    setFlipUp(up);
    setMaxHeight(Math.max(up ? above : below, MIN_MENU_PX));
  }, [flip]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) measure();
    },
    [measure],
  );

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, measure]);

  return { triggerRef, onOpenChange, maxHeight, flipUp };
}
