/**
 * TrafficMonitorSourceRail — the right-hand source list of the Traffic Monitor
 * tool window. One row per observable source: every connected browser
 * peer's tabs (favicon + title, like the browser's own tab strip, under
 * a browser-identity header) and the wire-capture partition (the L7
 * proxy — any app routed through the capture port). Selecting a row
 * binds the panel's plane views on the left to that source.
 *
 * Favicons arrive as `data:` URIs the EXTENSION resolved from the
 * browser's own favicon cache — the workbench renderer's CSP forbids
 * remote images and the desktop never fetches from sites itself.
 *
 * Presentational: the panel owns the inventory, the proxy status, and
 * the selection; the rail renders and reports clicks.
 */

import { ChromeOutlined, CompassOutlined, FileOutlined, FireOutlined, GlobalOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Tag, theme, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface RailPeerTab {
  tabId: number;
  url: string;
  title: string;
  /** Small `data:` URI resolved by the extension; absent while cold. */
  favIconUrl?: string;
}

export interface RailPeer {
  nodeId: string;
  agent: string;
  browser: { name: string; platform: string | null };
  tabs: RailPeerTab[];
}

/** Metaphoric brand glyphs — antd's icon set, no trademark artwork. */
function browserGlyph(name: string): React.ReactElement {
  switch (name) {
    case 'Chrome':
      return <ChromeOutlined />;
    case 'Firefox':
      return <FireOutlined />;
    case 'Safari':
      return <CompassOutlined />;
    default:
      return <GlobalOutlined />;
  }
}

/** `@openheaders/extension@2026.7.11` → `2026.7.11` (null when unparsable). */
function agentVersion(agent: string): string | null {
  const match = agent.match(/@(\d[\w.-]*)$/);
  return match ? match[1] : null;
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

const rowStyle = (active: boolean, token: ReturnType<typeof theme.useToken>['token']): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: '4px 10px',
  border: 'none',
  background: active ? token.controlItemBgActive : 'transparent',
  color: token.colorText,
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 12,
  lineHeight: '20px',
});

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

  const sectionLabel = (text: string): React.ReactElement => (
    <div
      style={{
        padding: '6px 10px 2px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: token.colorTextTertiary,
      }}
    >
      {text}
    </div>
  );

  return (
    <div
      data-testid="traffic-monitor-source-rail"
      style={{
        flex: '0 0 240px',
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
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
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingBottom: 8 }}>
        {peers.map((peer) => {
          const version = agentVersion(peer.agent);
          const browserLabel = peer.browser.platform
            ? `${peer.browser.name} · ${peer.browser.platform}`
            : peer.browser.name;
          return (
            <div key={peer.nodeId}>
              <div style={{ padding: '8px 10px 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                  {browserGlyph(peer.browser.name)}
                  <span>{browserLabel}</span>
                </div>
                <div style={{ fontSize: 11, color: token.colorTextTertiary, paddingLeft: 20 }}>
                  {version !== null ? t('workbench.trafficMonitor.extensionVersion', { version }) : peer.agent}
                </div>
              </div>
              {peer.tabs.map((tab) => {
                const key = tabSourceKey(peer.nodeId, tab.tabId);
                const title = tab.title || tab.url || t('workbench.trafficMonitor.untitledTab');
                return (
                  <Tooltip key={key} title={tab.url} placement="left">
                    <button
                      type="button"
                      data-testid="traffic-monitor-source-tab"
                      aria-pressed={selected === key}
                      style={rowStyle(selected === key, token)}
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
                      <Typography.Text style={{ fontSize: 12 }} ellipsis>
                        {title}
                      </Typography.Text>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
        {showWire && (
          <div>
            {sectionLabel(t('workbench.trafficMonitor.wire'))}
            <button
              type="button"
              data-testid="traffic-monitor-source-wire"
              aria-pressed={selected === WIRE_SOURCE_KEY}
              style={rowStyle(selected === WIRE_SOURCE_KEY, token)}
              onClick={() => onSelect(WIRE_SOURCE_KEY)}
            >
              <GlobalOutlined style={{ fontSize: 12 }} />
              <Typography.Text style={{ fontSize: 12, flex: '1 1 auto' }} ellipsis>
                {t('workbench.trafficMonitor.wireCapture')}
              </Typography.Text>
              <Tag color={wireRunning ? 'green' : undefined} style={{ margin: 0 }}>
                {wireRunning && wirePort !== null
                  ? t('workbench.proxyCapture.running', { port: wirePort })
                  : t('workbench.proxyCapture.stopped')}
              </Tag>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
