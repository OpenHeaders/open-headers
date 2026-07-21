/**
 * Scoped browser-routing controller laws (OBSERVABILITY_PLAN.md §5.1):
 *   - state pushes go to loopback peers only, folded from the capture
 *     service (desire AND bound port)
 *   - a routing-change signal pushes to every loopback peer
 *   - a peer connect / hello pushes to that peer alone
 *   - hello and ack frames from off-device wires are claimed and dropped
 *   - acks key on the stable peer qualifier and fold into status();
 *     a disconnect drops the peer's ack
 *   - setEnabled persists through the capture service and answers the
 *     post-edit projection
 */

import { setHostLogger } from '@openheaders/core/logger';
import { PROXY_ROUTING_ACK_TYPE, PROXY_ROUTING_HELLO_TYPE, PROXY_ROUTING_STATE_TYPE } from '@openheaders/core/protocol';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProxyRoutingWireState } from '../../../src/daemon/proxy/proxy-capture-service';
import { createProxyRoutingControl, type ProxyRoutingCaptureSource } from '../../../src/daemon/proxy/routing-push';
import type { OracleWsServer, PeerChangeListener, PeerSummary } from '../../../src/host-runtime/ws-server';

function peerSummary(nodeId: string, opts: { installId?: string | null; isLoopback?: boolean } = {}): PeerSummary {
  return {
    peerId: `peer-${nodeId}`,
    role: 'extension',
    agent: '@openheaders/extension@1.0.0',
    workspaceId: 'default',
    nodeId,
    installId: opts.installId ?? null,
    tokenId: null,
    userId: null,
    isLoopback: opts.isLoopback ?? true,
  };
}

interface SentFrame {
  frame: Record<string, unknown>;
  to: string[];
}

function fakeServer(peers: PeerSummary[]): {
  server: OracleWsServer;
  frames: SentFrame[];
  emitPeerChange: (kind: 'connect' | 'disconnect', peer: PeerSummary) => void;
} {
  const frames: SentFrame[] = [];
  const listeners = new Set<PeerChangeListener>();
  const server: OracleWsServer = {
    broadcast: () => undefined,
    broadcastFrame(frame, opts) {
      const to = peers.filter((p) => (opts?.filterPeer ? opts.filterPeer(p) : true)).map((p) => p.peerId);
      frames.push({ frame, to });
    },
    connectedCount: () => peers.length,
    connectedTokenIds: () => new Set<string>(),
    closePeersByTokenId: () => 0,
    listConnectedPeers: () => peers,
    subscribePeerChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: async () => undefined,
  };
  return {
    server,
    frames,
    emitPeerChange: (kind, peer) => {
      for (const listener of listeners) listener({ kind, peer });
    },
  };
}

function fakeCapture(initial: { enabled?: boolean; wire?: ProxyRoutingWireState } = {}): {
  capture: ProxyRoutingCaptureSource;
  setWire(next: ProxyRoutingWireState): void;
  fireChange(): void;
  setRoutingEnabled: ReturnType<typeof vi.fn>;
} {
  let enabled = initial.enabled ?? false;
  let wire = initial.wire ?? { enabled: false, port: null, scopePatterns: [] };
  const listeners = new Set<() => void>();
  const setRoutingEnabled = vi.fn(async (next: boolean) => {
    enabled = next;
    for (const listener of [...listeners]) listener();
  });
  return {
    capture: {
      getRoutingEnabled: async () => enabled,
      setRoutingEnabled,
      getRoutingWireState: async () => wire,
      subscribeRoutingChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setWire: (next) => {
      wire = next;
    },
    fireChange: () => {
      for (const listener of [...listeners]) listener();
    },
    setRoutingEnabled,
  };
}

const ACTIVE_WIRE: ProxyRoutingWireState = { enabled: true, port: 8139, scopePatterns: ['openheaders.io'] };

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  setHostLogger(consoleLogger);
});

