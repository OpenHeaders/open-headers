/**
 * "Command-line access" card (MCP pane, between the tokens ledger and
 * the config snippets) — one-click provisioning of the machine's `oh`
 * CLI. The heavy lifting is host-side (`oh.daemon.cli.provision` mints
 * a `CLI — <hostname>` token and writes it straight into
 * `openheaders/cli.json`; the secret never reaches this renderer), so
 * the card is a status readout plus one button.
 *
 * Status rides `oh.daemon.cli.status`, which hashes the file's token
 * against the ledger at call time — never cached — so a revoke in the
 * ledger above flips this card to "set up again" on the next poll.
 * Polled on the same cadence as the tokens ledger while the pane is
 * open. A malformed config file is refused and reported (the
 * `oh connect` law): the card shows the parse error and offers no
 * button until the user fixes or deletes the file.
 */

import { App as AntApp, Alert, Button, Typography, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { hostBridge } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';

/** Same cadence as the tokens ledger above — see daemon-tokens-section. */
const POLL_INTERVAL_MS = 3_000;

interface CliStatus {
  configPath: string;
  state: 'unconfigured' | 'configured' | 'stale' | 'external' | 'malformed';
  tokenId?: string;
  label?: string;
  daemonUrl?: string;
  error?: string;
}

const CliAccessCard: React.FC = () => {
  const { token: themeToken } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const [status, setStatus] = useState<CliStatus | null>(null);
  const [provisioning, setProvisioning] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await hostBridge.call('oh.daemon.cli.status'));
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = (): void => {
      void hostBridge
        .call('oh.daemon.cli.status')
        .then((resp) => {
          if (!cancelled) setStatus(resp);
        })
        .catch(() => undefined);
    };
    poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  async function handleProvision(rotating: boolean): Promise<void> {
    setProvisioning(true);
    try {
      const result = await hostBridge.call('oh.daemon.cli.provision');
      if (!result.ok) throw new Error(result.error);
      message.success(rotating ? t('workbench.settings.cliAccess.rotated') : t('workbench.settings.cliAccess.provisioned'));
      await refresh();
    } catch (err) {
      message.error(t('workbench.settings.cliAccess.provisionFailed', { message: (err as Error).message }));
    } finally {
      setProvisioning(false);
    }
  }

  if (!status) return null;

  const isConfigured = status.state === 'configured';
  const buttonLabel = isConfigured
    ? t('workbench.settings.cliAccess.rotate')
    : status.state === 'external'
      ? t('workbench.settings.cliAccess.connectHere')
      : t('workbench.settings.cliAccess.setUp');

  return (
    <section style={{ marginBottom: 12 }}>
      <header style={{ marginBottom: 6, padding: '0 2px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            color: themeToken.colorTextSecondary,
          }}
        >
          {t('workbench.settings.cliAccess.sectionTitle')}
        </h3>
        <div style={{ fontSize: 11, color: themeToken.colorTextTertiary, marginTop: 1 }}>
          {t('workbench.settings.cliAccess.sectionBlurb')}
        </div>
      </header>
      <div
        className="settings-card"
        style={{
          background: themeToken.colorBgContainer,
          border: `1px solid ${themeToken.colorBorderSecondary}`,
          borderRadius: 10,
          padding: 12,
        }}
      >
        {status.state === 'malformed' ? (
          <Alert
            type="error"
            showIcon
            message={
              <span style={{ fontSize: 12 }}>
                {t('workbench.settings.cliAccess.statusMalformed', { message: status.error ?? status.configPath })}
              </span>
            }
            data-testid="cli-access-malformed"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: themeToken.colorText }} data-testid="cli-access-status">
                {isConfigured
                  ? t('workbench.settings.cliAccess.statusConfigured', {
                      label: status.label ?? status.tokenId ?? '',
                    })
                  : status.state === 'stale'
                    ? t('workbench.settings.cliAccess.statusStale')
                    : status.state === 'external'
                      ? t('workbench.settings.cliAccess.statusExternal', { url: status.daemonUrl ?? '' })
                      : t('workbench.settings.cliAccess.statusUnconfigured')}
              </div>
              {isConfigured && (
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: 11, fontFamily: 'monospace' }}
                  ellipsis={{ tooltip: status.configPath }}
                >
                  {t('workbench.settings.cliAccess.pathNote', { path: status.configPath })}
                </Typography.Text>
              )}
            </div>
            <Button
              type={isConfigured ? 'default' : 'primary'}
              size="small"
              loading={provisioning}
              onClick={() => void handleProvision(isConfigured)}
              data-testid="cli-access-provision"
            >
              {buttonLabel}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default CliAccessCard;
