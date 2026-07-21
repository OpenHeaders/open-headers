/**
 * TrafficMonitorSourceRail — the right-hand source list of the Traffic Monitor
 * tool window. One row per observable source: every connected browser
 * peer's tabs (grouped under the peer's agent label, from the daemon's
 * telemetry inventory) and the wire-capture partition (the L7 proxy —
 * any app routed through the capture port). Selecting a row binds the
 * panel's plane views on the left to that source.
 *
 * Presentational: the panel owns the inventory, the proxy status, and
 * the selection; the rail renders and reports clicks.
 */

import { GlobalOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Tag, theme, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface RailPeer {
  nodeId: string;
  agent: string;
  tabs: Array<{ tabId: number; url: string; title: string }>;
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
        {peers.map((peer) => (
          <div key={peer.nodeId}>
            {sectionLabel(peer.agent)}
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
                    <Typography.Text style={{ fontSize: 12 }} ellipsis>
                      {title}
                    </Typography.Text>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        ))}
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
