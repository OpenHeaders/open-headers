/**
 * Traffic-tap seam pins (the agent-traffic plan §8 S1): the loopback
 * lifeline dialer reaches acceptors registered through the wrapper, the
 * browser-tab source rides the relay's exact consumer contract
 * (qualified port name + `subscribe` handshake), the proxy source
 * attaches to a real hub with identical floor semantics, and the
 * registry's status surface stays content-free.
 */

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installLoopbackLifelineDialer } from '../../src/traffic/loopback-lifeline';
import { createTrafficPartitionMirror } from '../../src/traffic/partition-mirror';
import { openContainer } from '../../src/traffic/seal';
import { createTrafficSessionArchive } from '../../src/traffic/session-archive';
import {
  createTrafficTap,
  DEFAULT_TRAFFIC_ARM_TTL_MS,
  MAX_TRAFFIC_REVEAL_TTL_MS,
  TRAFFIC_BODY_PULL_TIMEOUT_MS,
} from '../../src/traffic/tap';

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
  const consumerMessages: LifecycleConsumerMessage[] = [];
  const uninstall = getLifelineServer().onConnect((port) => {
    const target = parseQualifiedLifecyclePortName(port.name);
    if (target === null) return;
    ports.push(port);
    port.onMessage<LifecycleConsumerMessage>((msg) => {
      consumerMessages.push(msg);
      if (msg.kind !== 'subscribe') return;
      port.postMessage({ kind: 'ready', tabId: target.tabId, watermarkMs: 500 } satisfies LifecycleWireMessage);
      port.postMessage({ kind: 'source', tabId: target.tabId, source: 'heuristic' } satisfies LifecycleWireMessage);
      for (const lifecycle of replay) {
        port.postMessage({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle } });
      }
    });
    port.onDisconnect(() => disconnects.push(target.tabId));
  });
  return { ports, disconnects, consumerMessages, uninstall };
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
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([
      // Below/at the ready watermark (500) — pre-arm history the shared
      // watch-session floor replays but retention must drop.
      makeLifecycle({ requestId: 'pre-arm', startedAtMs: 400 }),
      makeLifecycle({ requestId: 'post-arm', startedAtMs: 900 }),
    ]);

    const tap = createTrafficTap({ mirror, proxyHub });
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
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const tap = createTrafficTap({ mirror, proxyHub });
    expect(tap.armBrowserTab('ext-node-1', 7)).toBeNull();
    expect(tap.status()).toEqual([]);
    proxyHub.dispose();
  });

  it('arming an armed partition is idempotent — one subscription, same uid', () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({ mirror, proxyHub });
    const first = tap.armBrowserTab('ext-node-1', 7);
    const second = tap.armBrowserTab('ext-node-1', 7);
    expect(second).toBe(first);
    expect(relay.ports).toHaveLength(1);
    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });
});

