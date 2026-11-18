/**
 * ToolbarSeparator — the 1px rule between two groups of a horizontal
 * icon row: a pane's band, a dialog's row of tools, a tree's inline
 * header. Presentational only.
 */

import { theme } from 'antd';
import type React from 'react';

const ToolbarSeparator: React.FC = () => {
  const { token } = theme.useToken();
  return (
    <span
      aria-hidden
      style={{ flex: '0 0 auto', width: 1, height: 16, margin: '0 4px', background: token.colorBorderSecondary }}
    />
  );
};

export default ToolbarSeparator;
