/**
 * TerminalTabStrip — the tab row in the Terminal tool-window header.
 * Rides the shared PanelHeader's left slot. Pure presentation: the tab
 * list and activation live in the terminal-instance registry; this
 * strip only renders what the panel passes down.
 *
 * The close × stays visible on every tab (IDE posture — hiding it
 * made the tabs shift as the × popped in and out) and the tab label
 * never changes metrics between active and inactive states, so
 * switching tabs cannot move the row. The + button sits after the last
 * tab with its shortcut in the tooltip.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { Button, theme, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useShortcutLabel } from '../../../hooks/useWorkspaceShortcuts';
import type { TerminalTabInfo } from './terminal-instance';

export interface TerminalTabStripProps {
  tabs: TerminalTabInfo[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  /** Pinned "Open TUI mode" affordance — opens a tab running `oh tui`. */
  onOpenTui: () => void;
}

export function terminalTabLabel(t: Translate, tab: TerminalTabInfo): string {
  if (tab.title !== undefined) return tab.title;
  return tab.titleIndex === 1
    ? t('workbench.terminal.tabLocal')
    : t('workbench.terminal.tabLocalN', { n: tab.titleIndex });
}

const TerminalTabStrip: React.FC<TerminalTabStripProps> = ({
  tabs,
  activeId,
  onActivate,
  onClose,
  onNew,
  onOpenTui,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [newHovered, setNewHovered] = useState(false);
  const newTabShortcut = useShortcutLabel('terminal-new-tab');

  return (
    <div role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, overflow: 'hidden' }}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const hovered = tab.id === hoveredId;
        return (
          <span
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={active}
            data-testid="terminal-tab"
            data-tab-active={active || undefined}
            onMouseEnter={() => setHoveredId(tab.id)}
            onMouseLeave={() => setHoveredId((id) => (id === tab.id ? null : id))}
            onClick={() => onActivate(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onActivate(tab.id);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '3px 8px 3px 10px',
              borderRadius: token.borderRadiusSM,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: active ? token.colorFillSecondary : hovered ? token.colorFillTertiary : 'transparent',
              color: active ? token.colorText : token.colorTextSecondary,
            }}
          >
            {terminalTabLabel(t, tab)}
            <span
              role="button"
              tabIndex={-1}
              aria-label={t('workbench.terminal.closeTab')}
              data-testid="terminal-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 9,
                color: token.colorTextTertiary,
              }}
            >
              <CloseOutlined />
            </span>
          </span>
        );
      })}
      <Tooltip title={<ShortcutHintTitle label={newTabShortcut}>{t('workbench.terminal.newTab')}</ShortcutHintTitle>}>
        <span
          role="button"
          tabIndex={0}
          aria-label={t('workbench.terminal.newTab')}
          data-testid="terminal-tab-new"
          onClick={onNew}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNew();
          }}
          onMouseEnter={() => setNewHovered(true)}
          onMouseLeave={() => setNewHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 5px',
            borderRadius: token.borderRadiusSM,
            cursor: 'pointer',
            background: newHovered ? token.colorFillTertiary : 'transparent',
            color: token.colorTextSecondary,
          }}
        >
          <PlusOutlined />
        </span>
      </Tooltip>
      <Button size="small" type="text" data-testid="terminal-open-tui" onClick={onOpenTui} style={{ marginLeft: 6 }}>
        {t('workbench.terminal.openTui')}
      </Button>
    </div>
  );
};

export default TerminalTabStrip;
