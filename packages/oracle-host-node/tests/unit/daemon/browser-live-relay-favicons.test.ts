/**
 * Browser live relay — the tab inventory's favicons by key. Asserts:
 *   - every inventory ask (the watch's subscribe, its re-subscribe on a
 *     reconnect, the pulled read) says the favicons are read by key
 *   - a peer that answers with its icons inline passes through unchanged
 *   - a favicon pull reaches the named peer once, and settles with the
 *     icons it asked for — never a key it did not ask, never anything
 *     that is not image bytes, never another peer's answer
 *   - an absent peer, a silent one and an empty ask settle with nothing
 *   - a pull names at most one pull's worth of keys
 */

import { type IncomingLifelinePort, setLifelineServer } from '@openheaders/core/awareness';
import { setHostLogger } from '@openheaders/core/logger';
import {
  TELEMETRY_FAVICONS_PER_PULL,
  TELEMETRY_TABS_FAVICONS_TYPE,
  TELEMETRY_TABS_LIST_TYPE,
  TELEMETRY_TABS_PORT_NAME,
  TELEMETRY_TABS_PUSH_TYPE,
  TELEMETRY_TABS_SUBSCRIBE_TYPE,
} from '@openheaders/core/protocol';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserLiveRelay, TABS_FAVICONS_TIMEOUT_MS } from '../../../src/daemon/telemetry/browser-live-relay';
import type { OracleWsServer, PeerChangeListener, PeerSummary } from '../../../src/host-runtime/ws-server';

const ICON = 'data:image/png;base64,aWNvbg==';
const RESPONSE = `${TELEMETRY_TABS_FAVICONS_TYPE}:response`;

function peerSummary(nodeId: string): PeerSummary {
  return {
    peerId: `peer-${nodeId}`,
    role: 'extension',
    agent: '@openheaders/extension@1.0.0',
    workspaceId: 'default',
    nodeId,
    installId: null,
    tokenId: null,
    userId: null,
    isLoopback: true,
  };
}

interface SentFrame {
  frame: Record<string, unknown>;
  to: string[];
}

function fakeServer(peers: PeerSummary[]) {
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
    emitPeerConnect: (peer: PeerSummary) => {
      for (const listener of listeners) listener({ kind: 'connect', peer });
    },
  };
}