describe('traffic tap — idle expiry + reveal escalation (S2)', () => {
  let priorServer: LifelineServer;

  beforeEach(() => {
    setHostLogger(consoleLogger);
    priorServer = getLifelineServer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    setLifelineServer(priorServer);
  });

  it('an idle arm lapses into ABSENCE; observe reads push the expiry forward', () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({ mirror, proxyHub });
    const uid = tap.armBrowserTab('ext-node-1', 7, { ttlMs: 10_000 }) ?? '';

    expect(tap.status()[0]?.expiresAtMs).toBe(Date.now() + 10_000);

    // A read at t+8s keeps the source warm — the lapse moves to t+18s.
    vi.advanceTimersByTime(8_000);
    expect(tap.records(uid)).not.toBeNull();
    vi.advanceTimersByTime(8_000);
    expect(tap.status()).toHaveLength(1);

    // No reads for a full ttl: the sweep disarms and detaches — the
    // streaming cost stops without any caller touching the tap.
    vi.advanceTimersByTime(40_000);
    expect(relay.disconnects).toEqual([7]);
    expect(tap.status()).toEqual([]);
    expect(tap.records(uid)).toBeNull();

    // Status polling alone never extends an arm.
    const uid2 = tap.armBrowserTab('ext-node-1', 7, { ttlMs: 10_000 }) ?? '';
    const armedUntil = tap.status()[0]?.expiresAtMs;
    vi.advanceTimersByTime(9_000);
    tap.status();
    expect(tap.status()[0]?.expiresAtMs).toBe(armedUntil);
    expect(tap.records(uid2)).not.toBeNull();

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('defaults the ttl when none is given', () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({ mirror, proxyHub });
    tap.armBrowserTab('ext-node-1', 7);
    expect(tap.status()[0]?.expiresAtMs).toBe(Date.now() + DEFAULT_TRAFFIC_ARM_TTL_MS);
    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('escalate opens a hard-capped reveal window; outside it reads are redacted', () => {
    const AUTH =
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([
      makeLifecycle({
        requestId: 'secret',
        startedAtMs: 900,
        requestHeaders: [{ name: 'Authorization', value: AUTH }],
      }),
    ]);
    const tap = createTrafficTap({ mirror, proxyHub });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';

    // Default read: redacted.
    expect(JSON.stringify(tap.records(uid))).not.toContain(AUTH);

    // Unknown uid or nonsense ttl refuses; a real escalation reveals.
    expect(tap.escalate('browser-tab:missing:1', 5_000)).toBe(false);
    expect(tap.escalate(uid, 0)).toBe(false);
    expect(tap.escalate(uid, 5_000)).toBe(true);
    expect(JSON.stringify(tap.records(uid))).toContain(AUTH);

    // The window is time-boxed — after it lapses, redaction returns.
    vi.advanceTimersByTime(5_001);
    expect(JSON.stringify(tap.records(uid))).not.toContain(AUTH);

    // The requested ttl clamps to the hard ceiling.
    expect(tap.escalate(uid, Number.MAX_SAFE_INTEGER)).toBe(true);
    vi.advanceTimersByTime(MAX_TRAFFIC_REVEAL_TTL_MS + 1);
    expect(JSON.stringify(tap.records(uid))).not.toContain(AUTH);

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });
});

describe('traffic tap — wait plane (S4)', () => {
  let priorServer: LifelineServer;

  beforeEach(() => {
    setHostLogger(consoleLogger);
    priorServer = getLifelineServer();
  });

  afterEach(() => {
    vi.useRealTimers();
    setLifelineServer(priorServer);
  });

  function waitRig(replay: RequestLifecycle[] = []) {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay(replay);
    const tap = createTrafficTap({ mirror, proxyHub });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';
    const teardown = () => {
      tap.dispose();
      relay.uninstall();
      proxyHub.dispose();
    };
    return { tap, uid, relay, teardown };
  }

  it('an already-retained match resolves immediately, oldest first', async () => {
    const { tap, uid, teardown } = waitRig([
      makeLifecycle({ requestId: 'older', startedAtMs: 900, url: 'https://api.openheaders.io/renew' }),
      makeLifecycle({ requestId: 'newer', startedAtMs: 950, url: 'https://api.openheaders.io/renew' }),
    ]);
    const result = await tap.waitForRecord(uid, (r) => r.url.includes('/renew'), { timeoutMs: 5_000 });
    expect(result).toMatchObject({ ok: true, record: { requestId: 'older' } });
    expect(tap.status()[0]?.pendingWaits).toBe(0);
    teardown();
  });

  it('resolves on a live admission and on a refinement that turns a record matching', async () => {
    const { tap, uid, relay, teardown } = waitRig();
    // Admission leg.
    const admission = tap.waitForRecord(uid, (r) => r.url.includes('/probe'), { timeoutMs: 5_000 });
    expect(tap.status()[0]?.pendingWaits).toBe(1);
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: {
        kind: 'started',
        lifecycle: makeLifecycle({ requestId: 'p1', startedAtMs: 900, url: 'https://api.openheaders.io/probe' }),
      },
    });
    expect(await admission).toMatchObject({ ok: true, record: { requestId: 'p1' } });
    // Refinement leg: the record exists but only matches once the
    // status arrives — the wait settles on the phase patch.
    const refinement = tap.waitForRecord(uid, (r) => r.statusCode === 503, { timeoutMs: 5_000 });
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: {
        kind: 'phase',
        tabId: 7,
        requestId: 'p1',
        patch: { phase: 'completed', statusCode: 503, statusText: 'Service Unavailable' },
      },
    });
    expect(await refinement).toMatchObject({ ok: true, record: { requestId: 'p1', statusCode: 503 } });
    expect(tap.status()[0]?.pendingWaits).toBe(0);
    teardown();
  });

  it('a never-matching predicate times out cleanly with no leaked watch', async () => {
    vi.useFakeTimers();
    const { tap, uid, relay, teardown } = waitRig();
    const pending = tap.waitForRecord(uid, () => false, { timeoutMs: 2_000 });
    expect(tap.status()[0]?.pendingWaits).toBe(1);
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'started', lifecycle: makeLifecycle({ requestId: 'noise', startedAtMs: 900 }) },
    });
    await vi.advanceTimersByTimeAsync(2_001);
    expect(await pending).toEqual({ ok: false, reason: 'timeout' });
    expect(tap.status()[0]?.pendingWaits).toBe(0);
    // A later wait behaves identically — nothing lingered.
    const again = tap.waitForRecord(uid, (r) => r.requestId === 'noise', { timeoutMs: 2_000 });
    expect(await again).toMatchObject({ ok: true, record: { requestId: 'noise' } });
    teardown();
  });

  it('disarm mid-wait settles the watch honestly; unknown uids answer null', async () => {
    const { tap, uid, teardown } = waitRig();
    const pending = tap.waitForRecord(uid, () => false, { timeoutMs: 60_000 });
    expect(tap.disarm(uid)).toBe(true);
    expect(await pending).toEqual({ ok: false, reason: 'source-disarmed' });
    expect(await tap.waitForRecord('browser-tab:missing:1', () => true, { timeoutMs: 1_000 })).toBeNull();
    teardown();
  });

  it('a resolved wait is an observe read — it extends the arm', async () => {
    vi.useFakeTimers();
    const { tap, uid, relay, teardown } = waitRig();
    const armedUntil = tap.status()[0]?.expiresAtMs ?? 0;
    const pending = tap.waitForRecord(uid, (r) => r.requestId === 'later', { timeoutMs: 60_000 });
    vi.advanceTimersByTime(10_000);
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'started', lifecycle: makeLifecycle({ requestId: 'later', startedAtMs: 900 }) },
    });
    expect(await pending).toMatchObject({ ok: true });
    expect(tap.status()[0]?.expiresAtMs ?? 0).toBeGreaterThan(armedUntil);
    teardown();
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
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    // PROXY_LIFECYCLE_TAB_ID partition traffic from before the arm — the
    // hub floors a FIRST watcher at the watermark, so this never replays.
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: -59210, requestId: 'pre', startedAtMs: 100 }) });

    const tap = createTrafficTap({ mirror, proxyHub });
    const uid = tap.armProxy();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: -59210, requestId: 'post', startedAtMs: 200 }) });

    const records = tap.records(uid);
    expect(records?.map((r) => r.requestId)).toEqual(['post']);
    expect(records?.[0]?.provenance).toBe('proxy');

    tap.dispose();
    proxyHub.dispose();
  });
});

