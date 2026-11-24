/**
 * Browser live-telemetry relay — a watch whose replay closed the peer's
 * connection for frame size. Asserts:
 *   - the close holds that one watch: its viewers are told why and the
 *     reconnect does not ask for it again, while every other watch is
 *     re-subscribed as before
 *   - a held watch refuses a new viewer at once
 *   - `clear-session` crosses, releases the hold and asks again
 *   - the peer's telemetry host announcing itself releases the hold
 *   - a close with several watches awaited is settled one watch at a
 *     time on the reconnects that follow
 *   - a peer that never closes for size is re-subscribed all at once
 */

import { type IncomingLifelinePort, setLifelineServer } from '@openheaders/core/awareness';
import { setHostLogger } from '@openheaders/core/logger';
import {
  TELEMETRY_HOST_READY_TYPE,
  TELEMETRY_LIFECYCLE_BATCH_TYPE,
  TELEMETRY_LIFECYCLE_CONSUMER_TYPE,
} from '@openheaders/core/protocol';
import type { LifecycleConsumerMessage } from '@openheaders/core/request-lifecycle';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { type BrowserLiveRelay, createBrowserLiveRelay } from '../../../src/daemon/telemetry/browser-live-relay';
import type {
  OracleWsServer,
  PeerChangeEvent,
  PeerChangeListener,
  PeerSummary,
} from '../../../src/host-runtime/ws-server';

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

const PEER: PeerSummary = {
  peerId: 'peer-a',
  role: 'extension',
  agent: '@openheaders/extension@2026.11.0',
  workspaceId: 'default',
  nodeId: 'node-a',
  installId: null,
  tokenId: null,
  userId: null,
  isLoopback: true,
};

interface Rig {
  relay: BrowserLiveRelay;
  /** Open a viewer port on a tab and send its subscribe. */
  watch(tabId: number): FakePort;
  /** `tabId:kind` of every consumer frame sent to the peer since the last read. */
  takeConsumerFrames(): string[];
  /** The peer's stream for a tab delivered a frame. */
  answer(tabId: number, consumerId: string): void;
  emit(event: PeerChangeEvent): void;
}

