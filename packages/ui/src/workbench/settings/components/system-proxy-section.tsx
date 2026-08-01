/**
 * SystemProxySection — the system plane's settings surface
 * (docs/REQUEST_ENGINE_PROXY_DESIGN.md P3): how THIS device's egress
 * reaches the network. The body of the Proxy · Outbound category on
 * the desktop host (`SystemProxyPane` owns the header) — per-device
 * state (the vault posture), never workspace data.
 *
 * Four modes: System (default — resolution delegated to Chromium,
 * "works exactly like Chrome on this machine"), Manual (one proxy URL,
 * credentials by VAULT REF — never plaintext — and a NO_PROXY-syntax
 * bypass list), PAC (explicit PAC URL or local file, executed only in
 * Chromium's sandboxed network service), Off (always direct). Every
 * edit applies live over `oh.desktop.systemProxy.set` — the next
 * send resolves under the new mode, no restart.
 *
 * One honesty surface rides the `resolve` RPC: a resolution preview —
 * "what would this machine do for this URL right now" — pre-filled
 * with a canonical target and resolved automatically on open and after
 * every settings change, so it doubles as the sourced display.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type {
  DesktopSystemProxyMode,
  SystemProxyOsSnapshot,
  SystemProxyResolution,
  SystemProxySettings,
} from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Divider, Input, Radio, Segmented, Select, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useVaultContext } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

/** The preview's canonical default target — schemeless (the resolve
 *  handler assumes https), auto-resolved when the pane opens. */
const DEFAULT_TARGET = 'openheaders.io';

/** Platform-native key names for the System snapshot's rows — each
 *  value is labeled what the OS itself calls it (raw wire vocabulary,
 *  the caption alone is localized); `source` picks the vocabulary. */
const SNAPSHOT_LABELS: Record<
  SystemProxyOsSnapshot['source'],
  { http: string; https: string; pac: string; bypass: string; wpad: string }
> = {
  'macos-system': {
    http: 'HTTPProxy',
    https: 'HTTPSProxy',
    pac: 'ProxyAutoConfigURLString',
    bypass: 'ExceptionsList',
    wpad: 'ProxyAutoDiscoveryEnable',
  },
  'windows-registry': {
    http: 'ProxyServer (http)',
    https: 'ProxyServer (https)',
    pac: 'AutoConfigURL',
    bypass: 'ProxyOverride',
    wpad: 'WPAD',
  },
  'process-env': {
    http: 'http_proxy',
    https: 'https_proxy',
    pac: 'auto_proxy',
    bypass: 'no_proxy',
    wpad: 'WPAD',
  },
};

const MODE_LABEL: Record<DesktopSystemProxyMode, MessageKey> = {
  system: 'workbench.settings.systemProxy.mode.system',
  manual: 'workbench.settings.systemProxy.mode.manual',
  pac: 'workbench.settings.systemProxy.mode.pac',
  off: 'workbench.settings.systemProxy.mode.off',
};

const MODE_DESC: Record<DesktopSystemProxyMode, MessageKey> = {
  system: 'workbench.settings.systemProxy.mode.systemDesc',
  manual: 'workbench.settings.systemProxy.mode.manualDesc',
  pac: 'workbench.settings.systemProxy.mode.pacDesc',
  off: 'workbench.settings.systemProxy.mode.offDesc',
};

/** Wire vocabulary for the resolved chain — raw tokens, localized
 *  caption only (the settings example-card precedent). */
function chainText(resolution: SystemProxyResolution | null): string {
  if (resolution === null || resolution.entries.length === 0) return 'DIRECT';
  const parts = resolution.entries.map((entry) => {
    if (entry.kind === 'direct') return 'DIRECT';
    if (entry.kind === 'socks') return entry.raw;
    return `PROXY ${entry.url.replace(/^https?:\/\//, '')}${entry.hasCredential === true ? ' · auth' : ''}`;
  });
  return `${parts.join(' ; ')} (${resolution.source})`;
}

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = theme.useToken();
  return (
    <span style={{ width: 150, flex: 'none', fontSize: 12, color: token.colorTextSecondary, paddingTop: 4 }}>
      {children}
    </span>
  );
};

