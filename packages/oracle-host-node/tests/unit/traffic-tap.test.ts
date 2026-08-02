/**
 * Traffic-tap seam pins (AGENT_TRAFFIC_PLAN.md §8 S1): the loopback
 * lifeline dialer reaches acceptors registered through the wrapper, the
 * browser-tab source rides the relay's exact consumer contract
 * (qualified port name + `subscribe` handshake), the proxy source
 * attaches to a real hub with identical floor semantics, and the
 * registry's status surface stays content-free.
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
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installLoopbackLifelineDialer } from '../../src/traffic/loopback-lifeline';
import { createTrafficTap } from '../../src/traffic/tap';

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

/**
 * A minimal relay-shaped acceptor: claims qualified lifecycle ports,
 * answers `subscribe` with `ready` + a canned replay, then exposes the
 * port for live pushes — the consumer contract S0 recorded.
 */
function installFakeRelay(replay: RequestLifecycle[]) {
  const ports: IncomingLifelinePort[] = [];
  const disconnects: number[] = [];
  const uninstall = getLifelineServer().onConnect((port) => {
    const target = parseQualifiedLifecyclePortName(port.name);
    if (target === null) return;
    ports.push(port);
    port.onMessage<LifecycleConsumerMessage>((msg) => {
      if (msg.kind !== 'subscribe') return;
      port.postMessage({ kind: 'ready', tabId: target.tabId, watermarkMs: 500 } satisfies LifecycleWireMessage);
      port.postMessage({ kind: 'source', tabId: target.tabId, source: 'heuristic' } satisfies LifecycleWireMessage);
      for (const lifecycle of replay) {
        port.postMessage({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle } });
      }
    });
    port.onDisconnect(() => disconnects.push(target.tabId));
  });
  return { ports, disconnects, uninstall };
}

describe('traffic tap — browser-tab source over the loopback lifeline', () => {
  let priorServer: LifelineServer;

  beforeEach(() => {
    setHostLogger(consoleLogger);
    priorServer = getLifelineServer();
  });

  afterEach(() => {
    setLifelineServer(priorServer);
  });

  it('dials the qualified acceptor, honors the arm floor, and detaches on disarm', () => {
    const dialer = installLoopbackLifelineDialer();
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([
      // Below/at the ready watermark (500) — pre-arm history the shared
      // watch-session floor replays but retention must drop.
      makeLifecycle({ requestId: 'pre-arm', startedAtMs: 400 }),
      makeLifecycle({ requestId: 'post-arm', startedAtMs: 900 }),
    ]);

    const tap = createTrafficTap({ dialer, proxyHub });
    const uid = tap.armBrowserTab('ext-node-1', 7);
    expect(uid).toBe('browser-tab:ext-node-1:7');
    expect(relay.ports).toHaveLength(1);

    const records = tap.records(uid ?? '');
    expect(records?.map((r) => r.requestId)).toEqual(['post-arm']);

    const [status] = tap.status();
    expect(status?.state).toBe('streaming');
    expect(status?.stats.droppedPreArm).toBe(1);
    expect(status?.stats.readyEpochs).toBe(1);

    // Live push after the replay lands in the same reducer path.
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'started', lifecycle: makeLifecycle({ requestId: 'live', startedAtMs: 1_200 }) },
    });
    expect(tap.records(uid ?? '')?.map((r) => r.requestId)).toEqual(['post-arm', 'live']);

    expect(tap.disarm(uid ?? '')).toBe(true);
    expect(relay.disconnects).toEqual([7]);
    expect(tap.status()).toEqual([]);
    relay.uninstall();
    proxyHub.dispose();
  });

  it('refuses the arm when no acceptor claims the qualified port', () => {
    const dialer = installLoopbackLifelineDialer();
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const tap = createTrafficTap({ dialer, proxyHub });
    expect(tap.armBrowserTab('ext-node-1', 7)).toBeNull();
    expect(tap.status()).toEqual([]);
    proxyHub.dispose();
  });

  it('arming an armed partition is idempotent — one subscription, same uid', () => {
    const dialer = installLoopbackLifelineDialer();
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({ dialer, proxyHub });
    const first = tap.armBrowserTab('ext-node-1', 7);
    const second = tap.armBrowserTab('ext-node-1', 7);
    expect(second).toBe(first);
    expect(relay.ports).toHaveLength(1);
    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });
});

describe('traffic tap — proxy source over a real hub', () => {
  let priorServer: LifelineServer;

  beforeEach(() => {
    setHostLogger(consoleLogger);
    priorServer = getLifelineServer();
  });

  afterEach(() => {
    setLifelineServer(priorServer);
  });

  it('attaches at arm time and retains only post-arm proxy exchanges', () => {
    const dialer = installLoopbackLifelineDialer();
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    // PROXY_LIFECYCLE_TAB_ID partition traffic from before the arm — the
    // hub floors a FIRST watcher at the watermark, so this never replays.
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: -59210, requestId: 'pre', startedAtMs: 100 }) });

    const tap = createTrafficTap({ dialer, proxyHub });
    const uid = tap.armProxy();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: -59210, requestId: 'post', startedAtMs: 200 }) });

    const records = tap.records(uid);
    expect(records?.map((r) => r.requestId)).toEqual(['post']);
    expect(records?.[0]?.provenance).toBe('proxy');

    tap.dispose();
    proxyHub.dispose();
  });
});
