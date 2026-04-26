/**
 * usePopoverPlacement — keep a popover anchored next to its trigger
 * across the popover's lifetime.
 *
 * Lifecycle contract (intentionally minimal):
 *   - Position derives from the anchor's `getBoundingClientRect()`
 *     + the popover's measured height. Recomputed on:
 *       - Popover size changes (own ResizeObserver).
 *       - Anchor size / position changes (anchor's ResizeObserver).
 *       - Window scroll / resize.
 *   - If the anchor is momentarily detached during React reconciliation,
 *     skip the recompute (don't write a zero-rect position). The next
 *     observer fire after reconnect picks up the real rect.
 *   - If the anchor goes away PERMANENTLY (its host destroyed it),
 *     that's the consumer's responsibility to handle — close the
 *     popover in the action that mutated the host. Hover popovers
 *     should close on commit-style actions anyway (matches AntD /
 *     Radix / etc.). The hook intentionally doesn't try to detect
 *     "anchor lost" via timeouts — that's brittle and only ever needed
 *     because the consumer kept the popover open across an action.
 *
 * `measured` is a paint-flicker guard — false until the popover's
 * real height has been recorded across two animation frames; the
 * popover should stay `visibility: hidden` until then so the initial
 * paint at the estimated-height position never reaches the screen.
 */

import { type RefCallback, useCallback, useEffect, useRef, useState } from 'react';
import { computeAnchoredPosition, type PopoverPlacement } from './popover-position';

export interface UsePopoverPlacementApi {
  position: PopoverPlacement;
  popoverRef: RefCallback<HTMLElement>;
  measured: boolean;
}

export function usePopoverPlacement(anchorEl: HTMLElement, width: number): UsePopoverPlacementApi {
  const [position, setPosition] = useState<PopoverPlacement>(() => computeAnchoredPosition(anchorEl, width));
  const [measured, setMeasured] = useState(false);
  const elRef = useRef<HTMLElement | null>(null);
  const heightRef = useRef<number | undefined>(undefined);

  const recompute = useCallback(() => {
    // Skip during transient detachment — the next observer fire after
    // reconnect picks up the real rect. Permanent loss is the
    // consumer's responsibility to close (see file header).
    if (!anchorEl.isConnected) return;
    setPosition(computeAnchoredPosition(anchorEl, width, heightRef.current));
  }, [anchorEl, width]);

  // ref-callback only stores the element; measurement is driven by the
  // ResizeObserver below so the FIRST height we record is the LAST
  // (post-autoSize / post-content-layout) height — no jump-after-reveal.
  const popoverRef = useCallback<RefCallback<HTMLElement>>((node) => {
    elRef.current = node;
    if (!node) setMeasured(false);
  }, []);

  // Popover-side observer — tracks the popover's own size for
  // continuous repositioning as content changes.
  useEffect(() => {
    const node = elRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // Use border-box (matches `getBoundingClientRect`); `contentRect`
      // is the content-box and excludes padding+border (~26px short
      // for a popover with `padding: 12; border: 1px`).
      const next = entry.borderBoxSize?.[0]?.blockSize ?? node.getBoundingClientRect().height;
      if (next === heightRef.current) return;
      heightRef.current = next;
      recompute();
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [recompute]);

  // Anchor-side observer — repositions when the anchor moves (parent
  // reflow, sibling content changes its width, etc.) without the
  // popover's own height changing.
  useEffect(() => {
    const ro = new ResizeObserver(() => recompute());
    ro.observe(anchorEl);
    return () => ro.disconnect();
  }, [anchorEl, recompute]);

  // Reveal-after-settle: defer `measured: true` by two animation
  // frames so any late layout pass (font swap, AntD `TextArea`
  // autoSize, child portal mount) has had a chance to settle the
  // popover's height before the first VISIBLE paint. The CSS
  // transition on the popover root absorbs any micro-shift that does
  // happen to land during the fade-in.
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMeasured(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Window scroll / resize — anchor coords change with viewport.
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
