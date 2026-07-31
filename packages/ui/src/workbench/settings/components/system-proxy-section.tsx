/**
 * SystemProxySection — the system plane's settings surface
 * (docs/REQUEST_ENGINE_PROXY_DESIGN.md P3): how THIS device's egress
 * reaches the network. Renders at the top of the Proxy category on the
 * desktop host, above the capture-proxy trust plane — per-device state
 * (the vault posture), never workspace data.
 *
 * Four modes: System (default — resolution delegated to Chromium,
 * "works exactly like Chrome on this machine"), Manual (one proxy URL,
 * credentials by VAULT REF — never plaintext — and a NO_PROXY-syntax
 * bypass list), PAC (explicit PAC URL or local file, executed only in
 * Chromium's sandboxed network service), Off (always direct). Every
 * edit applies live over `oh.desktop.systemProxy.set` — the next
 * send resolves under the new mode, no restart.
 *
 * Two honesty surfaces ride the same `resolve` RPC: the sourced
 * read-only display (a canonical-URL probe naming the resolved source
 * and chain, with Refresh) and the per-URL resolution preview —
 * "what would this machine do for this URL right now".
 */

import { hostBridge } from '@openheaders/core/bridge';
import type {
  DesktopSystemProxyMode,
  SystemProxyResolution,
  SystemProxySettings,
} from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Input, Radio, Select, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useVaultContext } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';

/** The sourced display's canonical probe target — one representative
 *  https URL; the per-URL preview answers everything else. */
const PROBE_URL = 'https://api.openheaders.io';

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
  const [probe, setProbe] = useState<{ text: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [preview, setPreview] = useState<{ url: string; text: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const credentialOptions = vault.secrets
    .filter((s) => s.kind === 'string')
    .map((s) => ({ value: s.name, label: s.name }));

  const refreshProbe = useCallback(async (mode: SystemProxySettings['mode']): Promise<void> => {
    if (mode === 'off') {
      setProbe(null);
      return;
    }
    try {
      const resp = await hostBridge.call('oh.desktop.systemProxy.resolve', { url: PROBE_URL });
      setProbe({ text: resp.ok ? chainText(resp.resolution) : resp.error });
    } catch {
      setProbe(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await hostBridge.call('oh.desktop.systemProxy.get');
        setSettings(resp.settings);
        void refreshProbe(resp.settings.mode);
      } catch {
        // No service on this host — the section stays empty (the pane
        // gates on the desktop host, so this is a dev-harness case).
        setSettings(null);
      }
    })();
  }, [refreshProbe]);

  const persist = useCallback(
    async (next: SystemProxySettings): Promise<void> => {
      setSettings(next);
      try {
        const resp = await hostBridge.call('oh.desktop.systemProxy.set', { settings: next });
        setSaveError(resp.ok ? null : resp.error);
        if (resp.ok) void refreshProbe(resp.settings.mode);
      } catch (err) {
        setSaveError((err as Error).message);
      }
    },
    [refreshProbe],
  );

  const runPreview = async (): Promise<void> => {
    const url = previewUrl.trim();
    if (url === '') return;
    setPreviewBusy(true);
    try {
      const resp = await hostBridge.call('oh.desktop.systemProxy.resolve', { url });
      setPreview({ url, text: resp.ok ? chainText(resp.resolution) : resp.error });
    } catch (err) {
      setPreview({ url, text: (err as Error).message });
    } finally {
      setPreviewBusy(false);
    }
  };

  if (settings === null) return null;

  const setField = (patch: Partial<SystemProxySettings>): void => {
    void persist({ ...settings, ...patch });
  };

  return (
    <section style={{ marginBottom: 14 }}>
      <div className="settings-card" style={{ padding: '8px 14px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, padding: '4px 0 2px' }}>
          {t('workbench.settings.systemProxy.title')}
        </div>
        <p style={{ margin: '2px 0 8px', fontSize: 12, color: token.colorTextSecondary }}>
          {t('workbench.settings.systemProxy.intro')}
        </p>

        <Radio.Group
          data-testid="oh-sysproxy-mode"
          value={settings.mode}
          onChange={(e) => setField({ mode: e.target.value as DesktopSystemProxyMode })}
          style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          {(['system', 'manual', 'pac', 'off'] as const).map((mode) => (
            <Radio key={mode} value={mode} data-testid={`oh-sysproxy-mode-${mode}`} style={{ alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: token.colorText }}>{t(MODE_LABEL[mode])}</span>
              <span style={{ display: 'block', fontSize: 12, color: token.colorTextSecondary }}>
                {t(MODE_DESC[mode])}
              </span>
            </Radio>
          ))}
        </Radio.Group>

        {settings.mode === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0 2px' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <FieldLabel>{t('workbench.settings.systemProxy.manual.url')}</FieldLabel>
              <Input
                size="small"
                data-testid="oh-sysproxy-manual-url"
                defaultValue={settings.manualProxyUrl ?? ''}
                placeholder={t('workbench.settings.systemProxy.manual.urlPlaceholder')}
                maxLength={512}
                style={{ maxWidth: 320 }}
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
                style={{ width: 320 }}
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
                style={{ maxWidth: 320 }}
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
          <div style={{ display: 'flex', gap: 12, margin: '10px 0 2px' }}>
            <FieldLabel>{t('workbench.settings.systemProxy.pac.source')}</FieldLabel>
            <Input
              size="small"
              data-testid="oh-sysproxy-pac-source"
              defaultValue={settings.pacSource ?? ''}
              placeholder={t('workbench.settings.systemProxy.pac.sourcePlaceholder')}
              maxLength={1024}
              style={{ maxWidth: 420 }}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value !== (settings.pacSource ?? '')) {
                  setField({ pacSource: value === '' ? undefined : value });
                }
              }}
              onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
            />
          </div>
        )}

        {saveError !== null && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: token.colorError }}>
            {t('workbench.settings.systemProxy.saveFailed', { message: saveError })}
          </p>
        )}

        {settings.mode !== 'off' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 10, fontSize: 12 }}>
            <span style={{ color: token.colorTextSecondary, flex: 'none' }}>
              {t('workbench.settings.systemProxy.sourced', { url: PROBE_URL.replace(/^https:\/\//, '') })}
            </span>
            <span
              data-testid="oh-sysproxy-sourced"
              style={{ fontFamily: token.fontFamilyCode, fontSize: 11, color: token.colorText, wordBreak: 'break-all' }}
            >
              {probe?.text ?? '—'}
            </span>
            <Button size="small" type="text" style={{ fontSize: 12, color: token.colorTextSecondary }} onClick={() => void refreshProbe(settings.mode)}>
              {t('workbench.settings.systemProxy.refresh')}
            </Button>
          </div>
        )}

        {settings.mode !== 'off' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                size="small"
                data-testid="oh-sysproxy-preview-url"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                placeholder={t('workbench.settings.systemProxy.previewPlaceholder')}
                style={{ maxWidth: 320 }}
                onPressEnter={() => void runPreview()}
              />
              <Button size="small" loading={previewBusy} onClick={() => void runPreview()} data-testid="oh-sysproxy-preview-run">
                {t('workbench.settings.systemProxy.previewButton')}
              </Button>
            </div>
            {preview !== null && (
              <div
                data-testid="oh-sysproxy-preview-result"
                style={{ marginTop: 4, fontSize: 11, fontFamily: token.fontFamilyCode, color: token.colorText, wordBreak: 'break-all' }}
              >
                {preview.url} → {preview.text}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default SystemProxySection;
