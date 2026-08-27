/**
 * The operating system's trust store — custom editor for
 * `requests.systemTrust` on API Requests › TLS (the Trusted Roots
 * plan, S9): one switch that lets the app's runtime also trust the
 * certificates this machine's OS store holds (the corporate root an
 * IT profile installed), additively beside the built-in roots, the
 * workspace list and the device pins. Device posture like the pins
 * above — never synced or exported — and read from the runtime at
 * dial time, so the caption names what it sees now. Disabled with an
 * honest caption on a runtime that cannot read the store (a browser
 * host, or Node before 22.15).
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { isNodeRequestRuntime, setSystemTrustEnabled, useDeviceTrust } from '@openheaders/ui/shared/device-trust';
import { App, Switch, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

const { Text } = Typography;

const SystemTrustRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const nodeHost = isNodeRequestRuntime();
  const { systemTrust, ready } = useDeviceTrust();
  const [pending, setPending] = useState(false);

  const handleChange = useCallback(
    async (enabled: boolean) => {
      setPending(true);
      const result = await setSystemTrustEnabled(enabled);
      setPending(false);
      if (!result.ok && result.error !== undefined) {
        message.error(t('workbench.trustedRoots.saveFailedDetail', { message: result.error }));
      }
    },
    [message, t],
  );

  const caption = !nodeHost
    ? t('workbench.trustedRoots.systemTrust.browser')
    : !systemTrust.supported
      ? t('workbench.trustedRoots.systemTrust.unsupported')
      : systemTrust.enabled
        ? t('workbench.trustedRoots.systemTrust.count', { count: systemTrust.count })
        : t('workbench.trustedRoots.systemTrust.off');

  return (
    <FieldRow
      settingKey={def.key}
      label={resolveLabel(def, t)}
      description={resolveDescription(def, t)}
      resettable={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Switch
          checked={systemTrust.enabled}
          loading={pending || (nodeHost && !ready)}
          disabled={!nodeHost || !systemTrust.supported}
          onChange={(enabled) => void handleChange(enabled)}
          data-testid="system-trust-switch"
        />
        <Text
          type="secondary"
          style={{ fontSize: 11, color: token.colorTextTertiary }}
          data-testid="system-trust-caption"
        >
          {caption}
        </Text>
      </div>
    </FieldRow>
  );
};

export default SystemTrustRow;
