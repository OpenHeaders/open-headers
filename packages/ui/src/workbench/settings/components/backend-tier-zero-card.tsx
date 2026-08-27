/**
 * Tier-zero card — the pinned, always-on local engine at the top of the
 * Back-end pane (the multi-backend plan §4). Not a list entry: the
 * extension's service worker / the desktop app's embedded back-end runs
 * regardless of what the connections list holds, and it hosts the home
 * Org. The daemon-side inbound surfaces (bind rows, paired devices) live
 * on the Backend › Server page — they configure this process AS a
 * server, orthogonal to any outbound connection below.
 */

import { TeamOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { Button, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useServerAdminStatus } from '../../components/server-admin/use-server-admin-status';
import { useOpenServerAdmin } from '../../hooks/OpenServerAdminContext';
import type { Host } from '../../../shared/host-vocabulary';
import { tierZeroMode } from '../schema/backend';
import { BackendIcon, backendModeIcon } from './backend-icons';

const HOST_TITLE: Record<Host, MessageKey> = {
  extension: 'workbench.settings.backendPane.tierZero.title.extension',
  desktop: 'workbench.settings.backendPane.tierZero.title.desktop',
  web: 'workbench.settings.backendPane.tierZero.title.web',
};

const HOST_COPY: Record<Host, MessageKey> = {
  extension: 'workbench.settings.backendPane.tierZero.copy.extension',
  desktop: 'workbench.settings.backendPane.tierZero.copy.desktop',
  web: 'workbench.settings.backendPane.tierZero.copy.web',
};

export const BackendTierZeroCard: React.FC<{ host: Host }> = ({ host }) => {
  const { token } = theme.useToken();
  const t = useT();
  // Admin-console CTA — rendered only when the probe says this subject
  // administers the back-end (desktop = its own spine, web = the
  // serving daemon over the wire) AND the shell provides the opener.
  // Pure affordance honesty; the server gates every call regardless.
  const adminStatus = useServerAdminStatus();
  const openServerAdmin = useOpenServerAdmin();

  return (
    <section style={{ marginBottom: 12 }}>
      <div
        className="settings-card"
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
          <span style={{ flex: 'none', display: 'inline-flex' }} aria-hidden>
            <BackendIcon kind={backendModeIcon(tierZeroMode(host))} size={30} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>{t(HOST_TITLE[host])}</span>
              <span
                style={{
                  padding: '0 5px',
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  borderRadius: 999,
                  background: token.colorSuccess,
                  color: token.colorTextLightSolid,
                  lineHeight: '14px',
                }}
              >
                {t('workbench.settings.backendPane.tierZero.alwaysOn')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>{t(HOST_COPY[host])}</div>
          </div>
        </div>
        {adminStatus === 'admin' && openServerAdmin && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText }}>
                {t('workbench.settings.backendPane.tierZero.adminTitle')}
              </div>
              <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                {t('workbench.settings.backendPane.tierZero.adminDescription')}
              </div>
            </div>
            <Button
              size="small"
              icon={<TeamOutlined />}
              onClick={() => openServerAdmin()}
              data-testid="open-daemon-admin"
            >
              {t('workbench.settings.backendPane.tierZero.adminOpen')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
