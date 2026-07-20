/**
 * LiveNetworkPanel — the workbench Live Network tool window
 * (Observability epic Phase 1).
 *
 * A browser-tab picker over the `oh.daemon.telemetry.tabs.list` admin
 * RPC above the shared {@link NetworkCaptureView}, bound to the picked
 * tab's QUALIFIED lifecycle lifeline (`oh-lifecycle:<tabId>@<nodeId>`)
 * — the daemon's telemetry relay forwards the watch to the owning
 * extension peer and streams its engine's envelopes back, so this view
 * renders the same rows the in-browser DevTools panel would, through
 * the same virtualized components. Row inspection routes outward to a
 * main editor tab, mirroring the Proxy window.
 *
 * Watching is subscription-gated end to end: mounting the capture view
 * opens the lifeline (which raises the extension's tracking ref for
 * the tab); unmounting (window closed, tab deselected) releases it.
 */

import { ReloadOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import { qualifiedLifecyclePortName } from '@openheaders/core/request-lifecycle';
import { Button, Select, Space, Tag, theme, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { NetworkCaptureView } from '../../../panel/components/NetworkCaptureView';
import { extractName } from '../../../panel/components/traffic/formatters';
import type { InspectorRowWithFires } from '../../../panel/data/inspector-row-projection';

export interface LiveNetworkPanelProps {
  info: InfoPopoverContent;
  onHide: () => void;
  /** Open a live row's inspector as a main editor tab. */
  onOpenRequest: (nodeId: string, tabId: number, requestId: string, label: string) => void;
}

interface WatchTarget {
  nodeId: string;
  tabId: number;
}

interface PickerOption {
  value: string;
  label: string;
}

function targetValue(nodeId: string, tabId: number): string {
  return `${tabId}@${nodeId}`;
}

const LiveNetworkPanel: React.FC<LiveNetworkPanelProps> = ({ info, onHide, onOpenRequest }) => {
  const t = useT();
  const { token } = theme.useToken();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);

  const [options, setOptions] = useState<PickerOption[]>([]);
  const [peerCount, setPeerCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<WatchTarget | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const resp = await hostBridge.call('oh.daemon.telemetry.tabs.list');
      setPeerCount(resp.peers.length);
      const next: PickerOption[] = [];
      for (const peer of resp.peers) {
        for (const tab of peer.tabs) {
          const title = tab.title || tab.url || t('workbench.liveNetwork.untitledTab');
          next.push({ value: targetValue(peer.nodeId, tab.tabId), label: title });
        }
      }
      setOptions(next);
      // A picked tab that disappeared from the inventory (closed,
      // browser gone) stays selected — the lifeline keeps replaying the
      // engine's view until upstream clears it; the user re-picks.
    } catch {
      setPeerCount(0);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onPick = useCallback((value: string) => {
    const at = value.indexOf('@');
    if (at <= 0) return;
    const tabId = Number.parseInt(value.slice(0, at), 10);
    const nodeId = value.slice(at + 1);
    if (!Number.isFinite(tabId) || nodeId.length === 0) return;
    setTarget({ nodeId, tabId });
  }, []);

  const inspectRequest = useCallback(
    (row: InspectorRowWithFires) => {
      if (!target) return;
      const { name } = extractName(row.lifecycle.url);
      onOpenRequest(target.nodeId, target.tabId, row.lifecycle.requestId, `${row.lifecycle.method} ${name}`);
    },
    [target, onOpenRequest],
  );

  const portName = useMemo(
    () => (target ? (tabId: number) => qualifiedLifecyclePortName(tabId, target.nodeId) : undefined),
    [target],
  );

  return (
    <div className="rules-bottom-panel">
      <PanelHeader wiring={headerWiring} title={<strong>{t('workbench.toolWindows.liveNetwork')}</strong>} info={info} />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        <div
          style={{
            flex: '0 0 auto',
            padding: '8px 12px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
          }}
        >
          <Space size={8} wrap align="center">
            <Tag color={peerCount > 0 ? 'green' : undefined} style={{ margin: 0 }}>
              {peerCount > 0
                ? t('workbench.liveNetwork.browserConnected', { count: peerCount })
                : t('workbench.liveNetwork.noBrowser')}
            </Tag>
            <Select
              size="small"
              showSearch
              optionFilterProp="label"
              placeholder={t('workbench.liveNetwork.pickTab')}
              value={target ? targetValue(target.nodeId, target.tabId) : undefined}
              options={options}
              onChange={onPick}
              loading={loading}
              style={{ minWidth: 320, maxWidth: 480 }}
            />
            <Tooltip title={t('workbench.liveNetwork.refreshTabs')}>
              <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => void reload()} />
            </Tooltip>
          </Space>
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
          {target && portName ? (
            <NetworkCaptureView
              key={targetValue(target.nodeId, target.tabId)}
              tabId={target.tabId}
              portName={portName}
              onInspectRequest={inspectRequest}
              emptyHero={
                <div className="dt-empty-hero">
                  <strong>{t('workbench.liveNetwork.emptyWatching')}</strong>
                  <span className="dt-empty-hero-sub">{t('workbench.liveNetwork.emptyWatchingHint')}</span>
                </div>
              }
            />
          ) : (
            <div className="dt-empty-hero" style={{ height: '100%' }}>
              <strong>{peerCount > 0 ? t('workbench.liveNetwork.emptyNoTab') : t('workbench.liveNetwork.emptyNoBrowser')}</strong>
              <span className="dt-empty-hero-sub">
                {peerCount > 0
                  ? t('workbench.liveNetwork.emptyNoTabHint')
                  : t('workbench.liveNetwork.emptyNoBrowserHint')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveNetworkPanel;
