/**
 * Browser live-telemetry relay — the daemon bridge between workbench
 * qualified lifecycle lifelines and the owning extension peer. Asserts:
 *   - qualified port names are claimed, local/synthetic shapes refused
 *   - consumer messages forward to the OWNING peer only
 *   - batches route by the sender's registry nodeId, point-to-point to
 *     the one consumer they address
 *   - each port's disconnect sends a consumer-scoped detach frame
 *   - a peer reconnect re-sends subscribe for live watches
 *   - listTabs correlates per-peer replies and drops silent peers
 *   - debugControl targets the named peer, resolves its snapshot, and
 *     nulls out on unknown peers / the reply timeout
 */

import { type IncomingLifelinePort, setLifelineServer } from '@openheaders/core/awareness';
import { setHostLogger } from '@openheaders/core/logger';
import {
  TELEMETRY_CONSOLE_BATCH_TYPE,
  TELEMETRY_CONSOLE_CONSUMER_TYPE,
  TELEMETRY_CONSOLE_DETACH_TYPE,
  TELEMETRY_DEBUG_CONTROL_TYPE,
  TELEMETRY_HOST_READY_TYPE,
  TELEMETRY_LIFECYCLE_BATCH_TYPE,
  TELEMETRY_LIFECYCLE_CONSUMER_TYPE,
  TELEMETRY_LIFECYCLE_DETACH_TYPE,
  TELEMETRY_STORAGE_CALL_TYPE,
  TELEMETRY_STORAGE_CONSUMER_TYPE,
  TELEMETRY_STORAGE_DETACH_TYPE,
  TELEMETRY_STORAGE_INVALIDATION_TYPE,
  TELEMETRY_TABS_LIST_TYPE,
  TELEMETRY_WATCH_REFUSED_TYPE,
} from '@openheaders/core/protocol';
import type { LifecycleConsumerMessage } from '@openheaders/core/request-lifecycle';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBrowserLiveRelay,
  DEBUG_CONTROL_TIMEOUT_MS,
  STORAGE_CALL_TIMEOUT_MS,
  TABS_LIST_TIMEOUT_MS,
} from '../../../src/daemon/telemetry/browser-live-relay';
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
    // The relay mints the consumer id the whole stream is scoped by.
    expect(consumerFrames[0].frame.consumerId).toBe('c1');
    expect(consumerFrames[0].to).toEqual(['peer-node-a']);

    // Batch from the owning peer reaches the port; the same tab id from
    // ANOTHER peer does not (partition identity is peer-qualified).
    relay.peerPush.handle(
      {
        type: TELEMETRY_LIFECYCLE_BATCH_TYPE,
        tabId: 7,
        consumerId: 'c1',
        messages: [{ kind: 'tab-cleared', tabId: 7 }],
      },
      peerSummary('node-a'),
    );
    relay.peerPush.handle(
      {
        type: TELEMETRY_LIFECYCLE_BATCH_TYPE,
        tabId: 7,
        consumerId: 'c1',
        messages: [{ kind: 'tab-cleared', tabId: 7 }],
      },
      peerSummary('node-b'),
    );
    expect(port.posted).toHaveLength(1);

    relay.dispose();
  });

  it('routes lifecycle watch refusals to the viewer port; other planes only log', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const { server } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);
    relay.installLifeline();

    const port = fakePort('oh-lifecycle:7@node-a');
    connect(port);
    port.send({ kind: 'subscribe' });

    relay.peerPush.handle(
      { type: TELEMETRY_WATCH_REFUSED_TYPE, plane: 'lifecycle', tabId: 7, consumerId: 'c1', reason: 'consent-off' },
      peerSummary('node-a'),
    );
    expect(port.posted).toEqual([{ kind: 'watch-refused', tabId: 7, reason: 'consent-off' }]);

    // Console/storage refusals carry no port vocabulary of their own —
    // the lifecycle envelope already marks the whole tab refused.
    relay.peerPush.handle(
      { type: TELEMETRY_WATCH_REFUSED_TYPE, plane: 'console', tabId: 7, consumerId: 'c1', reason: 'consent-off' },
      peerSummary('node-a'),
    );
    expect(port.posted).toHaveLength(1);

    // A refusal from a DIFFERENT peer never crosses partitions.
    relay.peerPush.handle(
      { type: TELEMETRY_WATCH_REFUSED_TYPE, plane: 'lifecycle', tabId: 7, consumerId: 'c1', reason: 'consent-off' },
      peerSummary('node-b'),
    );
    expect(port.posted).toHaveLength(1);

    relay.dispose();
  });

  it('routes batches point-to-point by consumer id', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const { server } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);
    relay.installLifeline();

    const first = fakePort('oh-lifecycle:7@node-a');
    const second = fakePort('oh-lifecycle:7@node-a');
    connect(first);
    connect(second);

    // Each viewer rides its own extension-side session — a batch lands
    // ONLY on the consumer it addresses (a late joiner's replay can't
    // reset a sibling's mirror).
    relay.peerPush.handle(
      {
        type: TELEMETRY_LIFECYCLE_BATCH_TYPE,
        tabId: 7,
        consumerId: 'c2',
        messages: [{ kind: 'tab-cleared', tabId: 7 }],
      },
      peerSummary('node-a'),
    );
    expect(first.posted).toHaveLength(0);
    expect(second.posted).toHaveLength(1);
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

  it('sends a consumer-scoped detach per leaving port and re-subscribes survivors on peer reconnect', () => {
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

    // A leaving viewer ends ITS stream session only — the extension's
    // per-tab ingestion refs refcount across consumers.
    first.disconnect();
    let detaches = frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_DETACH_TYPE);
    expect(detaches).toHaveLength(1);
    expect(detaches[0].frame.consumerId).toBe('c1');

    // A peer reconnect while a watch is live re-sends the subscribe for
    // each SURVIVING consumer so the extension re-attaches and replays.
    const before = frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE).length;
    emitPeerConnect(peerSummary('node-a'));
    const rejoins = frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE).slice(before);
    expect(rejoins).toHaveLength(1);
    expect(rejoins[0].frame.consumerId).toBe('c2');

    second.disconnect();
    detaches = frames.filter((f) => f.frame.type === TELEMETRY_LIFECYCLE_DETACH_TYPE);
    expect(detaches).toHaveLength(2);
    expect(detaches[1].frame.tabId).toBe(7);
    expect(detaches[1].frame.consumerId).toBe('c2');

    // Batches after the watch ended are dropped.
    relay.peerPush.handle(
      {
        type: TELEMETRY_LIFECYCLE_BATCH_TYPE,
        tabId: 7,
        consumerId: 'c2',
        messages: [{ kind: 'tab-cleared', tabId: 7 }],
      },
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
      {
        type: TELEMETRY_LIFECYCLE_BATCH_TYPE,
        tabId: 7,
        consumerId: 'c1',
        messages: [{ kind: 'tab-cleared', tabId: 7 }],
      },
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
          debug: { available: true, enabled: false, attachedTabs: [], pinnedTabs: [7] },
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
    // The Debug-mode posture rides the same reply, per peer.
    expect(result.peers[0].debug).toEqual({ available: true, enabled: false, attachedTabs: [], pinnedTabs: [7] });
    // No consent field on the wire means consenting (older peers).
    expect(result.peers[0].watchConsent).toBe(true);
    relay.dispose();
  });

  it('listTabs carries a peer-reported consent refusal through to the inventory', async () => {
    vi.useFakeTimers();
    const relay = createBrowserLiveRelay();
    const { server } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);

    const pending = relay.listTabs();
    relay.peerPush.handle(
      {
        type: `${TELEMETRY_TABS_LIST_TYPE}:response`,
        payload: {
          tabs: [],
          browser: { name: 'Chrome', platform: 'macOS' },
          debug: { available: false, enabled: false, attachedTabs: [], pinnedTabs: [] },
          watchConsent: false,
        },
      },
      peerSummary('node-a'),
    );
    await vi.advanceTimersByTimeAsync(TABS_LIST_TIMEOUT_MS + 10);
    const result = await pending;
    expect(result.peers[0].watchConsent).toBe(false);
    relay.dispose();
  });

  it('storageCall settles ok:false on a consent-refused reply instead of timing out', async () => {
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);

    const pending = relay.storageCall('node-a', 'getDomStorageEntries', { tabId: 7 });
    const call = frames.find((f) => f.frame.type === TELEMETRY_STORAGE_CALL_TYPE);
    expect(call).toBeDefined();
    relay.peerPush.handle(
      {
        type: `${TELEMETRY_STORAGE_CALL_TYPE}:response`,
        callId: call?.frame.callId as string,
        payload: null,
        refused: 'consent-off',
      },
      peerSummary('node-a'),
    );
    await expect(pending).resolves.toEqual({ ok: false, payload: null });
    relay.dispose();
  });

  it('debugControl targets the named peer and resolves its post-command snapshot', async () => {
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a'), peerSummary('node-b')]);
    relay.setWsServer(server);

    const pending = relay.debugControl('node-a', { kind: 'pin', tabId: 7, pinned: true });
    const requests = frames.filter((f) => f.frame.type === TELEMETRY_DEBUG_CONTROL_TYPE);
    expect(requests).toHaveLength(1);
    expect(requests[0].to).toEqual(['peer-node-a']);
    expect(requests[0].frame.command).toEqual({ kind: 'pin', tabId: 7, pinned: true });

    relay.peerPush.handle(
      {
        type: `${TELEMETRY_DEBUG_CONTROL_TYPE}:response`,
        payload: { debug: { available: true, enabled: true, attachedTabs: [], pinnedTabs: [7] } },
      },
      peerSummary('node-a'),
    );
    expect(await pending).toEqual({ available: true, enabled: true, attachedTabs: [], pinnedTabs: [7] });
    relay.dispose();
  });

  it('debugControl resolves null for an unknown peer and on the reply timeout', async () => {
    vi.useFakeTimers();
    const relay = createBrowserLiveRelay();
    const { server } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);

    expect(await relay.debugControl('node-gone', { kind: 'enable', enabled: true })).toBeNull();

    const pending = relay.debugControl('node-a', { kind: 'enable', enabled: true });
    await vi.advanceTimersByTimeAsync(DEBUG_CONTROL_TIMEOUT_MS + 10);
    expect(await pending).toBeNull();
    relay.dispose();
  });

  it('accepts storage ports, opens a per-consumer watch, and routes invalidations point-to-point', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const { server, frames, emitPeerConnect } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);
    relay.installLifeline();

    const first = fakePort('oh-storage:7@node-a');
    const second = fakePort('oh-storage:7@node-a');
    connect(first);
    connect(second);

    const opens = frames.filter((f) => f.frame.type === TELEMETRY_STORAGE_CONSUMER_TYPE);
    expect(opens).toHaveLength(2);
    expect(opens[0].frame.tabId).toBe(7);
    expect(opens[0].to).toEqual(['peer-node-a']);
    const firstId = opens[0].frame.consumerId as string;
    const secondId = opens[1].frame.consumerId as string;

    // The note lands ONLY on the consumer it addresses, and only from
    // the owning peer (partition identity is peer-qualified).
    relay.peerPush.handle(
      { type: TELEMETRY_STORAGE_INVALIDATION_TYPE, tabId: 7, consumerId: secondId, kind: 'indexeddb' },
      peerSummary('node-a'),
    );
    relay.peerPush.handle(
      { type: TELEMETRY_STORAGE_INVALIDATION_TYPE, tabId: 7, consumerId: firstId, kind: 'indexeddb' },
      peerSummary('node-other'),
    );
    expect(first.posted).toHaveLength(0);
    expect(second.posted).toEqual([{ tabId: 7, kind: 'indexeddb' }]);

    // A leaving viewer ends ITS watch; a reconnect re-opens survivors.
    first.disconnect();
    const detaches = frames.filter((f) => f.frame.type === TELEMETRY_STORAGE_DETACH_TYPE);
    expect(detaches).toHaveLength(1);
    expect(detaches[0].frame.consumerId).toBe(firstId);
    const before = frames.filter((f) => f.frame.type === TELEMETRY_STORAGE_CONSUMER_TYPE).length;
    emitPeerConnect(peerSummary('node-a'));
    const rejoins = frames.filter((f) => f.frame.type === TELEMETRY_STORAGE_CONSUMER_TYPE).slice(before);
    expect(rejoins).toHaveLength(1);
    expect(rejoins[0].frame.consumerId).toBe(secondId);
    relay.dispose();
  });

  it('accepts console ports, opens a per-consumer watch, and routes batches point-to-point', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const { server, frames, emitPeerConnect } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);
    relay.installLifeline();

    const first = fakePort('oh-console:7@node-a');
    const second = fakePort('oh-console:7@node-a');
    connect(first);
    connect(second);

    const opens = frames.filter((f) => f.frame.type === TELEMETRY_CONSOLE_CONSUMER_TYPE);
    expect(opens).toHaveLength(2);
    expect(opens[0].frame.tabId).toBe(7);
    expect(opens[0].to).toEqual(['peer-node-a']);
    const firstId = opens[0].frame.consumerId as string;
    const secondId = opens[1].frame.consumerId as string;

    // The batch lands ONLY on the consumer it addresses, and only from
    // the owning peer (partition identity is peer-qualified).
    relay.peerPush.handle(
      {
        type: TELEMETRY_CONSOLE_BATCH_TYPE,
        tabId: 7,
        consumerId: secondId,
        messages: [{ kind: 'ready', tabId: 7 }],
      },
      peerSummary('node-a'),
    );
    relay.peerPush.handle(
      {
        type: TELEMETRY_CONSOLE_BATCH_TYPE,
        tabId: 7,
        consumerId: firstId,
        messages: [{ kind: 'ready', tabId: 7 }],
      },
      peerSummary('node-other'),
    );
    expect(first.posted).toHaveLength(0);
    expect(second.posted).toEqual([{ kind: 'ready', tabId: 7 }]);

    // A leaving viewer ends ITS watch; a reconnect re-opens survivors.
    first.disconnect();
    const detaches = frames.filter((f) => f.frame.type === TELEMETRY_CONSOLE_DETACH_TYPE);
    expect(detaches).toHaveLength(1);
    expect(detaches[0].frame.consumerId).toBe(firstId);
    const before = frames.filter((f) => f.frame.type === TELEMETRY_CONSOLE_CONSUMER_TYPE).length;
    emitPeerConnect(peerSummary('node-a'));
    const rejoins = frames.filter((f) => f.frame.type === TELEMETRY_CONSOLE_CONSUMER_TYPE).slice(before);
    expect(rejoins).toHaveLength(1);
    expect(rejoins[0].frame.consumerId).toBe(secondId);
    relay.dispose();
  });

  it('storageCall correlates concurrent replies by callId, out of order', async () => {
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);

    const firstPending = relay.storageCall('node-a', 'getDomStorageEntries', { tabId: 7, frameId: 0, area: 'local' });
    const secondPending = relay.storageCall('node-a', 'getStorageQuota', { tabId: 7, frameId: 0 });
    const calls = frames.filter((f) => f.frame.type === TELEMETRY_STORAGE_CALL_TYPE);
    expect(calls).toHaveLength(2);
    expect(calls[0].to).toEqual(['peer-node-a']);
    const firstCallId = calls[0].frame.callId as string;
    const secondCallId = calls[1].frame.callId as string;
    expect(firstCallId).not.toBe(secondCallId);

    // Replies land LIFO — each must settle its own caller.
    relay.peerPush.handle(
      {
        type: `${TELEMETRY_STORAGE_CALL_TYPE}:response`,
        callId: secondCallId,
        payload: { quota: { usage: 1, quota: 2 } },
      },
      peerSummary('node-a'),
    );
    relay.peerPush.handle(
      {
        type: `${TELEMETRY_STORAGE_CALL_TYPE}:response`,
        callId: firstCallId,
        payload: { entries: [], truncated: false },
      },
      peerSummary('node-a'),
    );
    expect(await firstPending).toEqual({ ok: true, payload: { entries: [], truncated: false } });
    expect(await secondPending).toEqual({ ok: true, payload: { quota: { usage: 1, quota: 2 } } });
    relay.dispose();
  });

  it('storageCall settles ok:false for unknown peers, non-whitelisted methods, and the reply timeout', async () => {
    vi.useFakeTimers();
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);

    expect(await relay.storageCall('node-gone', 'getStorageQuota', { tabId: 7, frameId: 0 })).toEqual({
      ok: false,
      payload: null,
    });
    // The whitelist is enforced at the relay too — a console verb never
    // reaches the wire regardless of caller.
    expect(
      await relay.storageCall('node-a', 'consoleEval' as unknown as 'getStorageQuota', { tabId: 7, frameId: 0 }),
    ).toEqual({ ok: false, payload: null });
    expect(frames.filter((f) => f.frame.type === TELEMETRY_STORAGE_CALL_TYPE)).toHaveLength(0);

    const pending = relay.storageCall('node-a', 'getStorageQuota', { tabId: 7, frameId: 0 });
    await vi.advanceTimersByTimeAsync(STORAGE_CALL_TIMEOUT_MS + 10);
    expect(await pending).toEqual({ ok: false, payload: null });
    relay.dispose();
  });
});
