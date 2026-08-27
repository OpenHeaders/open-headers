/**
 * This device's trusted certificates — custom editor for
 * `requests.deviceTrust` on API Requests › TLS: the certificates THIS
 * machine pins beside the workspace list (the Trusted Roots plan,
 * device scope). Self-signed localhost, a staging box — host posture,
 * never synced, never exported. Pins are usually minted from a real
 * dial (the response surface's trust gesture); pasting one by hand
 * works too, and a self-signed leaf is welcome here. Remove only —
 * a pin has no name to edit worth a rename. Absent on browser hosts
 * (the runtime cannot apply trust material there).
 */

import { PlusOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  addDeviceTrustedCertificate,
  isNodeRequestRuntime,
  removeDeviceTrustedCertificate,
  useDeviceTrust,
} from '@openheaders/ui/shared/device-trust';
import { App, Button, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import AddTrustedRootPanel from '../../components/trusted-roots/AddTrustedRootPanel';
import CertificateTable from '../../components/trusted-roots/CertificateTable';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

const { Text } = Typography;

const DeviceTrustRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const nodeHost = isNodeRequestRuntime();
  const { certificates } = useDeviceTrust();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleAdd = useCallback(
    async (input: { name: string; certPem: string }) => {
      setBusy(true);
      const result = await addDeviceTrustedCertificate(input);
      setBusy(false);
      if (!result.ok) {
        message.error(t('workbench.trustedRoots.saveFailedDetail', { message: result.error }));
        return;
      }
      setAdding(false);
    },
    [message, t],
  );

  const handleRemove = useCallback(
    async (uid: string) => {
      const result = await removeDeviceTrustedCertificate(uid);
      if (!result.ok && result.error !== undefined) {
        message.error(t('workbench.trustedRoots.saveFailedDetail', { message: result.error }));
      }
    },
    [message, t],
  );

  return (
    <FieldRow
      settingKey={def.key}
      label={resolveLabel(def, t)}
      description={resolveDescription(def, t)}
      resettable={false}
      block
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
            {t('workbench.trustedRoots.device.count', { count: certificates.length })}
          </Text>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setAdding(true)}
            disabled={adding || !nodeHost}
            data-testid="device-trust-add"
          >
            {t('workbench.trustedRoots.add')}
          </Button>
        </div>
        <CertificateTable
          certificates={certificates}
          emptyTitle={t('workbench.trustedRoots.device.empty')}
          emptyHint={t('workbench.trustedRoots.device.emptyHint')}
          onRemove={nodeHost ? (uid) => void handleRemove(uid) : undefined}
          testId="device-trust"
        />
        {adding && (
          <AddTrustedRootPanel
            onAdd={(input) => void handleAdd(input)}
            onCancel={() => setAdding(false)}
            requireCa={false}
            busy={busy}
          />
        )}
        {!nodeHost && (
          <Text type="secondary" style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {t('workbench.trustedRoots.settings.browserNote')}
          </Text>
        )}
      </div>
    </FieldRow>
  );
};

export default DeviceTrustRow;
