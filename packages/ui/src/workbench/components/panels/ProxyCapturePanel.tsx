/**
 * ProxyCapturePanel — the workbench Proxy tool window (Proxy epic S6).
 *
 * A control strip over the `oh.daemon.proxy.{status,start,stop,scope.set}`
 * admin RPCs — start/stop the L7 capture proxy, set its port, and edit
 * the §2.4 decrypt scope — above the shared {@link NetworkCaptureView},
 * which renders the `PROXY_LIFECYCLE_TAB_ID` partition with the same
 * columns, waterfall, and detail tabs the browser DevTools Network panel
 * uses. Only hosts that register the `proxyCapture` capability (the
 * desktop renderer, which runs the daemon spine in-process) ever mount
 * this window.
 *
 * Status is re-read from the daemon on every reload — the panel keeps no
 * remembered running flag of its own, mirroring the trust pane.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type { ProxyCaptureStatus } from '@openheaders/core/types';
import { Alert, App as AntApp, Button, InputNumber, Select, Space, Tag, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { NetworkCaptureView } from '../../../panel/components/NetworkCaptureView';
import { extractName } from '../../../panel/components/traffic/formatters';
import type { InspectorRowWithFires } from '../../../panel/data/inspector-row-projection';

export interface ProxyCapturePanelProps {
  info: InfoPopoverContent;
  onHide: () => void;
  /** Open a captured request's inspector as a main editor tab. */
  onOpenRequest: (requestId: string, label: string) => void;
}

const ProxyCapturePanel: React.FC<ProxyCapturePanelProps> = ({ info, onHide, onOpenRequest }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);

  const [status, setStatus] = useState<ProxyCaptureStatus | null>(null);
  const [portDraft, setPortDraft] = useState<number | null>(null);
  const [scopeDraft, setScopeDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const resp = await hostBridge.call('oh.daemon.proxy.status');
      setStatus(resp);
      // Seed the drafts once from the daemon; later local edits win until
      // the next action reloads.
      setPortDraft((prev) => prev ?? resp.port);
      setScopeDraft((prev) => (prev.length === 0 ? [...resp.scopePatterns] : prev));
    } catch (err) {
      message.error((err as Error).message);
    }
  }, [message]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const running = status?.running === true;

  const inspectRequest = useCallback(
    (row: InspectorRowWithFires) => {
      const { name } = extractName(row.lifecycle.url);
      onOpenRequest(row.lifecycle.requestId, `${row.lifecycle.method} ${name}`);
    },
    [onOpenRequest],
  );

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
    <div className="rules-bottom-panel">
      <PanelHeader wiring={headerWiring} title={<strong>{t('workbench.toolWindows.proxyCapture')}</strong>} info={info} />
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
            <Select
              mode="tags"
              size="small"
              value={scopeDraft}
              onChange={saveScope}
              placeholder={t('workbench.proxyCapture.scopePlaceholder')}
              tokenSeparators={[',', ' ']}
              style={{ minWidth: 260 }}
              open={false}
              suffixIcon={null}
            />
          </Space>
          {running && status?.caPresent === false && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 8, padding: '4px 10px' }}
              message={t('workbench.proxyCapture.noCa')}
            />
          )}
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
          <NetworkCaptureView
            tabId={PROXY_LIFECYCLE_TAB_ID}
            onInspectRequest={inspectRequest}
            emptyHero={
              <div className="dt-empty-hero">
                <strong>
                  {running ? t('workbench.proxyCapture.emptyRunning') : t('workbench.proxyCapture.emptyStopped')}
                </strong>
                <span className="dt-empty-hero-sub">
                  {running
                    ? t('workbench.proxyCapture.emptyRunningHint', { port: status?.boundPort ?? status?.port ?? 0 })
                    : t('workbench.proxyCapture.emptyStoppedHint')}
                </span>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
};

export default ProxyCapturePanel;
