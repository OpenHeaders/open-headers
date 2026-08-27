/**
 * CLI access row — custom editor for `mcp.cliAccess` on the AI · MCP
 * Server › Clients page: one-click provisioning of the machine's `oh`
 * CLI. The heavy lifting is host-side (`oh.daemon.cli.provision` mints
 * a `CLI — <hostname>` token and writes it straight into
 * `openheaders/cli.json`; the secret never reaches this renderer), so
 * the row is a status readout plus one button.
 *
 * Status rides `oh.daemon.cli.status`, which hashes the file's token
 * against the ledger at call time — never cached — so a revoke on
 * Backend › Server flips this row to "set up again" on the next poll.
 * Polled on the same cadence as the tokens ledger while the page is
 * open. A malformed config file is refused and reported (the
 * `oh connect` law): the row shows the parse error and offers no
 * button until the user fixes or deletes the file.
 */

import { App as AntApp, Alert, Button, Typography, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { hostBridge } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

/** Same cadence as the tokens ledger — see backend-tokens-section. */
const POLL_INTERVAL_MS = 3_000;

interface CliStatus {
  configPath: string;
  state: 'unconfigured' | 'configured' | 'stale' | 'external' | 'malformed';
  tokenId?: string;
  label?: string;
  daemonUrl?: string;
  error?: string;
}

const CliAccessRow: React.FC<{ def: SettingDef }> = ({ def }) => {
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
    <FieldRow
      settingKey={def.key}
      label={resolveLabel(def, t)}
      description={resolveDescription(def, t)}
      resettable={false}
      block
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
    </FieldRow>
  );
};

export default CliAccessRow;
