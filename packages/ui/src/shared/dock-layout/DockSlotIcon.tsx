import { theme } from 'antd';
import type React from 'react';
import type { BottomPanelSplit, DockSlot } from './types';

interface DockSlotIconProps {
  slot: DockSlot;
  size?: number;
  /** Stacked (`rows`) draws the bottom strip split into two rows; the
      bottom slots highlight the upper/lower half instead of left/right. */
  bottomSplit?: BottomPanelSplit;
}

const FRAME_L = 0.5;
const FRAME_R = 19.5;
const FRAME_T = 0.5;
const FRAME_B = 15.5;

const LEFT_COL_RIGHT = 6;
const RIGHT_COL_LEFT = 14;

const SIDE_HALF_Y = 8;

const BOTTOM_STRIP_TOP = 11;
const BOTTOM_STRIP_MID = 10;

// Stacked (`rows`) bottom strip — taller so the two rows stay legible
// at icon size; the row divider sits at its vertical midpoint.
const BOTTOM_STACKED_TOP = 8;
const BOTTOM_STACKED_MID = (BOTTOM_STACKED_TOP + FRAME_B) / 2;

const DockSlotIcon: React.FC<DockSlotIconProps> = ({ slot, size = 20, bottomSplit = 'columns' }) => {
  const { token } = theme.useToken();
  const stroke = token.colorTextTertiary;
  const fill = token.colorTextSecondary;
  const height = Math.round((size * 16) / 20);

  const region: 'left' | 'right' | 'bottom' = slot.startsWith('left-')
    ? 'left'
    : slot.startsWith('right-')
      ? 'right'
      : 'bottom';

  let targetRect: { x: number; y: number; w: number; h: number };
  if (slot === 'left-top') {
    targetRect = { x: FRAME_L, y: FRAME_T, w: LEFT_COL_RIGHT - FRAME_L, h: SIDE_HALF_Y - FRAME_T };
  } else if (slot === 'left-bottom') {
    targetRect = { x: FRAME_L, y: SIDE_HALF_Y, w: LEFT_COL_RIGHT - FRAME_L, h: FRAME_B - SIDE_HALF_Y };
  } else if (slot === 'right-top') {
    targetRect = { x: RIGHT_COL_LEFT, y: FRAME_T, w: FRAME_R - RIGHT_COL_LEFT, h: SIDE_HALF_Y - FRAME_T };
  } else if (slot === 'right-bottom') {
    targetRect = { x: RIGHT_COL_LEFT, y: SIDE_HALF_Y, w: FRAME_R - RIGHT_COL_LEFT, h: FRAME_B - SIDE_HALF_Y };
  } else if (slot === 'bottom-left') {
    targetRect =
      bottomSplit === 'rows'
        ? { x: FRAME_L, y: BOTTOM_STACKED_TOP, w: FRAME_R - FRAME_L, h: BOTTOM_STACKED_MID - BOTTOM_STACKED_TOP }
        : { x: FRAME_L, y: BOTTOM_STRIP_TOP, w: BOTTOM_STRIP_MID - FRAME_L, h: FRAME_B - BOTTOM_STRIP_TOP };
  } else {
    targetRect =
      bottomSplit === 'rows'
        ? { x: FRAME_L, y: BOTTOM_STACKED_MID, w: FRAME_R - FRAME_L, h: FRAME_B - BOTTOM_STACKED_MID }
        : { x: BOTTOM_STRIP_MID, y: BOTTOM_STRIP_TOP, w: FRAME_R - BOTTOM_STRIP_MID, h: FRAME_B - BOTTOM_STRIP_TOP };
  }

  return (
    <svg viewBox="0 0 20 16" width={size} height={height} role="img" aria-hidden="true" style={{ display: 'block' }}>
      <rect x={0.5} y={0.5} width={19} height={15} rx={1.5} fill="none" stroke={stroke} strokeWidth={1} />
      {region === 'left' && (
        <>
          <line x1={LEFT_COL_RIGHT} y1={FRAME_T} x2={LEFT_COL_RIGHT} y2={FRAME_B} stroke={stroke} strokeWidth={1} />
          <line x1={FRAME_L} y1={SIDE_HALF_Y} x2={LEFT_COL_RIGHT} y2={SIDE_HALF_Y} stroke={stroke} strokeWidth={0.75} />
        </>
      )}
      {region === 'right' && (
        <>
          <line x1={RIGHT_COL_LEFT} y1={FRAME_T} x2={RIGHT_COL_LEFT} y2={FRAME_B} stroke={stroke} strokeWidth={1} />
          <line x1={RIGHT_COL_LEFT} y1={SIDE_HALF_Y} x2={FRAME_R} y2={SIDE_HALF_Y} stroke={stroke} strokeWidth={0.75} />
        </>
      )}
      {region === 'bottom' &&
        (bottomSplit === 'rows' ? (
          <>
            <line
              x1={FRAME_L}
              y1={BOTTOM_STACKED_TOP}
              x2={FRAME_R}
              y2={BOTTOM_STACKED_TOP}
              stroke={stroke}
              strokeWidth={1}
            />
            <line
              x1={FRAME_L}
              y1={BOTTOM_STACKED_MID}
              x2={FRAME_R}
              y2={BOTTOM_STACKED_MID}
              stroke={stroke}
              strokeWidth={0.75}
            />
          </>
        ) : (
          <>
            <line
              x1={FRAME_L}
              y1={BOTTOM_STRIP_TOP}
              x2={FRAME_R}
              y2={BOTTOM_STRIP_TOP}
              stroke={stroke}
              strokeWidth={1}
            />
            <line
              x1={BOTTOM_STRIP_MID}
              y1={BOTTOM_STRIP_TOP}
              x2={BOTTOM_STRIP_MID}
              y2={FRAME_B}
              stroke={stroke}
              strokeWidth={0.75}
            />
          </>
        ))}
      <rect
        x={targetRect.x}
        y={targetRect.y}
        width={targetRect.w}
        height={targetRect.h}
        fill={fill}
        fillOpacity={0.15}
        stroke={stroke}
        strokeWidth={1}
      />
    </svg>
  );
};

export default DockSlotIcon;
