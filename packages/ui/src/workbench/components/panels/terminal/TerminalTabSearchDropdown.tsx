/**
 * TerminalTabSearchDropdown — the terminal strip's chevron overlay.
 * Mirrors the editor tab strip's search dropdown (same CSS classes,
 * same keyboard model: ↑/↓ move, Enter switches/reopens, Esc closes)
 * over the terminal registry's simpler data: open tabs, a session-only
 * recently-closed section, and a sticky Settings row that jumps to
 * Settings → Terminal (IDE posture).
 *
 * Rendered through a portal with fixed positioning: the strip lives in
 * the PanelHeader's title slot, whose `overflow: hidden` would clip an
 * absolutely-positioned sibling.
 */

import { SearchOutlined, SettingOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';
import { Input, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type { TerminalClosedTab, TerminalTabInfo } from './terminal-instance';

const DROPDOWN_WIDTH = 300;

function closedTabLabel(t: Translate, closed: TerminalClosedTab): string {
  if (closed.title !== undefined) return closed.title;
  return closed.titleIndex === 1
    ? t('workbench.terminal.tabLocal')
    : t('workbench.terminal.tabLocalN', { n: closed.titleIndex });
}

interface TerminalTabSearchDropdownProps {
  open: boolean;
  onClose: () => void;
  /** The chevron trigger — anchors the fixed-position popup. */
  anchorRef: React.RefObject<HTMLElement | null>;
  tabs: TerminalTabInfo[];
  activeId: string | null;
  tabLabel: (tab: TerminalTabInfo) => string;
  onActivate: (id: string) => void;
  recentlyClosed: readonly TerminalClosedTab[];
  onReopenClosed: (index: number) => void;
  onOpenSettings: () => void;
}

const TerminalTabSearchDropdown: React.FC<TerminalTabSearchDropdownProps> = ({
  open,
  onClose,
  anchorRef,
  tabs,
  activeId,
  tabLabel,
  onActivate,
  recentlyClosed,
  onReopenClosed,
  onOpenSettings,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [closedExpanded, setClosedExpanded] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setFocusedIndex(0);
    setClosedExpanded(false);
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.right - DROPDOWN_WIDTH, window.innerWidth - DROPDOWN_WIDTH - 8)),
      });
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, anchorRef]);

  if (!open || !position) return null;

  const lowerSearch = search.toLowerCase();
  const filteredTabs = tabs.filter((tab) => tabLabel(tab).toLowerCase().includes(lowerSearch));
  const filteredClosed = recentlyClosed
    .map((closed, index) => ({ closed, index }))
    .filter(({ closed }) => closedTabLabel(t, closed).toLowerCase().includes(lowerSearch));
  const totalItems = filteredTabs.length + (closedExpanded ? filteredClosed.length : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, totalItems - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex < filteredTabs.length) {
        const tab = filteredTabs[focusedIndex];
        if (tab) {
          onActivate(tab.id);
          onClose();
        }
      } else if (closedExpanded) {
        const entry = filteredClosed[focusedIndex - filteredTabs.length];
        if (entry) {
          onReopenClosed(entry.index);
          onClose();
        }
      }
    }
  };

  const emptyStateStyle: React.CSSProperties = {
    padding: '8px',
    fontSize: 11,
    color: token.colorTextTertiary,
    textAlign: 'center',
  };

  return createPortal(
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      <div className="rules-tab-search-backdrop" onClick={onClose} />
      <div
        className="rules-tab-search-dropdown"
        data-testid="terminal-tab-search-dropdown"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          right: 'auto',
          width: DROPDOWN_WIDTH,
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ padding: '8px 8px 4px' }}>
          <Input
            ref={inputRef}
            size="small"
            placeholder={t('workbench.tabbar.search.placeholder')}
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFocusedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            allowClear
            variant="borderless"
            style={{ fontSize: 12 }}
          />
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', overscrollBehavior: 'none', padding: '0 4px 4px' }}>
          {filteredTabs.map((tab, idx) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: handled by the input's onKeyDown
            // biome-ignore lint/a11y/noStaticElementInteractions: tab search item
            <div
              key={tab.id}
              className="rules-tab-search-item"
              data-testid="terminal-tab-search-item"
              style={{
                ...(idx === focusedIndex ? { background: token.colorFillSecondary } : null),
                fontWeight: tab.id === activeId ? 500 : 400,
              }}
              onClick={() => {
                onActivate(tab.id);
                onClose();
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tabLabel(tab)}
              </span>
            </div>
          ))}
          {filteredTabs.length === 0 && (
            <div style={emptyStateStyle}>
              {search ? t('workbench.tabbar.search.noMatch') : t('workbench.tabbar.search.noOpenTabs')}
            </div>
          )}

          {recentlyClosed.length > 0 && (
            <>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: toggle section */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: toggle section */}
              <div
                className="rules-tab-search-item"
                style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary, marginTop: 4 }}
                onClick={() => setClosedExpanded((v) => !v)}
              >
                <span style={{ fontSize: 9, marginRight: 4 }}>{closedExpanded ? '▼' : '▶'}</span>
                {search
                  ? t('workbench.tabbar.search.recentlyClosedFiltered', {
                      matched: filteredClosed.length,
                      total: recentlyClosed.length,
                    })
                  : t('workbench.tabbar.search.recentlyClosed', { count: recentlyClosed.length })}
              </div>
              {closedExpanded &&
                filteredClosed.map(({ closed, index }, idx) => (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: handled by the input's onKeyDown
                  // biome-ignore lint/a11y/noStaticElementInteractions: tab search item
                  <div
                    key={`closed-${index}`}
                    className="rules-tab-search-item"
                    style={{
                      ...(filteredTabs.length + idx === focusedIndex ? { background: token.colorFillSecondary } : null),
                      opacity: 0.7,
                    }}
                    onClick={() => {
                      onReopenClosed(index);
                      onClose();
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {closedTabLabel(t, closed)}
                    </span>
                  </div>
                ))}
              {closedExpanded && filteredClosed.length === 0 && (
                <div style={emptyStateStyle}>{t('workbench.tabbar.search.noClosedMatch')}</div>
              )}
            </>
          )}
        </div>

        {/* Sticky Settings footer — jumps to Settings → Terminal. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: footer action */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: footer action */}
        <div
          className="rules-tab-search-item"
          data-testid="terminal-tab-settings"
          style={{
            margin: 4,
            marginTop: 0,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 0,
            paddingTop: 8,
            paddingBottom: 6,
          }}
          onClick={() => {
            onOpenSettings();
            onClose();
          }}
        >
          <SettingOutlined style={{ fontSize: 12, color: token.colorTextSecondary }} />
          <span>{t('workbench.terminal.settings')}</span>
        </div>
      </div>
    </>,
    document.body,
  );
};

export default TerminalTabSearchDropdown;
