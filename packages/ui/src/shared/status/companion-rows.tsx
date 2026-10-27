/**
 * Companion rows for the Status popover — each surface names its OTHER
 * half and whether the pair is live:
 *
 *   - extension host → a "Desktop app" row: connection state derived
 *     from the desktop app's record (the place rule) and its own sync
 *     slot; with no record
 *     at all, the `nmHostPresence` capability answers from OS truth
 *     whether the desktop was ever installed here — "not installed"
 *     earns a Download action that resolves this platform's latest
 *     installer from the update feed (website install section when the
 *     feed is unreachable).
 *   - desktop host → the connected browser peers from the daemon's sync
 *     status (`context.peers`), one row per peer wearing the browser's
 *     logo and brand name so two connected browsers stay told apart;
 *     none connected shows one "Extensions" row with the per-browser
 *     store links, handed to the browser that will install them (same
 *     data + capability seam as the Traffic Monitor rail's install CTAs).
 *   - web host → the "Extensions" row too: a web surface is already a
 *     client of its serving back-end (the sync rows tell that story),
 *     so the missing companion is the browser extension; store links
 *     open via `openExternalUrl` with a plain-tab fallback.
 */

import { DownloadOutlined } from '@ant-design/icons';
import { createBackend, updateBackend } from '@openheaders/core/backends';
import { getCapability, type InstallTargetBrowser, type NmHostPresenceVerdict } from '@openheaders/core/capabilities';
import { WS_PORT } from '@openheaders/core/protocol';
import type { BackendConnection, BackendSyncStatus, ExecutionPlaceRole, SyncPeerEntry } from '@openheaders/core/types';
import { BROWSER_DISPLAY_NAME, BROWSER_KINDS, type BrowserKind } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Typography } from 'antd';
import React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useUiTheme } from '@openheaders/ui/context/ui-theme';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import {
  EXTENSION_STORE_URLS,
  INSTALL_BROWSER_LABELS,
  INSTALLABLE_BROWSERS,
} from '../../workbench/data/extension-stores';
import { desktopAppRecord, useBackends } from '../backend';
import { DESKTOP_DOWNLOAD_URL, fetchLatestDesktopInstaller } from '../desktop-teaser/update-feed';
import { browserGlyph, detectedBrowser, detectedPlatform, platformGlyph } from '../host-glyph';
import { getCurrentHost } from '../host-vocabulary';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { useStatus } from '../hooks/useStatus';
import { hostKindIcon } from '../workspace-org/org-scope-vocabulary';
import { ADDON_GLYPH_COLOR, ADDON_GLYPH_SIZE, type AddonGlyph, AddonMark, AddonRow } from './addon-row';

export type DesktopCompanionState =
  | 'connected'
  | 'connecting'
  | 'not-connected'
  | 'off'
  | 'installed-not-connected'
  | 'not-installed'
  | 'unknown';

/**
 * Derivation of the Desktop-app row's state. The desktop app's record
 * (when one exists — `desktopAppRecord`, the place rule for this host)
 * is the whole answer — its sync slot is live wire
 * truth; only a record-less registry consults the presence probe
 * (`true` / `false` / `null` = unresolved or no capability).
 */
export function deriveDesktopCompanionState(
  backends: readonly BackendConnection[],
  syncSlots: Readonly<Record<string, BackendSyncStatus | undefined>>,
  presence: boolean | null,
): DesktopCompanionState {
  const desktopApp = desktopAppRecord(getCurrentHost(), backends);
  if (desktopApp) {
    if (!desktopApp.enabled) return 'off';
    const slot = syncSlots[desktopApp.id];
    if (!slot) return 'connecting';
    return slot.state === 'green' ? 'connected' : 'not-connected';
  }
  if (presence === true) return 'installed-not-connected';
  if (presence === false) return 'not-installed';
  return 'unknown';
}

/** The desktop app on this device as one live read: the row's state
 *  plus whether a launch can succeed. */
export interface DesktopCompanion {
  state: DesktopCompanionState;
  /** `desktopLaunch` is registered and, where only the presence probe
   *  answers, the NM host is anchored to a launchable install. */
  launchable: boolean;
}

/**
 * The ONE derivation behind every "is the desktop app here" surface
 * that needs the whole ladder (the status row, the execution-place
 * control): the desktop app's record answers from its sync slot; a
 * record-less registry consults the presence probe once per mount
 * (the probe spawns a real process — never while a record can answer).
 */
