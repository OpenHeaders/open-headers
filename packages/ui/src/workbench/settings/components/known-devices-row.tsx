/**
 * Known devices row — custom editor for `backend.knownDevices` on the
 * Backend › Server page. Hosts the daemon token ledger
 * (`BackendTokensLedger`) as one block row; the SSO sessions block, when
 * present, gets a sub-heading in the row-label style.
 */

import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';
import { BackendTokensLedger } from './backend-tokens-section';

const KnownDevicesRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <FieldRow
      settingKey={def.key}
      label={resolveLabel(def, t)}
      description={resolveDescription(def, t)}
      resettable={false}
      block
    >
      <BackendTokensLedger
        sessionsHeading={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 6px' }}>
            <span
              style={{ fontSize: 13, color: token.colorText, flex: 'none' }}
              title={t('workbench.settings.backendTokens.ssoBlurb')}
            >
              {t('workbench.settings.backendTokens.ssoTitle')}
            </span>
            <div style={{ flex: 1, height: 1, background: token.colorBorderSecondary }} />
          </div>
        }
      />
    </FieldRow>
  );
};

export default KnownDevicesRow;
