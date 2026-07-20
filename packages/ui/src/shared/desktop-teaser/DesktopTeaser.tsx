/**
 * DesktopTeaser — the placeholder body for a desktop-only feature on a
 * host that can't run it (extension / web workbench). Centered
 * explainer + a download CTA, so gated tabs and settings categories
 * stay discoverable instead of silently disappearing.
 *
 * The CTA opens the website's desktop install section outside the
 * current surface via the `openExternalUrl` capability; hosts without
 * it (the web app) fall back to a plain new tab.
 */

import { DownloadOutlined } from '@ant-design/icons';
import { Button, theme } from 'antd';
import type React from 'react';
import { getCapability } from '@openheaders/core/capabilities';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DESKTOP_DOWNLOAD_URL, DESKTOP_TEASER_COPY, type DesktopFeature } from './features';

export interface DesktopTeaserProps {
  feature: DesktopFeature;
  /** Feature glyph, typically the registry entry's own icon. */
  icon?: React.ReactNode;
}

function openDownloadPage(): void {
  const openUrl = getCapability('openExternalUrl');
  if (openUrl) void openUrl(DESKTOP_DOWNLOAD_URL);
  else window.open(DESKTOP_DOWNLOAD_URL, '_blank', 'noopener');
}

const DesktopTeaser: React.FC<DesktopTeaserProps> = ({ feature, icon }) => {
  const { token } = theme.useToken();
  const t = useT();
  const copy = DESKTOP_TEASER_COPY[feature];
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
        onClick={openDownloadPage}
        data-testid="desktop-teaser-cta"
        style={{ marginTop: 6 }}
      >
        {t('shared.desktopTeaser.cta')}
      </Button>
    </div>
  );
};

export default DesktopTeaser;
