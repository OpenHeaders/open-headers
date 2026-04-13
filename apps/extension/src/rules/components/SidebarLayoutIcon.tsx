import { theme } from 'antd';
import type React from 'react';
import type { SidebarLayoutVariant } from '../types';

interface SidebarLayoutIconProps {
  variant: SidebarLayoutVariant;
  size?: number;
}

const CELLS = 5;
const SIDEBAR_LEFT = 0.5;
const SIDEBAR_RIGHT = 7.5;
const SIDEBAR_TOP = 0.5;
const SIDEBAR_BOTTOM = 15.5;
const CELL_H = (SIDEBAR_BOTTOM - SIDEBAR_TOP) / CELLS;

const OCCUPIED: Record<SidebarLayoutVariant, readonly number[]> = {
  proportional: [1, 3, 5],
  compact: [1, 2, 5],
  stacked: [1, 2, 3],
};

const SidebarLayoutIcon: React.FC<SidebarLayoutIconProps> = ({ variant, size = 20 }) => {
  const { token } = theme.useToken();
  const stroke = token.colorTextTertiary;
  const fill = token.colorTextSecondary;
  const height = Math.round((size * 16) / 20);

  const occupied = OCCUPIED[variant];
  const cellY = (n: number) => SIDEBAR_TOP + (n - 1) * CELL_H;

  // Merge contiguous occupied cells into blocks.
  const sorted = [...occupied].sort((a, b) => a - b);
  const blocks: Array<{ start: number; end: number }> = [];
  for (const row of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && row === last.end + 1) {
      last.end = row;
    } else {
      blocks.push({ start: row, end: row });
    }
  }

  // Divider lines only at each block's boundaries, skipping the panel frame.
  const dividerYs = new Set<number>();
  for (const b of blocks) {
    const top = cellY(b.start);
    const bottom = cellY(b.end + 1);
    if (top > SIDEBAR_TOP + 0.01) dividerYs.add(top);
    if (bottom < SIDEBAR_BOTTOM - 0.01) dividerYs.add(bottom);
  }

  return (
    <svg viewBox="0 0 20 16" width={size} height={height} role="img" aria-hidden="true" style={{ display: 'block' }}>
      <rect x={0.5} y={0.5} width={19} height={15} rx={1.5} fill="none" stroke={stroke} strokeWidth={1} />
      <line
        x1={SIDEBAR_RIGHT}
        y1={SIDEBAR_TOP}
        x2={SIDEBAR_RIGHT}
        y2={SIDEBAR_BOTTOM}
        stroke={stroke}
        strokeWidth={1}
      />
      {blocks.map((b) => (
        <rect
          key={`block-${b.start}-${b.end}`}
          x={SIDEBAR_LEFT}
          y={cellY(b.start)}
          width={SIDEBAR_RIGHT - SIDEBAR_LEFT}
          height={(b.end - b.start + 1) * CELL_H}
          fill={fill}
          fillOpacity={0.15}
        />
      ))}
      {[...dividerYs].map((y) => (
        <line key={`div-${y}`} x1={SIDEBAR_LEFT} y1={y} x2={SIDEBAR_RIGHT} y2={y} stroke={stroke} strokeWidth={0.75} />
      ))}
    </svg>
  );
};

export default SidebarLayoutIcon;
