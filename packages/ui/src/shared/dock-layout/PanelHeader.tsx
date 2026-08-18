/**
 * PanelHeader — shared 32 px header row used across every tool-window
 * panel in the shell. Layout:
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
 *
 * The `wiring` prop is branded (`PanelHeaderWiring`) and produced only
 * by `createPanelHeaderWiring(...)`. Combined with the AST lint test,
 * this closes BC-D1 (forgot to mount) + BC-D2 (literal-bypass) by
 * construction. See the dock-layout spike notes § 2.
 */

import { EllipsisOutlined, MinusOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Dropdown, type MenuProps, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { PanelHeaderWiring } from './panel-header-wiring';

export interface PanelHeaderProps {
  /** Shell-produced wiring bundle. Carries the brand + `onHide`.
   *  Required so the header always has a working hide affordance. */
  wiring: PanelHeaderWiring;
  /** Left slot — typically the panel title, but can be any ReactNode
      (e.g. a Filter input for narrow sidebars). Omit to leave empty. */
  title?: React.ReactNode;
  /** Optional `(i)` info popover anchored next to the title. Reveals on
      panel hover/focus, mirroring the right-side action cluster. */
  info?: InfoPopoverContent;
  /** Panel-specific inline actions that render before ⋯ and −. */
  actions?: React.ReactNode;
  /** Items for the ⋯ Options dropdown. Omit to hide the ⋯ button. */
  optionsMenuItems?: MenuProps['items'];
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ wiring, title, info, actions, optionsMenuItems }) => {
  const t = useT();
  // The brand carries `onHide` only; un-brand at the consume site via
  // the canonical `as unknown as` pattern. Same shape as EditorHeader's
  // un-brand.
  const onHide = (wiring as unknown as { onHide: () => void }).onHide;

  // The ⋯ tooltip yields to the menu: hidden the instant the trigger
  // is clicked and while the dropdown is open; re-arms on the next
  // hover-in (the SortableTab suppression pattern).
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [optionsTooltipSuppressed, setOptionsTooltipSuppressed] = useState(false);

  return (
    <div className="rules-panel-header">
      {(title !== undefined || info) && (
        <div className="rules-panel-header-title">
          {title !== undefined && (typeof title === 'string' ? <strong>{title}</strong> : title)}
          {info && <InfoTrigger content={info} className="rules-panel-header-info" />}
        </div>
      )}
      <div className="rules-panel-header-actions" data-focus-skip>
        {actions}
        {optionsMenuItems && optionsMenuItems.length > 0 && (
          <Dropdown
            menu={{ items: optionsMenuItems }}
            trigger={['click']}
            placement="bottomRight"
            onOpenChange={setOptionsMenuOpen}
          >
            <Tooltip
              title={t('shared.dock.panelOptions')}
              placement="bottom"
              open={optionsMenuOpen || optionsTooltipSuppressed ? false : undefined}
            >
              <span
                role="button"
                tabIndex={0}
                aria-label={t('shared.dock.panelOptions')}
                className="rules-panel-header-action"
                // Prevent the button from stealing DOM focus on click — we
                // want whatever had focus before (editor, another panel) to
                // stay focused after the menu closes.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOptionsTooltipSuppressed(true)}
                onMouseEnter={() => setOptionsTooltipSuppressed(false)}
              >
                <EllipsisOutlined />
              </span>
            </Tooltip>
          </Dropdown>
        )}
        <Tooltip title={t('shared.dock.hidePanel')} placement="bottom">
          <span
            role="button"
            tabIndex={0}
            aria-label={t('shared.dock.hidePanel')}
            className="rules-panel-header-action"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onHide}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onHide();
            }}
          >
            <MinusOutlined />
          </span>
        </Tooltip>
      </div>
    </div>
  );
};

export default PanelHeader;