describe('traffic tap — body plane (S3)', () => {
  let priorServer: LifelineServer;

  beforeEach(() => {
    setHostLogger(consoleLogger);
    priorServer = getLifelineServer();
  });

  afterEach(() => {
    vi.useRealTimers();
    setLifelineServer(priorServer);
  });

  const JWT =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';

  /** Relay fake with the body plane: answers `request-body` from a
   *  canned body table (silence when absent — the engine's contract). */
  function installBodyRelay(replay: RequestLifecycle[], bodies: Map<string, string>) {
    const pulls: Array<{ requestId: string; hopIndex: number }> = [];
    const uninstall = getLifelineServer().onConnect((port) => {
      const target = parseQualifiedLifecyclePortName(port.name);
      if (target === null) return;
      port.onMessage<LifecycleConsumerMessage>((msg) => {
        if (msg.kind === 'subscribe') {
          port.postMessage({ kind: 'ready', tabId: target.tabId, watermarkMs: 500 } satisfies LifecycleWireMessage);
          for (const lifecycle of replay) {
            port.postMessage({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle } });
          }
          return;
        }
        if (msg.kind === 'request-body') {
          pulls.push({ requestId: msg.requestId, hopIndex: msg.hopIndex });
          const content = bodies.get(msg.requestId);
          if (content === undefined) return;
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
                startedDateTime: '2026-08-03T10:00:00.000Z',
                content,
                encoding: '',
              },
            },
          } satisfies LifecycleWireMessage);
        }
      });
    });
    return { pulls, uninstall };
  }

  it('pulls a failure body eagerly at classification time and retains it capped + redacted', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installBodyRelay(
      [
        makeLifecycle({
          requestId: 'broken',
          startedAtMs: 900,
          phase: 'completed',
          statusCode: 500,
          statusText: 'Server Error',
        }),
      ],
      new Map([['broken', `{"error":"stack trace","token":"${JWT}"}`]]),
    );
    const tap = createTrafficTap({ mirror, proxyHub });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';

    // The seam defers a microtask before dispatching the pull.
    await Promise.resolve();
    expect(relay.pulls).toEqual([{ requestId: 'broken', hopIndex: 0 }]);

    // Default reads stay body-free; the failure read carries it, redacted.
    expect(JSON.stringify(tap.records(uid))).not.toContain('stack trace');
    const [record] = tap.records(uid, { includeFailureBodies: true }) ?? [];
    expect(record?.failureBody?.content).toContain('stack trace');
    expect(record?.failureBody?.content).not.toContain(JWT);

    // traffic_get's path answers from retention without a second pull.
    const pulled = await tap.pullBody(uid, 'broken');
    expect(pulled).toEqual({ ok: true, body: record?.failureBody });
    expect(relay.pulls).toHaveLength(1);

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('pulls a success body on demand without retaining it', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installBodyRelay(
      [makeLifecycle({ requestId: 'ok', startedAtMs: 900, phase: 'completed', statusCode: 200 })],
      new Map([['ok', '{"users":[1,2,3]}']]),
    );
    const tap = createTrafficTap({ mirror, proxyHub });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';
    await Promise.resolve();
    expect(relay.pulls).toEqual([]);

    const pulled = await tap.pullBody(uid, 'ok');
    expect(pulled).toEqual({ ok: true, body: { content: '{"users":[1,2,3]}', encoding: 'text', truncated: false } });
    expect(relay.pulls).toEqual([{ requestId: 'ok', hopIndex: 0 }]);
    // Never retained: the failure-read projection carries no body.
    const [record] = tap.records(uid, { includeFailureBodies: true }) ?? [];
    expect(record?.failureBody).toBeUndefined();

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('answers honest unavailability: unknown ids, in-flight, network failures, and silence', async () => {
    vi.useFakeTimers();
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installBodyRelay(
      [
        makeLifecycle({ requestId: 'in-flight', startedAtMs: 900, phase: 'pending' }),
        makeLifecycle({
          requestId: 'net-error',
          startedAtMs: 901,
          phase: 'failed',
          error: { code: 'net::ERR_FAILED', reason: 'CORS' },
        }),
        makeLifecycle({ requestId: 'decayed', startedAtMs: 902, phase: 'completed', statusCode: 200 }),
      ],
      new Map(),
    );
    const tap = createTrafficTap({ mirror, proxyHub });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';

    expect(await tap.pullBody('browser-tab:missing:1', 'x')).toBeNull();
    expect(await tap.pullBody(uid, 'ghost')).toEqual({ ok: false, reason: 'unknown-request' });
    expect(await tap.pullBody(uid, 'in-flight')).toEqual({ ok: false, reason: 'in-flight' });
    expect(await tap.pullBody(uid, 'net-error')).toEqual({ ok: false, reason: 'no-response-body' });

    // A pull the engine cannot satisfy is silence — the bounded wait
    // resolves to the decay reason.
    const pending = tap.pullBody(uid, 'decayed');
    await vi.advanceTimersByTimeAsync(TRAFFIC_BODY_PULL_TIMEOUT_MS + 1);
    expect(await pending).toEqual({ ok: false, reason: 'gone' });

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('an empty body answer maps to a typed miss, never a fake empty body', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    // Two completed successes: one whose record proves bytes existed
    // (Content-Length), one with no size facts at all. The relay answers
    // both pulls with the engine's universal empty "no body to show"
    // (an unknown or dropped body arrives as empty, never an error).
    const relay = installBodyRelay(
      [
        makeLifecycle({
          requestId: 'was-there',
          startedAtMs: 900,
          phase: 'completed',
          statusCode: 200,
          responseHeaders: [{ name: 'Content-Length', value: '60' }],
        }),
        makeLifecycle({ requestId: 'never-there', startedAtMs: 901, phase: 'completed', statusCode: 204 }),
      ],
      new Map([
        ['was-there', ''],
        ['never-there', ''],
      ]),
    );
    const tap = createTrafficTap({ mirror, proxyHub });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';
    await Promise.resolve();

    // Bytes were observed ⇒ the body is gone; no size facts ⇒ there was
    // never body content to serve. Neither projects a fake empty body.
    expect(await tap.pullBody(uid, 'was-there')).toEqual({ ok: false, reason: 'gone' });
    expect(await tap.pullBody(uid, 'never-there')).toEqual({ ok: false, reason: 'no-response-body' });

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('getRecord projects one identity with the failure body attached', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installBodyRelay(
      [makeLifecycle({ requestId: 'broken', startedAtMs: 900, phase: 'completed', statusCode: 404 })],
      new Map([['broken', 'not found']]),
    );
    const tap = createTrafficTap({ mirror, proxyHub });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';
    await Promise.resolve();

    expect(tap.getRecord(uid, 'ghost')).toBeNull();
    expect(tap.getRecord('browser-tab:missing:1', 'broken')).toBeNull();
    const record = tap.getRecord(uid, 'broken');
    expect(record?.statusCode).toBe(404);
    expect(record?.failureBody?.content).toBe('not found');

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });
});

describe('traffic tap — recording sessions (S7, rebuilt on the C3 archive)', () => {
  let priorServer: LifelineServer;
  let archiveDir: string;
  let sealKey: Buffer;

  const AUTH =
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';

  beforeEach(() => {
    setHostLogger(consoleLogger);
    priorServer = getLifelineServer();
    archiveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-tap-sessions-'));
    sealKey = randomBytes(32);
  });

  afterEach(() => {
    vi.useRealTimers();
    setLifelineServer(priorServer);
    fs.rmSync(archiveDir, { recursive: true, force: true });
  });

  function makeArchive() {
    return createTrafficSessionArchive({ dir: archiveDir, sealKey });
  }

  function sealedLines(dirPath: string): Array<{ kind: string; reason?: string; msg?: { kind: string } }> {
    const framed = fs.readFileSync(path.join(dirPath, 'events.seal'));
    return openContainer(framed, sealKey)
      .content.toString('utf8')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  }

  it('refuses unknown sources, hosts without an archive, and doubled starts', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);

    const bare = createTrafficTap({ mirror, proxyHub });
    const bareUid = bare.armBrowserTab('ext-node-1', 7) ?? '';
    expect(bare.captureStart(bareUid, { name: 's' })).toEqual({ ok: false, reason: 'capture-unavailable' });
    bare.dispose();

    const tap = createTrafficTap({ mirror, proxyHub, archive: makeArchive() });
    expect(tap.captureStart('browser-tab:missing:1', { name: 's' })).toEqual({ ok: false, reason: 'unknown-source' });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';
    const first = tap.captureStart(uid, { name: 'one' });
    expect(first.ok).toBe(true);
    expect(tap.captureStart(uid, { name: 'two' })).toEqual({ ok: false, reason: 'capture-active' });

    // Quiesce before teardown — afterEach removes the archive dir.
    tap.captureStop(uid);
    await vi.waitFor(() => {
      expect(tap.captureSessions()[0]?.state).toBe('sealed');
    });

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('records the raw event log — plaintext while active, sealed encrypted on stop (§11.5)', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({ mirror, proxyHub, archive: makeArchive() });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';

    const started = tap.captureStart(uid, { name: 'raw at rest' });
    if (!started.ok) throw new Error('capture refused');
    expect(started.session.state).toBe('recording');
    expect(started.session.encrypted).toBe(true);
    expect(started.session.planes).toEqual(['lifecycle']);
    expect(tap.status()[0]?.capture?.sessionId).toBe(started.session.sessionId);

    // A reveal window open during recording changes NOTHING about the
    // session — the store is raw by design now; redaction is a read-time
    // projection concern, not a write-time one.
    expect(tap.escalate(uid, 60_000)).toBe(true);
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: {
        kind: 'started',
        lifecycle: makeLifecycle({
          requestId: 'secret',
          startedAtMs: 900,
          requestHeaders: [{ name: 'Authorization', value: AUTH }],
        }),
      },
    });
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'phase', tabId: 7, requestId: 'secret', patch: { phase: 'completed', statusCode: 200 } },
    });

    // The ACTIVE log is plaintext (crash-safe append) and carries the
    // raw value — the inversion of the v1 write-time pin.
    await vi.waitFor(() => {
      expect(tap.status()[0]?.capture?.events).toBe(2);
    });
    const dirPath = started.session.dirPath;
    expect(fs.readFileSync(path.join(dirPath, 'events.jsonl'), 'utf8')).toContain(AUTH);

    const stopped = tap.captureStop(uid);
    expect(stopped?.endReason).toBe('stopped');
    expect(stopped?.requests).toBe(1);
    expect(tap.status()[0]?.capture).toBeUndefined();

    // The ended list projects LIVE state: sealing completes async.
    await vi.waitFor(() => {
      expect(tap.captureSessions()[0]?.state).toBe('sealed');
    });
    expect(fs.existsSync(path.join(dirPath, 'events.jsonl'))).toBe(false);
    // Sealed bytes never carry the plaintext secret…
    expect(fs.readFileSync(path.join(dirPath, 'events.seal')).includes(Buffer.from(AUTH, 'utf8'))).toBe(false);
    // …but the decrypted log does, at full fidelity, with the honest
    // v2 frame: header → events → end trailer.
    const lines = sealedLines(dirPath);
    expect(lines.map((l) => l.kind)).toEqual(['header', 'event', 'event', 'end']);
    expect((lines[0] as { formatVersion?: number }).formatVersion).toBe(2);
    expect(JSON.stringify(lines)).toContain(AUTH);
    expect(lines.at(-1)?.reason).toBe('stopped');

    // Idempotent stop: nothing recording answers null.
    expect(tap.captureStop(uid)).toBeNull();
    expect(tap.captureSessions().map((s) => s.sessionId)).toEqual([started.session.sessionId]);

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('disarm stops the recording (absence cascades) with the honest end reason', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({ mirror, proxyHub, archive: makeArchive() });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';
    const started = tap.captureStart(uid, { name: 'cascade' });
    if (!started.ok) throw new Error('capture refused');

    expect(tap.disarm(uid)).toBe(true);
    await vi.waitFor(() => {
      expect(tap.captureSessions()[0]?.state).toBe('sealed');
    });
    const [session] = tap.captureSessions();
    expect(session?.endReason).toBe('source-disarmed');
    expect(sealedLines(session?.dirPath ?? '').at(-1)?.reason).toBe('source-disarmed');

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('an active recording holds the arm; the idle clock restarts when the session ends', async () => {
    vi.useFakeTimers();
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({ mirror, proxyHub, archive: makeArchive() });
    const uid = tap.armBrowserTab('ext-node-1', 7, { ttlMs: 5_000 }) ?? '';
    const started = tap.captureStart(uid, { name: 'overnight', bounds: { maxDurationMs: 10 * 60 * 1000 } });
    if (!started.ok) throw new Error('capture refused');

    // Far past the arm ttl with zero reads: the source survives — a
    // quiet night must not end an overnight recording.
    vi.advanceTimersByTime(60_000);
    expect(tap.status()).toHaveLength(1);
    expect(relay.disconnects).toEqual([]);

    // Session ends → the idle clock restarts, then lapses normally.
    tap.captureStop(uid);
    expect(tap.status()).toHaveLength(1);
    vi.advanceTimersByTime(5_001 + 30_000);
    expect(tap.status()).toEqual([]);
    expect(relay.disconnects).toEqual([7]);

    // Quiesce before teardown — afterEach removes the archive dir.
    await vi.waitFor(() => {
      expect(tap.captureSessions()[0]?.state).toBe('sealed');
    });

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('the log byte bound trips mid-stream: the session stops itself and retention is untouched', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({ mirror, proxyHub, archive: makeArchive() });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';
    const started = tap.captureStart(uid, { name: 'tiny', bounds: { maxBytes: 900 } });
    if (!started.ok) throw new Error('capture refused');

    for (let i = 0; i < 5; i++) {
      relay.ports[0]?.postMessage({
        kind: 'lifecycle-update',
        update: { kind: 'started', lifecycle: makeLifecycle({ requestId: `burst-${i}`, startedAtMs: 900 + i }) },
      });
    }

    await vi.waitFor(() => {
      expect(tap.captureSessions()[0]?.state).toBe('sealed');
    });
    expect(tap.status()[0]?.capture).toBeUndefined();
    const [session] = tap.captureSessions();
    expect(session?.endReason).toBe('size-bound');
    expect(session?.bytesWritten).toBeLessThanOrEqual(900);
    // Retention itself is untouched by the recorder's bound.
    expect(tap.records(uid)).toHaveLength(5);

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });

  it('pulls every response body at completion on debug-fed partitions — and skips the heuristic plane', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({ mirror, proxyHub, archive: makeArchive() });
    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';
    const started = tap.captureStart(uid, { name: 'wire honesty' });
    if (!started.ok) throw new Error('capture refused');

    // Heuristic-fed (the relay's subscribe answer): bodies arrive
    // inline on har-attached, so completion never round-trips a pull.
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'started', lifecycle: makeLifecycle({ requestId: 'h-1', startedAtMs: 900 }) },
    });
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'phase', tabId: 7, requestId: 'h-1', patch: { phase: 'completed', statusCode: 200 } },
    });
    expect(relay.consumerMessages.filter((m) => m.kind === 'request-body')).toEqual([]);

    // The partition flips to CDP: completion now pulls the final hop —
    // hop 0 for a direct exchange, hop N after N redirects — once per
    // request, over the tap's own wire session.
    relay.ports[0]?.postMessage({ kind: 'source', tabId: 7, source: 'cdp' });
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'started', lifecycle: makeLifecycle({ requestId: 'c-1', startedAtMs: 910 }) },
    });
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'phase', tabId: 7, requestId: 'c-1', patch: { phase: 'completed', statusCode: 200 } },
    });
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'started', lifecycle: makeLifecycle({ requestId: 'c-2', startedAtMs: 920 }) },
    });
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: {
        kind: 'redirect',
        tabId: 7,
        requestId: 'c-2',
        hop: {
          sourceUrl: 'https://api.openheaders.io/from',
          redirectUrl: 'https://api.openheaders.io/to',
          statusCode: 302,
          timestampMs: 921,
        },
        nextUrl: 'https://api.openheaders.io/to',
      },
    });
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'phase', tabId: 7, requestId: 'c-2', patch: { phase: 'completed', statusCode: 200 } },
    });
    // A refinement on an already-completed request never re-pulls.
    relay.ports[0]?.postMessage({
      kind: 'lifecycle-update',
      update: { kind: 'phase', tabId: 7, requestId: 'c-1', patch: { phase: 'completed', fromCache: true } },
    });

    expect(relay.consumerMessages.filter((m) => m.kind === 'request-body')).toEqual([
      { kind: 'request-body', requestId: 'c-1', hopIndex: 0 },
      { kind: 'request-body', requestId: 'c-2', hopIndex: 1 },
    ]);

    // Quiesce before teardown — afterEach removes the archive dir.
    tap.captureStop(uid);
    await vi.waitFor(() => {
      expect(tap.captureSessions()[0]?.state).toBe('sealed');
    });

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });
});

