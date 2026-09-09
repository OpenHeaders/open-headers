/**
 * "Connect desktop app" — the Sync page's one-click verb (the Backup and
 * Sync UX plan §5.4). A fresh loopback record, the native-messaging
 * handoff for its credential (the observability plan Phase 7 — the
 * daemon verifies this browser from OS truth and answers with a token),
 * then the probe-gated enable: on success nothing else shows but the
 * enable's own "Connecting to …" overlay. The wizard is the fallback —
 * a refused or unreachable handoff, or a host without the NM plane,
 * opens it on the same record with the pairing-code / token path.
 *
 * The record stays when the enable itself aborts after a granted token
 * (the probe already said why): it is paired, and the row's Connect
 * retries the gate.
 */

import { createBackend, updateBackend } from '@openheaders/core/backends';
import { getCapability } from '@openheaders/core/capabilities';
import { useState } from 'react';
import type { BackendWizardTarget } from './backend-wizard';
import type { BackendEnableSwitchHandle } from './use-backend-enable-switch';
import { useBackendRegistryWrite } from './use-backend-registry-write';

export interface ConnectDesktopAppHandle {
  connect: () => Promise<void>;
  /** The handoff is in flight — the verb disables meanwhile. */
  busy: boolean;
  /** The fresh record while the handoff runs — the list keeps it off screen until it is paired or the wizard has it. */
  pendingRecordId: string | null;
}

export function useConnectDesktopApp(
  enableSwitch: BackendEnableSwitchHandle,
  openWizard: (target: BackendWizardTarget) => void,
): ConnectDesktopAppHandle {
  const write = useBackendRegistryWrite();
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);

  const connect = async (): Promise<void> => {
    // A host that cannot store the record refuses here; nothing opens on
    // a record that was never created.
    const created = await write(() => createBackend());
    if (!created) return;
    const autoPair = getCapability('nmAutoPair');
    if (!autoPair) {
      openWizard({ recordId: created.id, mode: 'add', kind: 'desktop-app' });
      return;
    }
    setPendingRecordId(created.id);
    const result = await autoPair({ url: created.url });
    if (!result.ok) {
      // The wizard takes the record over in the same render the pending
      // mark clears, so the row never shows between the two.
      openWizard({ recordId: created.id, mode: 'add', kind: 'desktop-app', autoPairFailed: true });
      setPendingRecordId(null);
      return;
    }
    const paired = await write(() => updateBackend(created.id, { authToken: result.token }));
    setPendingRecordId(null);
    if (paired) await enableSwitch.setEnabled(paired, true);
  };

  return { connect, busy: pendingRecordId !== null, pendingRecordId };
}
