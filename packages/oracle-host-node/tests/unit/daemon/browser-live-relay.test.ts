/**
 * Browser live-telemetry relay — the daemon bridge between workbench
 * qualified lifecycle lifelines and the owning extension peer. Asserts:
 *   - qualified port names are claimed, local/synthetic shapes refused
 *   - consumer messages forward to the OWNING peer only
 *   - batches route by the sender's registry nodeId to watching ports
 *   - the last port's disconnect sends the detach frame
 *   - a peer reconnect re-sends subscribe for live watches
 *   - listTabs correlates per-peer replies and drops silent peers
 */

import { type IncomingLifelinePort, setLifelineServer } from '@openheaders/core/awareness';
import { setHostLogger } from '@openheaders/core/logger';
import {
  TELEMETRY_HOST_READY_TYPE,
  TELEMETRY_LIFECYCLE_BATCH_TYPE,
  TELEMETRY_LIFECYCLE_CONSUMER_TYPE,
  TELEMETRY_LIFECYCLE_DETACH_TYPE,
  TELEMETRY_TABS_LIST_TYPE,
} from '@openheaders/core/protocol';
import type { LifecycleConsumerMessage } from '@openheaders/core/request-lifecycle';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserLiveRelay, TABS_LIST_TIMEOUT_MS } from '../../../src/daemon/telemetry/browser-live-relay';
import type { OracleWsServer, PeerChangeListener, PeerSummary } from '../../../src/host-runtime/ws-server';

interface FakePort extends IncomingLifelinePort {
  posted: unknown[];
  send(msg: LifecycleConsumerMessage): void;
  disconnect(): void;
}

function fakePort(name: string): FakePort {
  const posted: unknown[] = [];
  const messageHandlers: Array<(m: unknown) => void> = [];
  const disconnectHandlers: Array<(info: { errorMessage?: string }) => void> = [];
  return {
    name,
    posted,
    postMessage: (m) => posted.push(m),
    onMessage: (h) => messageHandlers.push(h as (m: unknown) => void),
    onDisconnect: (h) => disconnectHandlers.push(h),
    send: (msg) => {
      for (const h of messageHandlers) h(msg);
    },
    disconnect: () => {
      for (const h of disconnectHandlers) h({});
    },
  };
}

function peerSummary(nodeId: string, peerId = `peer-${nodeId}`, installId: string | null = null): PeerSummary {
  return {
    peerId,
    role: 'extension',
    agent: '@openheaders/extension@1.0.0',
    workspaceId: 'default',
    nodeId,
    installId,
    tokenId: null,
    userId: null,
    isLoopback: true,
  };
}

interface SentFrame {
  frame: Record<string, unknown>;
  to: string[];
}

function fakeServer(peers: PeerSummary[]): {
  server: OracleWsServer;
  frames: SentFrame[];
  emitPeerConnect: (peer: PeerSummary) => void;
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
    emitPeerConnect: (peer) => {
      for (const listener of listeners) listener({ kind: 'connect', peer });
    },
  };
}

