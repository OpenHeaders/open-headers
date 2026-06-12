import { type RefObject, useCallback, useRef, useState } from 'react';

const MIN_PANE_PCT = 15;
/**
 * Space the TOP pane always keeps, in pixels — enough for the toolbar,
 * the grid header and one data row, so dragging the preview up can
 * never hide that the grid exists.
 */
const DEFAULT_MIN_TOP_PX = 90;

export interface VerticalSplitApi {
  /** Attach to the element that contains both panes (the split's frame of reference). */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Height of the BOTTOM pane as a percentage of the container. */
  bottomPct: number;
  /** Pointer-down handler for the divider between the panes. */
  onDividerPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * Drag-resizable horizontal divider between a top pane and a bottom
 * pane (the Messages tab's grid / preview split). Pointer capture keeps
 * the drag alive when the cursor leaves the divider; the percentage is
 * clamped so neither pane can collapse out of reach.
 */
export function useVerticalSplit(initialBottomPct: number, minTopPx: number = DEFAULT_MIN_TOP_PX): VerticalSplitApi {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bottomPct, setBottomPct] = useState(initialBottomPct);

  const onDividerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;
      e.preventDefault();
      const divider = e.currentTarget;
      divider.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        if (rect.height === 0) return;
        const fromBottomPx = rect.bottom - ev.clientY;
        const maxPct = ((rect.height - minTopPx) / rect.height) * 100;
        const pct = (fromBottomPx / rect.height) * 100;
        setBottomPct(Math.max(MIN_PANE_PCT, Math.min(maxPct, pct)));
      };
      const onUp = () => {
        divider.removeEventListener('pointermove', onMove);
        divider.removeEventListener('pointerup', onUp);
        divider.removeEventListener('pointercancel', onUp);
      };
      divider.addEventListener('pointermove', onMove);
      divider.addEventListener('pointerup', onUp);
      divider.addEventListener('pointercancel', onUp);
    },
    [minTopPx],
  );

  return { containerRef, bottomPct, onDividerPointerDown };
}
