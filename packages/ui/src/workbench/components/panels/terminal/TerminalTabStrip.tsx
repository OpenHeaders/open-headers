/**
 * TerminalTabStrip — the tab row in the Terminal tool-window header.
 * Rides the shared PanelHeader's left slot. Pure presentation: the tab
 * list and activation live in the terminal-instance registry; this
 * strip only renders what the panel passes down.
 *
 * The close × reveals on hover or on the active tab (content-level
 * affordances stay visible-on-context, chrome stays quiet); the +
 * button sits after the last tab, IDE posture.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { Button, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
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

function tabLabel(t: Translate, tab: TerminalTabInfo): string {
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

  return (
    <div role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, overflow: 'hidden' }}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const showClose = active || tab.id === hoveredId;
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
              gap: 4,
              padding: '1px 6px',
              borderRadius: token.borderRadiusSM,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: active ? token.colorFillSecondary : 'transparent',
              color: active ? token.colorText : token.colorTextSecondary,
              fontWeight: active ? 600 : 400,
            }}
          >
            {tabLabel(t, tab)}
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
                visibility: showClose ? 'visible' : 'hidden',
              }}
            >
              <CloseOutlined />
            </span>
          </span>
        );
      })}
      <span
        role="button"
        tabIndex={0}
        aria-label={t('workbench.terminal.newTab')}
        data-testid="terminal-tab-new"
        onClick={onNew}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onNew();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 4px',
          borderRadius: token.borderRadiusSM,
          cursor: 'pointer',
          color: token.colorTextSecondary,
        }}
      >
        <PlusOutlined />
      </span>
      <Button size="small" type="text" data-testid="terminal-open-tui" onClick={onOpenTui} style={{ marginLeft: 6 }}>
        {t('workbench.terminal.openTui')}
      </Button>
    </div>
  );
};

export default TerminalTabStrip;
