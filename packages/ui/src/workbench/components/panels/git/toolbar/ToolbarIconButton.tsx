/**
 * ToolbarIconButton — one icon slot in a pane toolbar (the horizontal
 * sibling of the rail's BarButton): hover fill, disabled grey, active
 * (toggled) fill, tooltip above. Presentational only.
 */

import { theme, Tooltip } from 'antd';
import type React from 'react';

export interface ToolbarIconButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  testid: string;
}

const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({ icon, title, onClick, disabled, active, testid }) => {
  const { token } = theme.useToken();
  return (
    <Tooltip placement="top" title={title}>
      <button
        type="button"
        aria-label={title}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={active ? 'git-tool-rail-button active' : 'git-tool-rail-button'}
        data-testid={testid}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          padding: 0,
          border: 'none',
          background: active === true ? token.colorFillSecondary : 'transparent',
          borderRadius: token.borderRadiusSM,
          cursor: disabled === true ? 'default' : 'pointer',
          color: disabled === true ? token.colorTextQuaternary : token.colorTextSecondary,
          fontSize: 13,
        }}
      >
        <span style={{ display: 'inline-flex' }}>{icon}</span>
      </button>
    </Tooltip>
  );
};

export default ToolbarIconButton;
