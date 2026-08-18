/**
 * Capture-feedback pusher laws (the agent-traffic plan §4):
 *   - server attach pushes each loopback peer its OWN capture-armed
 *     tabId set (keyed on the stable peer qualifier); remote peers
 *     never hear about capture state
 *   - a tap status transition pushes to every loopback peer, empty
 *     sets included (the frame that clears the last badge)
 *   - a peer connect / hello pushes to that peer alone
 *   - hello frames from off-device wires are claimed and dropped
 *   - only STREAMING browser-tab sources badge — refused/ended arms
 *     and the proxy partition never do
 */

import { TRAFFIC_CAPTURE_HELLO_TYPE, TRAFFIC_CAPTURE_STATE_TYPE } from '@openheaders/core/protocol';
import { describe, expect, it } from 'vitest';
import {
  type CaptureFeedbackTapSource,
  createCaptureFeedbackPush,
} from '../../../src/daemon/telemetry/capture-feedback-push';
import type { OracleWsServer, PeerChangeListener, PeerSummary } from '../../../src/host-runtime/ws-server';
import type { TrafficSourceStatus } from '../../../src/traffic/tap';

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

function source(overrides: Partial<TrafficSourceStatus>): TrafficSourceStatus {
  return {
    uid: 'src-1',
    kind: 'browser-tab',
    label: 'openheaders.io',
    armedAtMs: 1000,
    expiresAtMs: 2000,
    state: 'streaming',
    pendingWaits: 0,
    stats: {
      recordCount: 0,
      byteSize: 0,
      maxRecords: 100,
      maxBytes: 1024,
      evictedCount: 0,
      droppedPreArm: 0,
      droppedEvictedReplay: 0,
      readyEpochs: 1,
    },
    ...overrides,
  };
}

function fakeTap(initial: TrafficSourceStatus[] = []): {
  tap: CaptureFeedbackTapSource;
  setSources(next: TrafficSourceStatus[]): void;
  fireChange(): void;
} {
  let sources = initial;
  const listeners = new Set<() => void>();
  return {
    tap: {
      status: () => sources,
      onStatusChanged(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setSources: (next) => {
      sources = next;
    },
    fireChange: () => {
      for (const listener of [...listeners]) listener();
    },
  };
}

function stateFramesTo(frames: SentFrame[], peerId: string): number[][] {
  return frames
    .filter((f) => f.frame.type === TRAFFIC_CAPTURE_STATE_TYPE && f.to.includes(peerId))
    .map((f) => f.frame.tabIds as number[]);
}

describe('capture feedback push', () => {
  it('server attach pushes each loopback peer its own set; remote peers never hear', () => {
    const ext = peerSummary('ext-a');
    const remote = peerSummary('ext-b', { isLoopback: false });
    const rig = fakeServer([ext, remote]);
    const { tap } = fakeTap([
      source({ uid: 's1', nodeId: 'ext-a', tabId: 7 }),
      source({ uid: 's2', nodeId: 'ext-a', tabId: 9 }),
      source({ uid: 's3', nodeId: 'ext-b', tabId: 4 }),
    ]);
    const push = createCaptureFeedbackPush(tap);
    push.setWsServer(rig.server);
    expect(stateFramesTo(rig.frames, ext.peerId)).toEqual([[7, 9]]);
    expect(stateFramesTo(rig.frames, remote.peerId)).toEqual([]);
    push.dispose();
  });

  it('keys the set on the stable peer qualifier (installId over nodeId)', () => {
    const ext = peerSummary('writer-node', { installId: 'install-1' });
    const rig = fakeServer([ext]);
    const { tap } = fakeTap([source({ nodeId: 'install-1', tabId: 3 })]);
    const push = createCaptureFeedbackPush(tap);
    push.setWsServer(rig.server);
    expect(stateFramesTo(rig.frames, ext.peerId)).toEqual([[3]]);
    push.dispose();
  });

  it('a tap transition pushes to every loopback peer — empty sets included', () => {
    const ext = peerSummary('ext-a');
    const rig = fakeServer([ext]);
    const { tap, setSources, fireChange } = fakeTap([source({ nodeId: 'ext-a', tabId: 7 })]);
    const push = createCaptureFeedbackPush(tap);
    push.setWsServer(rig.server);
    rig.frames.length = 0;

    setSources([]);
    fireChange();
    expect(stateFramesTo(rig.frames, ext.peerId)).toEqual([[]]);
    push.dispose();
  });

  it('a peer connect and a hello push to that peer alone', () => {
    const a = peerSummary('ext-a');
    const b = peerSummary('ext-b');
    const rig = fakeServer([a, b]);
    const { tap } = fakeTap([source({ nodeId: 'ext-a', tabId: 1 })]);
    const push = createCaptureFeedbackPush(tap);
    push.setWsServer(rig.server);
    rig.frames.length = 0;

    rig.emitPeerChange('connect', a);
    expect(stateFramesTo(rig.frames, a.peerId)).toEqual([[1]]);
    expect(stateFramesTo(rig.frames, b.peerId)).toEqual([]);
    rig.frames.length = 0;

    push.peerPush.handle({ type: TRAFFIC_CAPTURE_HELLO_TYPE }, b);
    expect(stateFramesTo(rig.frames, b.peerId)).toEqual([[]]);
    expect(stateFramesTo(rig.frames, a.peerId)).toEqual([]);
    push.dispose();
  });

  it('hello frames from off-device wires are claimed and dropped', () => {
    const remote = peerSummary('ext-b', { isLoopback: false });
    const rig = fakeServer([remote]);
    const { tap } = fakeTap();
    const push = createCaptureFeedbackPush(tap);
    push.setWsServer(rig.server);
    rig.frames.length = 0;

    expect(push.peerPush.owns(TRAFFIC_CAPTURE_HELLO_TYPE)).toBe(true);
    push.peerPush.handle({ type: TRAFFIC_CAPTURE_HELLO_TYPE }, remote);
    expect(rig.frames).toEqual([]);
    push.dispose();
  });

  it('only streaming browser-tab sources badge — refused arms and the proxy partition never do', () => {
    const ext = peerSummary('ext-a');
    const rig = fakeServer([ext]);
    const { tap } = fakeTap([
      source({ uid: 's1', nodeId: 'ext-a', tabId: 7 }),
      source({ uid: 's2', nodeId: 'ext-a', tabId: 9, state: 'refused' }),
      source({ uid: 's3', kind: 'proxy', label: 'System Proxy' }),
    ]);
    const push = createCaptureFeedbackPush(tap);
    push.setWsServer(rig.server);
    expect(stateFramesTo(rig.frames, ext.peerId)).toEqual([[7]]);
    push.dispose();
  });

  it('dispose stops pushing on later tap transitions', () => {
    const ext = peerSummary('ext-a');
    const rig = fakeServer([ext]);
    const { tap, fireChange } = fakeTap([source({ nodeId: 'ext-a', tabId: 7 })]);
    const push = createCaptureFeedbackPush(tap);
    push.setWsServer(rig.server);
    push.dispose();
    rig.frames.length = 0;

    fireChange();
    expect(rig.frames).toEqual([]);
  });
});