function rig(): Rig {
  const handlers = new Set<(port: IncomingLifelinePort) => void>();
  setLifelineServer({
    onConnect(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  });
  const frames: Record<string, unknown>[] = [];
  const listeners = new Set<PeerChangeListener>();
  const server: OracleWsServer = {
    broadcast: () => undefined,
    broadcastFrame(frame, opts) {
      if (!opts?.filterPeer || opts.filterPeer(PEER)) frames.push(frame);
    },
    connectedCount: () => 1,
    connectedTokenIds: () => new Set<string>(),
    closePeersByTokenId: () => 0,
    listConnectedPeers: () => [PEER],
    subscribePeerChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: async () => undefined,
  };
  const relay = createBrowserLiveRelay();
  relay.setWsServer(server);
  relay.installLifeline();
  frames.length = 0;
  return {
    relay,
    watch(tabId) {
      const port = fakePort(`oh-lifecycle:${tabId}@node-a`);
      for (const handler of handlers) handler(port);
      port.send({ kind: 'subscribe' });
      return port;
    },
    takeConsumerFrames() {
      const taken = frames
        .splice(0)
        .filter((frame) => frame.type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE)
        .map((frame) => `${String(frame.tabId)}:${(frame.message as LifecycleConsumerMessage).kind}`);
      return taken;
    },
    answer(tabId, consumerId) {
      relay.peerPush.handle(
        {
          type: TELEMETRY_LIFECYCLE_BATCH_TYPE,
          tabId,
          consumerId,
          messages: [{ kind: 'ready', tabId, watermarkMs: -1 }],
        },
        PEER,
      );
    },
    emit(event) {
      for (const listener of listeners) listener(event);
    },
  };
}

const HELD = (tabId: number) => ({ kind: 'watch-refused', tabId, reason: 'history-too-large' });

beforeEach(() => {
  setHostLogger(consoleLogger);
});

describe('createBrowserLiveRelay — a watch held for an oversized replay', () => {
  it('holds the one awaited watch, tells its viewers, and re-subscribes only the others', () => {
    const r = rig();
    const light = r.watch(7);
    r.answer(7, 'c1');
    const heavy = r.watch(9);
    expect(r.takeConsumerFrames()).toEqual(['7:subscribe', '9:subscribe']);
    light.posted.length = 0;

    // Tab 9's replay never arrives: the server closes the peer for size.
    r.emit({ kind: 'disconnect', peer: PEER, cause: 'frame-too-large' });
    expect(heavy.posted).toEqual([HELD(9)]);
    expect(light.posted).toEqual([]);

    // The reconnect asks for tab 7 again and leaves tab 9 alone.
    r.emit({ kind: 'connect', peer: PEER });
    expect(r.takeConsumerFrames()).toEqual(['7:subscribe']);
    r.relay.dispose();
  });

  it('refuses a new viewer of a held watch at once, without asking the peer', () => {
    const r = rig();
    r.watch(9);
    r.emit({ kind: 'disconnect', peer: PEER, cause: 'frame-too-large' });
    r.emit({ kind: 'connect', peer: PEER });
    r.takeConsumerFrames();

    const late = r.watch(9);
    expect(late.posted).toEqual([HELD(9)]);
    expect(r.takeConsumerFrames()).toEqual([]);
    r.relay.dispose();
  });

  it('clear-session crosses, releases the hold and asks every viewer’s stream again', () => {
    const r = rig();
    const first = r.watch(9);
    r.emit({ kind: 'disconnect', peer: PEER, cause: 'frame-too-large' });
    r.emit({ kind: 'connect', peer: PEER });
    const second = r.watch(9);
    r.takeConsumerFrames();

    first.send({ kind: 'clear-session' });
    expect(r.takeConsumerFrames()).toEqual(['9:clear-session', '9:subscribe', '9:subscribe']);

    // Asked again, it is an ordinary watch: a later close for another
    // reason holds nothing.
    r.answer(9, 'c1');
    r.emit({ kind: 'disconnect', peer: PEER });
    r.emit({ kind: 'connect', peer: PEER });
    expect(r.takeConsumerFrames()).toEqual(['9:subscribe', '9:subscribe']);
    expect(second.posted.filter((m) => (m as { kind?: string }).kind === 'watch-refused')).toEqual([HELD(9)]);
    r.relay.dispose();
  });

  it('a clear on a watch that is not held just crosses', () => {
    const r = rig();
    const port = r.watch(7);
    r.takeConsumerFrames();
    port.send({ kind: 'clear-session' });
    expect(r.takeConsumerFrames()).toEqual(['7:clear-session']);
    r.relay.dispose();
  });

  it('the peer’s telemetry host announcing itself releases its holds', () => {
    const r = rig();
    r.watch(9);
    r.takeConsumerFrames();
    r.emit({ kind: 'disconnect', peer: PEER, cause: 'frame-too-large' });
    r.emit({ kind: 'connect', peer: PEER });
    expect(r.takeConsumerFrames()).toEqual([]);

    // A host that just came up holds no history from before.
    r.relay.peerPush.handle({ type: TELEMETRY_HOST_READY_TYPE }, PEER);
    expect(r.takeConsumerFrames()).toEqual(['9:subscribe']);
    r.relay.dispose();
  });

  it('settles a close with several watches awaited one watch at a time', () => {
    const r = rig();
    const a = r.watch(1);
    const b = r.watch(2);
    const c = r.watch(3);
    r.takeConsumerFrames();

    // All three awaited: the close names none of them.
    r.emit({ kind: 'disconnect', peer: PEER, cause: 'frame-too-large' });
    expect([a.posted, b.posted, c.posted]).toEqual([[], [], []]);

    // The reconnect asks for one; each answer releases the next.
    r.emit({ kind: 'connect', peer: PEER });
    expect(r.takeConsumerFrames()).toEqual(['1:subscribe']);
    r.answer(1, 'c1');
    expect(r.takeConsumerFrames()).toEqual(['2:subscribe']);

    // Tab 2's replay closes the wire — it alone was awaited.
    r.emit({ kind: 'disconnect', peer: PEER, cause: 'frame-too-large' });
    expect(b.posted).toEqual([HELD(2)]);

    r.emit({ kind: 'connect', peer: PEER });
    expect(r.takeConsumerFrames()).toEqual(['1:subscribe']);
    r.answer(1, 'c1');
    expect(r.takeConsumerFrames()).toEqual(['3:subscribe']);
    r.answer(3, 'c3');

    // Settled: the next reconnect asks for both at once again.
    r.emit({ kind: 'disconnect', peer: PEER });
    r.emit({ kind: 'connect', peer: PEER });
    expect(r.takeConsumerFrames()).toEqual(['1:subscribe', '3:subscribe']);
    expect(c.posted.filter((m) => (m as { kind?: string }).kind === 'watch-refused')).toEqual([]);
    r.relay.dispose();
  });

  it('a queued watch whose last viewer leaves passes its turn on', () => {
    const r = rig();
    r.watch(1);
    const b = r.watch(2);
    r.watch(3);
    r.emit({ kind: 'disconnect', peer: PEER, cause: 'frame-too-large' });
    r.emit({ kind: 'connect', peer: PEER });
    r.takeConsumerFrames();

    b.disconnect();
    r.takeConsumerFrames();
    r.answer(1, 'c1');
    expect(r.takeConsumerFrames()).toEqual(['3:subscribe']);
    r.relay.dispose();
  });

  it('a peer that never closes for size is re-subscribed all at once', () => {
    const r = rig();
    r.watch(1);
    r.watch(2);
    r.watch(3);
    r.takeConsumerFrames();
    r.emit({ kind: 'disconnect', peer: PEER });
    r.emit({ kind: 'connect', peer: PEER });
    expect(r.takeConsumerFrames()).toEqual(['1:subscribe', '2:subscribe', '3:subscribe']);
    r.relay.dispose();
  });
});
