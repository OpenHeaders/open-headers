/**
 * Trusted certificates row — custom editor for `requests.trustedRoots`
 * on the API Requests › TLS section: the global door to the
 * workspace's trusted-certificate list, showing the same face as the
 * per-request Settings TLS rows through the shared
 * {@link TrustedRootsPicker} (canonical count, unsaved suffix,
 * read-only list, manage link into the editor). A readout, not a
 * value — nothing to reset. On a non-node host the picker is disabled
 * and the honest caption states that the browser dials with its own
 * trust store.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Typography } from 'antd';
import type React from 'react';
import TrustedRootsPicker, { isNodeRequestRuntime } from '../../components/trusted-roots/TrustedRootsPicker';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

const { Text } = Typography;

const TrustedRootsRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
  const label = resolveLabel(def, t);
  const nodeHost = isNodeRequestRuntime();
  return (
    <FieldRow settingKey={def.key} label={label} description={resolveDescription(def, t)} resettable={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <TrustedRootsPicker ariaLabel={label} testId="settings-trusted-roots" />
        {!nodeHost && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.trustedRoots.settings.browserNote')}
          </Text>
        )}
      </div>
    </FieldRow>
  );
};

export default TrustedRootsRow;
