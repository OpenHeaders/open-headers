/**
 * Sync status reporter (desktop main).
 *
 * Sibling to the extension SW's handshake-status reporter — same `sync`
 * subsystem, opposite vantage point. The extension reports whether IT
 * is talking to a back-end; the desktop reports how many extensions
 * (and same-device vs LAN) are talking to IT.
 *
 * Steady-state classification:
 *   - 0 peers → green "Idle — no extensions connected"
 *   - N peers, all loopback → green "Connected to N extension(s) on this device"
 *   - N peers with one or more LAN → green "Connected to N extension(s) (L on LAN)"
 *
 * "Idle" stays green: the desktop app can be used standalone, so an
 * empty peer set is a healthy steady state — not a degraded one.
 *
 * Reads the current peer list once via `listConnectedPeers()` on attach
 * (so the pill reflects state if the reporter is wired AFTER a peer
 * already connected), then re-reports on every connect/disconnect.
 */

import { report as reportStatus } from '@openheaders/ui/shared/status/store';
import type { OracleWsServer, PeerSummary } from '@openheaders/oracle-host-node/host-runtime/ws-server';

export interface InstallSyncStatusReporterHandle {
  /** Drop the subscription. Idempotent. */
  dispose(): void;
}

export function installSyncStatusReporter(server: OracleWsServer): InstallSyncStatusReporterHandle {
  let disposed = false;

  function emit(peers: readonly PeerSummary[]): void {
    if (disposed) return;
    const total = peers.length;
    const lan = peers.filter((p) => !p.isLoopback).length;
    const message = describe(total, lan);
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message,
      context: { peerCount: total, lanCount: lan, loopbackCount: total - lan },
    });
  }

  // Initial snapshot — covers the case where a peer connected before
  // this reporter attached (e.g. during the WS supervisor's first bind).
  emit(server.listConnectedPeers());

  const unsubscribe = server.subscribePeerChange(() => {
    // The peer-change event is fired AFTER the registry update, so
    // `listConnectedPeers()` reflects the post-event truth.
    emit(server.listConnectedPeers());
  });

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unsubscribe();
    },
  };
}

function describe(total: number, lan: number): string {
  if (total === 0) return 'Idle — no extensions connected';
  if (lan === 0) {
    return total === 1
      ? 'Connected to 1 extension on this device'
      : `Connected to ${total} extensions on this device`;
  }
  if (lan === total) {
    return total === 1
      ? 'Connected to 1 extension on LAN'
      : `Connected to ${total} extensions on LAN`;
  }
  return `Connected to ${total} extension${total === 1 ? '' : 's'} (${lan} on LAN)`;
}
