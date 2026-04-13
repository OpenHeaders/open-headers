/**
 * DropZoneOverlay — six-quadrant drop surface shown while the user is
 * dragging a dock tab.
 */

import { useDroppable } from '@dnd-kit/core';
import { theme } from 'antd';
import type React from 'react';
import { DOCK_LABELS } from '../tool-windows';
import type { DockSlot } from '../types';
import DockSlotIcon from './DockSlotIcon';
import type { DropZoneRect } from './ShellLayout';

interface DropZoneProps {
  slot: DockSlot;
  rect: DropZoneRect;
  highlighted: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ slot, rect, highlighted }) => {
  const { token } = theme.useToken();
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${slot}`, data: { slot } });
  const active = isOver || highlighted;
  const background = active ? `${token.colorPrimary}33` : `${token.colorPrimary}0D`;
  const border = active ? `2px solid ${token.colorPrimary}` : `1px dashed ${token.colorPrimary}77`;

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
        border,
      }}
      data-dock-slot={slot}
    >
      <span className="rules-drop-zone-label" style={{ color: token.colorPrimary, background: token.colorBgElevated }}>
        <span className="rules-drop-zone-label-icon">
          <DockSlotIcon slot={slot} size={20} />
        </span>
        {DOCK_LABELS[slot]}
      </span>
    </div>
  );
};

interface DropZoneOverlayProps {
  visible: boolean;
  rects: Record<DockSlot, DropZoneRect> | null;
  highlightedSlot: DockSlot | null;
}

const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({ visible, rects, highlightedSlot }) => {
  if (!visible || !rects) return null;

  return (
    <div className="rules-drop-overlay" aria-hidden="true">
      {(Object.keys(rects) as DockSlot[]).map((slot) => (
        <DropZone key={slot} slot={slot} rect={rects[slot]} highlighted={highlightedSlot === slot} />
      ))}
    </div>
  );
};

export default DropZoneOverlay;
