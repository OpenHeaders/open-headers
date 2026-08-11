/**
 * Companion rows for the Status popover — each surface names its OTHER
 * half and whether the pair is live:
 *
 *   - extension host → a "Desktop app" row: connection state derived
 *     from the loopback backend record's own sync slot; with no record
 *     at all, the `nmHostPresence` capability answers from OS truth
 *     whether the desktop was ever installed here — "not installed"
 *     earns a Download action that resolves this platform's latest
 *     installer from the update feed (website install section when the
 *     feed is unreachable).
 *   - desktop host → an "Extensions" row: connected browser peers from
 *     the daemon's sync status (`context.peerCount`); none connected
 *     shows the per-browser store links, handed to the browser that
 *     will install them (same data + capability seam as the Traffic
 *     Monitor rail's install CTAs).
 *   - web host → the "Extensions" row too: a web surface is already a
 *     client of its serving back-end (the sync rows tell that story),
 *     so the missing companion is the browser extension; store links
 *     open via `openExternalUrl` with a plain-tab fallback.
 */

import { DownloadOutlined } from '@ant-design/icons';
import { createBackend, isLoopbackBackendUrl, updateBackend } from '@openheaders/core/backends';
import { getCapability, type NmHostPresenceVerdict } from '@openheaders/core/capabilities';
import { WS_PORT } from '@openheaders/core/protocol';
import type { BackendConnection, BackendSyncStatus } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Tag, Typography } from 'antd';
import React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  EXTENSION_STORE_URLS,
  INSTALL_BROWSER_LABELS,
  INSTALLABLE_BROWSERS,
} from '../../workbench/data/extension-stores';
import { useBackends } from '../backend';
import { DESKTOP_DOWNLOAD_URL, fetchLatestDesktopInstaller } from '../desktop-teaser/update-feed';
import { getCurrentHost } from '../host-vocabulary';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { useStatus } from '../hooks/useStatus';
import { STATUS_TAG_WIDTH } from './StatusPill';

export type DesktopCompanionState =
  | 'connected'
  | 'connecting'
  | 'not-connected'
  | 'off'
  | 'installed-not-connected'
  | 'not-installed'
  | 'unknown';

/**
 * Pure derivation of the Desktop-app row's state. The loopback record
 * (when one exists) is the whole answer — its sync slot is live wire
 * truth; only a record-less registry consults the presence probe
 * (`true` / `false` / `null` = unresolved or no capability).
 */
export function deriveDesktopCompanionState(
  backends: readonly BackendConnection[],
  syncSlots: Readonly<Record<string, BackendSyncStatus | undefined>>,
  presence: boolean | null,
): DesktopCompanionState {
  const loopback = backends.find((b) => isLoopbackBackendUrl(b.url));
  if (loopback) {
    if (!loopback.enabled) return 'off';
    const slot = syncSlots[loopback.id];
    if (!slot) return 'connecting';
    return slot.state === 'green' ? 'connected' : 'not-connected';
  }
  if (presence === true) return 'installed-not-connected';
  if (presence === false) return 'not-installed';
  return 'unknown';
}

/** Host-aware companion rows — mounted by `productStatusExtras`. */
export const CompanionStatusRows: React.FC = () => {
  const host = getCurrentHost();
  if (host === 'extension') return <DesktopAppRow />;
  return <ExtensionsRow />;
};

const DesktopAppRow: React.FC = () => {
  const t = useT();
  const backends = useBackends();
  const { snapshot: syncSlots } = useBackendSyncStatus();
  const hasLoopbackRecord = backends.some((b) => isLoopbackBackendUrl(b.url));
  const [presence, setPresence] = React.useState<NmHostPresenceVerdict | null>(null);

  // The probe spawns a real process — consult it only when no record
  // can answer, and only once per mount (the impl caches briefly too).
  React.useEffect(() => {
    if (hasLoopbackRecord) return;
    const probe = getCapability('nmHostPresence');
    if (!probe) {
      setPresence({ present: false, anchored: false });
      return;
    }
    let alive = true;
    void probe().then((verdict) => {
      if (alive) setPresence(verdict);
    });
    return () => {
      alive = false;
    };
  }, [hasLoopbackRecord]);

  const state = deriveDesktopCompanionState(backends, syncSlots, presence === null ? null : presence.present);
  // Unresolved probe: render nothing rather than flash a wrong guess.
  if (state === 'unknown') return null;

  const visual: Record<Exclude<DesktopCompanionState, 'unknown'>, { tagColor: string; messageKey: MessageKey }> = {
    connected: { tagColor: 'success', messageKey: 'shared.chrome.status.companionConnected' },
    connecting: { tagColor: 'warning', messageKey: 'shared.chrome.status.backendConnecting' },
    'not-connected': { tagColor: 'warning', messageKey: 'shared.chrome.status.companionNotConnected' },
    off: { tagColor: 'default', messageKey: 'shared.chrome.status.backendOff' },
    'installed-not-connected': { tagColor: 'default', messageKey: 'shared.chrome.status.companionInstalledNotConnected' },
    'not-installed': { tagColor: 'default', messageKey: 'shared.chrome.status.companionNotInstalled' },
  };
  const { tagColor, messageKey } = visual[state];
  return (
    <CompanionRow
      tagColor={tagColor}
      label={t('shared.chrome.status.companionDesktopApp')}
      testId="status-companion-desktop"
    >
      <Typography.Text style={{ fontSize: 11 }}>{t(messageKey)}</Typography.Text>
      {state === 'not-installed' && <DesktopDownloadAction />}
      {state === 'not-connected' && <DesktopOpenAppAction primary />}
      {state === 'installed-not-connected' && (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <DesktopConnectAction />
          {presence?.anchored === true && <DesktopOpenAppAction />}
        </span>
      )}
    </CompanionRow>
  );
};

