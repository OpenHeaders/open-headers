/**
 * Partition-mirror pins (AGENT_TRAFFIC_PLAN.md §11.2, C2): one wire
 * session per watched partition regardless of reader count, viewers
 * served hub-style from the LOCAL store (§10 read-model law), the tap
 * fed the verbatim envelope stream with the synthesized arm floor for
 * late joins, reconnect epochs resetting the fold, clear-session
 * converging every reader, and the interposer claiming only real-tab
 * qualified lifelines.
 */

import {
  getLifelineServer,
  type IncomingLifelinePort,
  type LifelineServer,
  setLifelineServer,
} from '@openheaders/core/awareness';
import { setHostLogger } from '@openheaders/core/logger';
import {
  type LifecycleConsumerMessage,
  type LifecycleWireMessage,
  parseQualifiedLifecyclePortName,
  type RequestLifecycle,
} from '@openheaders/core/request-lifecycle';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { TrafficRetentionConsumer, TrafficRetentionRing } from '@openheaders/oracle/traffic-retention';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installLoopbackLifelineDialer } from '../../src/traffic/loopback-lifeline';
import { createTrafficPartitionMirror, type TrafficPartitionMirror } from '../../src/traffic/partition-mirror';

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 7,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/users',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

/** A settable root server the tests push "renderer" ports through —
 *  the real IPC lifeline server's role in production. */
function installFakeRootServer() {
  const handlers = new Set<(port: IncomingLifelinePort) => void>();
  setLifelineServer({
    onConnect(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  });
  return {
    push(port: IncomingLifelinePort): void {
      for (const handler of [...handlers]) handler(port);
    },
  };
}

/** A viewer-side port fake: captures pushes, lets the test drive the
 *  consumer messages and the disconnect the renderer would send. */
function makeViewerPort(name: string) {
  const received: LifecycleWireMessage[] = [];
  const messageHandlers: Array<(message: unknown) => void> = [];
  const disconnectHandlers: Array<(info: { errorMessage?: string }) => void> = [];
  const port: IncomingLifelinePort = {
    name,
    postMessage(message) {
      received.push(message as LifecycleWireMessage);
    },
    onMessage(handler) {
      messageHandlers.push(handler as (message: unknown) => void);
    },
    onDisconnect(handler) {
      disconnectHandlers.push(handler);
    },
  };
  return {
    port,
    received,
    send(message: LifecycleConsumerMessage): void {
      for (const handler of [...messageHandlers]) handler(message);
    },
    disconnect(): void {
      for (const handler of [...disconnectHandlers]) handler({});
    },
    kinds(): string[] {
      return received.map((m) => (m.kind === 'lifecycle-update' ? `update:${m.update.kind}` : m.kind));
    },
  };
}

/** Relay-shaped acceptor: claims real-tab qualified lifecycle ports,
 *  answers `subscribe` with ready + source + a canned replay, records
 *  every consumer message, and serves a canned body table. */
function installFakeRelay(replay: RequestLifecycle[], options?: { refuse?: boolean }) {
  const ports: IncomingLifelinePort[] = [];
  const subscribes: number[] = [];
  const pulls: Array<{ requestId: string; hopIndex: number }> = [];
  const clears: number[] = [];
  const disconnects: number[] = [];
  const uninstall = getLifelineServer().onConnect((port) => {
    const target = parseQualifiedLifecyclePortName(port.name);
    if (target === null || target.tabId < 0) return;
    ports.push(port);
    port.onMessage<LifecycleConsumerMessage>((msg) => {
      if (msg.kind === 'subscribe') {
        subscribes.push(target.tabId);
        if (options?.refuse === true) {
          port.postMessage({
            kind: 'watch-refused',
            tabId: target.tabId,
            reason: 'consent-off',
          } satisfies LifecycleWireMessage);
          return;
        }
        port.postMessage({ kind: 'ready', tabId: target.tabId, watermarkMs: 500 } satisfies LifecycleWireMessage);
        port.postMessage({ kind: 'source', tabId: target.tabId, source: 'heuristic' } satisfies LifecycleWireMessage);
        for (const lifecycle of replay) {
          port.postMessage({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle } });
        }
        return;
      }
      if (msg.kind === 'clear-session') {
        clears.push(target.tabId);
        return;
      }
      pulls.push({ requestId: msg.requestId, hopIndex: msg.hopIndex });
      port.postMessage({
        kind: 'lifecycle-update',
        update: {
          kind: 'body-attached',
          tabId: target.tabId,
          requestId: msg.requestId,
          hopIndex: msg.hopIndex,
          body: {
            method: 'GET',
            url: 'https://api.openheaders.io/users',
            startedDateTime: '2026-08-05T10:00:00.000Z',
            content: '{"users":[1]}',
            encoding: '',
          },
        },
      } satisfies LifecycleWireMessage);
    });
    port.onDisconnect(() => disconnects.push(target.tabId));
  });
  return { ports, subscribes, pulls, clears, disconnects, uninstall };
}

