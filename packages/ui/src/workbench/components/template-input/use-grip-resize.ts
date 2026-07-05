/**
 * Grip drag state for a resizable TemplateInput surface.
 *
 * Vertical axis: manual height from the drag overrides the maxRows
 * auto-grow cap while the surface is expanded; kept across
 * collapse/expand cycles so the field reopens at the user's size.
 *
 * Horizontal axis: the field never owns its width — that belongs to
 * the layout it sits in — so X travel is only REPORTED through the
 * optional `onResizeX` handler for the layout owner (e.g. a column
 * split) to apply. Double-click resets both axes: height locally,
 * width via a `reset` phase to the owner.
 */

import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import type { GripResizeXHandler } from './types';

export function useGripResize(editableRef: React.RefObject<HTMLDivElement | null>, onResizeX?: GripResizeXHandler) {
  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const gripDragRef = useRef<{ startX: number; startY: number; startHeight: number } | null>(null);
  const handleGripPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = editableRef.current;
      if (!el) return;
      // preventDefault stops the pointerdown from blurring the editable;
      // the explicit focus() covers grabbing the grip on a blurred
      // (collapsed) field — focusing expands it, so the drag resizes the
      // wrapped surface rather than the one-line ellipsis view.
      e.preventDefault();
      el.focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      gripDragRef.current = { startX: e.clientX, startY: e.clientY, startHeight: el.offsetHeight };
      onResizeX?.({ phase: 'start', deltaX: 0, gripEl: e.currentTarget });
    },
    [editableRef, onResizeX],
  );
  const handleGripPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = gripDragRef.current;
      if (!drag) return;
      const minHeight = 24;
      setManualHeight(Math.max(minHeight, drag.startHeight + (e.clientY - drag.startY)));
      onResizeX?.({ phase: 'move', deltaX: e.clientX - drag.startX, gripEl: e.currentTarget });
    },
    [onResizeX],
  );
  const handleGripPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = gripDragRef.current;
      if (drag) onResizeX?.({ phase: 'end', deltaX: e.clientX - drag.startX, gripEl: e.currentTarget });
      gripDragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [onResizeX],
  );
  const handleGripDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setManualHeight(null);
      onResizeX?.({ phase: 'reset', deltaX: 0, gripEl: e.currentTarget });
    },
    [onResizeX],
  );

  return { manualHeight, handleGripPointerDown, handleGripPointerMove, handleGripPointerUp, handleGripDoubleClick };
}
