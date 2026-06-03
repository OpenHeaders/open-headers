import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** Air left below the menu's last row before the viewport edge — clears the
 * popover's inner padding and antd's trigger offset, with a little to spare. */
const VIEWPORT_GAP_PX = 12;

/**
 * Caps a toolbar-style popover (`.dt-morefilters-menu`) to the room beneath
 * its trigger, so it grows to fit and scrolls only when the panel is too short
 * to show every row.
 *
 * The shared menu CSS reserves a fixed strip for the *top* toolbar
 * (`calc(100vh - 96px)`), which is correct only for popovers that open near
 * the viewport's top. Detail-pane popovers open well below that, where the
 * static reserve would let the menu overrun the panel's bottom edge. This hook
 * measures the trigger's actual offset on open — and again on panel resize
 * while open, so the menu re-fits live as the DevTools panel is dragged — and
 * returns an inline `maxHeight` that overrides the static cap for that menu
 * only (top-toolbar popovers, which don't use this hook, keep the CSS reserve).
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
    const room = window.innerHeight - el.getBoundingClientRect().bottom - VIEWPORT_GAP_PX;
    setMaxHeight(Math.max(room, 0));
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
