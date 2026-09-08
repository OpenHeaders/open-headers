/**
 * Tier-zero card — band 1 of the Sync page (the Backup and Sync UX plan
 * §5.2): the always-on place your workspaces live, pinned above the
 * "Synced with" rows and never a list entry. Two lines per host —
 * "This browser" / "This computer" / "This server" over one sentence
 * that names the places below as the only way anything leaves. The
 * daemon-side inbound surfaces (bind rows, paired devices) live on
 * Backup and Sync › Your devices — they configure this process AS a
 * server, orthogonal to any outbound connection below.
 *
 * `administer` is the card's one action, on its ⋯: the desktop app's
 * own spine is the server on that host, so the console opens from
 * here; the web host's serving daemon is the band-2 row instead.
 */

import { ArrowRightOutlined, MoreOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Dropdown, Typography, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useOptionalInspectorNav } from '../../hooks/useInspectorNav';
import type { Host } from '../../../shared/host-vocabulary';
import { tierZeroMode } from '../schema/backend';
import { BackendIcon, backendModeIcon } from './backend-icons';
import { useOptionalSettingsHost } from './settings-host-context';

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

export const BackendTierZeroCard: React.FC<{ host: Host; administer: (() => void) | null }> = ({
  host,
  administer,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const title = t(HOST_TITLE[host]);

  return (
    <section style={{ marginBottom: 14 }}>
      <div
        className="settings-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
        }}
      >
        <span style={{ flex: 'none', display: 'inline-flex' }} aria-hidden>
          <BackendIcon kind={backendModeIcon(tierZeroMode(host))} size={30} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>{title}</span>
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
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
            {t(HOST_COPY[host])} <DocsLink />
          </div>
        </div>
        {administer && (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'administer',
                  label: (
                    <span data-testid="open-daemon-admin">{t('workbench.settings.backendPane.tierZero.administer')}</span>
                  ),
                  onClick: administer,
                },
              ],
            }}
          >
            <Button
              size="small"
              type="text"
              icon={<MoreOutlined />}
              aria-label={t('workbench.settings.backendPane.rowMenuAria', { label: title })}
            />
          </Dropdown>
        )}
      </div>
    </section>
  );
};

/**
 * "Learn more" — the docs paradigm section, where the topology diagrams
 * live. When the inspector-nav provider isn't mounted (settings opened
 * from a surface that doesn't host the docs panel), the link silently
 * hides. A modal host is dismissed on click — the docs open behind it.
 */
const DocsLink: React.FC = () => {
  const t = useT();
  const nav = useOptionalInspectorNav();
  const host = useOptionalSettingsHost();
  if (!nav) return null;
  return (
    <Typography.Link
      onClick={(e) => {
        e.preventDefault();
        nav.openDocs('paradigm');
        host?.close();
      }}
      style={{ fontSize: 12, whiteSpace: 'nowrap' }}
    >
      {t('workbench.settings.backendPane.learnMore')} <ArrowRightOutlined style={{ fontSize: 10 }} />
    </Typography.Link>
  );
};
