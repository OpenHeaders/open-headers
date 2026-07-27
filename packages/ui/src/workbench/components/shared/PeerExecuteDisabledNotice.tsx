/**
 * PeerExecuteDisabledNotice — host-aware rendering of the peer plane's
 * opt-in refusal (`PEER_EXECUTE_DISABLED_MESSAGE`). The wire text says
 * "Settings → Backend" without naming WHOSE settings; this notice does:
 * the copy branches on what the enabled companion IS (the loopback
 * desktop app vs a LAN/remote server), and with the desktop app
 * CONNECTED on this machine the primary action hands off — the
 * `companionReveal` capability fronts the app and lands Settings on the
 * exact opt-in row (`peerExecuteSetting` target). The desktop's reveal
 * plane enforces the same-device law wire-side: only a loopback peer
 * may front the window, so a LAN server posture never grows a button
 * (the DesktopTeaser gating recipe, applied to a refusal surface).
 */

import { SelectOutlined } from '@ant-design/icons';
import { isLoopbackBackendUrl } from '@openheaders/core/backends';
import { getCapability } from '@openheaders/core/capabilities';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useBackends } from '@openheaders/ui/shared/backend';
import { useBackendSyncStatus } from '@openheaders/ui/shared/hooks/useBackendSyncStatus';

const { Text } = Typography;

const PeerExecuteDisabledNotice: React.FC = () => {
  const { token } = theme.useToken();
  const t = useT();
  const [revealing, setRevealing] = useState(false);

  // Live loopback wire truth — the DesktopTeaser derivation verbatim:
  // an enabled loopback record with a green sync slot IS "the desktop
  // app is running and connected here".
  const backends = useBackends();
  const { snapshot: syncSlots } = useBackendSyncStatus();
  const loopback = backends.find((b) => isLoopbackBackendUrl(b.url));
  const companionReveal = getCapability('companionReveal');
  const desktopCompanion = loopback?.enabled === true;
  const companionConnected =
    companionReveal !== undefined && desktopCompanion && syncSlots[loopback.id]?.state === 'green';

  const reveal = async (): Promise<void> => {
    if (!companionReveal) return;
    setRevealing(true);
    // Success is visible (the desktop app fronts on the opt-in row);
    // a dropped wire resolves `ok: false` and the button simply stays.
    await companionReveal('peerExecuteSetting');
    setRevealing(false);
  };

  return (
    <div
      data-testid="peer-execute-disabled-notice"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
    >
      <div
        style={{
          maxWidth: 520,
          padding: '6px 14px',
          borderRadius: 6,
          background: token.colorErrorBg,
          border: `1px solid ${token.colorErrorBorder}`,
        }}
      >
        <Text style={{ fontSize: 12, color: token.colorErrorText }}>
          {desktopCompanion ? t('shared.peerExecute.disabledDesktop') : t('shared.peerExecute.disabledServer')}
        </Text>
      </div>
      {companionConnected && (
        <Button
          type="primary"
          size="small"
          icon={<SelectOutlined />}
          loading={revealing}
          onClick={() => void reveal()}
          data-testid="peer-execute-enable-cta"
        >
          {t('shared.peerExecute.enableCta')}
        </Button>
      )}
    </div>
  );
};

export default PeerExecuteDisabledNotice;
