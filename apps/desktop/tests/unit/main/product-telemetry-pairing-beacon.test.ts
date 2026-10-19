/**
 * Peer usage observer → product-telemetry mapping (S35): the desktop
 * shell installs the spine's process-wide peer observer and maps an
 * extension passing the HELLO gate onto the `extension-paired` feature
 * signal; every other peer role maps to nothing.
 */

import type { TelemetryEvent } from '@openheaders/core/telemetry';
import { notifyPeerConnected, setPeerUsageObserver } from '@openheaders/oracle-host-node/daemon';
import type { PeerSummary } from '@openheaders/oracle-host-node/host-runtime/ws-server';
import { afterEach, describe, expect, it } from 'vitest';
import { installProductTelemetryPairingBeacon } from '../../../src/main/product-telemetry-pairing-beacon';

afterEach(() => {
  setPeerUsageObserver(null);
});

const peer = (role: string): PeerSummary => ({
  peerId: 'peer-1',
  role,
  agent: `@openheaders/${role}@2026.10.0`,
  workspaceId: 'ws-a',
  nodeId: `${role}-node`,
  installId: null,
  tokenId: null,
  userId: null,
  isLoopback: true,
});

describe('installProductTelemetryPairingBeacon', () => {
  it('maps an accepted extension HELLO onto the extension-paired feature signal', () => {
    const events: TelemetryEvent[] = [];
    installProductTelemetryPairingBeacon((event) => events.push(event));
    notifyPeerConnected(peer('extension'));
    expect(events).toEqual([{ name: 'feature_used', feature: 'extension-paired' }]);
  });

  it('maps nothing for any other peer role — a CLI, a web client or another desktop is not the pairing', () => {
    const events: TelemetryEvent[] = [];
    installProductTelemetryPairingBeacon((event) => events.push(event));
    for (const role of ['cli', 'web', 'desktop', 'daemon']) notifyPeerConnected(peer(role));
    expect(events).toEqual([]);
  });

  it('reports nothing once the observer is cleared — the standalone-daemon posture', () => {
    const events: TelemetryEvent[] = [];
    installProductTelemetryPairingBeacon((event) => events.push(event));
    setPeerUsageObserver(null);
    notifyPeerConnected(peer('extension'));
    expect(events).toEqual([]);
  });
});
