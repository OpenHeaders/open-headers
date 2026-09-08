/**
 * The served tab's one "Synced with" row (the Backup and Sync UX plan
 * §5.2, the web arm). A web tab has exactly one back-end by
 * construction — the daemon that served it — and no registry record to
 * list, so this row is synthesised: the place is the workspace group the
 * server provides (its name is the server's), the state is the one
 * wire's slot, the second line says who is signed in, and the ⋯ carries
 * Administer for the subject the probe admits. Nothing here can add,
 * edit or remove a connection: the tab holds no client plane to point
 * anywhere else.
 */

import { MoreOutlined } from '@ant-design/icons';
import { orgCatalogue } from '@openheaders/core/identity';
import { Button, Dropdown, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useBackendSyncStatus } from '../../../shared/hooks/useBackendSyncStatus';
import { useIdentitySnapshot } from '../../../shared/hooks/useIdentitySnapshot';
import { useServerAdminIdentity } from '../../components/server-admin/use-server-admin-status';
import { BackendIcon } from './backend-icons';
import { BackendRowStatusDot } from './backend-row-status-dot';
import { BACKEND_ROW_STATUS_LABEL, slotStatus } from './use-backend-row-status';

export const BackendServedRow: React.FC<{ administer: (() => void) | null }> = ({ administer }) => {
  const { token } = theme.useToken();
  const t = useT();
  const snapshot = useIdentitySnapshot();
  const identity = useServerAdminIdentity();
  const { snapshot: slots } = useBackendSyncStatus();

  // One wire, one slot — whichever id the host filed it under.
  const slot = Object.values(slots)[0];
  const status = slotStatus(slot);
  const server = useMemo(() => orgCatalogue(snapshot).find((descriptor) => !descriptor.isHome) ?? null, [snapshot]);
  const place = server?.name ?? window.location.hostname;

  const signedIn =
    identity === null
      ? null
      : identity.email !== null
        ? t('web.access.signedInAsWithEmail', { name: identity.displayName, email: identity.email })
        : t('web.access.signedInAs', { name: identity.displayName });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
      }}
    >
      <BackendRowStatusDot status={status} detail={slot?.message ?? null} />
      <span style={{ flex: 'none', display: 'inline-flex' }} aria-hidden>
        <BackendIcon kind="vm" size={24} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: token.colorText,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {place}
          </span>
          <span style={{ fontSize: 11, color: token.colorTextSecondary, whiteSpace: 'nowrap' }}>
            {t(BACKEND_ROW_STATUS_LABEL[status])}
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: token.colorTextTertiary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {signedIn ? `${signedIn} · ${window.location.host}` : window.location.host}
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
            data-testid="synced-row-menu"
            aria-label={t('workbench.settings.backendPane.rowMenuAria', { label: place })}
          />
        </Dropdown>
      )}
    </div>
  );
};
