/**
 * PanelHeader — shared 32 px header row used across every tool-window
 * panel in the shell. Matches the IDE pattern:
 *
 *   [left slot: title or custom node] [inline actions] [⋯] [−]
 *
 * Right-side actions (inline + ⋯ + −) are hidden by default and fade in
 * when the dock body is hovered OR focus-within (clicked inside). Left
 * slot stays visible always. Height is fixed at 32 px so border-bottom
 * lines land at the same y across every panel AND the editor tab bar.
 *
 * Visibility is driven entirely by CSS selectors (`.rules-dock-body:hover`
 * and `.rules-dock-body:focus-within`) — the header doesn't track its
 * own hover/focus state, keeping the component pure.
 */

import { EllipsisOutlined, MinusOutlined } from '@ant-design/icons';
import { Dropdown, type MenuProps, theme } from 'antd';
import type React from 'react';

export interface PanelHeaderProps {
  /** Left slot — typically the panel title, but can be any ReactNode
      (e.g. a Filter input for narrow sidebars). Omit to leave empty. */
  title?: React.ReactNode;
  /** Panel-specific inline actions that render before ⋯ and −. */
  actions?: React.ReactNode;
  /** Items for the ⋯ Options dropdown. Omit to hide the ⋯ button. */
  optionsMenuItems?: MenuProps['items'];
  /** Handler for the − Hide button. Omit to hide the − button. */
  onHide?: () => void;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ title, actions, optionsMenuItems, onHide }) => {
  const { token } = theme.useToken();

  return (
    <div
      className="rules-panel-header"
      style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
    >
      <div className="rules-panel-header-title">
        {typeof title === 'string' ? <strong>{title}</strong> : title}
      </div>
      <div className="rules-panel-header-actions" data-focus-skip>
        {actions}
        {optionsMenuItems && optionsMenuItems.length > 0 && (
          <Dropdown menu={{ items: optionsMenuItems }} trigger={['click']} placement="bottomRight">
            <span
              role="button"
              tabIndex={0}
              aria-label="Panel options"
              className="rules-panel-header-action"
              // Prevent the button from stealing DOM focus on click — we
              // want whatever had focus before (editor, another panel) to
              // stay focused after the menu closes.
              onMouseDown={(e) => e.preventDefault()}
            >
              <EllipsisOutlined />
            </span>
          </Dropdown>
        )}
        {onHide && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Hide panel"
            className="rules-panel-header-action"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onHide}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onHide();
            }}
          >
            <MinusOutlined />
          </span>
        )}
      </div>
    </div>
  );
};

export default PanelHeader;
