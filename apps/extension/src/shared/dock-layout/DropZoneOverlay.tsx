/**
 * DropZoneOverlay — three drop-target cards shown while a dock tab is
 * being dragged. Each card is a single dashed outline that visually
 * pairs the two docks of a region (left, right, or bottom) and splits
 * itself with a single internal divider — so the user reads each side
 * of the shell as one chunk halved into top/bottom (or left/right for
 * the bottom panel) instead of six free-floating rectangles whose
 * borders touch and double-up at the seams.
 */

import { useDroppable } from '@dnd-kit/core';
import { theme } from 'antd';
import type React from 'react';
import { DOCK_LABELS } from './constants';
import DockSlotIcon from './DockSlotIcon';
import type { DockSlot, DropZoneGroup } from './types';

interface DropHalfProps {
  slot: DockSlot;
  highlighted: boolean;
}

const DropHalf: React.FC<DropHalfProps> = ({ slot, highlighted }) => {
  const { token } = theme.useToken();
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${slot}`, data: { slot } });
  const active = isOver || highlighted;
  // Opaque fills so underlying editor / panel content doesn't bleed
  // through the overlay during a drag — the drop zones need to read as
  // a solid surface, not a translucent wash, or the user can't focus on
  // where they're aiming. Falls back to fixed light-theme defaults if
  // the token isn't exposed.
  const background = active
    ? token.colorPrimaryBg ?? '#bae0ff'
    : token.colorBgElevated ?? '#ffffff';

  return (
    <div
      ref={setNodeRef}
      className={`rules-drop-half ${active ? 'is-over' : ''}`}
      style={{ background }}
      data-dock-slot={slot}
    >
      <span className="rules-drop-zone-label" style={{ color: token.colorPrimary, background: token.colorBgContainer }}>
        <span className="rules-drop-zone-label-icon">
          <DockSlotIcon slot={slot} size={20} />
        </span>
        {DOCK_LABELS[slot]}
      </span>
    </div>
  );
};

interface DropGroupProps {
  group: DropZoneGroup;
  highlightedSlot: DockSlot | null;
}

const DropGroup: React.FC<DropGroupProps> = ({ group, highlightedSlot }) => {
  const { token } = theme.useToken();
  const dividerColor = `${token.colorPrimary}77`;
  return (
    <div
      className={`rules-drop-group rules-drop-group--${group.split}`}
      style={
        {
          left: group.rect.left,
          top: group.rect.top,
          width: group.rect.width,
          height: group.rect.height,
          borderColor: dividerColor,
          '--rules-drop-divider': dividerColor,
        } as React.CSSProperties
      }
    >
      <DropHalf slot={group.firstSlot} highlighted={highlightedSlot === group.firstSlot} />
      <DropHalf slot={group.secondSlot} highlighted={highlightedSlot === group.secondSlot} />
    </div>
  );
};

interface DropZoneOverlayProps {
  visible: boolean;
  groups: DropZoneGroup[] | null;
  highlightedSlot: DockSlot | null;
}

const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({ visible, groups, highlightedSlot }) => {
  if (!visible || !groups) return null;

  return (
    <div className="rules-drop-overlay" aria-hidden="true">
      {groups.map((group) => (
        <DropGroup key={group.firstSlot} group={group} highlightedSlot={highlightedSlot} />
      ))}
    </div>
  );
};

export default DropZoneOverlay;
