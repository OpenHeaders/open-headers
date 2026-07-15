/**
 * DropZoneOverlay — six independent drop-target rects shown while a
 * dock tab is being dragged. Each slot is its own absolute-positioned
 * `useDroppable` so dnd-kit's collision detection sees them as flat
 * siblings (no nested droppable hierarchy). The rects are pre-inset by
 * ShellLayout so adjacent zones never share an edge — the visible gap
 * between two halves of the same region (and between regions) is what
 * groups them visually for the user.
 */

import { useDroppable } from '@dnd-kit/core';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { theme } from 'antd';
import type React from 'react';
import DockSlotIcon from './DockSlotIcon';
import { DOCK_LABEL_KEYS } from './tool-window-copy';
import type { DockSlot, DropZoneRect } from './types';

interface DropZoneProps {
  slot: DockSlot;
  rect: DropZoneRect;
  highlighted: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ slot, rect, highlighted }) => {
  const { token } = theme.useToken();
  const t = useT();
  // Drop-zone sizes are computed once at drag start and never change
  // during the drag, so we don't need a ResizeObserver on each node.
  // Disabling it removes the only RO loop class still attached to these
  // droppables — dnd-kit's `BeforeDragging` measuring strategy already
  // freezes the rect map, but the per-droppable RO would still tick on
  // any subpixel/style change and call `measureDroppableContainers`
  // (which is a no-op under BeforeDragging, but the scheduling alone
  // costs renders). Belt and suspenders.
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${slot}`,
    data: { slot },
    resizeObserverConfig: { disabled: true },
  });
  const active = isOver || highlighted;
  // Opaque fills so underlying editor / panel content doesn't bleed
  // through during a drag — drop zones must read as a solid surface,
  // not a translucent wash, or the user can't focus on where they're
  // aiming.
  const background = active ? (token.colorPrimaryBg ?? '#bae0ff') : (token.colorBgElevated ?? '#ffffff');
  const borderColor = active ? token.colorPrimary : `${token.colorPrimary}77`;

  return (
    <div
      ref={setNodeRef}
      className={`rules-drop-zone ${active ? 'is-over' : ''}`}
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        background,
        borderColor,
      }}
      data-dock-slot={slot}
    >
      <span className="rules-drop-zone-label" style={{ color: token.colorPrimary, background: token.colorBgContainer }}>
        <span className="rules-drop-zone-label-icon">
          <DockSlotIcon slot={slot} size={20} />
        </span>
        {t(DOCK_LABEL_KEYS[slot])}
      </span>
    </div>
  );
};

interface DropZoneOverlayProps {
  visible: boolean;
  rects: Record<DockSlot, DropZoneRect> | null;
  highlightedSlot: DockSlot | null;
  /** Pixel x-extents of the activity bars so the content backdrop
      can stop short of them — bars stay drag-targets for tab reorder
      / cross-rail moves and must remain visually accessible. */
  leftBarWidth: number;
  rightBarWidth: number;
}

const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({
  visible,
  rects,
  highlightedSlot,
  leftBarWidth,
  rightBarWidth,
}) => {
  if (!visible || !rects) return null;

  return (
    <div className="rules-drop-overlay" aria-hidden="true">
      {/* Backdrop covers only the panel/editor area between the two
          activity bars — the bars themselves stay uncovered so users
          can still drag a tab onto another rail or reorder within
          the same rail. Sits below the zones in DOM order so the
          rects paint on top, and stays pointer-transparent so
          dnd-kit's hit testing routes through to the per-zone
          droppables. */}
      <div
        className="rules-drop-backdrop"
        style={{ left: leftBarWidth, right: rightBarWidth, top: 0, bottom: 0 }}
      />
      {(Object.keys(rects) as DockSlot[]).map((slot) => (
        <DropZone key={slot} slot={slot} rect={rects[slot]} highlighted={highlightedSlot === slot} />
      ))}
    </div>
  );
};

export default DropZoneOverlay;
