/**
 * GraphControlGroup — one box of the workflow graph's own controls: the
 * buttons that belong together, side by side.
 */

import { theme } from 'antd';
import type React from 'react';

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
