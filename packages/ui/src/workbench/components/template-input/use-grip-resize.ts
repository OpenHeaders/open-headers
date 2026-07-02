/**
 * Manual height from the resize grip. Overrides the maxRows
 * auto-grow cap while the surface is expanded; kept across
 * collapse/expand cycles so the field reopens at the user's size.
 */

import type React from 'react';
import { useCallback, useRef, useState } from 'react';

export function useGripResize(editableRef: React.RefObject<HTMLDivElement | null>) {
  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const gripDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
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
      gripDragRef.current = { startY: e.clientY, startHeight: el.offsetHeight };
    },
    [editableRef],
  );
  const handleGripPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = gripDragRef.current;
    if (!drag) return;
    const minHeight = 24;
    setManualHeight(Math.max(minHeight, drag.startHeight + (e.clientY - drag.startY)));
  }, []);
  const handleGripPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    gripDragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return { manualHeight, setManualHeight, handleGripPointerDown, handleGripPointerMove, handleGripPointerUp };
}
