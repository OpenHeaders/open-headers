/**
 * Presentational chrome for `MergePane`: the per-pane slot wrapper,
 * the fallback pane header, and the resize sash.
 */

import type { ReactNode } from 'react';
import type React from 'react';

const HEADER_HEIGHT = 28;
const HEADER_PAD = '4px 10px';

interface PaneSlotProps {
  gridArea: string;
  visible: boolean;
  bg: string;
  header: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Optional flex-row flankers around the editor container. Used by
   *  the result pane to render the per-side action gutters
   *  (`<HunkActionGutter>`) flanking the editable Monaco surface. */
  leftFlanker?: ReactNode;
  rightFlanker?: ReactNode;
}

export function PaneSlot({
  gridArea,
  visible,
  bg,
  header,
  containerRef,
  leftFlanker,
  rightFlanker,
}: PaneSlotProps): React.ReactElement {
  return (
    <div
      style={{
        gridArea,
        // Hide via display:none; the inner editor instance + DOM
        // container survive (React keeps the subtree mounted; CSS
        // just removes it from layout). Re-showing triggers a Monaco
        // layout() in the visibility effect upstream so the editor
        // recovers its scroll geometry.
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        background: bg,
      }}
    >
      <div
        style={{
          height: HEADER_HEIGHT,
          padding: HEADER_PAD,
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(127,127,127,0.2)',
        }}
      >
        {header}
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
        {leftFlanker}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
        {rightFlanker}
      </div>
    </div>
  );
}

export function DefaultHeader({ label }: { label: string }): React.ReactElement {
  return <span>{label}</span>;
}

interface SashProps {
  gridArea: string;
  axis: 'col' | 'row';
  bg: string;
  ariaLabel: string;
  /** Approximate "first pane" share as a percentage (0–100). */
  ariaValueNow: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function Sash({
  gridArea,
  axis,
  bg,
  ariaLabel,
  ariaValueNow,
  onPointerDown,
  onKeyDown,
}: SashProps): React.ReactElement {
  return (
    <div
      className="oh-merge__sash"
      style={{
        gridArea,
        background: bg,
        cursor: axis === 'col' ? 'col-resize' : 'row-resize',
        zIndex: 2,
      }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="separator"
      aria-orientation={axis === 'col' ? 'vertical' : 'horizontal'}
      aria-label={ariaLabel}
      aria-valuenow={ariaValueNow}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}
