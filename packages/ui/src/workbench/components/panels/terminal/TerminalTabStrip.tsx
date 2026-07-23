/**
 * TerminalTabStrip — the tab row in the Terminal tool-window header.
 * Rides the shared PanelHeader's left slot. Pure presentation: the tab
 * list and activation live in the terminal-instance registry; this
 * strip only renders what the panel passes down.
 *
 * Overflow follows the editor tab strip exactly (same CSS classes):
 * the tabs scroll in their own region — 3 px hover scrollbar, edge
 * fade, wheel translation, active-tab auto-scroll — while the + /
 * chevron / Open TUI cluster sits OUTSIDE the scroll container, so it
 * stays anchored at the right edge no matter how many tabs are open.
 * The close × stays visible on every tab and the label never changes
 * metrics between active and inactive states, so switching tabs cannot
 * move the row.
 */

import { CloseOutlined, DownOutlined, PlusOutlined } from '@ant-design/icons';
import { useUiTheme } from '@openheaders/ui/context';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { Button, Dropdown, Input, Modal, theme, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useShortcutLabel } from '../../../hooks/useWorkspaceShortcuts';
import { useSettingValue } from '../../../settings/hooks';
import OverlayScrollThumb from '../../tabbar/OverlayScrollThumb';
import { activePillRing } from '../../tabbar/tab-format';
import { buildTerminalTabContextMenu } from './build-terminal-tab-context-menu';
import TerminalTabSearchDropdown from './TerminalTabSearchDropdown';
import type { TerminalClosedTab, TerminalTabInfo } from './terminal-instance';

export interface TerminalTabStripProps {
  tabs: TerminalTabInfo[];
  activeId: string | null;
  /** True while the terminal's dock owns focus — the active tab renders
   *  with the primary tint (editor tab strip posture), neutral grey
   *  otherwise. */
  focused: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  /** Context-menu bulk closes — confirm-aware, owned by the panel. */
  onCloseOther: (id: string) => void;
  onCloseAll: () => void;
  onCloseToLeft: (id: string) => void;
  onCloseToRight: (id: string) => void;
  /** Commit an explicit tab label (context menu → Rename). */
  onRename: (id: string, title: string) => void;
  onNew: () => void;
  /** Terminal profiles for the + chevron — id + display name only; the
   *  strip stays presentation, the panel owns resolution. Empty hides
   *  the chevron entirely (the + alone is today's posture). */
  profiles: readonly { id: string; name: string }[];
  onNewWithProfile: (profileId: string) => void;
  /** Pinned "Open TUI mode" affordance — opens a tab running `oh tui`. */
  onOpenTui: () => void;
  recentlyClosed: readonly TerminalClosedTab[];
  onReopenClosed: (index: number) => void;
  /** Opens the settings surface at Settings → Terminal. */
  onOpenSettings: () => void;
}

export function terminalTabLabel(t: Translate, tab: TerminalTabInfo, defaultName = ''): string {
  if (tab.title !== undefined) return tab.title;
  const custom = defaultName.trim();
  if (custom.length > 0) return tab.titleIndex === 1 ? custom : `${custom} (${tab.titleIndex})`;
  return tab.titleIndex === 1
    ? t('workbench.terminal.tabLocal')
    : t('workbench.terminal.tabLocalN', { n: tab.titleIndex });
}

