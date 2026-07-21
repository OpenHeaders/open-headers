/**
 * ProxyCaptureStrip — the wire-capture control strip of the unified
 * Network tool window: start/stop the L7 capture proxy, edit its port
 * and §2.4 decrypt scope, and flip scoped browser routing, over the
 * `oh.daemon.proxy.{status,start,stop,scope.set,routing.*}` admin RPCs.
 *
 * Extracted from the former ProxyCapturePanel when the Proxy and Live
 * Network windows merged into one source-driven view — the strip now
 * renders only while the Wire source is selected, so capture
 * infrastructure stays contextual instead of owning a window. Status is
 * re-read from the daemon on every mount; the strip keeps no remembered
 * running flag of its own (the trust pane's law). The parent watches
 * {@link useProxyCaptureStatus}'s status to badge the source rail.
 */

import { LockOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import type { ProxyCaptureStatus, ProxyRoutingStatus } from '@openheaders/core/types';
import { Alert, App as AntApp, Button, InputNumber, Popover, Select, Space, Switch, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface ProxyCaptureControls {
  status: ProxyCaptureStatus | null;
  routing: ProxyRoutingStatus | null;
  reload: () => Promise<void>;
}

/** Daemon-backed capture status + routing projection, re-read on mount. */
export function useProxyCaptureStatus(): ProxyCaptureControls {
  const { message } = AntApp.useApp();
  const [status, setStatus] = useState<ProxyCaptureStatus | null>(null);
  const [routing, setRouting] = useState<ProxyRoutingStatus | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setStatus(await hostBridge.call('oh.daemon.proxy.status'));
      setRouting(await hostBridge.call('oh.daemon.proxy.routing.status'));
    } catch (err) {
      message.error((err as Error).message);
    }
  }, [message]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { status, routing, reload };
}

export interface ProxyCaptureStripProps {
  controls: ProxyCaptureControls;
}

export const ProxyCaptureStrip: React.FC<ProxyCaptureStripProps> = ({ controls }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const { status, routing, reload } = controls;

  const [portDraft, setPortDraft] = useState<number | null>(null);
  const [scopeDraft, setScopeDraft] = useState<string[]>([]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Seed the drafts once from the daemon; later local edits win until
  // the next action reloads.
  useEffect(() => {
    if (status === null) return;
    setPortDraft((prev) => prev ?? status.port);
    setScopeDraft((prev) => (prev.length === 0 ? [...status.scopePatterns] : prev));
  }, [status]);

  const running = status?.running === true;

  const start = async (): Promise<void> => {
    setBusy(true);
    try {
      const resp = await hostBridge.call('oh.daemon.proxy.start', portDraft !== null ? { port: portDraft } : {});
      if (!resp.ok) message.error(t('workbench.proxyCapture.startFailed', { message: resp.error }));
    } catch (err) {
      message.error(t('workbench.proxyCapture.startFailed', { message: (err as Error).message }));
    } finally {
      setBusy(false);
      void reload();
    }
  };

  const stop = async (): Promise<void> => {
    setBusy(true);
    try {
      await hostBridge.call('oh.daemon.proxy.stop');
    } finally {
      setBusy(false);
      void reload();
    }
  };

  const toggleRouting = async (enabled: boolean): Promise<void> => {
    try {
      const resp = await hostBridge.call('oh.daemon.proxy.routing.set', { enabled });
      if (!resp.ok) message.error(t('workbench.proxyCapture.routingFailed', { message: resp.error }));
    } catch (err) {
      message.error(t('workbench.proxyCapture.routingFailed', { message: (err as Error).message }));
    } finally {
      void reload();
    }
  };

  const saveScope = async (patterns: string[]): Promise<void> => {
    setScopeDraft(patterns);
    try {
      const resp = await hostBridge.call('oh.daemon.proxy.scope.set', { patterns });
      if (resp.ok) {
        setScopeDraft([...resp.scopePatterns]);
        message.success(t('workbench.proxyCapture.scopeSaved'));
      } else {
        message.error(t('workbench.proxyCapture.scopeFailed', { message: resp.error }));
      }
    } catch (err) {
      message.error(t('workbench.proxyCapture.scopeFailed', { message: (err as Error).message }));
    } finally {
      void reload();
    }
  };

  return (
    <div
      style={{
        flex: '0 0 auto',
        padding: '8px 12px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
      }}
    >
      <Space size={8} wrap align="center">
        <Tag color={running ? 'green' : undefined} style={{ margin: 0 }}>
          {running && status?.boundPort != null
            ? t('workbench.proxyCapture.running', { port: status.boundPort })
            : t('workbench.proxyCapture.stopped')}
        </Tag>
        <InputNumber
          size="small"
          min={1}
          max={65535}
          value={portDraft}
          disabled={running || busy}
          onChange={(v) => setPortDraft(typeof v === 'number' ? v : null)}
          style={{ width: 96 }}
          prefix={t('workbench.proxyCapture.port')}
        />
        {running ? (
          <Button size="small" danger loading={busy} onClick={stop}>
            {t('workbench.proxyCapture.stop')}
          </Button>
        ) : (
          <Button size="small" type="primary" loading={busy} onClick={start}>
            {t('workbench.proxyCapture.start')}
          </Button>
        )}
        <Popover
          trigger="click"
          open={scopeOpen}
          onOpenChange={setScopeOpen}
          placement="bottomLeft"
          arrow={false}
          content={
            <div style={{ width: 300 }}>
              <Select
                mode="tags"
                size="small"
                autoFocus
                value={scopeDraft}
                onChange={saveScope}
                placeholder={t('workbench.proxyCapture.scopePlaceholder')}
                tokenSeparators={[',', ' ']}
                style={{ width: '100%' }}
                open={false}
                suffixIcon={null}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary }}>
                {t('workbench.proxyCapture.scopeHint')}
              </div>
            </div>
          }
        >
          <Button size="small" icon={<LockOutlined />}>
            {scopeDraft.length > 0
              ? t('workbench.proxyCapture.scopeCount', { count: scopeDraft.length })
              : t('workbench.proxyCapture.scope')}
          </Button>
        </Popover>
        <Space size={6} align="center">
          <Switch size="small" checked={routing?.enabled === true} onChange={(checked) => void toggleRouting(checked)} />
          <span style={{ fontSize: 12 }}>{t('workbench.proxyCapture.routing')}</span>
        </Space>
      </Space>
      {routing?.enabled === true && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 8, padding: '4px 10px' }}
          message={
            <Space size={6} wrap>
              <span>
                {routing.active ? t('workbench.proxyCapture.routingCaveat') : t('workbench.proxyCapture.routingInactive')}
              </span>
              {routing.active &&
                routing.peers.map((peer) => (
                  <Tooltip key={peer.nodeId} title={peer.error}>
                    <Tag
                      color={peer.applied ? 'green' : peer.mode === 'unsupported' ? undefined : 'red'}
                      style={{ margin: 0 }}
                    >
                      {peer.mode === 'unsupported'
                        ? t('workbench.proxyCapture.routingUnsupported', { agent: peer.agent })
                        : peer.agent}
                    </Tag>
                  </Tooltip>
                ))}
            </Space>
          }
        />
      )}
      {running && status?.caPresent === false && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8, padding: '4px 10px' }}
          message={t('workbench.proxyCapture.noCa')}
        />
      )}
    </div>
  );
};
