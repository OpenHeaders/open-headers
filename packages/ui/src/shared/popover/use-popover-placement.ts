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

// Breathing room left between the popover's bottom and the footer's top once
// the cap engages. Small because the cap measures the footer's REAL top, not a
// viewport guess that has to over-reserve for the footer's own height.
const FOOTER_CAP_GAP = 8;
// Floor — one row's worth, so the popover stays a thin scroll strip rather than
// collapsing as the footer rises to meet it on a very short pane.
const MIN_CAP_HEIGHT = 24;

export function usePopoverPlacement(
  anchorEl: HTMLElement,
  width: number,
  opts?: {
    trackScroll?: boolean;
    boundsEl?: HTMLElement | null;
    footerEl?: HTMLElement | null;
    staticAfterMeasure?: boolean;
  },
): UsePopoverPlacementApi {
  // Whether to re-anchor on scroll. Hover popovers track their trigger as the
  // page scrolls; a pinned editor opts out (`trackScroll: false`) so it stays
  // put relative to the panel while the list scrolls underneath it, rather
  // than drifting along with its (scrolling) anchor row.
  const trackScroll = opts?.trackScroll ?? true;
  // The pane's bottom bar (e.g. the panel status bar). When supplied, the
  // height cap tracks this element's REAL top on BOTH sides — so the popover's
  // bottom stays above it and the content scrolls inside as the pane shortens,
  // even when the popover opened ABOVE its trigger (the room-above cap alone
  // ignores a footer rising from below). Re-read live on resize; because the
  // footer is stable, that never jitters the placement the way re-reading the
  // scrolling anchor would.
  const footerEl = opts?.footerEl ?? null;
  // Freeze the anchored position once it has settled (after the reveal
  // frames). A pinned editor over a list whose rows shift sub-pixel as the
  // pane reflows would otherwise re-anchor on every resize frame — visible as
  // a jitter the static (Ant-positioned) toolbar popovers never show. Frozen,
  // the top/left/side stay put like those; only the footer-tracked `maxHeight`
  // keeps updating, so the bottom follows the footer without moving the popover.
  const staticAfterMeasure = opts?.staticAfterMeasure ?? false;
  // Optional clipping/positioning container. When provided, the returned
  // `top`/`left` are relative to it (the consumer renders `position: absolute`
  // and portals into it, so the container's `overflow` clips and its footer
  // covers) and the height cap follows the container — which may be a pane
  // shorter than the window. When absent, coordinates are viewport-relative
  // for `position: fixed`.
  const boundsEl = opts?.boundsEl ?? null;
  const [position, setPosition] = useState<PopoverPlacement>(() => computeAnchoredPosition(anchorEl, width));
  const [measured, setMeasured] = useState(false);
  const elRef = useRef<HTMLElement | null>(null);
  const heightRef = useRef<number | undefined>(undefined);
  // Latched true once the position has settled (see reveal effect). While true,
  // `recompute` stops re-anchoring top/left/side, so resize / scroll / content
  // observers can't drift the popover — only the footer-tracked `maxHeight`
  // keeps updating.
  const frozenRef = useRef(false);

  const recompute = useCallback(() => {
    // Skip during transient detachment — the next observer fire after
    // reconnect picks up the real rect. Permanent loss is the
    // consumer's responsibility to close (see file header).
    if (!anchorEl.isConnected) return;
    const r = boundsEl?.getBoundingClientRect();
    // Footer-tracked cap for a given (container-relative) popover top: the room
    // down to the footer's real top, floored. Returns Infinity with no footer,
    // so callers fall back to the anchor-derived `maxHeight` below.
    const footerCap = (top: number): number => {
      if (!footerEl) return Number.POSITIVE_INFINITY;
      const footerTop = footerEl.getBoundingClientRect().top - (r?.top ?? 0);
      return Math.max(footerTop - top - FOOTER_CAP_GAP, MIN_CAP_HEIGHT);
    };

    // Placement is pinned after settle — only the live footer cap keeps
    // tracking, so the bottom follows the footer on resize without re-reading
    // (and jittering against) the moving anchor.
    if (staticAfterMeasure && frozenRef.current) {
      if (!footerEl) return;
      setPosition((prev) => {
        const capped = footerCap(prev.top);
        return capped === prev.maxHeight ? prev : { ...prev, maxHeight: capped };
      });
      return;
    }

    // Clamp the container rect to the VISIBLE window before sizing the fallback
    // cap. `.dt-panel-root` is `height: 100vh`, so when it's offset below a top
    // bar (the workbench) its `bottom` sits past the window edge; capping to
    // that hidden region let the popover run under the footer.
    const bounds = r
      ? {
          top: Math.max(r.top, 0),
          bottom: Math.min(r.bottom, window.innerHeight),
          left: Math.max(r.left, 0),
          right: Math.min(r.right, window.innerWidth),
        }
      : undefined;
    const p = computeAnchoredPosition(anchorEl, width, heightRef.current, bounds);
    // Coordinates stay relative to the actual container origin (raw rect) so
    // `position: absolute` inside it lands correctly. The footer cap (when a
    // footer is supplied) supersedes the anchor-derived one on both sides.
    const top = r ? p.top - r.top : p.top;
    const left = r ? p.left - r.left : p.left;
    const maxHeight = footerEl ? footerCap(top) : p.maxHeight;
    setPosition({ top, left, side: p.side, maxHeight });
  }, [anchorEl, width, boundsEl, footerEl, staticAfterMeasure]);

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

  // Bounds-side observer — re-fits the height cap when the container pane
  // resizes (e.g. dragging the dock divider), which doesn't fire a window
  // `resize`. Without this the popover keeps a stale, too-tall cap and spills
  // past the pane's footer when the pane shortens.
  useEffect(() => {
    if (!boundsEl) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(boundsEl);
    return () => ro.disconnect();
  }, [boundsEl, recompute]);

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
      raf2 = requestAnimationFrame(() => {
        setMeasured(true);
        // Position has settled (initial anchor + the popover's own
        // ResizeObserver has recorded its real height) — latch it so later
        // resize/scroll/content observer fires can't re-anchor and jitter it.
        if (staticAfterMeasure) frozenRef.current = true;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [staticAfterMeasure]);

  // Window resize always re-fits. Scroll tracking (capture, so it catches
  // inner scroll containers) re-anchors a moving trigger — gated by
  // `trackScroll` so a pinned editor stays put as the panel scrolls.
  useEffect(() => {
    const onChange = () => recompute();
    window.addEventListener('resize', onChange);
    if (trackScroll) window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      if (trackScroll) window.removeEventListener('scroll', onChange, true);
    };
  }, [recompute, trackScroll]);

  return { position, popoverRef, measured };
}