const TerminalTabStrip: React.FC<TerminalTabStripProps> = ({
  tabs,
  activeId,
  focused,
  onActivate,
  onClose,
  onCloseOther,
  onCloseAll,
  onCloseToLeft,
  onCloseToRight,
  onRename,
  onNew,
  profiles,
  onNewWithProfile,
  onOpenTui,
  recentlyClosed,
  onReopenClosed,
  onOpenSettings,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { isDarkMode } = useUiTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [newHovered, setNewHovered] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLDivElement>(null);
  const newTabShortcut = useShortcutLabel('terminal-new-tab');
  const defaultTabName = useSettingValue('terminal.defaultTabName');

  // ── Auto-scroll the active tab into view (editor strip posture:
  // instant, and snap to the end when the last tab is active). ──────
  useEffect(() => {
    if (!activeId || !scrollRef.current) return;
    const container = scrollRef.current;
    const isLastTab = tabs.length > 0 && tabs[tabs.length - 1].id === activeId;
    if (isLastTab) {
      container.scrollTo({ left: container.scrollWidth, behavior: 'instant' });
    } else {
      const el = container.querySelector(`[data-tab-id="${activeId}"]`);
      el?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
    }
  }, [activeId, tabs]);

  // ── Vertical wheel → horizontal scroll (normalized deltas). ───────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const el = scrollRef.current;
    if (!el) return;
    const unit =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? el.clientWidth : 1;
    el.scrollLeft += e.deltaY * unit;
  }, []);

  // ── Edge-fade mask only while actually overflowing. ───────────────
  const [hasOverflow, setHasOverflow] = useState(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = el.scrollWidth > el.clientWidth + 1;
    if (next !== hasOverflow) setHasOverflow(next);
  });

  return (
    <div className="rules-tabs-bar" style={{ flex: 1, minWidth: 0, height: '100%' }}>
      <div className={`rules-tabs-scroll${hasOverflow ? ' is-overflow' : ''}`} ref={scrollRef} onWheel={handleWheel}>
        <div role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {tabs.map((tab, tabIndex) => {
            const active = tab.id === activeId;
            const hovered = tab.id === hoveredId;
            return (
              <Dropdown
                key={tab.id}
                trigger={['contextMenu']}
                menu={buildTerminalTabContextMenu(
                  {
                    tabId: tab.id,
                    tabIndex,
                    tabCount: tabs.length,
                    onRename: (id) => {
                      setRenameId(id);
                      setRenameValue(terminalTabLabel(t, tab, defaultTabName));
                    },
                    onClose,
                    onCloseOther,
                    onCloseAll,
                    onCloseToLeft,
                    onCloseToRight,
                  },
                  t,
                )}
              >
              <span
                role="tab"
                tabIndex={0}
                aria-selected={active}
                data-testid="terminal-tab"
                data-tab-id={tab.id}
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
                  background: active
                    ? focused
                      ? token.colorPrimaryBg
                      : token.colorFillSecondary
                    : hovered
                      ? token.colorFillTertiary
                      : 'transparent',
                  // Hairline ring on active pills (activePillRing) —
                  // primary tint when this strip owns focus, neutral
                  // otherwise.
                  boxShadow: active ? activePillRing(token, isDarkMode, focused) : undefined,
                  color: active ? token.colorText : token.colorTextSecondary,
                }}
              >
                {terminalTabLabel(t, tab, defaultTabName)}
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
              </Dropdown>
            );
          })}
        </div>
      </div>

      {/* Gecko stand-in for the 3px webkit hover scrollbar. */}
      <OverlayScrollThumb scrollRef={scrollRef} />

      {/* Sticky right cluster — siblings of the scroll container, so
          they never scroll away: + · chevron · Open TUI mode. */}
      <Tooltip
        placement="bottomRight"
        title={<ShortcutHintTitle label={newTabShortcut}>{t('workbench.terminal.newTab')}</ShortcutHintTitle>}
      >
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
            marginLeft: 2,
            borderRadius: token.borderRadiusSM,
            cursor: 'pointer',
            flexShrink: 0,
            background: newHovered ? token.colorFillTertiary : 'transparent',
            color: token.colorTextSecondary,
          }}
        >
          <PlusOutlined />
        </span>
      </Tooltip>

      {/* Profile half of the split +: only exists once the user has
          created profiles — plain click on + keeps opening the default,
          the chevron picks a specific one. */}
      {profiles.length > 0 && (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: profiles.map((profile) => ({ key: profile.id, label: profile.name })),
            onClick: ({ key }) => onNewWithProfile(key),
          }}
        >
          <Tooltip placement="bottomRight" title={t('workbench.terminal.newTabWithProfile')}>
            <span
              role="button"
              tabIndex={0}
              aria-label={t('workbench.terminal.newTabWithProfile')}
              data-testid="terminal-tab-new-profile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 2px',
                borderRadius: token.borderRadiusSM,
                cursor: 'pointer',
                flexShrink: 0,
                color: token.colorTextSecondary,
              }}
            >
              <DownOutlined style={{ fontSize: 8 }} />
            </span>
          </Tooltip>
        </Dropdown>
      )}

      <div ref={chevronRef} style={{ flexShrink: 0 }}>
        <Tooltip placement="bottomRight" title={t('workbench.tabbar.searchTabs')} open={searchOpen ? false : undefined}>
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

      <Modal
        title={<span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.terminal.rename.title')}</span>}
        width={380}
        open={renameId !== null}
        okButtonProps={{ size: 'small' }}
        cancelButtonProps={{ size: 'small' }}
        onOk={() => {
          if (renameId !== null) onRename(renameId, renameValue);
          setRenameId(null);
        }}
        onCancel={() => setRenameId(null)}
        destroyOnHidden
      >
        <Input
          size="small"
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={() => {
            if (renameId !== null) onRename(renameId, renameValue);
            setRenameId(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default TerminalTabStrip;
