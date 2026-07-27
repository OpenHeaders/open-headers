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
 * app and reveal this feature there. Otherwise it resolves the latest
 * installer for this platform from the update feed's versions manifest
 * (see `update-feed.ts`) and opens it outside the current surface via
 * the `openExternalUrl` capability; hosts without it (the web app)
 * fall back to a plain new tab. When the feed is unreachable, the CTA
 * and the "other platforms" link both route to the website's install
 * section instead.
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

const DesktopTeaser: React.FC<DesktopTeaserProps> = ({ feature, icon }) => {
  const { token } = theme.useToken();
  const t = useT();
  const copy = DESKTOP_TEASER_COPY[feature];
  const [installer, setInstaller] = useState<DesktopInstaller | null>(null);
  const [revealing, setRevealing] = useState(false);

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

  const reveal = async (): Promise<void> => {
    if (!companionReveal) return;
    setRevealing(true);
    // The verdict itself needs no handling here: success is visible
    // (the desktop app fronts), and a dropped wire re-derives this
    // teaser back to the download CTA on the next status emission.
    await companionReveal(feature);
    setRevealing(false);
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
      ) : (
        <>
          <Button
            color="orange"
            variant="solid"
            icon={<DownloadOutlined />}
            onClick={() => openExternal(installer?.url ?? DESKTOP_DOWNLOAD_URL)}
            data-testid="desktop-teaser-cta"
            style={{ marginTop: 6 }}
          >
            {t('shared.desktopTeaser.cta')}
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => openExternal(DESKTOP_DOWNLOAD_URL)}
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
