/**
 * Sash — the resize handle between two shell tracks.
 *
 * A pure CSS overlay on the edge of the cell it resizes (so it follows
 * the grid line with no JavaScript), plus one pointer-capture drag
 * loop. Each pointer move clamps and hands the next pixel size to the
 * session's `apply`, which writes a single custom property — the
 * layout engine does the rest. `commit` fires once on release so the
 * host persists exactly one value per drag. Double-click hands off to
 * `onReset`.
 */

import type React from 'react';
import { useCallback, useRef } from 'react';
import { clampTrack } from './track-model';

export interface SashSession {
  /** Size of the resized track at drag start, px. */
  start: number;
  min: number;
  max: number;
  /** Write the next size — one custom-property write, no React state. */
  apply: (px: number) => void;
  /** Persist the final size; called once, on release. */
  commit: (px: number) => void;
}

export interface SashProps {
  axis: 'x' | 'y';
  /** Edge of its cell the sash sits on. On the `end` edge the cell
      grows as the pointer moves toward the end; on the `start` edge
      it grows as the pointer moves toward the start. */
  edge: 'start' | 'end';
  /** Opens a drag session, or null to refuse the drag. */
  begin: () => SashSession | null;
  onReset?: () => void;
}

const DRAG_CLASS: Record<SashProps['axis'], string> = {
  x: 'oh-sash-dragging-x',
  y: 'oh-sash-dragging-y',
};

const Sash: React.FC<SashProps> = ({ axis, edge, begin, onReset }) => {
  const dragRef = useRef<{ session: SashSession; origin: number; last: number } | null>(null);

  const finish = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.documentElement.classList.remove(DRAG_CLASS[axis]);
      e.currentTarget.classList.remove('oh-sash--active');
      drag.session.commit(drag.last);
    },
    [axis],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const session = begin();
      if (!session) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { session, origin: axis === 'x' ? e.clientX : e.clientY, last: session.start };
      document.documentElement.classList.add(DRAG_CLASS[axis]);
      e.currentTarget.classList.add('oh-sash--active');
    },
    [axis, begin],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pos = axis === 'x' ? e.clientX : e.clientY;
      const delta = (pos - drag.origin) * (edge === 'end' ? 1 : -1);
      const next = clampTrack(drag.session.start + delta, drag.session.min, drag.session.max);
      if (next === drag.last) return;
      drag.last = next;
      drag.session.apply(next);
    },
    [axis, edge],
  );

  return (
    <div
      className={`oh-sash oh-sash--${axis} oh-sash--${edge}`}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onDoubleClick={onReset}
    />
  );
};

export default Sash;
