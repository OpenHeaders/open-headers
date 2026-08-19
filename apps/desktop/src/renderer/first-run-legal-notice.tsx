/**
 * First-run legal notice — the in-app successor to the installer's
 * NSIS license page. Browsers set the pattern: the installer never
 * fronts legal text; the product's first run carries a "by continuing
 * you agree" line with links to the published documents. Desktop-only
 * (this module lives in the host shell, not `@openheaders/ui`) — the
 * extension's legal surface is its store listing, and the web-served
 * workbench rides the daemon operator's acceptance.
 *
 * Non-blocking by design: a slim bar above the workbench, not a modal
 * gate. "Got it" flips `legal.firstRunAcknowledged` in the user
 * settings scope (schema in `@openheaders/ui` settings, hidden from
 * the settings shell), so the bar never returns.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSetting, useSettingsReady } from '@openheaders/ui/workbench/settings';
import { Button, Typography, theme } from 'antd';
import type { ReactNode } from 'react';

const EULA_URL = 'https://openheaders.com/eula';
const PRIVACY_URL = 'https://openheaders.com/privacy';

export function FirstRunLegalNotice(): ReactNode {
  const ready = useSettingsReady();
  const [acknowledged, setAcknowledged] = useSetting('legal.firstRunAcknowledged');
  const t = useT();
  const { token } = theme.useToken();
  // Render nothing until the persisted value hydrates — the bar must
  // not flash for users who already acknowledged. Packaged builds only:
  // the notice replaces the INSTALLER's license page, so dev runs and
  // e2e harnesses (fresh userData every run) never see it.
  if (!window.oh.startupData.isPackaged || !ready || acknowledged) return null;
  return (
    <div
      data-testid="first-run-legal-notice"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        maxWidth: 760,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <Typography.Text style={{ fontSize: 12 }}>{t('desktop.firstRunLegal.message')}</Typography.Text>
      <Typography.Link
        style={{ fontSize: 12, whiteSpace: 'nowrap' }}
        onClick={() => void window.oh.openExternal(EULA_URL)}
      >
        {t('desktop.firstRunLegal.license')}
      </Typography.Link>
      <Typography.Link
        style={{ fontSize: 12, whiteSpace: 'nowrap' }}
        onClick={() => void window.oh.openExternal(PRIVACY_URL)}
      >
        {t('desktop.firstRunLegal.privacy')}
      </Typography.Link>
      <Button
        data-testid="first-run-legal-acknowledge"
        size="small"
        type="primary"
        onClick={() => setAcknowledged(true)}
      >
        {t('desktop.firstRunLegal.acknowledge')}
      </Button>
    </div>
  );
}
