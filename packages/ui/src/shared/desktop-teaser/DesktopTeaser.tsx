/**
 * DesktopTeaser — the placeholder body for a desktop-only feature on a
 * host that can't run it (extension / web workbench). Centered
 * explainer + a call to action, so gated tabs and settings categories
 * stay discoverable instead of silently disappearing.
 *
 * The CTA is state-aware: with the companion desktop app CONNECTED on
 * this machine (live loopback wire truth, same derivation as the
 * status popover's Desktop-app row) and the `companionReveal`
 * capability present, the primary action hands off — front the desktop
 * app and reveal this feature there. With the app INSTALLED but not
 * connected (the `desktopLaunch` capability present and the NM host
 * answering the presence probe), the primary action launches it — the
 * service worker's watch sentinel attaches as it comes up and this
 * teaser re-derives to the reveal CTA on its own. Otherwise it
 * resolves the latest installer for this platform from the update
 * feed's versions manifest (see `update-feed.ts`) and opens it outside
 * the current surface via the `openExternalUrl` capability; hosts
 * without it (the web app) fall back to a plain new tab. When the feed
 * is unreachable, the CTA and the "other platforms" link both route to
 * the website's install section instead.
 */

import { DownloadOutlined, SelectOutlined } from '@ant-design/icons';
import { isLoopbackBackendUrl } from '@openheaders/core/backends';
import { getCapability } from '@openheaders/core/capabilities';
import { Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useBackends } from '../backend';
import { useBackendSyncStatus } from '../hooks/useBackendSyncStatus';
import { noteFeatureUsed } from '../product-telemetry';
import { DESKTOP_TEASER_COPY, type DesktopFeature } from './features';
import { DESKTOP_DOWNLOAD_URL, type DesktopInstaller, fetchLatestDesktopInstaller } from './update-feed';

export interface DesktopTeaserProps {
  feature: DesktopFeature;
  /** Feature glyph, typically the registry entry's own icon. */
  icon?: React.ReactNode;
}

function openExternal(url: string): void {
  const openUrl = getCapability('openExternalUrl');
  if (openUrl) void openUrl(url);
  else window.open(url, '_blank', 'noopener');
}

/** Download intent — the extension→desktop funnel signal (plan §3, S16). */
function openDownload(url: string): void {
  noteFeatureUsed('desktop-download');
  openExternal(url);
}

const DesktopTeaser: React.FC<DesktopTeaserProps> = ({ feature, icon }) => {
  const { token } = theme.useToken();
  const t = useT();
  const copy = DESKTOP_TEASER_COPY[feature];
  const [installer, setInstaller] = useState<DesktopInstaller | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [launchable, setLaunchable] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Live loopback wire truth — the enabled loopback record's sync slot
  // going green IS "the desktop app is running and connected here".
  // No presence probe: anything short of connected keeps download.
  const backends = useBackends();
  const { snapshot: syncSlots } = useBackendSyncStatus();
  const loopback = backends.find((b) => isLoopbackBackendUrl(b.url));
  const companionReveal = getCapability('companionReveal');
  const companionConnected =
    companionReveal !== undefined &&
    loopback !== undefined &&
    loopback.enabled &&
    syncSlots[loopback.id]?.state === 'green';

  useEffect(() => {
    if (companionConnected) return;
    let alive = true;
    void fetchLatestDesktopInstaller().then((resolved) => {
      if (alive) setInstaller(resolved);
    });
    return () => {
      alive = false;
    };
  }, [companionConnected]);

  // Installed-but-not-connected: the launch gesture needs the NM plane
  // (`desktopLaunch`) AND OS truth that the app is actually installed
  // AND anchored — a dev-layout host runs but refuses every launch, so
  // an unanchored verdict keeps the honest download CTA instead of a
  // button guaranteed to demote on click.
  const desktopLaunch = getCapability('desktopLaunch');
  const launchAvailable = desktopLaunch !== undefined;
  useEffect(() => {
    if (companionConnected || !launchAvailable) return;
    const probe = getCapability('nmHostPresence');
    if (!probe) return;
    let alive = true;
    void probe().then((verdict) => {
      if (alive) setLaunchable(verdict.present && verdict.anchored);
    });
    return () => {
      alive = false;
    };
  }, [companionConnected, launchAvailable]);

  const reveal = async (): Promise<void> => {
    if (!companionReveal) return;
    setRevealing(true);
    // The verdict itself needs no handling here: success is visible
    // (the desktop app fronts), and a dropped wire re-derives this
    // teaser back to the download CTA on the next status emission.
    await companionReveal(feature);
    setRevealing(false);
  };

  const launch = async (): Promise<void> => {
    if (!desktopLaunch) return;
    setLaunching(true);
    const { ok } = await desktopLaunch();
    setLaunching(false);
    // A refused launch (moved install, unanchored host) falls back to
    // the honest download CTA; success needs nothing — the connection
    // landing re-derives this teaser to the reveal state.
    if (!ok) setLaunchable(false);
  };

  return (
    <div
      data-testid="desktop-teaser"
      data-teaser-feature={feature}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '32px 24px',
        textAlign: 'center',
        overflow: 'auto',
      }}
    >
      {icon != null && <div style={{ fontSize: 28, color: token.colorTextQuaternary, lineHeight: 1 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 600, color: token.colorText }}>{t(copy.title)}</div>
      <div style={{ maxWidth: 400, fontSize: 13, lineHeight: 1.6, color: token.colorTextSecondary }}>
        {t(copy.body)}
      </div>
      {companionConnected ? (
        <Button
          type="primary"
          icon={<SelectOutlined />}
          loading={revealing}
          onClick={() => void reveal()}
          data-testid="desktop-teaser-open-app"
          style={{ marginTop: 6 }}
        >
          {t('shared.desktopTeaser.openApp')}
        </Button>
      ) : launchAvailable && launchable ? (
        <Button
          type="primary"
          icon={<SelectOutlined />}
          loading={launching}
          onClick={() => void launch()}
          data-testid="desktop-teaser-launch"
          style={{ marginTop: 6 }}
        >
          {t('shared.desktopTeaser.launchApp')}
        </Button>
      ) : (
        <>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => openDownload(installer?.url ?? DESKTOP_DOWNLOAD_URL)}
            data-testid="desktop-teaser-cta"
            // The Save button's orange (EditorHeader), with the label
            // eased off pure white — full-brightness text on this fill
            // glares on dark themes.
            style={{ marginTop: 6, background: '#f5722d', borderColor: '#f5722d', color: 'rgba(255,255,255,0.85)' }}
          >
            {t('shared.desktopTeaser.cta')}
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => openDownload(DESKTOP_DOWNLOAD_URL)}
            style={{ fontSize: 12, padding: 0, height: 'auto' }}
          >
            {t('shared.desktopTeaser.otherPlatforms')}
          </Button>
        </>
      )}
    </div>
  );
};

export default DesktopTeaser;
