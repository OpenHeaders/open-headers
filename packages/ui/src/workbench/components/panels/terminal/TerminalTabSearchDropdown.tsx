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
/** Fixed row height (20px line + 5px vertical padding each side) so the
 *  list caps below are exact row counts, not fractions. */
const ITEM_HEIGHT = 30;
const OPEN_TABS_MAX_ROWS = 5;
const CLOSED_MAX_ROWS = 3;

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
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const inputRef = useRef<InputRef>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setFocusedIndex(0);
    setClosedExpanded(false);
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      const top = rect.bottom + 4;
      setPosition({
        top,
        left: Math.max(8, Math.min(rect.right - DROPDOWN_WIDTH, window.innerWidth - DROPDOWN_WIDTH - 8)),
        // Stop at the window edge — the inner lists shrink and scroll
        // instead of the popup overflowing the app bottom.
        maxHeight: window.innerHeight - top - 8,
      });
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, anchorRef]);

  // The capped lists scroll; keyboard focus must follow into view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-kb-focused]')?.scrollIntoView({ block: 'nearest' });
  }, [open, focusedIndex]);

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

  // Fixed metrics so ITEM_HEIGHT is exact — the caps count whole rows.
  const rowStyle: React.CSSProperties = { lineHeight: '20px', boxSizing: 'border-box', height: ITEM_HEIGHT };

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
          maxHeight: position.maxHeight,
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
          // Portaled to document.body — outside the themed app subtree,
          // so the text color must be set here or it inherits the
          // body's light-scheme default (invisible in dark theme).
          color: token.colorText,
        }}
      >
        <div style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
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
        <div
          ref={listRef}
          style={{ padding: '0 4px 4px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <div
            className="oh-persistent-scroll"
            data-testid="terminal-tab-search-list"
            style={{ maxHeight: ITEM_HEIGHT * OPEN_TABS_MAX_ROWS, minHeight: 0 }}
          >
            {filteredTabs.map((tab, idx) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: handled by the input's onKeyDown
              // biome-ignore lint/a11y/noStaticElementInteractions: tab search item
              <div
                key={tab.id}
                className="rules-tab-search-item"
                data-testid="terminal-tab-search-item"
                data-kb-focused={idx === focusedIndex || undefined}
                style={{
                  ...rowStyle,
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
          </div>

          {recentlyClosed.length > 0 && (
            <>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: toggle section */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: toggle section */}
              <div
                className="rules-tab-search-item"
                style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary, marginTop: 4, flexShrink: 0 }}
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
              {closedExpanded && (
                <div
                  className="oh-persistent-scroll"
                  data-testid="terminal-tab-search-closed-list"
                  style={{ maxHeight: ITEM_HEIGHT * CLOSED_MAX_ROWS, minHeight: 0 }}
                >
                  {filteredClosed.map(({ closed, index }, idx) => (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: handled by the input's onKeyDown
                    // biome-ignore lint/a11y/noStaticElementInteractions: tab search item
                    <div
                      key={`closed-${index}`}
                      className="rules-tab-search-item"
                      data-kb-focused={filteredTabs.length + idx === focusedIndex || undefined}
                      style={{
                        ...rowStyle,
                        ...(filteredTabs.length + idx === focusedIndex
                          ? { background: token.colorFillSecondary }
                          : null),
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
                  {filteredClosed.length === 0 && (
                    <div style={emptyStateStyle}>{t('workbench.tabbar.search.noClosedMatch')}</div>
                  )}
                </div>
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
            flexShrink: 0,
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
