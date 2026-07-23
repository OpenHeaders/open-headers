/**
 * TerminalHeaderCluster — the right-aligned tail every pane's strip
 * carries: tab-search chevron (scoped to THAT pane's tabs, the editor
 * TabBar posture — same ⌘⇧A tooltip) + the TUI button. The focused
 * pane's instance registers its search toggle so the workspace
 * `tab-search` shortcut opens it while the terminal owns focus.
 */

import { DownOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { Button, theme, Tooltip } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useShortcutLabel } from '../../../hooks/useWorkspaceShortcuts';
import { useSettingValue } from '../../../settings/hooks';
import TerminalTabSearchDropdown from './TerminalTabSearchDropdown';
import type { TerminalClosedTab, TerminalTabInfo } from './terminal-instance';
import { registerTerminalTabSearchToggle } from './terminal-tab-search-toggle';
import { terminalTabLabel } from './TerminalTabStrip';

export interface TerminalHeaderClusterProps {
  /** THIS pane's tabs — the search dropdown is pane-scoped, exactly
   *  like the editor leaf's tab search. */
  tabs: TerminalTabInfo[];
  activeId: string | null;
  onActivate: (id: string) => void;
  /** True while this pane owns pane focus — its search toggle is the
   *  one the ⌘⇧A shortcut reaches. */
  isFocusedPane: boolean;
  /** Pinned "TUI" affordance — opens a tab running `oh tui`. */
  onOpenTui: () => void;
  recentlyClosed: readonly TerminalClosedTab[];
  onReopenClosed: (index: number) => void;
  /** Opens the settings surface at Settings → Terminal. */
  onOpenSettings: () => void;
}

const TerminalHeaderCluster: React.FC<TerminalHeaderClusterProps> = ({
  tabs,
  activeId,
  onActivate,
  isFocusedPane,
  onOpenTui,
  recentlyClosed,
  onReopenClosed,
  onOpenSettings,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [searchOpen, setSearchOpen] = useState(false);
  const chevronRef = useRef<HTMLDivElement>(null);
  const tabSearchLabel = useShortcutLabel('tab-search');
  const defaultTabName = useSettingValue('terminal.defaultTabName');

  // The focused pane's chevron answers the workspace tab-search
  // shortcut; registration follows pane focus so exactly one instance
  // is live at a time.
  useEffect(() => {
    if (!isFocusedPane) return;
    registerTerminalTabSearchToggle(() => setSearchOpen((v) => !v));
    return () => registerTerminalTabSearchToggle(null);
  }, [isFocusedPane]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <div ref={chevronRef} style={{ flexShrink: 0 }}>
        <Tooltip
          placement="bottom"
          title={<ShortcutHintTitle label={tabSearchLabel}>{t('workbench.tabbar.searchTabs')}</ShortcutHintTitle>}
          open={searchOpen ? false : undefined}
        >
          <div
            className="rules-tab-action"
            data-testid="terminal-tab-search"
            style={{ color: token.colorTextSecondary }}
            onClick={() => setSearchOpen((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearchOpen((v) => !v);
            }}
          >
            <DownOutlined style={{ fontSize: 10 }} />
          </div>
        </Tooltip>
      </div>
      <TerminalTabSearchDropdown
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        anchorRef={chevronRef}
        tabs={tabs}
        activeId={activeId}
        tabLabel={(tab) => terminalTabLabel(t, tab, defaultTabName)}
        onActivate={onActivate}
        recentlyClosed={recentlyClosed}
        onReopenClosed={onReopenClosed}
        onOpenSettings={onOpenSettings}
      />

      <Button
        size="small"
        type="text"
        className="oh-cta-btn"
        data-testid="terminal-open-tui"
        onClick={onOpenTui}
        style={{ marginLeft: 4, flexShrink: 0 }}
      >
        {t('workbench.terminal.openTui')}
      </Button>
    </div>
  );
};

export default TerminalHeaderCluster;
