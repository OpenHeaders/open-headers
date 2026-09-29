/**
 * PeerExecuteDisabledNotice — host-aware rendering of the peer plane's
 * two-tier opt-in refusal. The wire text names the TIER (same-device
 * browsers vs other devices — the `peerExecuteRefusalKind` matcher
 * below is how parents detect it), never whose switch it is; this
 * notice does:
 *
 *   - the LOCAL tier is the desktop app on this machine — with the app
 *     CONNECTED here the primary action hands off through the
 *     `companionReveal` capability, which fronts the app and lands
 *     Settings on the exact opt-in row (`peerExecuteSetting`);
 *   - the REMOTE tier is the place the request was delegated to. The
 *     editing scope's Org says what answered: a standalone server
 *     (`hostKind === 'daemon'`) keeps its switch in Server Admin ›
 *     Server — the served tab opens that domain in place when the
 *     viewer is an admin, every other host offers the server's page
 *     outside; a desktop app on another machine keeps it under its own
 *     Backup and Sync › Your devices, which only that machine can open.
 */

import { SelectOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import { describeOrg } from '@openheaders/core/identity';
import {
  LOCAL_PEER_EXECUTE_DISABLED_MESSAGE,
  REMOTE_PEER_EXECUTE_DISABLED_MESSAGE,
} from '@openheaders/core/protocol';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { desktopAppRecord, useBackends } from '@openheaders/ui/shared/backend';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { useBackendSyncStatus } from '@openheaders/ui/shared/hooks/useBackendSyncStatus';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import { openServerPage, serverPageForOrg } from '../../../shared/workspace-org/server-page';
import { postServerAdminReveal } from '../../data/server-admin-reveal';
import { useEditingScopeOrgId, useWorkspaceServer } from '../../execution-place/useWorkspaceServer';
import { useServerAdminStatus } from '../server-admin/use-server-admin-status';

const { Text } = Typography;

export type PeerExecuteRefusalKind = 'local' | 'remote';

/** Which opt-in tier a failed send's error text names; null for every
 *  other failure — the parents' render gate. */
export function peerExecuteRefusalKind(detail: string | undefined): PeerExecuteRefusalKind | null {
  if (detail === LOCAL_PEER_EXECUTE_DISABLED_MESSAGE) return 'local';
  if (detail === REMOTE_PEER_EXECUTE_DISABLED_MESSAGE) return 'remote';
  return null;
}

const PeerExecuteDisabledNotice: React.FC<{ kind: PeerExecuteRefusalKind }> = ({ kind }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [revealing, setRevealing] = useState(false);

  // Live wire truth — the DesktopTeaser derivation verbatim: the desktop
  // app's record (the place rule), enabled, with a green sync slot IS
  // "the desktop app is running and connected here".
  const backends = useBackends();
  const { snapshot: syncSlots } = useBackendSyncStatus();
  const host = getCurrentHost();
  const desktopApp = desktopAppRecord(host, backends);
  const companionReveal = getCapability('companionReveal');
  const companionConnected =
    companionReveal !== undefined && desktopApp?.enabled === true && syncSlots[desktopApp.id]?.state === 'green';

  // The remote tier's answering place — the editing scope's Org and its
  // server record (the place reader's own seams).
  const snapshot = useIdentitySnapshot();
  const orgId = useEditingScopeOrgId();
  const server = useWorkspaceServer();
  const adminStatus = useServerAdminStatus();
  const descriptor = orgId !== null ? describeOrg(snapshot, orgId) : null;
  const serverAnswered = kind === 'remote' && descriptor?.hostKind === 'daemon';
  const place = server?.name ?? descriptor?.name ?? t('shared.executionPlace.role.server');
  const serverPage = serverAnswered && host !== 'web' && orgId !== null ? serverPageForOrg(orgId) : null;

  const reveal = async (): Promise<void> => {
    if (!companionReveal) return;
    setRevealing(true);
    // Success is visible (the desktop app fronts on the opt-in row);
    // a dropped wire resolves `ok: false` and the button simply stays.
    await companionReveal('peerExecuteSetting');
    setRevealing(false);
  };

  const sentence =
    kind === 'local'
      ? t('shared.peerExecute.localDisabled')
      : serverAnswered
        ? t('shared.peerExecute.serverDisabled', { place })
        : t('shared.peerExecute.remoteDisabled');

  return (
    <div
      data-testid="peer-execute-disabled-notice"
      data-place={kind === 'local' ? 'desktop-app' : serverAnswered ? 'server' : 'remote-desktop-app'}
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
        <Text style={{ fontSize: 12, color: token.colorErrorText }}>{sentence}</Text>
      </div>
      {kind === 'local' && companionConnected && (
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
      {serverAnswered && host === 'web' && adminStatus === 'admin' && (
        <Button
          type="primary"
          size="small"
          icon={<SelectOutlined />}
          onClick={() => postServerAdminReveal('server')}
          data-testid="peer-execute-open-server-admin"
        >
          {t('shared.peerExecute.openServerAdmin')}
        </Button>
      )}
      {serverPage !== null && (
        <Button
          size="small"
          icon={<SelectOutlined />}
          onClick={() => openServerPage(serverPage)}
          data-testid="peer-execute-open-place"
        >
          {t('shared.peerExecute.openPlace', { place })}
        </Button>
      )}
    </div>
  );
};

export default PeerExecuteDisabledNotice;
