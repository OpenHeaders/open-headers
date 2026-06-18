import { useCallback, useRef, useState } from 'react';

/**
 * Side-by-side body panes for a rule-modified exchange — the served (what the
 * page received) next to the original (what the server sent). Each pane is a
 * labeled column; the children are already-rendered body views
 * ({@link BodyStateView} / {@link PreviewPane} / a request-body viewer). Used by
 * the Response, Preview, and Payload tabs when a lifecycle carries a two-sided
 * override.
 *
 * The divider is draggable to re-balance the two panes, clamped so neither
 * falls below {@link MIN_PANE_PX}. The split is a fraction of the container
 * width, so it holds as the panel resizes.
 */

/** Smallest width either pane may be dragged to. */
const MIN_PANE_PX = 140;

interface SplitBodyViewProps {
  readonly startLabel: string;
  readonly start: React.ReactNode;
  readonly endLabel: string;
  readonly end: React.ReactNode;
}

export default function SplitBodyView({ startLabel, start, endLabel, end }: SplitBodyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [startFraction, setStartFraction] = useState(0.5);

  const resizeToClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    // Clamp so each side keeps at least MIN_PANE_PX (cap the min at half the
    // container so a narrow panel still splits evenly rather than locking).
    const minFraction = Math.min(0.5, MIN_PANE_PX / rect.width);
    const raw = (clientX - rect.left) / rect.width;
    setStartFraction(Math.max(minFraction, Math.min(1 - minFraction, raw)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      resizeToClientX(e.clientX);
    },
    [resizeToClientX],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div className="dt-body-split" ref={containerRef}>
      <section className="dt-body-split-pane" style={{ flex: `0 0 ${startFraction * 100}%` }}>
        <header className="dt-body-split-label">{startLabel}</header>
        {start}
      </section>
      <div
        className="dt-body-split-divider"
        role="separator"
        aria-orientation="vertical"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <section className="dt-body-split-pane" style={{ flex: '1 1 0' }}>
        <header className="dt-body-split-label">{endLabel}</header>
        {end}
      </section>
    </div>
  );
}
