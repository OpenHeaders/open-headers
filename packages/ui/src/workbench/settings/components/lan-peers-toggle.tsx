/**
 * LAN-peers toggle — custom editor for `backend.bindAddress` (Phase U3.1
 * per `UNIFIED_ORACLE_MODEL.md` §4.2 + `DATA_PLANE_TOPOLOGIES.md` §11.4).
 *
 * The persisted setting is the literal bind address string so future
 * deliverables (interface-specific binds, IPv6) extend the enum without
 * remodeling. The affordance is a single Switch because users think
 * "allow LAN peers? yes/no", not "pick a bind address." A confirmation
 * Modal fires on first opt-in to surface the LAN-exposure tradeoff;
 * flipping it on reveals the "Known devices" section (token generation
 * + device pairing) in the same pane.
 *
 * The auth-required handshake flip is already wired in U2.3: ws-server
 * inspects `LOOPBACK_BINDS` on its current bind and passes the resulting
 * `requireAuth` flag into `evaluateHello`. This editor only writes the
 * persisted bind address; the rebind-in-place glue lives in
 * `apps/desktop/src/main/install-rpc-host.ts` so non-desktop hosts that
 * happen to load this editor (search results, screenshots) never touch
 * a socket.
 */

import { App as AntApp, Modal, Switch, Typography } from 'antd';
import { useState } from 'react';
import type React from 'react';
import type { BackendBindAddress } from '../schema/backend';
import { useSetting } from '../hooks';
import FieldRow from '../fields/FieldRow';
import type { SettingDef } from '../types';

const LOOPBACK: BackendBindAddress = '127.0.0.1';
const ALL_INTERFACES: BackendBindAddress = '0.0.0.0';

const LanPeersToggleEditor: React.FC<{ def: SettingDef }> = ({ def }) => {
  const { modal } = AntApp.useApp();
  const [value, setValue] = useSetting('backend.bindAddress');
  const [pending, setPending] = useState(false);

  const enabled = value === ALL_INTERFACES;

  function flipTo(next: BackendBindAddress): void {
    if (next === value) return;
    setValue(next);
  }

  function handleChange(nextEnabled: boolean): void {
    if (!nextEnabled) {
      flipTo(LOOPBACK);
      return;
    }
    setPending(true);
    modal.confirm({
      title: 'Allow LAN peers?',
      okText: 'Allow LAN peers',
      cancelText: 'Keep loopback only',
      okButtonProps: { danger: true },
      width: 480,
      content: (
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          The desktop daemon will bind every local network interface so other
          devices on your network can connect. Connections from non-loopback
          peers are rejected until you issue an auth token from the "Known
          devices" section below and they paste it into their Settings →
          Backend → Daemon auth token. Clients on this machine (loopback) stay
          trust-by-process and need no token.
        </Typography.Paragraph>
      ),
      onOk: () => {
        flipTo(ALL_INTERFACES);
        setPending(false);
      },
      onCancel: () => {
        setPending(false);
      },
    });
  }

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
    >
      <Switch checked={enabled} loading={pending} onChange={handleChange} />
    </FieldRow>
  );
};

export default LanPeersToggleEditor;
