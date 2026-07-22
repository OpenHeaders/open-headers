/**
 * AddonsPill — the "Add-ons" popover next to the System pill: where
 * this surface's companions live. The System popover stays a pure
 * subsystem-health surface; everything about the OTHER Open Headers
 * pieces on this machine — the desktop app / browser extensions
 * (host-dependent), the `oh` CLI, the daemon — reads here, in the same
 * fixed-tag-column row format as the System popover.
 *
 * Row availability is honest per host:
 *   - extension → Desktop app (OS-truth install detection + download
 *     CTA, see `companion-rows`), CLI (coarse state probed over the
 *     wire from the connected desktop, pointer copy when nothing
 *     answers), plus a Daemon row when a self-hosted (non-loopback)
 *     backend record exists — a browser can't detect an unconfigured
 *     daemon, so no record means no row.
 *   - desktop  → Extensions (connected peers / store links), CLI
 *     (`oh.daemon.cli.status` — the provisioning card's live truth,
 *     with the one-click provision remedy), MCP (surfaced once the
 *     CLI is set up — the TUI and agents need `/mcp` answering, and
 *     an externally-provisioned CLI otherwise discovers the off
 *     switch only via the TUI's retry screen), and the Daemon row.
 *   - web      → Extensions row; its serving back-end is already the
 *     sync rows' story.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { isLoopbackBackendUrl } from '@openheaders/core/backends';
import type { BackendConnection, BackendSyncStatus } from '@openheaders/core/types';
import { Button, Popover, Tag, Typography, theme } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useBackends } from '../backend';
import { getCurrentHost } from '../host-vocabulary';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { CompanionStatusRows } from './companion-rows';
import { STATUS_TAG_WIDTH } from './StatusPill';

export interface AddonsPillProps {
  className?: string;
  placement?: TooltipPlacement;
}

export const AddonsPill: React.FC<AddonsPillProps> = ({ className, placement = 'top' }) => {
  const t = useT();
  const { token } = theme.useToken();
  const body = (
    <div style={{ maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <CompanionStatusRows />
      <CliRow />
      <DaemonRow />
    </div>
  );
  const title = (
    <Typography.Text strong style={{ fontSize: 12 }}>
      {t('shared.chrome.addons.title')}
    </Typography.Text>
  );
  return (
    <Popover placement={placement} trigger={['click', 'hover']} content={body} title={title}>
      <span
        className={className ?? 'rules-statusbar-item'}
        data-testid="addons-pill"
        style={{ whiteSpace: 'nowrap' }}
      >
        {/* Neutral grey — the pill is an inventory, not a health signal. */}
        <span className="rules-dot" style={{ background: token.colorTextTertiary }} />
        {t('shared.chrome.addons.title')}
      </span>
    </Popover>
  );
};

interface CliStatus {
  configPath: string;
  state: 'unconfigured' | 'configured' | 'stale' | 'external' | 'malformed';
  label?: string;
}

/**
 * CLI row. On the desktop, the daemon admin verb hashes the config
 * file's token against the ledger at call time — same truth as the
 * provisioning card; one shot per popover mount (the popover is
 * transient, so no polling). On the extension — the main onboarding
 * surface — the row asks the connected desktop for its coarse CLI
 * state over the wire (`getCliWireStatus` → the read-only
 * `getCliStatusSummary` peer verb) and renders it with the same
 * five-state map, read-only (provisioning stays a desktop gesture).
 * With no wire answer — desktop not connected, an older desktop, a
 * timeout — the row falls back to the pointer copy rather than fake a
 * state ("set up from the desktop app" while connected, "requires the
 * desktop app" while not).
 */
