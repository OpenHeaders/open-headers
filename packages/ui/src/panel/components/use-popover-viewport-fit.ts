import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** Reserve below the trigger: clears the 24px footer status bar plus the
 * popover's own offset + inner padding (~8px) and a breathing gap, so the
 * menu's bottom edge lands just above the footer's grey zone instead of
 * overlapping it. */
const BOTTOM_RESERVE_PX = 64;

/** Absolute floor — one row's worth, so the menu always stays a usable
 * scroll strip yet keeps shrinking with the panel down to a single row
 * rather than flooring early and sliding its bottom over the footer. */
const MIN_MENU_PX = 24;

/**
 * Caps a toolbar-style popover (`.dt-morefilters-menu`) to the room beneath its
 * trigger, so it stays anchored to the button and shrinks + scrolls internally
 * as the panel gets shorter — the same behaviour the top-toolbar popovers get
 * for free from the static `calc(100vh - 96px)` cap, but correct for a popover
 * that opens lower in the detail pane (where a fixed reserve would either
 * overrun the viewport or, with antd's auto-adjust, slide the menu off its
 * anchor). The trigger offset is re-read on open and on panel resize, so the
 * cap tracks the live panel height.
 */
export function usePopoverViewportFit<T extends HTMLElement = HTMLElement>(): {
  triggerRef: RefObject<T | null>;
  onOpenChange: (open: boolean) => void;
  maxHeight: number | undefined;
} {
  const triggerRef = useRef<T | null>(null);
  const [open, setOpen] = useState(false);
  // Persisted across closes so a reopen paints with the last good cap
  // immediately, before the on-open re-measure refreshes it.
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const room = window.innerHeight - el.getBoundingClientRect().bottom - BOTTOM_RESERVE_PX;
    setMaxHeight(Math.max(room, MIN_MENU_PX));
  }, []);

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

  return { triggerRef, onOpenChange, maxHeight };
}