/**
 * Explicit launch for a disconnected companion — the NM host opens the
 * desktop app it shipped inside (`desktopLaunch`), and the service
 * worker's watch sentinel attaches the moment the app is up, so the
 * row re-derives to Connected on its own. Absent capability (no NM
 * plane) hides the button; the probe-backed state also hides it when
 * the host is unanchored (a dev layout refuses every launch); a failed
 * launch leaves the row as it was.
 */
const DesktopOpenAppAction: React.FC<{ primary?: boolean }> = ({ primary }) => {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const launch = getCapability('desktopLaunch');
  if (!launch) return null;
  const open = async (): Promise<void> => {
    setBusy(true);
    await launch();
    setBusy(false);
  };
  return (
    <Button
      size="small"
      type={primary ? 'primary' : 'default'}
      loading={busy}
      onClick={() => void open()}
      data-testid="status-companion-open-app"
      style={{ fontSize: 11, height: 20, padding: '0 6px' }}
    >
      {t('shared.chrome.status.companionOpenApp')}
    </Button>
  );
};

/**
 * One-click join for the "installed but not connected" state — the
 * same NM handoff the wizard rides, minus the wizard: a verified mint
 * creates the record enabled (the daemon's OS-truth verification IS
 * the probe-gated-enable's probe), and the row re-derives to
 * Connected off the registry change. A refusal (desktop not running,
 * unverified browser) leaves the row as it was — the button stays for
 * another try.
 */
const DesktopConnectAction: React.FC = () => {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const autoPair = getCapability('nmAutoPair');
  if (!autoPair) return null;
  const connect = async (): Promise<void> => {
    const url = `ws://127.0.0.1:${WS_PORT}`;
    setBusy(true);
    const result = await autoPair({ url });
    if (result.ok) {
      const record = await createBackend({ url, authToken: result.token });
      await updateBackend(record.id, { enabled: true });
    }
    setBusy(false);
  };
  return (
    <Button
      size="small"
      type="primary"
      loading={busy}
      onClick={() => void connect()}
      data-testid="status-companion-connect"
      style={{ fontSize: 11, height: 20, padding: '0 6px' }}
    >
      {t('shared.chrome.status.companionConnect')}
    </Button>
  );
};

/**
 * Resolve-then-open download: the click fetches this platform's latest
 * installer from the update feed so the browser starts the actual
 * download; an unreachable feed lands on the website install section.
 */
const DesktopDownloadAction: React.FC = () => {
  const t = useT();
  const [resolving, setResolving] = React.useState(false);
  const download = async (): Promise<void> => {
    setResolving(true);
    const installer = await fetchLatestDesktopInstaller();
    setResolving(false);
    openOutside(installer?.url ?? DESKTOP_DOWNLOAD_URL);
  };
  return (
    <Button
      size="small"
      type="primary"
      icon={<DownloadOutlined style={{ fontSize: 10 }} />}
      loading={resolving}
      onClick={() => void download()}
      data-testid="status-companion-download"
      // Same Save-button orange + eased-off label as the teaser CTA.
      style={{
        fontSize: 11,
        height: 20,
        padding: '0 6px',
        background: '#f5722d',
        borderColor: '#f5722d',
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      {t('shared.chrome.status.companionDownload')}
    </Button>
  );
};

const ExtensionsRow: React.FC = () => {
  const t = useT();
  const { snapshot } = useStatus();
  const rawCount = snapshot.sync?.context?.peerCount;
  const peerCount = typeof rawCount === 'number' ? rawCount : null;
  if (peerCount !== null && peerCount > 0) {
    return (
      <CompanionRow
        tagColor="success"
        label={t('shared.chrome.status.companionExtensions')}
        testId="status-companion-extensions"
      >
        <Typography.Text style={{ fontSize: 11 }}>
          {t('shared.chrome.status.companionPeersConnected', { count: peerCount })}
        </Typography.Text>
      </CompanionRow>
    );
  }
  return (
    <CompanionRow
      tagColor="default"
      label={t('shared.chrome.status.companionExtensions')}
      testId="status-companion-extensions"
    >
      <Typography.Text style={{ fontSize: 11 }}>{t('shared.chrome.status.companionNoPeers')}</Typography.Text>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {INSTALLABLE_BROWSERS.map((browser) => (
          <Button
            key={browser}
            type="link"
            size="small"
            onClick={() => openStoreListing(browser)}
            style={{ fontSize: 11, padding: '0 3px', height: 18 }}
          >
            {INSTALL_BROWSER_LABELS[browser]}
          </Button>
        ))}
      </span>
    </CompanionRow>
  );
};

function openStoreListing(browser: (typeof INSTALLABLE_BROWSERS)[number]): void {
  const url = EXTENSION_STORE_URLS[browser];
  // A store listing must land in the browser that will install it —
  // hosts with an OS process plane register `openUrlInBrowser`; the
  // rest hand the URL to their default external-open path.
  const inBrowser = getCapability('openUrlInBrowser');
  if (inBrowser) {
    void inBrowser(url, browser);
    return;
  }
  openOutside(url);
}

function openOutside(url: string): void {
  const openUrl = getCapability('openExternalUrl');
  if (openUrl) void openUrl(url);
  else window.open(url, '_blank', 'noopener');
}

/**
 * Companion row shell — same fixed-width tag column as the built-in
 * subsystem rows, message content top-aligned so a wrapped value keeps
 * the tag pinned to its first line.
 */
const CompanionRow: React.FC<{
  tagColor: string;
  label: string;
  testId: string;
  children: React.ReactNode;
}> = ({ tagColor, label, testId, children }) => (
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
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </span>
  </div>
);