describe('proxy routing control — pushes', () => {
  it('pushes the folded wire state to loopback peers only on server attach', async () => {
    const loopback = peerSummary('a');
    const remote = peerSummary('b', { isLoopback: false });
    const rig = fakeServer([loopback, remote]);
    const { capture, setWire } = fakeCapture();
    setWire(ACTIVE_WIRE);
    const control = createProxyRoutingControl(capture);
    control.setWsServer(rig.server);
    await settle();
    const states = rig.frames.filter((f) => f.frame.type === PROXY_ROUTING_STATE_TYPE);
    expect(states.length).toBeGreaterThan(0);
    // The off-device peer never receives a state frame; the loopback
    // peer receives the folded verdict.
    expect(states.flatMap((sent) => sent.to)).toEqual([loopback.peerId]);
    for (const sent of states) {
      expect(sent.frame.enabled).toBe(true);
      expect(sent.frame.port).toBe(8139);
      expect(sent.frame.scopePatterns).toEqual(['openheaders.io']);
    }
    control.dispose();
  });

  it('pushes to every loopback peer on a routing-change signal', async () => {
    const a = peerSummary('a');
    const b = peerSummary('b');
    const rig = fakeServer([a, b]);
    const { capture, setWire, fireChange } = fakeCapture();
    const control = createProxyRoutingControl(capture);
    control.setWsServer(rig.server);
    await settle();
    rig.frames.length = 0;
    setWire(ACTIVE_WIRE);
    fireChange();
    await settle();
    const states = rig.frames.filter((f) => f.frame.type === PROXY_ROUTING_STATE_TYPE);
    expect(states).toHaveLength(1);
    expect(states[0].to).toEqual([a.peerId, b.peerId]);
    control.dispose();
  });

  it('answers a hello with a push to that peer alone; off-device hello is dropped', async () => {
    const a = peerSummary('a');
    const b = peerSummary('b');
    const remote = peerSummary('c', { isLoopback: false });
    const rig = fakeServer([a, b, remote]);
    const { capture } = fakeCapture();
    const control = createProxyRoutingControl(capture);
    control.setWsServer(rig.server);
    await settle();
    rig.frames.length = 0;
    expect(control.peerPush.owns(PROXY_ROUTING_HELLO_TYPE)).toBe(true);
    control.peerPush.handle({ type: PROXY_ROUTING_HELLO_TYPE }, a);
    control.peerPush.handle({ type: PROXY_ROUTING_HELLO_TYPE }, remote);
    await settle();
    const states = rig.frames.filter((f) => f.frame.type === PROXY_ROUTING_STATE_TYPE);
    expect(states).toHaveLength(1);
    expect(states[0].to).toEqual([a.peerId]);
    control.dispose();
  });

  it('pushes to a peer on its connect event', async () => {
    const a = peerSummary('a');
    const rig = fakeServer([a]);
    const { capture } = fakeCapture();
    const control = createProxyRoutingControl(capture);
    control.setWsServer(rig.server);
    await settle();
    rig.frames.length = 0;
    rig.emitPeerChange('connect', a);
    await settle();
    const states = rig.frames.filter((f) => f.frame.type === PROXY_ROUTING_STATE_TYPE);
    expect(states).toHaveLength(1);
    expect(states[0].to).toEqual([a.peerId]);
    control.dispose();
  });
});

describe('proxy routing control — acks and status', () => {
  it('folds acks into status() keyed by the stable qualifier and drops them on disconnect', async () => {
    const peer = peerSummary('node-1', { installId: 'install-1' });
    const rig = fakeServer([peer]);
    const { capture } = fakeCapture({ enabled: true, wire: ACTIVE_WIRE });
    const control = createProxyRoutingControl(capture);
    control.setWsServer(rig.server);
    control.peerPush.handle({ type: PROXY_ROUTING_ACK_TYPE, applied: true, mode: 'pac' }, peer);
    let status = await control.status();
    expect(status.enabled).toBe(true);
    expect(status.active).toBe(true);
    expect(status.peers).toEqual([{ nodeId: 'install-1', agent: peer.agent, applied: true, mode: 'pac' }]);
    rig.emitPeerChange('disconnect', peer);
    status = await control.status();
    expect(status.peers).toEqual([]);
    control.dispose();
  });

  it('drops malformed and off-device acks', async () => {
    const peer = peerSummary('a');
    const remote = peerSummary('b', { isLoopback: false });
    const rig = fakeServer([peer, remote]);
    const { capture } = fakeCapture();
    const control = createProxyRoutingControl(capture);
    control.setWsServer(rig.server);
    control.peerPush.handle({ type: PROXY_ROUTING_ACK_TYPE, applied: 'yes', mode: 'pac' }, peer);
    control.peerPush.handle({ type: PROXY_ROUTING_ACK_TYPE, applied: true, mode: 'socks' }, peer);
    control.peerPush.handle({ type: PROXY_ROUTING_ACK_TYPE, applied: true, mode: 'pac' }, remote);
    expect((await control.status()).peers).toEqual([]);
    control.dispose();
  });

  it('keeps an ack error message in the peer projection', async () => {
    const peer = peerSummary('a');
    const rig = fakeServer([peer]);
    const { capture } = fakeCapture();
    const control = createProxyRoutingControl(capture);
    control.setWsServer(rig.server);
    control.peerPush.handle(
      {
        type: PROXY_ROUTING_ACK_TYPE,
        applied: false,
        mode: 'pac',
        error: 'proxy settings controlled by other extensions',
      },
      peer,
    );
    expect((await control.status()).peers[0]?.error).toBe('proxy settings controlled by other extensions');
    control.dispose();
  });
});

describe('proxy routing control — setEnabled', () => {
  it('persists through the capture service, pushes, and answers the projection', async () => {
    const peer = peerSummary('a');
    const rig = fakeServer([peer]);
    const fake = fakeCapture();
    const control = createProxyRoutingControl(fake.capture);
    control.setWsServer(rig.server);
    await settle();
    rig.frames.length = 0;
    fake.setWire(ACTIVE_WIRE);
    const result = await control.setEnabled(true);
    await settle();
    expect(fake.setRoutingEnabled).toHaveBeenCalledWith(true);
    expect(result).toEqual({ ok: true, routing: { enabled: true, active: true, peers: [] } });
    const states = rig.frames.filter((f) => f.frame.type === PROXY_ROUTING_STATE_TYPE);
    expect(states).toHaveLength(1);
    control.dispose();
  });
});