const CliRow: React.FC = () => {
  const t = useT();
  const [status, setStatus] = React.useState<CliStatus | null>(null);
  const [wireState, setWireState] = React.useState<CliStatus['state'] | null>(null);
  const [provisioning, setProvisioning] = React.useState(false);
  const host = getCurrentHost();
  const isDesktop = host === 'desktop';
  const backends = useBackends();
  const { snapshot: syncSlots } = useBackendSyncStatus();
  const loopback = backends.find((b) => isLoopbackBackendUrl(b.url));
  const desktopConnected = loopback?.enabled === true && syncSlots[loopback.id]?.state === 'green';
  React.useEffect(() => {
    if (!isDesktop) return;
    let alive = true;
    void hostBridge
      .call('oh.daemon.cli.status')
      .then((resp) => {
        if (alive) setStatus(resp as CliStatus);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isDesktop]);
  React.useEffect(() => {
    if (host !== 'extension' || !desktopConnected) return;
    let alive = true;
    void hostBridge
      .call('getCliWireStatus')
      .then((resp) => {
        if (alive) setWireState(resp.state);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [host, desktopConnected]);
  // The provisioning card's one-click verb, inlined as the row's
  // remedy: mints the token host-side and writes cli.json; the fresh
  // status read flips the row to "set up".
  const provision = async (): Promise<void> => {
    setProvisioning(true);
    try {
      await hostBridge.call('oh.daemon.cli.provision');
      setStatus(await hostBridge.call('oh.daemon.cli.status'));
    } catch {
      // The row keeps its state; the settings card carries the detail.
    }
    setProvisioning(false);
  };
  const visual: Record<CliStatus['state'], { tagColor: string; message: string }> = {
    configured: { tagColor: 'success', message: t('shared.chrome.addons.cliSetUp') },
    unconfigured: { tagColor: 'default', message: t('shared.chrome.addons.cliNotSetUp') },
    stale: { tagColor: 'warning', message: t('shared.chrome.addons.cliStale') },
    external: { tagColor: 'default', message: t('shared.chrome.addons.cliExternal') },
    malformed: { tagColor: 'error', message: t('shared.chrome.addons.cliMalformed') },
  };
  if (host === 'extension') {
    // Real state when the wire answered; pointer copy otherwise. A
    // disconnect drops back to the pointer copy immediately — a stale
    // answer must not outlive its wire. Read-only — the provision
    // remedy stays a desktop gesture.
    const wire = desktopConnected && wireState !== null ? visual[wireState] : null;
    return (
      <AddonRow
        tagColor={wire?.tagColor ?? 'default'}
        label={t('shared.chrome.addons.cli')}
        message={
          wire?.message ??
          t(desktopConnected ? 'shared.chrome.addons.cliViaDesktop' : 'shared.chrome.addons.requiresDesktop')
        }
        testId="addons-cli"
      />
    );
  }
  if (!isDesktop || !status) return null;
  const { tagColor, message } = visual[status.state];
  // The two states the one-click verb can actually fix; `malformed`
  // needs a human (fix or delete the file) and `external` is a choice.
  const provisionable = status.state === 'unconfigured' || status.state === 'stale';
  return (
    <>
      <AddonRow
        tagColor={tagColor}
        label={t('shared.chrome.addons.cli')}
        message={message}
        testId="addons-cli"
        action={
          provisionable ? (
            <Button
              size="small"
              type="primary"
              loading={provisioning}
              onClick={() => void provision()}
              data-testid="addons-cli-provision"
              style={{ fontSize: 11, height: 20, padding: '0 6px' }}
            >
              {t('shared.chrome.addons.cliProvision')}
            </Button>
          ) : undefined
        }
      />
      {(status.state === 'configured' || status.state === 'external') && <McpRow />}
    </>
  );
};

/**
 * MCP surface state, shown once a CLI config exists — the TUI and
 * agent clients need `/mcp` answering, and `mcp.enabled` defaults off,
 * so a provisioned CLI against a silent surface is the popover's
 * problem to name (and fix, one click) rather than the TUI retry
 * screen's.
 */
const McpRow: React.FC = () => {
  const t = useT();
  const [enabled, setEnabled] = useSetting('mcp.enabled');
  return (
    <AddonRow
      tagColor={enabled ? 'success' : 'default'}
      label={t('shared.chrome.addons.mcp')}
      message={t(enabled ? 'shared.chrome.addons.mcpOn' : 'shared.chrome.status.backendOff')}
      testId="addons-mcp"
      action={
        enabled ? undefined : (
          <Button
            size="small"
            type="primary"
            onClick={() => setEnabled(true)}
            data-testid="addons-mcp-enable"
            style={{ fontSize: 11, height: 20, padding: '0 6px' }}
          >
            {t('shared.chrome.addons.mcpTurnOn')}
          </Button>
        )
      }
    />
  );
};

/**
 * Daemon row — a STANDALONE self-hosted daemon on the LAN/WAN, never
 * the desktop app's embedded daemon (that plane is the Desktop-app
 * row's story). Both browser and desktop surfaces can be a daemon's
 * CLIENT, so the row mirrors a configured non-loopback back-end
 * record's wire state; with none, it stays visible as a neutral
 * "not configured" for discoverability. Web's serving daemon already
 * reads in the sync rows.
 */
const DaemonRow: React.FC = () => {
  const t = useT();
  const host = getCurrentHost();
  const backends = useBackends();
  const { snapshot: syncSlots } = useBackendSyncStatus();
  if (host !== 'extension' && host !== 'desktop') return null;
  const daemonRecord = backends.find((b) => !isLoopbackBackendUrl(b.url));
  if (!daemonRecord) {
    return (
      <AddonRow
        tagColor="default"
        label={t('shared.chrome.addons.daemon')}
        message={t('shared.chrome.addons.notConfigured')}
        testId="addons-daemon"
      />
    );
  }
  const { tagColor, message } = daemonRecordVisual(daemonRecord, syncSlots[daemonRecord.id], t);
  return (
    <AddonRow tagColor={tagColor} label={t('shared.chrome.addons.daemon')} message={message} testId="addons-daemon" />
  );
};

function daemonRecordVisual(
  record: BackendConnection,
  slot: BackendSyncStatus | undefined,
  t: ReturnType<typeof useT>,
): { tagColor: string; message: string } {
  if (!record.enabled) return { tagColor: 'default', message: t('shared.chrome.status.backendOff') };
  if (!slot) return { tagColor: 'warning', message: t('shared.chrome.status.backendConnecting') };
  if (slot.state === 'green') return { tagColor: 'success', message: t('shared.chrome.status.companionConnected') };
  return { tagColor: 'warning', message: t('shared.chrome.status.companionNotConnected') };
}

const AddonRow: React.FC<{
  tagColor: string;
  label: string;
  message: string;
  testId: string;
  /** Optional inline remedy, right-aligned after the message. */
  action?: React.ReactNode;
}> = ({ tagColor, label, message, testId, action }) => {
  const { token } = theme.useToken();
  return (
    <div data-testid={testId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <Tag color={tagColor} style={{ fontSize: 10, width: STATUS_TAG_WIDTH, textAlign: 'center', margin: 0, flex: 'none' }}>
        {label}
      </Tag>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 4,
          paddingTop: 1,
        }}
      >
        <Typography.Text style={{ fontSize: 11, minWidth: 0, color: token.colorText, overflowWrap: 'anywhere' }}>
          {message}
        </Typography.Text>
        {action}
      </span>
    </div>
  );
};
