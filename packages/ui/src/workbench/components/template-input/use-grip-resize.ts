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
      // preventDefault stops the pointerdown from blurring an already-
      // focused editable. Grabbing the grip on a blurred (collapsed)
      // field deliberately does NOT focus it — a grip click is a drag
      // gesture, not an edit intent, and focusing would balloon an
      // expand-on-focus field open just for a horizontal column drag.
      // Double-click (below) is the expand-to-fit gesture.
      e.preventDefault();
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
      // Auto-fit: drop the manual height so the surface returns to
      // auto-grow — as tall as the content needs, capped at maxRows
      // (past the cap it inner-scrolls). Focusing expands a collapsed
      // expand-on-focus field so the fit is visible immediately.
      setManualHeight(null);
      editableRef.current?.focus();
      onResizeX?.({ phase: 'reset', deltaX: 0, gripEl: e.currentTarget });
    },
    [editableRef, onResizeX],
  );

  return { manualHeight, handleGripPointerDown, handleGripPointerMove, handleGripPointerUp, handleGripDoubleClick };
}
