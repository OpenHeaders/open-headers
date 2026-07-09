/**
 * Sync status reporter (Node host).
 *
 * Pins the reporter's two-input state machine — bind lifecycle folded
 * with the active server's peer set — against an injected in-memory
 * status store (a last-report-per-subsystem map, matching the host
 * store's overwrite semantics). No sockets: a typed in-memory fake
 * server stands in for the `OracleWsServer`, so we can drive peer
 * changes deterministically.
 *
 * Covered:
 *   - bind lifecycle → status colour (binding/restarting → yellow,
 *     failed → red and overriding, bound → green)
 *   - the `describe()` peer classification across loopback / LAN / mixed
 *   - peer-change re-emission, detach, and dispose semantics
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { SpineStatusReport } from '../../../src/daemon/status-seam';
import { installSyncStatusReporter as installReporter } from '../../../src/daemon/sync-status-reporter';
import type { OracleWsServer, PeerChangeListener, PeerSummary } from '../../../src/host-runtime/ws-server';

const snapshot = new Map<string, SpineStatusReport>();

function installSyncStatusReporter() {
  return installReporter((input) => {
    snapshot.set(input.subsystem, input);
  });
}

interface FakeServer extends OracleWsServer {
  /** Replace the connected-peer set and fire every peer-change listener. */
  setPeers(peers: PeerSummary[]): void;
}

function makeFakeServer(initial: PeerSummary[] = []): FakeServer {
  let peers = initial;
  const listeners = new Set<PeerChangeListener>();
  return {
    broadcast() {},
    broadcastFrame() {},
    connectedCount() {
      return peers.length;
    },
    connectedTokenIds() {
      return new Set<string>();
    },
    closePeersByTokenId() {
      return 0;
    },
    listConnectedPeers() {
      return peers;
    },
    subscribePeerChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async close() {},
    setPeers(next) {
      peers = next;
      // The reporter ignores the event payload and re-reads
      // listConnectedPeers(), so a synthetic event is enough.
      for (const listener of listeners) {
        listener({ kind: 'connect', peer: next[0] ?? loopbackPeer(0) });
      }
    },
  };
}

function loopbackPeer(i: number): PeerSummary {
  return {
    peerId: `peer-${i}`,
    role: 'extension',
    agent: '@openheaders/extension@5.0.0',
    workspaceId: 'ws-1',
    nodeId: `node-${i}`,
    tokenId: null,
    isLoopback: true,
  };
}

function lanPeer(i: number): PeerSummary {
  return { ...loopbackPeer(i), peerId: `lan-peer-${i}`, tokenId: `tok-${i}`, isLoopback: false };
}

/** A Node bind error whose `code` is `EADDRINUSE` — the actionable case. */
function addrInUseError(): Error {
  return Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
}

function syncEntry() {
  return snapshot.get('sync');
}

beforeEach(() => {
  snapshot.clear();
});

