/**
 * Lifecycle port host (W-a) — chrome adapter wires `chrome.runtime.onConnect`
 * to `RequestLifecycleHub.attach` via the consumer's `subscribe` handshake.
 * Asserts:
 *   - port-name parsing accepts `oh-lifecycle:<tabId>` and rejects siblings
 *   - attach is deferred to the `subscribe` message → ready + replay
 *   - a second `subscribe` re-attaches in place against the same floor
 *   - dead-port postMessage throw is swallowed
 *   - onDisconnect triggers hub.detach (refcount + stops fanout)
 */

import { LIFECYCLE_PORT_PREFIX, lifecyclePortName, parseLifecyclePortName } from '@openheaders/core/request-lifecycle';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { describe, expect, it, vi } from 'vitest';

import { acceptLifecyclePort } from '@/background/lifecycle-port-host/accept-port';
import { createPortSink } from '@/background/lifecycle-port-host/port-sink';

interface FakePort {
  name: string;
  posted: unknown[];
  disconnectListeners: Array<() => void>;
  messageListeners: Array<(msg: unknown) => void>;
  onDisconnect: { addListener: (fn: () => void) => void };
  onMessage: { addListener: (fn: (msg: unknown) => void) => void };
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  /** Simulate an inbound frame from the consumer (e.g. a `subscribe`). */
  emit: (msg: unknown) => void;
}

function fakePort(name: string, postImpl?: (msg: unknown) => void): FakePort {
  const port: FakePort = {
    name,
    posted: [],
    disconnectListeners: [],
    messageListeners: [],
    onDisconnect: {
      addListener: (fn) => {
        port.disconnectListeners.push(fn);
      },
    },
    onMessage: {
      addListener: (fn) => {
        port.messageListeners.push(fn);
      },
    },
    postMessage: vi.fn((msg: unknown) => {
      if (postImpl) postImpl(msg);
      else port.posted.push(msg);
    }),
    disconnect: vi.fn(),
    emit: (msg) => {
      for (const fn of port.messageListeners) fn(msg);
    },
  };
  return port;
}

/** Send the consumer's `subscribe` handshake to trigger (or re-attach) attach. */
function subscribe(port: FakePort): void {
  port.emit({ kind: 'subscribe' });
}

describe('parseLifecyclePortName', () => {
  it('parses oh-lifecycle:<tabId> into a number', () => {
    expect(parseLifecyclePortName('oh-lifecycle:42')).toBe(42);
    expect(parseLifecyclePortName('oh-lifecycle:0')).toBe(0);
  });

  it('returns null for siblings / malformed', () => {
    expect(parseLifecyclePortName('devtools-inspector:1')).toBeNull();
    expect(parseLifecyclePortName('oh-lifecycle:')).toBeNull();
    expect(parseLifecyclePortName('oh-lifecycle:not-a-number')).toBeNull();
    expect(parseLifecyclePortName('')).toBeNull();
  });

  it('parses a negative id (the reserved synthetic proxy partition)', () => {
    // Valid at the parse layer — the extension acceptor refuses < 0
    // itself (below); the daemon acceptor serves the proxy sentinel.
    expect(parseLifecyclePortName('oh-lifecycle:-59210')).toBe(-59210);
  });

  it('lifecyclePortName + parseLifecyclePortName roundtrip', () => {
    expect(parseLifecyclePortName(lifecyclePortName(7))).toBe(7);
    expect(LIFECYCLE_PORT_PREFIX).toBe('oh-lifecycle:');
  });
});

describe('createPortSink', () => {
  it('posts ready and lifecycle-update envelopes', () => {
    const port = fakePort('oh-lifecycle:1');
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.deliverReady(1, 1234, 'tok-1');
    sink.deliverUpdate({
      kind: 'started',
      lifecycle: {
        tabId: 1,
        requestId: 'r',
        url: 'https://openheaders.io',
        method: 'GET',
        resourceType: 'xmlhttprequest',
        phase: 'pending',
        redirectHopCount: 0,
        redirectHops: [],
        startedAtMs: 1,
        hopStartedAtMs: 1,
        har: [],
        harBodyByHop: [],
      },
    });
    expect(port.posted).toEqual([
      { kind: 'ready', tabId: 1, watermarkMs: 1234, sessionToken: 'tok-1' },
      expect.objectContaining({ kind: 'lifecycle-update' }),
    ]);
  });

  it('passes an undefined session token through on ready', () => {
    const port = fakePort('oh-lifecycle:1');
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.deliverReady(1, 7, undefined);
    expect(port.posted).toEqual([{ kind: 'ready', tabId: 1, watermarkMs: 7 }]);
  });

  it('posts tab-cleared envelope on deliverTabCleared', () => {
    const port = fakePort('oh-lifecycle:1');
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.deliverTabCleared(1);
    expect(port.posted).toEqual([{ kind: 'tab-cleared', tabId: 1 }]);
  });

  it('swallows postMessage throws (dead port)', () => {
    const port = fakePort('oh-lifecycle:1', () => {
      throw new Error('port dead');
    });
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    expect(() => sink.deliverReady(1, -1, undefined)).not.toThrow();
  });

  it('close() disconnects the underlying port and swallows errors', () => {
    const port = fakePort('oh-lifecycle:1');
    const sink = createPortSink(port as unknown as chrome.runtime.Port);
    sink.close();
    expect(port.disconnect).toHaveBeenCalledTimes(1);

    port.disconnect = vi.fn(() => {
      throw new Error('already gone');
    });
    expect(() => sink.close()).not.toThrow();
  });
});

