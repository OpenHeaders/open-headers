/**
 * PanelOptionsButton — the ⋯ Options trigger of a tool window's header
 * cluster: a click-opened dropdown over the panel's option items whose
 * tooltip yields to the menu (hidden the instant the trigger is clicked
 * and while the menu is open; re-arms on the next hover-in). PanelHeader
 * renders it before the hide affordance; a split-state corner strip
 * that hosts its own cluster renders it directly.
 */

import { EllipsisOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Dropdown, type MenuProps, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';

export interface PanelOptionsButtonProps {
  /** IDE options-menu posture: give EVERY item an `icon` (a glyph, a
   *  `menuCheckIcon`, or a `menuIconGutter` spacer) so labels share one x. */
  items: MenuProps['items'];
  testid?: string;
}

const PanelOptionsButton: React.FC<PanelOptionsButtonProps> = ({ items, testid }) => {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tooltipSuppressed, setTooltipSuppressed] = useState(false);

  return (
    <Dropdown
      menu={{ items }}
      classNames={{ root: 'rules-panel-options-menu' }}
      trigger={['click']}
      placement="bottomRight"
      onOpenChange={setMenuOpen}
    >
      <Tooltip
        title={t('shared.dock.panelOptions')}
        placement="bottom"
        open={menuOpen || tooltipSuppressed ? false : undefined}
      >
        <span
          role="button"
          tabIndex={0}
          aria-label={t('shared.dock.panelOptions')}
          className="rules-panel-header-action"
          data-testid={testid}
          // Prevent the button from stealing DOM focus on click — whatever
          // had focus before (editor, another panel) stays focused after
          // the menu closes.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTooltipSuppressed(true)}
          onMouseEnter={() => setTooltipSuppressed(false)}
        >
          <EllipsisOutlined />
        </span>
      </Tooltip>
    </Dropdown>
  );
};

export default PanelOptionsButton;
