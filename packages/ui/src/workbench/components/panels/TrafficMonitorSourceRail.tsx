/**
 * TrafficMonitorSourceRail — the right-hand source list of the Traffic Monitor
 * tool window. Two collapsible sections in the sidebar's own idiom
 * (shared {@link SectionHeader} + `rules-sidebar-item` rows): BROWSER
 * TABS — every connected peer under a colored brand roundel with its
 * extension version, each tab as favicon + title like the browser's own
 * tab strip — and WIRE, the L7 capture partition (any app routed
 * through the capture port). Selecting a row binds the panel's plane
 * views on the left to that source.
 *
 * Favicons arrive as `data:` URIs the EXTENSION resolved from the
 * browser's own favicon cache — the workbench renderer's CSP forbids
 * remote images and the desktop never fetches from sites itself.
 *
 * Presentational: the panel owns the inventory, the proxy status, and
 * the selection; the rail renders and reports clicks.
 */

import { CaretRightOutlined, FileOutlined, GlobalOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Tag, theme, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { SectionHeader } from '../sidebar/SectionHeader';
import { BrowserBrandIcon } from './browser-brand-icons';

/** Fixed rail width — expand/collapse never reflows it. */
const RAIL_WIDTH = 250;
/** Min height either sash pane keeps; drag clamps against this. */
const MIN_PANE_HEIGHT = 96;

export interface RailPeerTab {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  /** Small `data:` URI resolved by the extension; absent while cold. */
  favIconUrl?: string;
}

/**
 * Tabs grouped by browser window, in order of appearance. One browser
 * instance is ONE peer — multiple windows show as labeled groups inside
 * it (the label renders only when there is more than one window).
 */
function groupByWindow(tabs: readonly RailPeerTab[]): Array<{ windowId: number; tabs: RailPeerTab[] }> {
  const groups: Array<{ windowId: number; tabs: RailPeerTab[] }> = [];
  const byWindow = new Map<number, RailPeerTab[]>();
  for (const tab of tabs) {
    let group = byWindow.get(tab.windowId);
    if (!group) {
      group = [];
      byWindow.set(tab.windowId, group);
      groups.push({ windowId: tab.windowId, tabs: group });
    }
    group.push(tab);
  }
  return groups;
}

export interface RailPeer {
  nodeId: string;
  agent: string;
  browser: { name: string; platform: string | null };
  tabs: RailPeerTab[];
}

export type TrafficSourceKey = string;

export function tabSourceKey(nodeId: string, tabId: number): TrafficSourceKey {
  return `tab:${tabId}@${nodeId}`;
}

export const WIRE_SOURCE_KEY: TrafficSourceKey = 'wire';

export interface TrafficMonitorSourceRailProps {
  peers: readonly RailPeer[];
  loading: boolean;
  onRefresh: () => void;
  /** Wire row is present only on hosts with the proxyCapture capability. */
  showWire: boolean;
  wireRunning: boolean;
  wirePort: number | null;
  selected: TrafficSourceKey | null;
  onSelect: (key: TrafficSourceKey) => void;
}

/** `@openheaders/extension@2026.7.11` → `2026.7.11` (null when unparsable). */
export function agentVersion(agent: string): string | null {
  const match = agent.match(/@(\d[\w.-]*)$/);
  return match ? match[1] : null;
}

function SourceRow({
  testid,
  active,
  indent = false,
  onClick,
  children,
}: {
  testid: string;
  active: boolean;
  /** Nested under a caret row (peer) — indents like tree children. */
  indent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={active}
      className={`rules-sidebar-item traffic-monitor-source-row${active ? ' selected' : ''}`}
      style={indent ? { paddingLeft: 30 } : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export const TrafficMonitorSourceRail: React.FC<TrafficMonitorSourceRailProps> = ({
  peers,
  loading,
  onRefresh,
  showWire,
  wireRunning,
  wirePort,
  selected,
  onSelect,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [browsersOpen, setBrowsersOpen] = useState(true);
  const [wireOpen, setWireOpen] = useState(true);
  // Per-peer expansion, expanded by default — the peer row is a
  // collection-style caret row over its window groups and tab rows.
  const [collapsedPeers, setCollapsedPeers] = useState<ReadonlySet<string>>(() => new Set());
  const togglePeer = (nodeId: string): void => {
    setCollapsedPeers((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Draggable split between the browser pane and the wire pane. `null`
  // until first drag — the browser pane grows to fill until the user
  // sizes it, after which the height is explicit and clamped on every
  // move against the live body height (so a panel resize can't strand
  // the sash off-screen).
  const bodyRef = useRef<HTMLDivElement>(null);
  const [browserPaneHeight, setBrowserPaneHeight] = useState<number | null>(null);

  const onSashDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const body = bodyRef.current;
      if (!body) return;
      const bodyTop = body.getBoundingClientRect().top;
      const move = (ev: PointerEvent): void => {
        const max = body.clientHeight - MIN_PANE_HEIGHT;
        const next = Math.min(Math.max(ev.clientY - bodyTop, MIN_PANE_HEIGHT), Math.max(MIN_PANE_HEIGHT, max));
        setBrowserPaneHeight(next);
      };
      const up = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [],
  );

  const splitActive = showWire && wireOpen;

  const browsersPane = (
    <div
      style={
        splitActive && browserPaneHeight !== null
          ? { height: browserPaneHeight, flex: '0 0 auto', minHeight: 0, overflowY: 'auto' }
          : { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }
      }
    >
      <SectionHeader
        title={t('workbench.trafficMonitor.browserTabs')}
        expanded={browsersOpen}
        onToggle={() => setBrowsersOpen((v) => !v)}
      />
      {browsersOpen &&
        peers.map((peer) => {
          const version = agentVersion(peer.agent);
          const expanded = !collapsedPeers.has(peer.nodeId);
          return (
            <div key={peer.nodeId}>
              <button
                type="button"
                data-testid="traffic-monitor-peer"
                aria-expanded={expanded}
                className="rules-sidebar-item traffic-monitor-source-row"
                onClick={() => togglePeer(peer.nodeId)}
              >
                <CaretRightOutlined
                  style={{
                    color: token.colorTextTertiary,
                    fontSize: 10,
                    transition: 'transform 0.2s',
                    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                />
                <BrowserBrandIcon name={peer.browser.name} />
                <span className="rules-sidebar-item-label">
                  {peer.browser.name}
                  <span style={{ color: token.colorTextTertiary }}>
                    {version !== null
                      ? ` · ${t('workbench.trafficMonitor.extensionVersion', { version })}`
                      : ` · ${peer.agent}`}
                  </span>
                </span>
              </button>
              {expanded &&
                groupByWindow(peer.tabs).map((group, index, groups) => (
                  <div key={group.windowId}>
                    {groups.length > 1 && (
                      <div style={{ padding: '4px 14px 0 30px', fontSize: 11, color: token.colorTextTertiary }}>
                        {t('workbench.trafficMonitor.windowLabel', { n: index + 1 })}
                      </div>
                    )}
                    {group.tabs.map((tab) => {
                      const key = tabSourceKey(peer.nodeId, tab.tabId);
                      const title = tab.title || tab.url || t('workbench.trafficMonitor.untitledTab');
                      return (
                        <Tooltip key={key} title={tab.url} placement="left">
                          <SourceRow
                            testid="traffic-monitor-source-tab"
                            active={selected === key}
                            indent
                            onClick={() => onSelect(key)}
                          >
                            {tab.favIconUrl?.startsWith('data:') ? (
                              <img
                                src={tab.favIconUrl}
                                alt=""
                                width={14}
                                height={14}
                                style={{ flex: '0 0 auto', borderRadius: 2 }}
                              />
                            ) : (
                              <FileOutlined style={{ fontSize: 12, color: token.colorTextTertiary, flex: '0 0 auto' }} />
                            )}
                            <span className="rules-sidebar-item-label">{title}</span>
                          </SourceRow>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
            </div>
          );
        })}
    </div>
  );

  const wirePane = showWire ? (
    <div style={splitActive ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' } : { flex: '0 0 auto' }}>
      <SectionHeader
        title={t('workbench.trafficMonitor.wire')}
        expanded={wireOpen}
        onToggle={() => setWireOpen((v) => !v)}
      />
      {wireOpen && (
        <SourceRow
          testid="traffic-monitor-source-wire"
          active={selected === WIRE_SOURCE_KEY}
          onClick={() => onSelect(WIRE_SOURCE_KEY)}
        >
          <GlobalOutlined style={{ fontSize: 12, flex: '0 0 auto' }} />
          <span className="rules-sidebar-item-label">{t('workbench.trafficMonitor.wireCapture')}</span>
          <Tag color={wireRunning ? 'green' : undefined} style={{ margin: 0, flex: '0 0 auto' }}>
            {wireRunning && wirePort !== null
              ? t('workbench.proxyCapture.running', { port: wirePort })
              : t('workbench.proxyCapture.stopped')}
          </Tag>
        </SourceRow>
      )}
    </div>
  ) : null;

  return (
    <div
      data-testid="traffic-monitor-source-rail"
      style={{
        flex: `0 0 ${RAIL_WIDTH}px`,
        width: RAIL_WIDTH,
        maxWidth: RAIL_WIDTH,
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600 }}>{t('workbench.trafficMonitor.sources')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag color={peers.length > 0 ? 'green' : undefined} style={{ margin: 0 }} data-testid="traffic-monitor-peers">
            {peers.length > 0
              ? t('workbench.trafficMonitor.browserConnected', { count: peers.length })
              : t('workbench.trafficMonitor.noBrowser')}
          </Tag>
          <Tooltip title={t('workbench.trafficMonitor.refreshTabs')}>
            <Button
              size="small"
              type="text"
              data-testid="traffic-monitor-refresh"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={onRefresh}
            />
          </Tooltip>
        </span>
      </div>
      <div ref={bodyRef} style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {browsersPane}
        {splitActive && (
          <div
            className="traffic-monitor-sash"
            data-testid="traffic-monitor-sash"
            role="separator"
            aria-orientation="horizontal"
            onPointerDown={onSashDown}
          />
        )}
        {wirePane}
      </div>
    </div>
  );
};