export function useDesktopCompanion(): DesktopCompanion {
  const backends = useBackends();
  const { snapshot: syncSlots } = useBackendSyncStatus();
  const hasDesktopAppRecord = desktopAppRecord(getCurrentHost(), backends) !== undefined;
  const [presence, setPresence] = React.useState<NmHostPresenceVerdict | null>(null);

  React.useEffect(() => {
    if (hasDesktopAppRecord) return;
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
  }, [hasDesktopAppRecord]);

  const state = deriveDesktopCompanionState(backends, syncSlots, presence === null ? null : presence.present);
  const launchable =
    getCapability('desktopLaunch') !== undefined && (hasDesktopAppRecord || presence?.anchored === true);
  return { state, launchable };
}

/** The desktop app is the place the global execution-place preference
 *  points at, and it is here to run them — the row says so beside
 *  Connected (the Execution Place plan's Phase E). A preference the
 *  app cannot honour right now is the control's story, not the row's. */
export function desktopCompanionRunsRequests(
  state: DesktopCompanionState,
  preference: 'auto' | ExecutionPlaceRole,
): boolean {
  return state === 'connected' && preference === 'desktop-app';
}

/** Host-aware companion rows — mounted by `productStatusExtras`. */
export const CompanionStatusRows: React.FC = () => {
  const host = getCurrentHost();
  if (host === 'extension') return <DesktopAppRow />;
  return <ExtensionsRow />;
};

