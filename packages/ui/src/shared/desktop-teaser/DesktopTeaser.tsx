/**
 * DesktopTeaser — the placeholder body for a desktop-only feature on a
 * host that can't run it (extension / web workbench). Centered
 * explainer + a download CTA, so gated tabs and settings categories
 * stay discoverable instead of silently disappearing.
 *
 * The CTA resolves the latest installer for this platform from the
 * update feed's versions manifest (see `update-feed.ts`) and opens it
 * outside the current surface via the `openExternalUrl` capability;
 * hosts without it (the web app) fall back to a plain new tab. When
 * the feed is unreachable, the CTA and the "other platforms" link
 * both route to the website's install section instead.
 */

import { DownloadOutlined } from '@ant-design/icons';
import { Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { getCapability } from '@openheaders/core/capabilities';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DESKTOP_TEASER_COPY, type DesktopFeature } from './features';
import {
  DESKTOP_DOWNLOAD_URL,
  DESKTOP_PLATFORM_LABELS,
  type DesktopInstaller,
  fetchLatestDesktopInstaller,
} from './update-feed';

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
  useEffect(() => {
    let alive = true;
    void fetchLatestDesktopInstaller().then((resolved) => {
      if (alive) setInstaller(resolved);
    });
    return () => {
      alive = false;
    };
  }, []);
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
      <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{t('shared.desktopTeaser.availability')}</div>
      <Button
        type="primary"
        icon={<DownloadOutlined />}
        onClick={() => openExternal(installer?.url ?? DESKTOP_DOWNLOAD_URL)}
        data-testid="desktop-teaser-cta"
        style={{ marginTop: 6 }}
      >
        {t('shared.desktopTeaser.cta')}
      </Button>
      {installer && (
        <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
          {`v${installer.version} · ${DESKTOP_PLATFORM_LABELS[installer.platform]}`}
        </div>
      )}
      <Button
        type="link"
        size="small"
        onClick={() => openExternal(DESKTOP_DOWNLOAD_URL)}
        style={{ fontSize: 12, padding: 0, height: 'auto' }}
      >
        {t('shared.desktopTeaser.otherPlatforms')}
      </Button>
    </div>
  );
};

export default DesktopTeaser;