describe('sync-status-reporter — bind lifecycle', () => {
  it('reports transient yellow while the initial bind is in flight', () => {
    const reporter = installSyncStatusReporter();
    reporter.setBindState({ kind: 'binding', host: '127.0.0.1', port: 8137 });

    const entry = syncEntry();
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toBe('Starting extension pipe…');
    expect(entry?.context).toMatchObject({ bindHost: '127.0.0.1', bindPort: 8137 });
  });

  it('reports red and overrides peer state when the bind fails', () => {
    const reporter = installSyncStatusReporter();
    const server = makeFakeServer([loopbackPeer(0), loopbackPeer(1)]);
    reporter.attachServer(server);
    expect(syncEntry()?.state).toBe('green');

    reporter.setBindState({ kind: 'failed', host: '0.0.0.0', port: 8137, error: addrInUseError() });

    const entry = syncEntry();
    expect(entry?.state).toBe('red');
    expect(entry?.message).toBe(
      'Extension pipe offline — port 8137 is already in use. Change it in Settings → Backend.',
    );
    expect(entry?.context).toMatchObject({ bindHost: '0.0.0.0', bindPort: 8137 });
  });

  it('falls back to the generic bind-failed message for a non-EADDRINUSE cause', () => {
    const reporter = installSyncStatusReporter();
    reporter.setBindState({ kind: 'failed', host: '0.0.0.0', port: 9000, error: new Error('EACCES') });

    const entry = syncEntry();
    expect(entry?.state).toBe('red');
    expect(entry?.message).toBe(
      "Extension pipe offline — couldn't bind 0.0.0.0:9000. Change it in Settings → Backend.",
    );
    expect(entry?.context).toMatchObject({ bindHost: '0.0.0.0', bindPort: 9000, error: 'EACCES' });
  });

  it('stringifies a non-Error bind failure cause', () => {
    const reporter = installSyncStatusReporter();
    reporter.setBindState({ kind: 'failed', host: '127.0.0.1', port: 8137, error: 'boom' });
    expect(syncEntry()?.context).toMatchObject({ error: 'boom' });
  });

  it('shows "restarting" yellow when the server detaches mid-rebind', () => {
    const reporter = installSyncStatusReporter();
    reporter.setBindState({ kind: 'bound', host: '127.0.0.1', port: 8137 });
    reporter.attachServer(makeFakeServer());
    expect(syncEntry()?.state).toBe('green');

    reporter.detachServer();

    const entry = syncEntry();
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toBe('Extension pipe restarting…');
  });

  it('recovers from a failed bind when a later attempt binds and attaches', () => {
    const reporter = installSyncStatusReporter();
    reporter.setBindState({ kind: 'failed', host: '0.0.0.0', port: 8137, error: addrInUseError() });
    expect(syncEntry()?.state).toBe('red');

    reporter.setBindState({ kind: 'binding', host: '127.0.0.1', port: 8137 });
    expect(syncEntry()?.state).toBe('yellow');

    reporter.attachServer(makeFakeServer());
    reporter.setBindState({ kind: 'bound', host: '127.0.0.1', port: 8137 });
    expect(syncEntry()?.state).toBe('green');
    expect(syncEntry()?.message).toBe('Idle — no extensions connected');
  });
});

describe('sync-status-reporter — peer classification', () => {
  const cases: Array<{ name: string; peers: PeerSummary[]; message: string }> = [
    { name: 'no peers → idle', peers: [], message: 'Idle — no extensions connected' },
    { name: '1 loopback', peers: [loopbackPeer(0)], message: 'Connected to 1 extension on this device' },
    {
      name: '2 loopback',
      peers: [loopbackPeer(0), loopbackPeer(1)],
      message: 'Connected to 2 extensions on this device',
    },
    { name: '1 LAN', peers: [lanPeer(0)], message: 'Connected to 1 extension on LAN' },
    { name: '2 LAN', peers: [lanPeer(0), lanPeer(1)], message: 'Connected to 2 extensions on LAN' },
    {
      name: 'mixed (1 of 3 on LAN)',
      peers: [loopbackPeer(0), loopbackPeer(1), lanPeer(2)],
      message: 'Connected to 3 extensions (1 on LAN)',
    },
    {
      name: 'mixed (1 of 2 on LAN)',
      peers: [loopbackPeer(0), lanPeer(1)],
      message: 'Connected to 2 extensions (1 on LAN)',
    },
  ];

  for (const { name, peers, message } of cases) {
    it(`classifies ${name}`, () => {
      const reporter = installSyncStatusReporter();
      reporter.attachServer(makeFakeServer(peers));

      const entry = syncEntry();
      expect(entry?.state).toBe('green');
      expect(entry?.message).toBe(message);
      const lan = peers.filter((p) => !p.isLoopback).length;
      expect(entry?.context).toMatchObject({
        peerCount: peers.length,
        lanCount: lan,
        loopbackCount: peers.length - lan,
      });
    });
  }

  it('re-emits when the peer set changes after attach', () => {
    const reporter = installSyncStatusReporter();
    const server = makeFakeServer([]);
    reporter.attachServer(server);
    expect(syncEntry()?.message).toBe('Idle — no extensions connected');

    server.setPeers([loopbackPeer(0), lanPeer(1)]);
    expect(syncEntry()?.message).toBe('Connected to 2 extensions (1 on LAN)');
  });
});

describe('sync-status-reporter — dispose', () => {
  it('stops emitting and drops the peer subscription after dispose', () => {
    const reporter = installSyncStatusReporter();
    const server = makeFakeServer([loopbackPeer(0)]);
    reporter.attachServer(server);
    expect(syncEntry()?.message).toBe('Connected to 1 extension on this device');

    reporter.dispose();

    // Neither a peer change nor a bind transition should move the entry now.
    server.setPeers([loopbackPeer(0), loopbackPeer(1)]);
    reporter.setBindState({ kind: 'failed', host: '0.0.0.0', port: 8137, error: new Error('late') });
    expect(syncEntry()?.message).toBe('Connected to 1 extension on this device');
  });
});