const SystemProxySection: React.FC = () => {
  const { token } = theme.useToken();
  const t = useT();
  const { vault } = useVaultContext();
  const [settings, setSettings] = useState<SystemProxySettings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pacKind, setPacKind] = useState<'url' | 'file'>('url');
  const [osSnapshot, setOsSnapshot] = useState<SystemProxyOsSnapshot | null>(null);
  const [osError, setOsError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_TARGET);
  const [preview, setPreview] = useState<{ url: string; text: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const credentialOptions = vault.secrets
    .filter((s) => s.kind === 'string')
    .map((s) => ({ value: s.name, label: s.name }));

  const fetchSnapshot = useCallback(async (): Promise<void> => {
    try {
      const resp = await hostBridge.call('oh.desktop.systemProxy.describe');
      if (resp.ok) {
        setOsSnapshot(resp.snapshot);
        setOsError(null);
      } else {
        setOsSnapshot(null);
        setOsError(resp.error);
      }
    } catch (err) {
      setOsSnapshot(null);
      setOsError((err as Error).message);
    }
  }, []);

  // Resolve is the ONE refresh verb: re-asking the machine re-reads the
  // OS snapshot too, so the System display never needs its own button.
  const runResolve = useCallback(
    async (url: string): Promise<void> => {
      const target = url.trim();
      if (target === '') return;
      setPreviewBusy(true);
      void fetchSnapshot();
      try {
        const resp = await hostBridge.call('oh.desktop.systemProxy.resolve', { url: target });
        setPreview({ url: target, text: resp.ok ? chainText(resp.resolution) : resp.error });
      } catch (err) {
        setPreview({ url: target, text: (err as Error).message });
      } finally {
        setPreviewBusy(false);
      }
    },
    [fetchSnapshot],
  );

  useEffect(() => {
    void (async () => {
      try {
        const resp = await hostBridge.call('oh.desktop.systemProxy.get');
        setSettings(resp.settings);
        const source = resp.settings.pacSource;
        setPacKind(source !== undefined && !/^https?:\/\//i.test(source) ? 'file' : 'url');
        void runResolve(DEFAULT_TARGET);
      } catch {
        // No service on this host — the section stays empty (the pane
        // gates on the desktop host, so this is a dev-harness case).
        setSettings(null);
      }
    })();
  }, [runResolve]);

  // The System slot's informational snapshot — read on every visit to
  // the mode (and on every Resolve); informational only, resolution
  // stays per-URL.
  useEffect(() => {
    if (settings?.mode !== 'system') return;
    void fetchSnapshot();
  }, [settings?.mode, fetchSnapshot]);

  const persist = useCallback(
    async (next: SystemProxySettings): Promise<void> => {
      setSettings(next);
      try {
        const resp = await hostBridge.call('oh.desktop.systemProxy.set', { settings: next });
        setSaveError(resp.ok ? null : resp.error);
        if (resp.ok) void runResolve(previewUrl);
      } catch (err) {
        setSaveError((err as Error).message);
      }
    },
    [runResolve, previewUrl],
  );

  if (settings === null) return null;

  const setField = (patch: Partial<SystemProxySettings>): void => {
    void persist({ ...settings, ...patch });
  };

  const browsePacFile = async (): Promise<void> => {
    const resp = await hostBridge.call('oh.desktop.systemProxy.pickPacFile');
    if (resp.path !== null) setField({ pacSource: resp.path });
  };

  const modeInfo: InfoPopoverContent = {
    title: t('workbench.settings.systemProxy.mode.infoTitle'),
    summary: t('workbench.settings.systemProxy.mode.infoSummary'),
    sections: [
      {
        heading: t('workbench.settings.systemProxy.mode.infoHeading'),
        layout: 'stacked',
        items: (['system', 'manual', 'pac', 'off'] as const).map((mode) => ({
          label: t(MODE_LABEL[mode]),
          desc: t(MODE_DESC[mode]),
        })),
      },
    ],
  };

  return (
    <section style={{ marginBottom: 14 }}>
      <div className="settings-card" style={{ padding: '8px 14px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, padding: '4px 0 2px' }}>
          {t('workbench.settings.systemProxy.title')}
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: token.colorTextSecondary }}>
          {t('workbench.settings.systemProxy.intro')}
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: token.colorTextSecondary }}>
          {t('workbench.settings.systemProxy.introNote')}
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <FieldLabel>{t('workbench.settings.systemProxy.mode.label')}</FieldLabel>
          <Radio.Group
            data-testid="oh-sysproxy-mode"
            value={settings.mode}
            onChange={(e) => setField({ mode: e.target.value as DesktopSystemProxyMode })}
          >
            {(['system', 'manual', 'pac', 'off'] as const).map((mode) => (
              <Radio key={mode} value={mode} data-testid={`oh-sysproxy-mode-${mode}`}>
                <span style={{ fontSize: 12 }}>{t(MODE_LABEL[mode])}</span>
              </Radio>
            ))}
          </Radio.Group>
          <InfoTrigger content={modeInfo} />
        </div>

        {/* Fixed-height slot sized to the tallest mode (System's note +
            snapshot grid) so switching modes never bounces the rows
            below. */}
        <div style={{ minHeight: 112, margin: '10px 0 2px' }}>
          {settings.mode === 'system' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <FieldLabel>{t('workbench.settings.systemProxy.system.valuesLabel')}</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {osError !== null ? (
                  <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                    {t('workbench.settings.systemProxy.system.unavailable', { message: osError })}
                  </span>
                ) : (
                  osSnapshot !== null && (
                    <>
                      <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                        {t('workbench.settings.systemProxy.system.sourcedNote', { source: osSnapshot.source })}
                      </span>
                      {/* Raw wire vocabulary — localized caption only. */}
                      <div
                        data-testid="oh-sysproxy-os-snapshot"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          columnGap: 16,
                          rowGap: 2,
                          fontFamily: token.fontFamilyCode,
                          fontSize: 11,
                          color: token.colorText,
                          wordBreak: 'break-all',
                        }}
                      >
                        <span style={{ color: token.colorTextSecondary }}>
                          {`[HTTP] ${SNAPSHOT_LABELS[osSnapshot.source].http}`}
                        </span>
                        <span>{osSnapshot.httpProxy ?? '—'}</span>
                        <span style={{ color: token.colorTextSecondary }}>
                          {`[HTTPS] ${SNAPSHOT_LABELS[osSnapshot.source].https}`}
                        </span>
                        <span>{osSnapshot.httpsProxy ?? '—'}</span>
                        <span style={{ color: token.colorTextSecondary }}>
                          {`[PAC] ${SNAPSHOT_LABELS[osSnapshot.source].pac}`}
                        </span>
                        <span>{osSnapshot.pacUrl ?? '—'}</span>
                        <span style={{ color: token.colorTextSecondary }}>
                          {`[BYPASS] ${SNAPSHOT_LABELS[osSnapshot.source].bypass}`}
                        </span>
                        <span>{osSnapshot.bypassList ?? '—'}</span>
                        {osSnapshot.autoDetect === true && (
                          <>
                            <span style={{ color: token.colorTextSecondary }}>
                              {`[WPAD] ${SNAPSHOT_LABELS[osSnapshot.source].wpad}`}
                            </span>
                            <span>on</span>
                          </>
                        )}
                      </div>
                    </>
                  )
                )}
              </div>
            </div>
          )}
          {settings.mode === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <FieldLabel>{t('workbench.settings.systemProxy.manual.url')}</FieldLabel>
                <Input
                  size="small"
                  data-testid="oh-sysproxy-manual-url"
                  defaultValue={settings.manualProxyUrl ?? ''}
                  placeholder={t('workbench.settings.systemProxy.manual.urlPlaceholder')}
                  maxLength={512}
                  style={{ maxWidth: 420 }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value !== (settings.manualProxyUrl ?? '')) {
                      setField({ manualProxyUrl: value === '' ? undefined : value });
                    }
                  }}
                  onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <FieldLabel>{t('workbench.settings.systemProxy.manual.credentials')}</FieldLabel>
                <Select
                  size="small"
                  data-testid="oh-sysproxy-manual-credential"
                  value={settings.manualCredentialRef}
                  onChange={(manualCredentialRef) => setField({ manualCredentialRef })}
                  options={credentialOptions}
                  allowClear
                  placeholder={t('workbench.settings.systemProxy.manual.credentialsPlaceholder')}
                  popupMatchSelectWidth={false}
                  style={{ width: 420 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <FieldLabel>{t('workbench.settings.systemProxy.manual.bypass')}</FieldLabel>
                <Input
                  size="small"
                  data-testid="oh-sysproxy-manual-bypass"
                  defaultValue={settings.manualBypassList ?? ''}
                  placeholder={t('workbench.settings.systemProxy.manual.bypassPlaceholder')}
                  maxLength={2048}
                  style={{ maxWidth: 420 }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value !== (settings.manualBypassList ?? '')) {
                      setField({ manualBypassList: value === '' ? undefined : value });
                    }
                  }}
                  onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
                />
              </div>
            </div>
          )}

          {settings.mode === 'pac' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <FieldLabel>{t('workbench.settings.systemProxy.pac.source')}</FieldLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                <Segmented
                  size="small"
                  data-testid="oh-sysproxy-pac-kind"
                  value={pacKind}
                  onChange={(value) => setPacKind(value as 'url' | 'file')}
                  options={[
                    { value: 'url', label: t('workbench.settings.systemProxy.pac.kindUrl') },
                    { value: 'file', label: t('workbench.settings.systemProxy.pac.kindFile') },
                  ]}
                />
                <Input
                  key={`${pacKind}:${settings.pacSource ?? ''}`}
                  size="small"
                  data-testid="oh-sysproxy-pac-source"
                  defaultValue={settings.pacSource ?? ''}
                  placeholder={t(
                    pacKind === 'url'
                      ? 'workbench.settings.systemProxy.pac.sourcePlaceholder'
                      : 'workbench.settings.systemProxy.pac.filePlaceholder',
                  )}
                  maxLength={1024}
                  style={{ width: 420 }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value !== (settings.pacSource ?? '')) {
                      setField({ pacSource: value === '' ? undefined : value });
                    }
                  }}
                  onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
                />
                {pacKind === 'file' && (
                  <Button size="small" data-testid="oh-sysproxy-pac-browse" onClick={() => void browsePacFile()}>
                    {t('workbench.settings.systemProxy.pac.browse')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {saveError !== null && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: token.colorError }}>
            {t('workbench.settings.systemProxy.saveFailed', { message: saveError })}
          </p>
        )}

        <div>
          <Divider style={{ margin: '14px 0 12px' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              size="small"
              data-testid="oh-sysproxy-preview-url"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder={t('workbench.settings.systemProxy.previewPlaceholder')}
              style={{ maxWidth: 420 }}
              onPressEnter={() => void runResolve(previewUrl)}
            />
            <Button
              size="small"
              loading={previewBusy}
              onClick={() => void runResolve(previewUrl)}
              data-testid="oh-sysproxy-preview-run"
            >
              {t('workbench.settings.systemProxy.previewButton')}
            </Button>
          </div>
          {/* Reserved line so the first resolution doesn't push the card taller. */}
          <div
            data-testid="oh-sysproxy-preview-result"
            style={{
              marginTop: 4,
              minHeight: 16,
              fontSize: 11,
              fontFamily: token.fontFamilyCode,
              color: token.colorText,
              wordBreak: 'break-all',
            }}
          >
            {preview !== null && `${preview.url} → ${preview.text}`}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SystemProxySection;
