/**
 * usePopoverPlacement — keep a popover positioned next to its anchor,
 * accounting for the popover's actual rendered height. Hover popovers
 * lose the close-grace battle when there's a gap between anchor and
 * popover (cursor enters dead space → mouseleave fires → close timer
 * runs); placing the popover flush against the anchor closes that gap.
 *
 * The hook holds the position state, observes the popover's own size
 * via `ResizeObserver`, and re-runs `computeAnchoredPosition` on
 * scroll / resize / size change. Callers attach the returned ref to
 * their popover root and read `position` for `top` / `left`.
 */

import { type RefCallback, useCallback, useEffect, useRef, useState } from 'react';
import { computeAnchoredPosition, type PopoverPlacement } from './popover-position';

export interface UsePopoverPlacementApi {
  position: PopoverPlacement;
  popoverRef: RefCallback<HTMLElement>;
  /** False until the popover's real rendered height has been
   *  measured. Callers should keep the popover `visibility: hidden`
   *  while this is false to avoid a one-frame flicker — the initial
   *  position uses an estimated height (~220px) which is wrong by
   *  ~50px for typical popover content; correcting it after the
   *  first paint makes the popover visibly jump. Hiding through the
   *  first paint and revealing once measured eliminates the flicker
   *  without delaying the popover. */
  measured: boolean;
}

export function usePopoverPlacement(anchorEl: HTMLElement, width: number): UsePopoverPlacementApi {
  // Initial render uses the conservative default-height estimate
  // from `computeAnchoredPosition`. The popover is hidden via
  // `measured: false` until the ref-callback below records the real
  // height; the position state is then correct on the first VISIBLE
  // paint, no flicker.
  const [position, setPosition] = useState<PopoverPlacement>(() => computeAnchoredPosition(anchorEl, width));
  const [measured, setMeasured] = useState(false);
  const elRef = useRef<HTMLElement | null>(null);
  const heightRef = useRef<number | undefined>(undefined);

  const recompute = useCallback(() => {
    setPosition(computeAnchoredPosition(anchorEl, width, heightRef.current));
  }, [anchorEl, width]);

  // ref-callback only stores the element. Measurement is driven by
  // the ResizeObserver below.
  const popoverRef = useCallback<RefCallback<HTMLElement>>((node) => {
    elRef.current = node;
    if (!node) setMeasured(false);
  }, []);

  useEffect(() => {
    const node = elRef.current;
    if (!node) return;
    let revealRaf1 = 0;
    let revealRaf2 = 0;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // Use border-box size, NOT `contentRect`. `contentRect` is the
      // content-box (CSS Box Model: excludes padding + border) — for
      // a popover with `padding: 12; border: 1px` that under-reports
      // by 26px, leaving the popover floating ~26px below where its
      // top-edge calc thinks it should be. `borderBoxSize` is the
      // visually-painted box and matches `getBoundingClientRect()`.
      const next = entry.borderBoxSize?.[0]?.blockSize ?? node.getBoundingClientRect().height;
      if (next === heightRef.current) return;
      heightRef.current = next;
      recompute();
    });
    ro.observe(node);
    // Reveal-after-settle: a single ResizeObserver fire isn't proof
    // that layout is stable — late layout passes (font swap, AntD
    // TextArea autoSize, child portal mounts) can fire again on the
    // next frame and shift the popover. Waiting two animation frames
    // before flipping `measured: true` guarantees the painter sees
    // the final position; combined with the CSS opacity transition
    // on the popover root, any fire that lands DURING the fade-in is
    // imperceptible because the popover is still partially
    // transparent and animating.
    revealRaf1 = requestAnimationFrame(() => {
      revealRaf2 = requestAnimationFrame(() => setMeasured(true));
    });
    return () => {
      ro.disconnect();
      cancelAnimationFrame(revealRaf1);
      cancelAnimationFrame(revealRaf2);
    };
  }, [recompute]);

  useEffect(() => {
    const onScroll = () => recompute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [recompute]);

  return { position, popoverRef, measured };
}
