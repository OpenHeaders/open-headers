/**
 * ToolbarIconButton — one icon slot in a pane toolbar (the horizontal
 * sibling of the rail's BarButton): hover fill, disabled grey, active
 * (toggled) fill, tooltip above (or beside, for a vertical gutter).
 * The tooltip yields to a popover the button opens (S35 law): hidden
 * the instant the button is clicked and while `popoverOpen` holds,
 * back on the next hover. Presentational only.
 */

import { theme, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { GIT_BAR_GLYPH_SIZE } from '../git-type-scale';

export interface ToolbarIconButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  testid: string;
  /** Where the tooltip opens — a vertical gutter reads better beside its button. */
  tooltipPlacement?: 'top' | 'right';
  /** False renders the bare button — a chevron whose strip is its own disclosure. */
  tooltip?: boolean;
  /** True while a popover this button opened is showing — the tooltip stays away. */
  popoverOpen?: boolean;
}

const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({
  icon,
  title,
  onClick,
  disabled,
  active,
  testid,
  tooltipPlacement = 'top',
  tooltip = true,
  popoverOpen = false,
}) => {
  const { token } = theme.useToken();
  const [suppressed, setSuppressed] = useState(false);
  const button = (
      <button
        type="button"
        aria-label={title}
        aria-pressed={active}
        disabled={disabled}
        onClick={() => {
          setSuppressed(true);
          onClick?.();
        }}
        onMouseEnter={() => setSuppressed(false)}
        className={active ? 'git-tool-rail-button active' : 'git-tool-rail-button'}
        data-testid={testid}
        style={{
          flex: '0 0 auto',
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
          fontSize: GIT_BAR_GLYPH_SIZE,
        }}
      >
        <span style={{ display: 'inline-flex' }}>{icon}</span>
      </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip placement={tooltipPlacement} title={title} open={popoverOpen || suppressed ? false : undefined}>
      {button}
    </Tooltip>
  );
};

export default ToolbarIconButton;