describe('traffic tap — status-change invalidation feed', () => {
  let priorServer: LifelineServer;
  let archiveDir: string;

  beforeEach(() => {
    setHostLogger(consoleLogger);
    priorServer = getLifelineServer();
    archiveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-tap-status-'));
  });

  afterEach(() => {
    setLifelineServer(priorServer);
    fs.rmSync(archiveDir, { recursive: true, force: true });
  });

  it('fires post-commit on arm, capture start/stop, and disarm — never on reads or idempotent re-arms', async () => {
    const dialer = installLoopbackLifelineDialer();
    const mirror = createTrafficPartitionMirror({ dialer });
    const store = new RequestLifecycleStore();
    const proxyHub = new RequestLifecycleHub({ store });
    const relay = installFakeRelay([]);
    const tap = createTrafficTap({
      mirror,
      proxyHub,
      archive: createTrafficSessionArchive({ dir: archiveDir, sealKey: randomBytes(32) }),
    });
    let ticks = 0;
    // Post-commit contract: a listener reading status() sees the state
    // the tick announced.
    let statusAtLastTick = 0;
    const unsubscribe = tap.onStatusChanged(() => {
      ticks++;
      statusAtLastTick = tap.status().length;
    });

    const uid = tap.armBrowserTab('ext-node-1', 7) ?? '';
    expect(ticks).toBe(1);
    expect(statusAtLastTick).toBe(1);

    // Idempotent re-arm and content-free reads stay silent.
    tap.armBrowserTab('ext-node-1', 7);
    tap.status();
    tap.records(uid);
    expect(ticks).toBe(1);

    expect(tap.captureStart(uid, { name: 'run' }).ok).toBe(true);
    expect(ticks).toBe(2);
    tap.captureStop(uid);
    expect(ticks).toBe(3);

    tap.disarm(uid);
    expect(ticks).toBe(4);
    expect(statusAtLastTick).toBe(0);

    unsubscribe();
    tap.armProxy();
    expect(ticks).toBe(4);

    // Quiesce before teardown (after unsubscribe — the seal's own
    // status tick must not enter the count): afterEach removes the
    // archive dir.
    await vi.waitFor(() => {
      expect(tap.captureSessions()[0]?.state).toBe('sealed');
    });

    tap.dispose();
    relay.uninstall();
    proxyHub.dispose();
  });
});