/** Install a lifeline-server fake and hand back the connect trigger. */
function installFakeLifeline(): (port: IncomingLifelinePort) => void {
  const handlers = new Set<(port: IncomingLifelinePort) => void>();
  setLifelineServer({
    onConnect(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  });
  return (port) => {
    for (const handler of handlers) handler(port);
  };
}

beforeEach(() => {
  setHostLogger(consoleLogger);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createBrowserLiveRelay', () => {
  it('forwards consumer messages to the owning peer and routes batches back by registry nodeId', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a'), peerSummary('node-b')]);
    relay.setWsServer(server);
    relay.installLifeline();

    const port = fakePort('oh-lifecycle:7@node-a');
    connect(port);
    port.send({ kind: 'subscribe' });

    const consumerFrames = frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE);
    expect(consumerFrames).toHaveLength(1);
    expect(consumerFrames[0].frame.tabId).toBe(7);
    expect(consumerFrames[0].to).toEqual(['peer-node-a']);

    // Batch from the owning peer reaches the port; the same tab id from
    // ANOTHER peer does not (partition identity is peer-qualified).
    relay.peerPush.handle(
      { type: TELEMETRY_LIFECYCLE_BATCH_TYPE, tabId: 7, messages: [{ kind: 'tab-cleared', tabId: 7 }] },
      peerSummary('node-a'),
    );
    relay.peerPush.handle(
      { type: TELEMETRY_LIFECYCLE_BATCH_TYPE, tabId: 7, messages: [{ kind: 'tab-cleared', tabId: 7 }] },
      peerSummary('node-b'),
    );
    expect(port.posted).toHaveLength(1);

    relay.dispose();
  });

  it('refuses local and synthetic port shapes', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);
    relay.installLifeline();

    for (const name of ['oh-lifecycle:7', 'oh-lifecycle:-59210', 'oh-lifecycle:-1@node-a', 'oh-page:7@node-a']) {
      const port = fakePort(name);
      connect(port);
      port.send({ kind: 'subscribe' });
    }
    expect(frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE)).toHaveLength(0);
    relay.dispose();
  });

  it('sends detach when the last port leaves and re-subscribes on peer reconnect', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const { server, frames, emitPeerConnect } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);
    relay.installLifeline();

    const first = fakePort('oh-lifecycle:7@node-a');
    const second = fakePort('oh-lifecycle:7@node-a');
    connect(first);
    connect(second);
    first.send({ kind: 'subscribe' });
    second.send({ kind: 'subscribe' });

    first.disconnect();
    expect(frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_DETACH_TYPE)).toHaveLength(0);

    // A peer reconnect while a watch is live re-sends the subscribe so
    // the extension re-attaches and replays.
    const before = frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE).length;
    emitPeerConnect(peerSummary('node-a'));
    expect(frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE).length).toBe(before + 1);

    second.disconnect();
    const detaches = frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_DETACH_TYPE);
    expect(detaches).toHaveLength(1);
    expect(detaches[0].frame.tabId).toBe(7);

    // Batches after the watch ended are dropped.
    relay.peerPush.handle(
      { type: TELEMETRY_LIFECYCLE_BATCH_TYPE, tabId: 7, messages: [{ kind: 'tab-cleared', tabId: 7 }] },
      peerSummary('node-a'),
    );
    expect(first.posted).toHaveLength(0);
    expect(second.posted).toHaveLength(0);
    relay.dispose();
  });

  it('keys watches on installId so a reconnect with a changed nodeId still re-subscribes', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    // The peer sends a stable installId; its nodeId is the ACTIVE
    // workspace's writer identity and changes after a join → adopt.
    const { server, frames, emitPeerConnect } = fakeServer([peerSummary('node-home', 'peer-1', 'install-a')]);
    relay.setWsServer(server);
    relay.installLifeline();

    // The workbench opens the lifeline against the inventory's stable
    // qualifier (the installId).
    const port = fakePort('oh-lifecycle:7@install-a');
    connect(port);
    port.send({ kind: 'subscribe' });
    expect(frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE)).toHaveLength(1);

    // Reconnect under a DIFFERENT nodeId, same install: the watch must
    // re-subscribe (the wire-flap orphan bug) and batches still route.
    const before = frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE).length;
    emitPeerConnect(peerSummary('node-adopted', 'peer-2', 'install-a'));
    expect(frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE).length).toBe(before + 1);

    relay.peerPush.handle(
      { type: TELEMETRY_LIFECYCLE_BATCH_TYPE, tabId: 7, messages: [{ kind: 'tab-cleared', tabId: 7 }] },
      peerSummary('node-adopted', 'peer-2', 'install-a'),
    );
    expect(port.posted).toHaveLength(1);
    relay.dispose();
  });

  it('re-subscribes live watches on the telemetry-host-ready announce', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);
    relay.installLifeline();

    const port = fakePort('oh-lifecycle:7@node-a');
    connect(port);
    port.send({ kind: 'subscribe' });
    const before = frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE).length;

    // A cold SW registers its telemetry handlers AFTER the wire's
    // HELLO — the ready announce re-joins the watches it missed.
    relay.peerPush.handle({ type: TELEMETRY_HOST_READY_TYPE }, peerSummary('node-a'));
    expect(frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE).length).toBe(before + 1);
    relay.dispose();
  });

  it('listTabs correlates per-peer replies and drops silent peers on the timeout', async () => {
    vi.useFakeTimers();
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a'), peerSummary('node-b')]);
    relay.setWsServer(server);

    const pending = relay.listTabs();
    const requests = frames.filter((f) => f.frame.type === TELEMETRY_TABS_LIST_TYPE);
    expect(requests).toHaveLength(2);

    relay.peerPush.handle(
      {
        type: `${TELEMETRY_TABS_LIST_TYPE}:response`,
        payload: {
          tabs: [{ tabId: 7, windowId: 1, title: 'Docs', url: 'https://openheaders.io/docs', active: true }],
          browser: { name: 'Chrome', platform: 'macOS' },
        },
      },
      peerSummary('node-a'),
    );
    await vi.advanceTimersByTimeAsync(TABS_LIST_TIMEOUT_MS + 10);

    const result = await pending;
    expect(result.peers).toHaveLength(1);
    expect(result.peers[0].nodeId).toBe('node-a');
    expect(result.peers[0].tabs[0].url).toBe('https://openheaders.io/docs');
    expect(result.peers[0].browser).toEqual({ name: 'Chrome', platform: 'macOS' });
    relay.dispose();
  });
});
