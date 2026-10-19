/**
 * Peer usage observer → product-telemetry mapping (the telemetry plan
 * §3, S35): the desktop shell installs the spine's process-wide peer
 * observer and maps one policy-free signal onto a typed event — a
 * browser extension passing the HELLO gate against this host's
 * WebSocket server is the `extension-paired` feature in use ("this
 * desktop is paired with the extension"). The controller's daily
 * re-armed latch keeps it to once per session per UTC day; every other
 * peer role (another desktop, a CLI, a web client) maps to nothing.
 */

import { HANDSHAKE_ROLES } from '@openheaders/core/protocol';
import type { TelemetryEvent } from '@openheaders/core/telemetry';
import { setPeerUsageObserver } from '@openheaders/oracle-host-node/daemon';

export function installProductTelemetryPairingBeacon(track: (event: TelemetryEvent) => void): void {
  setPeerUsageObserver({
    peerConnected: (peer) => {
      if (peer.role === HANDSHAKE_ROLES.EXTENSION) track({ name: 'feature_used', feature: 'extension-paired' });
    },
  });
}
