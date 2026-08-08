/**
 * WireCaptureControl — the Traffic Interception row's capture control:
 * an always-visible Start/Stop split button whose chevron opens the
 * wire settings popover, over the `oh.daemon.proxy.{status,start,stop,
 * scope.set,routing.*}` admin RPCs.
 *
 * Successor of the ProxyCaptureStrip: when the per-source tab row
 * landed (S25) the wire's plane column became chrome-identical to a
 * browser tab's, and the control band moved into the source rail —
 * the observe affordance's popover grammar applied to infrastructure:
 * the popover leads with Decrypt scope (task-scoped, adjusted
 * mid-session, live even while running) and folds Port (locked while
 * running; applies on the next start) and Route browsers — with its
 * per-browser ack tags — under Advanced. A no-CA warning tops the
 * popover while the proxy runs without an installed CA.
 *
 * Renders spans only — the control nests inside the rail's SourceRow
 * `<button>`, so every click stops propagation instead of selecting
 * the row. Status is re-read from the daemon on every mount; the
 * control keeps no remembered running flag of its own (the trust
 * pane's law). The parent watches {@link useProxyCaptureStatus}'s
 * status to badge the PROXY · SYSTEM section header.
 */

import { CaretRightOutlined, DownOutlined, LoadingOutlined, WarningOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import type { ProxyCaptureStatus, ProxyRoutingStatus } from '@openheaders/core/types';
import { App as AntApp, InputNumber, Popover, Select, Space, Switch, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { RoutingInfoTrigger, ScopeInfoTrigger } from './WireCaptureInfo';
import { agentVersion } from './TrafficMonitorSourceRail';

/**
 * Per-browser ack tag: the extension identity in friendly form plus the
 * applied routing mode (`PAC` / `onRequest` — wire vocabulary, raw).
 */
function peerAckLabel(t: Translate, peer: { agent: string; mode: string }): string {
  const version = agentVersion(peer.agent);
  const identity = version !== null ? t('workbench.trafficMonitor.extensionVersion', { version }) : peer.agent;
  if (peer.mode === 'unsupported') return t('workbench.proxyCapture.routingUnsupported', { agent: identity });
  return peer.mode === 'pac' ? `${identity} · PAC` : `${identity} · ${peer.mode}`;
}

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

export interface WireCaptureControlProps {
  controls: ProxyCaptureControls;
  /** Away from the rail's side, opening ABOVE the row (the wire row
   *  sits at the rail's bottom — a downward overlay runs off the
   *  window edge). */
  placement: 'leftBottom' | 'rightBottom';
  /** Opens Settings › Proxy · Traffic Interception — the CA-install action on the no-CA warning. */
  onOpenProxySettings: () => void;
}

export const WireCaptureControl: React.FC<WireCaptureControlProps> = ({
  controls,
  placement,
  onOpenProxySettings,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const { status, routing, reload } = controls;

  const [portDraft, setPortDraft] = useState<number | null>(null);
  const [scopeDraft, setScopeDraft] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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

  const segmentBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 7px',
    fontSize: 11,
    lineHeight: '16px',
    cursor: 'pointer',
  };

  const popoverContent = (
    // The overlay is portaled but React still bubbles its events
    // through the owner tree — without this stop, every click inside
    // the popover also fires the host row's select.
    // biome-ignore lint/a11y/noStaticElementInteractions: propagation fence, not an interactive control
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 320 }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {running && status?.caPresent === false && (
        <div
          data-testid="traffic-monitor-wire-noca"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: token.colorWarning }}
        >
          <WarningOutlined style={{ paddingTop: 2 }} />
          <span style={{ color: token.colorText }}>
            {t('workbench.proxyCapture.noCa')}{' '}
            <span
              role="button"
              tabIndex={0}
              style={{ color: token.colorPrimary, cursor: 'pointer' }}
              onClick={() => {
                setMenuOpen(false);
                onOpenProxySettings();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setMenuOpen(false);
                  onOpenProxySettings();
                }
              }}
            >
              {t('workbench.proxyCapture.noCaAction')}
            </span>
          </span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{t('workbench.proxyCapture.scope')}</span>
        <ScopeInfoTrigger />
      </div>
      <Select
        mode="tags"
        size="small"
        value={scopeDraft}
        onChange={saveScope}
        placeholder={t('workbench.proxyCapture.scopePlaceholder')}
        tokenSeparators={[',', ' ']}
        style={{ width: '100%' }}
        open={false}
        suffixIcon={null}
      />
      <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{t('workbench.proxyCapture.scopeHint')}</div>
      <button
        type="button"
        data-testid="traffic-monitor-wire-advanced"
        aria-expanded={advancedOpen}
        className="traffic-monitor-observe-option"
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', paddingTop: 1 }}>
          <CaretRightOutlined
            style={{
              fontSize: 10,
              color: token.colorTextTertiary,
              transition: 'transform 0.2s',
              transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </span>
        <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {t('workbench.trafficMonitor.captureAdvanced')}
        </span>
      </button>
      {advancedOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 24 }}>
          <InputNumber
            size="small"
            min={1}
            max={65535}
            value={portDraft}
            disabled={running || busy}
            onChange={(v) => setPortDraft(typeof v === 'number' ? v : null)}
            style={{ width: 128 }}
            prefix={t('workbench.proxyCapture.port')}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Space size={6} align="center">
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t('workbench.proxyCapture.routing')}</span>
              <RoutingInfoTrigger port={status?.boundPort ?? status?.port ?? null} />
            </Space>
            <Switch
              size="small"
              data-testid="proxy-routing-switch"
              checked={routing?.enabled === true}
              onChange={(checked) => void toggleRouting(checked)}
            />
          </div>
          <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
            {t('workbench.proxyCapture.routingPopoverHint')}
          </div>
          {routing?.enabled === true && (
            <div data-testid="traffic-monitor-wire-routing-acks" style={{ fontSize: 12 }}>
              {routing.active ? (
                <>
                  <Space size={6} wrap>
                    <span>{t('workbench.proxyCapture.routingActiveLead')}</span>
                    {routing.peers.map((peer) => (
                      <Tooltip key={peer.nodeId} title={peer.error}>
                        <Tag
                          color={peer.applied ? 'green' : peer.mode === 'unsupported' ? undefined : 'red'}
                          style={{ margin: 0 }}
                        >
                          {peerAckLabel(t, peer)}
                        </Tag>
                      </Tooltip>
                    ))}
                  </Space>
                  <div style={{ opacity: 0.75, marginTop: 2 }}>{t('workbench.proxyCapture.routingCaveat')}</div>
                </>
              ) : (
                <span>{t('workbench.proxyCapture.routingInactive')}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <span
      data-testid="traffic-monitor-wire-control"
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        flex: '0 0 auto',
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusSM,
        overflow: 'hidden',
        background: token.colorBgContainer,
      }}
    >
      <span
        role="button"
        tabIndex={0}
        data-testid="traffic-monitor-wire-toggle"
        aria-busy={busy}
        className="traffic-monitor-wire-segment"
        style={{
          ...segmentBase,
          color: busy ? token.colorTextTertiary : running ? token.colorError : token.colorPrimary,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!busy) void (running ? stop() : start());
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (!busy) void (running ? stop() : start());
          }
        }}
      >
        {busy ? (
          <LoadingOutlined spin style={{ fontSize: 11 }} />
        ) : running ? (
          t('workbench.proxyCapture.stop')
        ) : (
          t('workbench.proxyCapture.start')
        )}
      </span>
      <Popover
        open={menuOpen}
        onOpenChange={(open) => {
          if (open) setAdvancedOpen(false);
          setMenuOpen(open);
        }}
        trigger="click"
        placement={placement}
        overlayInnerStyle={{ padding: 10 }}
        content={popoverContent}
      >
        <span
          role="button"
          tabIndex={0}
          data-testid="traffic-monitor-wire-options"
          aria-label={t('workbench.proxyCapture.optionsAria')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="traffic-monitor-wire-segment"
          style={{
            ...segmentBase,
            padding: '1px 4px',
            borderLeft: `1px solid ${token.colorBorder}`,
            color: token.colorTextSecondary,
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }
          }}
        >
          <DownOutlined style={{ fontSize: 9 }} />
        </span>
      </Popover>
    </span>
  );
};
