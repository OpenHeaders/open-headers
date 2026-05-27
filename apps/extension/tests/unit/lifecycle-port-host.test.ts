/**
 * Lifecycle port host (W-a) — chrome adapter wires `chrome.runtime.onConnect`
 * to `RequestLifecycleHub.attach`. Asserts:
 *   - port-name parsing accepts `oh-lifecycle:<tabId>` and rejects siblings
 *   - happy-path attach → ready + replay over postMessage
 *   - dead-port postMessage throw is swallowed
 *   - onDisconnect triggers hub.detach (refcount + stops fanout)
 */

import { describe, expect, it, vi } from 'vitest';

import {
  LIFECYCLE_PORT_PREFIX,
  lifecyclePortName,
  parseLifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';

import { acceptLifecyclePort } from '@/background/lifecycle-port-host/accept-port';
import { createPortSink } from '@/background/lifecycle-port-host/port-sink';

interface FakePort {
  name: string;
  posted: unknown[];
  disconnectListeners: Array<() => void>;
  onDisconnect: { addListener: (fn: () => void) => void };
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function fakePort(name: string, postImpl?: (msg: unknown) => void): FakePort {
  const port: FakePort = {
    name,
    posted: [],
    disconnectListeners: [],
    onDisconnect: {
      addListener: (fn) => {
        port.disconnectListeners.push(fn);
      },
    },
    postMessage: vi.fn((msg: unknown) => {
      if (postImpl) postImpl(msg);
      else port.posted.push(msg);
    }),
    disconnect: vi.fn(),
  };
  return port;
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
    expect(parseLifecyclePortName('oh-lifecycle:-1')).toBeNull();
    expect(parseLifecyclePortName('')).toBeNull();
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
    sink.deliverReady(1);
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
        har: new Map(),
        harBodyByHop: new Map(),
      },
    });
    expect(port.posted).toEqual([
      { kind: 'ready', tabId: 1 },
      expect.objectContaining({ kind: 'lifecycle-update' }),
    ]);
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
    expect(() => sink.deliverReady(1)).not.toThrow();
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

  it('attaches a matching port and delivers ready + replay synchronously', () => {
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
        har: new Map(),
        harBodyByHop: new Map(),
      },
    });
    const hub = new RequestLifecycleHub({ store });
    const port = fakePort(lifecyclePortName(5));
    const accepted = acceptLifecyclePort(hub, port as unknown as chrome.runtime.Port);
    expect(accepted).toBe(true);
    expect(port.posted[0]).toEqual({ kind: 'ready', tabId: 5 });
    expect(port.posted).toHaveLength(2);
    expect((port.posted[1] as { kind: string }).kind).toBe('lifecycle-update');
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
        har: new Map(),
        harBodyByHop: new Map(),
      },
    });
    expect(port.posted.length).toBe(before);
  });
});
