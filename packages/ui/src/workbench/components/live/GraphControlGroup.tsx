/**
 * GraphControlGroup — one box of the workflow graph's own controls: the
 * buttons that belong together, side by side.
 */

import { theme } from 'antd';
import type React from 'react';
import type { Size } from './graph-minimap';

/** A graph control's side, and the box's edge on both sides of the row. */
const BUTTON = 24;
const BOX_EDGE = 2;

/** The box of a group of that many buttons. */
export function controlGroupSize(buttons: number): Size {
  return { width: buttons * BUTTON + BOX_EDGE, height: BUTTON + BOX_EDGE };
}

const GraphControlGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 6,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgElevated,
        boxShadow: token.boxShadowTertiary,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};

export default GraphControlGroup;