const DesktopAppRow: React.FC = () => {
  const t = useT();
  const { state, launchable } = useDesktopCompanion();
  const runsRequests = desktopCompanionRunsRequests(state, useSettingValue('requests.executionPlace'));
  // Unresolved probe: render nothing rather than flash a wrong guess.
  if (state === 'unknown') return null;

  const visual: Record<Exclude<DesktopCompanionState, 'unknown'>, { tagColor: string; messageKey: MessageKey }> = {
    connected: { tagColor: 'success', messageKey: 'shared.chrome.status.companionConnected' },
    connecting: { tagColor: 'warning', messageKey: 'shared.chrome.status.backendConnecting' },
    'not-connected': { tagColor: 'warning', messageKey: 'shared.chrome.status.companionNotConnected' },
    off: { tagColor: 'default', messageKey: 'shared.chrome.status.backendOff' },
    'installed-not-connected': {
      tagColor: 'default',
      messageKey: 'shared.chrome.status.companionInstalledNotConnected',
    },
    'not-installed': { tagColor: 'default', messageKey: 'shared.chrome.status.companionNotInstalled' },
  };
  const { tagColor, messageKey } = visual[state];
  // The OS brand mark keeps its own colour (Apple and Tux are
  // deliberately `currentColor`); only the generic fallback takes the tint.
  const osMark = platformGlyph(detectedPlatform());
  return (
    <AddonRow
      glyph={
        <AddonMark icon={osMark ?? hostKindIcon('desktop')} color={osMark ? undefined : ADDON_GLYPH_COLOR.desktop} />
      }
      tagColor={tagColor}
      label={t('shared.chrome.status.companionDesktopApp')}
      testId="status-companion-desktop"
    >
      <Typography.Text style={{ fontSize: 11 }} data-testid="status-companion-desktop-state">
        {runsRequests ? `${t(messageKey)} · ${t('shared.chrome.status.companionRunsRequests')}` : t(messageKey)}
      </Typography.Text>
      {state === 'not-installed' && <DesktopDownloadAction />}
      {state === 'not-connected' && <DesktopOpenAppAction primary />}
      {state === 'installed-not-connected' && (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <DesktopConnectAction />
          {launchable && <DesktopOpenAppAction />}
        </span>
      )}
    </AddonRow>
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
export const DesktopOpenAppAction: React.FC<{ primary?: boolean }> = ({ primary }) => {
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
export const DesktopConnectAction: React.FC = () => {
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
export const DesktopDownloadAction: React.FC = () => {
  const t = useT();
  const { saveAccent } = useUiTheme();
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
      // The variant's save accent + eased-off label, as the teaser CTA.
      style={{
        fontSize: 11,
        height: 20,
        padding: '0 6px',
        background: saveAccent,
        borderColor: saveAccent,
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      {t('shared.chrome.status.companionDownload')}
    </Button>
  );
};

/**
 * The store listing of THIS browser's extension — the served tab's
 * discovery rung on its place picker: a tab reaches no extension,
 * installed or not, so the row only points at the install. A browser
 * without a listing renders no button; the reason line stands alone.
 */
export const ExtensionInstallAction: React.FC = () => {
  const t = useT();
  const browser = detectedBrowser();
  const target = INSTALLABLE_BROWSERS.find((candidate) => candidate === browser);
  if (target === undefined) return null;
  return (
    <Button
      size="small"
      type="primary"
      onClick={() => openStoreListing(target)}
      data-testid="status-extension-install"
      style={{ fontSize: 11, height: 20, padding: '0 6px' }}
    >
      {t('shared.executionPlace.roster.install')}
    </Button>
  );
};

/** The Extensions row's mark: the served tab names the browser it runs
 *  in (its own logo); the desktop speaks for every browser at once, so
 *  it wears the generic browser glyph. */
function extensionsRowGlyph(): AddonGlyph {
  if (getCurrentHost() === 'web') return browserGlyph(detectedBrowser()) ?? hostKindIcon('browser');
  return hostKindIcon('browser');
}

function isBrowserKind(value: unknown): value is BrowserKind {
  return typeof value === 'string' && (BROWSER_KINDS as readonly string[]).includes(value);
}

/** The serving host's peer list out of its `sync` context — `null`
 *  when the entry carries none (a host that predates the list). */
export function readSyncPeers(context: Record<string, unknown> | undefined): SyncPeerEntry[] | null {
  const raw = context?.peers;
  if (!Array.isArray(raw)) return null;
  const peers: SyncPeerEntry[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const { browser, isLoopback } = item as { browser?: unknown; isLoopback?: unknown };
    if (typeof isLoopback !== 'boolean') return null;
    if (browser !== null && !isBrowserKind(browser)) return null;
    peers.push({ browser: browser ?? null, isLoopback });
  }
  return peers;
}

/** One row per connected peer: its browser's logo and brand name when
 *  it announced one, the generic browser glyph + "Extensions" when not. */
const ConnectedPeerRows: React.FC<{ peers: readonly SyncPeerEntry[] }> = ({ peers }) => {
  const t = useT();
  return (
    <>
      {peers.map((peer, index) => {
        const Logo = peer.browser ? browserGlyph(peer.browser) : null;
        return (
          <AddonRow
            // Peers carry no stable id across the status seam; the list
            // re-renders whole on every peer change, so position is the key.
            key={index}
            glyph={<AddonMark icon={Logo ?? hostKindIcon('browser')} color={ADDON_GLYPH_COLOR.browser} />}
            tagColor="success"
            label={peer.browser ? BROWSER_DISPLAY_NAME[peer.browser] : t('shared.chrome.status.companionExtensions')}
            testId="status-companion-extension-peer"
          >
            <Typography.Text style={{ fontSize: 11 }}>{t('shared.chrome.status.companionConnected')}</Typography.Text>
          </AddonRow>
        );
      })}
    </>
  );
};

const ExtensionsRow: React.FC = () => {
  const t = useT();
  const { snapshot } = useStatus();
  const context = snapshot.sync?.context;
  const rawCount = context?.peerCount;
  const peerCount = typeof rawCount === 'number' ? rawCount : null;
  if (peerCount !== null && peerCount > 0) {
    const peers = readSyncPeers(context);
    if (peers !== null && peers.length > 0) return <ConnectedPeerRows peers={peers} />;
    return (
      <AddonRow
        glyph={<AddonMark icon={extensionsRowGlyph()} color={ADDON_GLYPH_COLOR.browser} />}
        tagColor="success"
        label={t('shared.chrome.status.companionExtensions')}
        testId="status-companion-extensions"
      >
        <Typography.Text style={{ fontSize: 11 }}>
          {t('shared.chrome.status.companionPeersConnected', { count: peerCount })}
        </Typography.Text>
      </AddonRow>
    );
  }
  return (
    <AddonRow
      glyph={<AddonMark icon={extensionsRowGlyph()} color={ADDON_GLYPH_COLOR.browser} />}
      tagColor="default"
      label={t('shared.chrome.status.companionExtensions')}
      testId="status-companion-extensions"
    >
      <Typography.Text style={{ fontSize: 11 }}>{t('shared.chrome.status.companionNoPeers')}</Typography.Text>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {INSTALLABLE_BROWSERS.map((browser) => {
          const Logo = browserGlyph(browser);
          return (
            <Button
              key={browser}
              type="link"
              size="small"
              icon={Logo ? <Logo style={{ fontSize: ADDON_GLYPH_SIZE - 2 }} /> : undefined}
              onClick={() => openStoreListing(browser)}
              style={{ fontSize: 11, padding: '0 3px', height: 18 }}
            >
              {INSTALL_BROWSER_LABELS[browser]}
            </Button>
          );
        })}
      </span>
    </AddonRow>
  );
};

function openStoreListing(browser: InstallTargetBrowser): void {
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