describe('acceptLifecyclePort', () => {
  it('rejects ports with the wrong prefix', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort('devtools-inspector:1');
    const accepted = acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);
    expect(accepted).toBe(false);
    expect(port.posted).toEqual([]);
  });

  it('refuses a reserved synthetic partition — the extension serves only real browser tabs', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    // PROXY_LIFECYCLE_TAB_ID rides a negative sentinel; a Node host's
    // acceptor serves it, the extension never does.
    const port = fakePort('oh-lifecycle:-59210');
    const accepted = acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);
    expect(accepted).toBe(false);
    expect(port.posted).toEqual([]);
  });

  it('defers attach until `subscribe`, then delivers ready + replay synchronously', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });

    // Panel opens on the empty tab → the session floor is established below
    // any future request, then it disconnects.
    const warmup = fakePort(lifecyclePortName(5));
    acceptLifecyclePort(hub, warmup as unknown as chrome.runtime.Port);
    subscribe(warmup);
    for (const fn of warmup.disconnectListeners) fn();

    // A request arrives in-session while no consumer is attached.
    store.apply({
      kind: 'started',
      lifecycle: {
        tabId: 5,
        requestId: 'a',
        url: 'https://openheaders.io/a',
        method: 'GET',
        resourceType: 'xmlhttprequest',
        phase: 'pending',
        redirectHopCount: 0,
        redirectHops: [],
        startedAtMs: 1,
        hopStartedAtMs: 1,
        har: [],
        harBodyByHop: [],
      },
    });

    // A fresh consumer connects + subscribes → ready + synchronous replay
    // of the in-session request, re-resolved against the same floor.
    const port = fakePort(lifecyclePortName(5));
    const accepted = acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);
    expect(accepted).toBe(true);
    // Nothing is delivered until the consumer subscribes.
    expect(port.posted).toEqual([]);

    subscribe(port);
    expect(port.posted[0]).toEqual({ kind: 'ready', tabId: 5, watermarkMs: 1 });
    expect(port.posted).toHaveLength(2);
    expect((port.posted[1] as { kind: string }).kind).toBe('lifecycle-update');
  });

  it('session-start subscribe (no sinceMs) replays nothing and reports the watermark', () => {
    const store = new RequestLifecycleStore();
    store.apply({
      kind: 'started',
      lifecycle: {
        tabId: 5,
        requestId: 'a',
        url: 'https://openheaders.io/a',
        method: 'GET',
        resourceType: 'xmlhttprequest',
        phase: 'pending',
        redirectHopCount: 0,
        redirectHops: [],
        startedAtMs: 7000,
        hopStartedAtMs: 7000,
        har: [],
        harBodyByHop: [],
      },
    });
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(5));
    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);
    subscribe(port);
    expect(port.posted).toEqual([{ kind: 'ready', tabId: 5, watermarkMs: 7000 }]);
  });

  it('a second subscribe re-attaches in place against the same session floor', () => {
    const store = new RequestLifecycleStore();
    store.apply({
      kind: 'started',
      lifecycle: {
        tabId: 5,
        requestId: 'a',
        url: 'https://openheaders.io/a',
        method: 'GET',
        resourceType: 'xmlhttprequest',
        phase: 'pending',
        redirectHopCount: 0,
        redirectHops: [],
        startedAtMs: 1,
        hopStartedAtMs: 1,
        har: [],
        harBodyByHop: [],
      },
    });
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(5));
    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);

    // Session-start: floor at the watermark → ready only, no replay.
    subscribe(port);
    expect(port.posted).toEqual([{ kind: 'ready', tabId: 5, watermarkMs: 1 }]);

    // A repeated subscribe re-attaches (detach + re-attach) against the
    // SAME engine-owned floor → another ready, still no replay.
    subscribe(port);
    expect(port.posted).toHaveLength(2);
    expect((port.posted[1] as { kind: string }).kind).toBe('ready');
  });

  it('raises panel-watching tracking on accept and releases it on disconnect', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(11));
    const start = vi.fn();
    const stop = vi.fn();
    const accepted = acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port, {
      trackerDeps: { start, stop },
    });
    expect(accepted).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]?.[0]).toBe(11);
    const reason = start.mock.calls[0]?.[1];
    expect(reason).toMatch(/^panel-watching:11:\d+$/);
    expect(stop).not.toHaveBeenCalled();

    for (const fn of port.disconnectListeners) fn();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop.mock.calls[0]).toEqual([11, reason]);
  });

  it('does NOT raise tracking when the port name is rejected', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort('devtools-inspector:1');
    const start = vi.fn();
    const stop = vi.fn();
    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port, {
      trackerDeps: { start, stop },
    });
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('onDisconnect detaches: subsequent updates do not reach the port', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(9));
    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);
    subscribe(port);

    // Fire the disconnect listener Chrome would have called.
    for (const fn of port.disconnectListeners) fn();

    const before = port.posted.length;
    store.apply({
      kind: 'started',
      lifecycle: {
        tabId: 9,
        requestId: 'r',
        url: 'https://openheaders.io',
        method: 'GET',
        resourceType: 'xmlhttprequest',
        phase: 'pending',
        redirectHopCount: 0,
        redirectHops: [],
        startedAtMs: 1,
        hopStartedAtMs: 1,
        har: [],
        harBodyByHop: [],
      },
    });
    expect(port.posted.length).toBe(before);
  });

  it('clear-session advances the session floor so a later subscribe drops pre-clear requests', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(5));
    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);

    // Session-start on an empty tab establishes the floor below any future
    // request; then a request starts during the session.
    subscribe(port);
    store.apply({
      kind: 'started',
      lifecycle: {
        tabId: 5,
        requestId: 'before',
        url: 'https://openheaders.io/before',
        method: 'GET',
        resourceType: 'xmlhttprequest',
        phase: 'pending',
        redirectHopCount: 0,
        redirectHops: [],
        startedAtMs: 5000,
        hopStartedAtMs: 5000,
        har: [],
        harBodyByHop: [],
      },
    });

    // Clear → engine advances the floor to the current watermark.
    port.emit({ kind: 'clear-session' });

    // A fresh subscribe now floors at 5000, so 'before' does not replay.
    const postedBefore = port.posted.length;
    subscribe(port);
    const replays = port.posted.slice(postedBefore).filter((m) => (m as { kind: string }).kind === 'lifecycle-update');
    expect(replays).toEqual([]);
  });

  it('posts the current provenance on subscribe and on each owner flip', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(5));

    const unsubscribe = vi.fn();
    const provenance = {
      ownerOf: vi.fn(() => 'cdp' as const),
      onOwnerChange: vi.fn((_listener: (tabId: number, owner: 'heuristic' | 'cdp') => void) => unsubscribe),
    };

    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port, { provenance });
    subscribe(port);
    // Baseline owner posted alongside the ready/replay.
    expect(port.posted).toContainEqual({ kind: 'source', tabId: 5, source: 'cdp' });

    // A flip for this tab is forwarded; a flip for another tab is ignored.
    const changeListener = provenance.onOwnerChange.mock.calls[0]?.[0];
    if (changeListener === undefined) throw new Error('expected an owner-change subscription');
    changeListener(99, 'heuristic');
    changeListener(5, 'heuristic');
    const sources = port.posted.filter((m) => (m as { kind: string }).kind === 'source');
    expect(sources).toEqual([
      { kind: 'source', tabId: 5, source: 'cdp' },
      { kind: 'source', tabId: 5, source: 'heuristic' },
    ]);

    // Disconnect unsubscribes from the router.
    for (const fn of port.disconnectListeners) fn();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('sends no source frame when no provenance is wired', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(5));
    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);
    subscribe(port);
    expect(port.posted.some((m) => (m as { kind: string }).kind === 'source')).toBe(false);
  });

  it('routes a request-body message to the body fetcher using the port tabId as authority', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(7));
    const requestBody = vi.fn(() => Promise.resolve());
    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port, { bodyFetcher: { requestBody } });
    subscribe(port);

    port.emit({ kind: 'request-body', requestId: 'page::r-1', hopIndex: 2 });
    // The port's tabId (7) is the authority; the message scopes only the
    // request id + hop.
    expect(requestBody).toHaveBeenCalledWith(7, 'page::r-1', 2);
  });

  it('drops a request-body message cleanly when no body fetcher is wired', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(7));
    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);
    subscribe(port);
    expect(() => port.emit({ kind: 'request-body', requestId: 'page::r-1', hopIndex: 0 })).not.toThrow();
  });

  it('defers attach until the readiness gate resolves', async () => {
    const store = new RequestLifecycleStore();
    store.apply({
      kind: 'started',
      lifecycle: {
        tabId: 5,
        requestId: 'a',
        url: 'https://openheaders.io/a',
        method: 'GET',
        resourceType: 'xmlhttprequest',
        phase: 'pending',
        redirectHopCount: 0,
        redirectHops: [],
        startedAtMs: 1,
        hopStartedAtMs: 1,
        har: [],
        harBodyByHop: [],
      },
    });
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(5));
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port, { ready });

    // Gate unresolved → attach (ready + replay) has not run yet.
    subscribe(port);
    expect(port.posted).toEqual([]);

    release();
    await ready;
    await Promise.resolve();
    expect((port.posted[0] as { kind: string }).kind).toBe('ready');
  });
});