const VIEWER_PORT = 'oh-lifecycle:7@ext-node-1';

describe('traffic partition mirror (C2)', () => {
  let priorServer: LifelineServer;
  let mirror: TrafficPartitionMirror | null = null;
  let uninstallInterposer: (() => void) | null = null;

  beforeEach(() => {
    setHostLogger(consoleLogger);
    priorServer = getLifelineServer();
  });

  afterEach(() => {
    mirror?.dispose();
    mirror = null;
    uninstallInterposer?.();
    uninstallInterposer = null;
    setLifelineServer(priorServer);
  });

  function rig(replay: RequestLifecycle[] = [], options?: { refuse?: boolean }) {
    const root = installFakeRootServer();
    const dialer = installLoopbackLifelineDialer();
    mirror = createTrafficPartitionMirror({ dialer });
    uninstallInterposer = mirror.installInterposer();
    const relay = installFakeRelay(replay, options);
    return { root, relay, mirror };
  }

  it('one wire session serves a viewer and the tap; the subscribe crosses once', () => {
    const { root, relay } = rig([
      makeLifecycle({ requestId: 'a', startedAtMs: 700 }),
      makeLifecycle({ requestId: 'b', startedAtMs: 900 }),
    ]);
    const viewer = makeViewerPort(VIEWER_PORT);
    root.push(viewer.port);
    viewer.send({ kind: 'subscribe' });

    expect(relay.ports).toHaveLength(1);
    expect(relay.subscribes).toEqual([7]);
    expect(viewer.kinds()).toEqual(['ready', 'source', 'update:started', 'update:started']);

    // The tap joins the SAME session: no new dial, no new subscribe, a
    // synthesized ready whose watermark is the mirror's newest
    // startedAtMs — the arm floor (finding 6).
    const envelopes: LifecycleWireMessage[] = [];
    const seat = mirror?.attachTapConsumer('ext-node-1', 7, (m) => envelopes.push(m));
    expect(seat).not.toBeNull();
    expect(relay.ports).toHaveLength(1);
    expect(relay.subscribes).toEqual([7]);
    expect(envelopes[0]).toEqual({ kind: 'ready', tabId: 7, watermarkMs: 900 });
    expect(envelopes[1]).toEqual({ kind: 'source', tabId: 7, source: 'heuristic' });
  });

  it('a late viewer is served the LOCAL snapshot — no second wire replay', () => {
    const { root, relay } = rig([
      makeLifecycle({ requestId: 'a', startedAtMs: 700 }),
      makeLifecycle({ requestId: 'b', startedAtMs: 900 }),
    ]);
    const first = makeViewerPort(VIEWER_PORT);
    root.push(first.port);
    first.send({ kind: 'subscribe' });

    const late = makeViewerPort(VIEWER_PORT);
    root.push(late.port);
    late.send({ kind: 'subscribe' });

    expect(relay.subscribes).toEqual([7]);
    expect(late.kinds()).toEqual(['ready', 'update:started', 'update:started', 'source']);
    const replayed = late.received.filter((m) => m.kind === 'lifecycle-update');
    expect(
      replayed.map((m) =>
        m.kind === 'lifecycle-update' && m.update.kind === 'started' ? m.update.lifecycle.requestId : '',
      ),
    ).toEqual(['a', 'b']);
  });

  it('the tap joining a live session starts empty at the synthesized floor; a live frame admits past it', () => {
    const { root, relay, mirror: live } = rig([makeLifecycle({ requestId: 'history', startedAtMs: 900 })]);
    const viewer = makeViewerPort(VIEWER_PORT);
    root.push(viewer.port);
    viewer.send({ kind: 'subscribe' });

    const ring = new TrafficRetentionRing({ maxRecords: 100, maxBytes: 1_000_000 });
    const consumer = new TrafficRetentionConsumer({ ring });
    live?.attachTapConsumer('ext-node-1', 7, (m) => consumer.handle(m));
    expect(ring.snapshot()).toEqual([]);

    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'started', lifecycle: makeLifecycle({ requestId: 'fresh', startedAtMs: 1_200 }) },
    } satisfies LifecycleWireMessage);
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['fresh']);
    // The viewer sees history AND the fresh row — per-reader floors.
    expect(viewer.kinds().filter((k) => k === 'update:started')).toHaveLength(2);
  });

  it('a reconnect epoch resets the fold and re-serves viewers a fresh ready', () => {
    const { root, relay } = rig([makeLifecycle({ requestId: 'a', startedAtMs: 700 })]);
    const viewer = makeViewerPort(VIEWER_PORT);
    root.push(viewer.port);
    viewer.send({ kind: 'subscribe' });
    viewer.received.length = 0;

    // Wire flap: fresh ready + canonical replay of the surviving record.
    relay.ports[0]?.postMessage({ kind: 'ready', tabId: 7, watermarkMs: 800 } satisfies LifecycleWireMessage);
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'started', lifecycle: makeLifecycle({ requestId: 'a', startedAtMs: 700 }) },
    } satisfies LifecycleWireMessage);

    expect(viewer.kinds()).toEqual(['ready', 'source', 'update:started']);
    // A third viewer attach after the epoch snapshots exactly one row.
    const late = makeViewerPort(VIEWER_PORT);
    root.push(late.port);
    late.send({ kind: 'subscribe' });
    expect(late.kinds()).toEqual(['ready', 'update:started', 'source']);
  });

  it('clear-session forwards to the engine and converges every reader', () => {
    const { root, relay } = rig([makeLifecycle({ requestId: 'a', startedAtMs: 700 })]);
    const one = makeViewerPort(VIEWER_PORT);
    const two = makeViewerPort(VIEWER_PORT);
    root.push(one.port);
    root.push(two.port);
    one.send({ kind: 'subscribe' });
    two.send({ kind: 'subscribe' });
    one.received.length = 0;
    two.received.length = 0;

    one.send({ kind: 'clear-session' });
    expect(relay.clears).toEqual([7]);
    expect(one.kinds()).toEqual(['tab-cleared']);
    expect(two.kinds()).toEqual(['tab-cleared']);

    // A fresh viewer sees the emptied store.
    const after = makeViewerPort(VIEWER_PORT);
    root.push(after.port);
    after.send({ kind: 'subscribe' });
    expect(after.kinds()).toEqual(['ready', 'source']);
  });

  it('request-body forwards over the one wire and the answer reaches both planes', () => {
    const {
      root,
      relay,
      mirror: live,
    } = rig([makeLifecycle({ requestId: 'a', startedAtMs: 700, phase: 'completed', statusCode: 200 })]);
    const viewer = makeViewerPort(VIEWER_PORT);
    root.push(viewer.port);
    viewer.send({ kind: 'subscribe' });
    const envelopes: LifecycleWireMessage[] = [];
    live?.attachTapConsumer('ext-node-1', 7, (m) => envelopes.push(m));
    viewer.received.length = 0;
    envelopes.length = 0;

    viewer.send({ kind: 'request-body', requestId: 'a', hopIndex: 0 });
    expect(relay.pulls).toEqual([{ requestId: 'a', hopIndex: 0 }]);
    expect(viewer.kinds()).toEqual(['update:body-attached']);
    expect(envelopes.map((m) => (m.kind === 'lifecycle-update' ? m.update.kind : m.kind))).toEqual(['body-attached']);
  });

  it('a consent refusal reaches pending viewers and the tap verbatim', () => {
    const { root, mirror: live, relay } = rig([], { refuse: true });
    const viewer = makeViewerPort(VIEWER_PORT);
    root.push(viewer.port);
    const envelopes: LifecycleWireMessage[] = [];
    live?.attachTapConsumer('ext-node-1', 7, (m) => envelopes.push(m));
    viewer.send({ kind: 'subscribe' });

    expect(viewer.kinds()).toEqual(['watch-refused']);
    // The tap attached before the refused subscribe crossed — it hears
    // the same refusal envelope the dedicated port would have carried.
    expect(envelopes).toEqual([{ kind: 'watch-refused', tabId: 7, reason: 'consent-off' }]);
    expect(relay.subscribes).toEqual([7]);
  });

  it('the last reader out releases the wire; the next reader re-dials', () => {
    const { root, relay, mirror: live } = rig([]);
    const viewer = makeViewerPort(VIEWER_PORT);
    root.push(viewer.port);
    viewer.send({ kind: 'subscribe' });
    const seat = live?.attachTapConsumer('ext-node-1', 7, () => {});

    viewer.disconnect();
    expect(relay.disconnects).toEqual([]);
    seat?.detach();
    expect(relay.disconnects).toEqual([7]);

    const again = makeViewerPort(VIEWER_PORT);
    root.push(again.port);
    again.send({ kind: 'subscribe' });
    expect(relay.ports).toHaveLength(2);
    expect(relay.subscribes).toEqual([7, 7]);
    expect(again.kinds()).toEqual(['ready', 'source']);
  });

  it('the interposer passes non-tab lifelines through untouched', () => {
    const { root } = rig([]);
    const seen: string[] = [];
    const unregister = getLifelineServer().onConnect((port) => {
      seen.push(port.name);
    });

    root.push(makeViewerPort(VIEWER_PORT).port);
    root.push(makeViewerPort('oh-storage:7@ext-node-1').port);
    root.push(makeViewerPort('oh-console:7@ext-node-1').port);
    root.push(makeViewerPort('oh-lifecycle:-59210').port);
    root.push(makeViewerPort('oh-lifecycle:-1@ext-node-1').port);

    expect(seen).toEqual([
      'oh-storage:7@ext-node-1',
      'oh-console:7@ext-node-1',
      'oh-lifecycle:-59210',
      'oh-lifecycle:-1@ext-node-1',
    ]);
    unregister();
  });
});
