import { useDroppable } from '@dnd-kit/core';
import type React from 'react';
import { PANEL_DOCK_LABELS, type PanelDockSlot } from '../data/tool-windows';

export interface DropZoneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DropZoneProps {
  slot: PanelDockSlot;
  rect: DropZoneRect;
  highlighted: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ slot, rect, highlighted }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${slot}`, data: { slot } });
  const active = isOver || highlighted;

  return (
    <div
      ref={setNodeRef}
      className={`dt-drop-zone${active ? ' dt-drop-zone--active' : ''}`}
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      data-dock-slot={slot}
    >
      <span className="dt-drop-zone-label">{PANEL_DOCK_LABELS[slot]}</span>
    </div>
  );
};

interface DropZoneOverlayProps {
  visible: boolean;
  rects: Record<PanelDockSlot, DropZoneRect> | null;
  highlightedSlot: PanelDockSlot | null;
}

export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({ visible, rects, highlightedSlot }) => {
  if (!visible || !rects) return null;

  return (
    <div className="dt-drop-overlay" aria-hidden="true">
      {(Object.keys(rects) as PanelDockSlot[]).map((slot) => (
        <DropZone key={slot} slot={slot} rect={rects[slot]} highlighted={highlightedSlot === slot} />
      ))}
    </div>
  );
};

export default DropZoneOverlay;