function tabsPort(): IncomingLifelinePort & { posted: unknown[] } {
  const posted: unknown[] = [];
  return {
    name: TELEMETRY_TABS_PORT_NAME,
    posted,
    postMessage: (message) => posted.push(message),
    onMessage: () => undefined,
    onDisconnect: () => undefined,
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

function pullFrames(frames: SentFrame[]): SentFrame[] {
  return frames.filter((sent) => sent.frame.type === TELEMETRY_TABS_FAVICONS_TYPE);
}

describe('browser live relay — favicons by key', () => {
  beforeEach(() => {
    setHostLogger(consoleLogger);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for the inventory with its favicons by key, on every ask', async () => {
    vi.useFakeTimers();
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const peer = peerSummary('node-a');
    const { server, frames, emitPeerConnect } = fakeServer([peer]);
    relay.setWsServer(server);
    relay.installLifeline();

    connect(tabsPort());
    emitPeerConnect(peer);
    void relay.listTabs();
    await vi.advanceTimersByTimeAsync(1_000);

    const asks = frames.filter(
      (sent) => sent.frame.type === TELEMETRY_TABS_SUBSCRIBE_TYPE || sent.frame.type === TELEMETRY_TABS_LIST_TYPE,
    );
    expect(asks.map((sent) => sent.frame.type)).toEqual([
      TELEMETRY_TABS_SUBSCRIBE_TYPE,
      TELEMETRY_TABS_SUBSCRIBE_TYPE,
      TELEMETRY_TABS_LIST_TYPE,
    ]);
    for (const ask of asks) expect(ask.frame.favicons).toBe('by-key');
  });

  it('passes a keyed row and an inline row through to the viewer as the peer sent them', () => {
    const connect = installFakeLifeline();
    const relay = createBrowserLiveRelay();
    const peer = peerSummary('node-a');
    relay.setWsServer(fakeServer([peer]).server);
    relay.installLifeline();
    const port = tabsPort();
    connect(port);

    const keyed = {
      tabId: 3,
      windowId: 1,
      title: 'Docs',
      url: 'https://openheaders.io/docs',
      active: true,
      favIconKey: 'k',
    };
    const inline = {
      tabId: 4,
      windowId: 1,
      title: 'Blog',
      url: 'https://openheaders.io/blog',
      active: false,
      favIconUrl: ICON,
    };
    relay.peerPush.handle(
      {
        type: TELEMETRY_TABS_PUSH_TYPE,
        payload: {
          tabs: [keyed, inline],
          browser: { name: 'Chrome', platform: 'macOS' },
          debug: { available: true, enabled: false, attachedTabs: [], pinnedTabs: [] },
        },
      },
      peer,
    );

    const pushed = port.posted.find((message) => (message as { kind?: string }).kind === 'peer-tabs');
    expect((pushed as { peer: { tabs: unknown[] } }).peer.tabs).toEqual([keyed, inline]);
  });

  it('pulls from the named peer and settles with the icons it asked for', async () => {
    const relay = createBrowserLiveRelay();
    const a = peerSummary('node-a');
    const b = peerSummary('node-b');
    const { server, frames } = fakeServer([a, b]);
    relay.setWsServer(server);

    const pending = relay.favicons('node-a', ['k1', 'k2', 'k1']);
    const [pull] = pullFrames(frames);
    expect(pullFrames(frames)).toHaveLength(1);
    expect(pull.to).toEqual(['peer-node-a']);
    expect(pull.frame.keys).toEqual(['k1', 'k2']);

    relay.peerPush.handle(
      {
        type: RESPONSE,
        callId: pull.frame.callId,
        payload: { icons: { k1: ICON, unasked: ICON, k2: 'https://openheaders.io/favicon.ico' } },
      },
      a,
    );
    expect(await pending).toEqual({ k1: ICON });
  });

  it('does not settle a pull with another peer’s answer', async () => {
    vi.useFakeTimers();
    const relay = createBrowserLiveRelay();
    const a = peerSummary('node-a');
    const b = peerSummary('node-b');
    const { server, frames } = fakeServer([a, b]);
    relay.setWsServer(server);

    const pending = relay.favicons('node-a', ['k1']);
    const [pull] = pullFrames(frames);
    relay.peerPush.handle({ type: RESPONSE, callId: pull.frame.callId, payload: { icons: { k1: ICON } } }, b);

    await vi.advanceTimersByTimeAsync(TABS_FAVICONS_TIMEOUT_MS + 10);
    expect(await pending).toEqual({});
  });

  it('settles with nothing for an absent peer, a silent one and an empty ask', async () => {
    vi.useFakeTimers();
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);

    expect(await relay.favicons('node-gone', ['k1'])).toEqual({});
    expect(await relay.favicons('node-a', [])).toEqual({});
    expect(pullFrames(frames)).toEqual([]);

    const silent = relay.favicons('node-a', ['k1']);
    await vi.advanceTimersByTimeAsync(TABS_FAVICONS_TIMEOUT_MS + 10);
    expect(await silent).toEqual({});
  });

  it('names at most one pull’s worth of keys', () => {
    const relay = createBrowserLiveRelay();
    const { server, frames } = fakeServer([peerSummary('node-a')]);
    relay.setWsServer(server);

    const keys = Array.from({ length: TELEMETRY_FAVICONS_PER_PULL + 5 }, (_, index) => `k${index}`);
    void relay.favicons('node-a', keys);
    expect(pullFrames(frames)[0].frame.keys).toEqual(keys.slice(0, TELEMETRY_FAVICONS_PER_PULL));
    relay.dispose();
  });
});
