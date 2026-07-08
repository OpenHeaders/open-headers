/**
 * Transport connection — WebSocket lifecycle FSM coverage.
 *
 * Focus: the connect-race fix. A superseded attempt must never leave an
 * orphan socket racing the live one (the double-socket bug behind the
 * ~7s clean-install join latency).
 */
import { HANDSHAKE_REJECT_CLOSE_CODE, PROTOCOL_INCOMPATIBLE_CLOSE_CODE } from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';

import {
  createTransportConnection,
  STABLE_CONNECTION_MS,
  type TransportConnectionDeps,
} from '../../../src/sync/client/transport-connection';

class FakeSocket {
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((e?: { code?: number; reason?: string }) => void) | null = null;
  sent: string[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000 });
  }

  fireOpen(): void {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  fireClose(code?: number, reason?: string): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
}
function defer<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeTimers() {
  const pending = new Map<number, { fn: () => void; ms: number }>();
  let nextId = 1;
  return {
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++;
      pending.set(id, { fn, ms });
      return id;
    },
    clearTimer: (h: unknown) => {
      pending.delete(h as number);
    },
    runAll: () => {
      for (const [id, t] of [...pending]) {
        pending.delete(id);
        t.fn();
      }
    },
    count: () => pending.size,
  };
}

function makeHarness(overrides: Partial<TransportConnectionDeps> = {}) {
  const sockets: FakeSocket[] = [];
  const timers = makeTimers();
  const onOpen = vi.fn();
  const onClose = vi.fn();
  const onMessage = vi.fn();

  const deps: TransportConnectionDeps = {
    getUrl: () => 'ws://127.0.0.1:8137',
    shouldConnect: () => true,
    getReconnectDelayMs: () => 1000,
    getMaxReconnectDelayMs: () => 30_000,
    getPingIntervalMs: () => 0,
    probeReachable: () => Promise.resolve(true),
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s as unknown as WebSocket;
    },
    onOpen,
    onClose,
    onMessage,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    ...overrides,
  };
  const transport = createTransportConnection(deps);
  return { transport, sockets, timers, onOpen, onClose, onMessage };
}

describe('createTransportConnection', () => {
  it('idle → probing → opening → open on a reachable host', async () => {
    const h = makeHarness();
    h.transport.ensureConnected();
    expect(h.transport.state()).toBe('probing');
    await Promise.resolve();
    expect(h.transport.state()).toBe('opening');
    expect(h.sockets).toHaveLength(1);
    h.sockets[0].fireOpen();
    expect(h.transport.state()).toBe('open');
    expect(h.transport.isConnected()).toBe(true);
    expect(h.onOpen).toHaveBeenCalledTimes(1);
  });

  it('coalesces repeat ensureConnected() calls into one socket', async () => {
    const h = makeHarness();
    h.transport.ensureConnected();
    h.transport.ensureConnected();
    h.transport.ensureConnected();
    await Promise.resolve();
    expect(h.sockets).toHaveLength(1);
  });

  it('reconnect() during probing supersedes the attempt — no orphan socket', async () => {
    const probeA = defer<boolean>();
    const probeB = defer<boolean>();
    const probeReachable = vi
      .fn<(url: string) => Promise<boolean>>()
      .mockReturnValueOnce(probeA.promise)
      .mockReturnValueOnce(probeB.promise);
    const h = makeHarness({ probeReachable });

    h.transport.ensureConnected(); // attempt A — probing
    h.transport.reconnect(); // supersede A, start attempt B

    probeA.resolve(true); // A's stale resolution
    await Promise.resolve();
    expect(h.sockets).toHaveLength(0); // A must NOT have opened a socket

    probeB.resolve(true); // B proceeds
    await Promise.resolve();
    expect(h.sockets).toHaveLength(1); // exactly one live socket
  });

  it('reconnect() while open tears the socket down and reconnects', async () => {
    const h = makeHarness();
    h.transport.ensureConnected();
    await Promise.resolve();
    h.sockets[0].fireOpen();
    expect(h.transport.state()).toBe('open');

    h.transport.reconnect();
    expect(h.sockets[0].closed).toBe(true);
    expect(h.transport.state()).toBe('probing');
    await Promise.resolve();
    expect(h.sockets).toHaveLength(2);
  });

  it('unreachable host backs off, then retries on the timer', async () => {
    const probeReachable = vi
      .fn<(url: string) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const h = makeHarness({ probeReachable });

    h.transport.ensureConnected();
    await Promise.resolve();
    expect(h.transport.state()).toBe('backoff');
    expect(h.transport.reconnectAttempts()).toBe(1);

    h.timers.runAll(); // fire the backoff timer
    expect(h.transport.state()).toBe('probing');
    await Promise.resolve();
    expect(h.sockets).toHaveLength(1);
  });

  it('a protocol-incompatible close latches idle and suppresses retry', async () => {
    const h = makeHarness();
    h.transport.ensureConnected();
    await Promise.resolve();
    h.sockets[0].fireOpen();
    h.sockets[0].fireClose(PROTOCOL_INCOMPATIBLE_CLOSE_CODE, 'too new');

    expect(h.transport.state()).toBe('idle');
    expect(h.onClose).toHaveBeenCalledWith(
      expect.objectContaining({ wasOpen: true, protocolIncompatible: true, peerRefused: true }),
    );
    expect(h.timers.count()).toBe(0); // no backoff scheduled

    // The latch survives a bare ensureConnected()…
    h.transport.ensureConnected();
    expect(h.transport.state()).toBe('idle');
    // …but reconnect() clears it.
    h.transport.reconnect();
    expect(h.transport.state()).toBe('probing');
  });

  it('an evicting handshake reject (1008 auth-required) latches idle like a protocol mismatch', async () => {
    const h = makeHarness();
    h.transport.ensureConnected();
    await Promise.resolve();
    h.sockets[0].fireOpen();
    h.sockets[0].fireClose(HANDSHAKE_REJECT_CLOSE_CODE, 'auth-required');

    expect(h.transport.state()).toBe('idle');
    expect(h.onClose).toHaveBeenCalledWith(
      expect.objectContaining({
        wasOpen: true,
        protocolIncompatible: false,
        peerRefused: true,
        rejectReason: 'auth-required',
      }),
    );
    expect(h.timers.count()).toBe(0); // no redial — the peer would refuse it again

    h.transport.ensureConnected();
    expect(h.transport.state()).toBe('idle');
    // A credential change re-dials through reconnect().
    h.transport.reconnect();
    expect(h.transport.state()).toBe('probing');
  });

  it('a non-evicting 1008 (workspace-unknown) backs off normally', async () => {
    const h = makeHarness();
    h.transport.ensureConnected();
    await Promise.resolve();
    h.sockets[0].fireOpen();
    h.sockets[0].fireClose(HANDSHAKE_REJECT_CLOSE_CODE, 'workspace-unknown');

    expect(h.onClose).toHaveBeenCalledWith(
      expect.objectContaining({ peerRefused: false, rejectReason: 'workspace-unknown' }),
    );
    expect(h.transport.state()).toBe('backoff');
  });

  it('open→drop flaps keep growing the backoff; a stable connection resets it', async () => {
    let clock = 0;
    const h = makeHarness({ now: () => clock });

    // Two open→immediate-drop cycles: attempts keep climbing.
    h.transport.ensureConnected();
    await Promise.resolve();
    h.sockets[0].fireOpen();
    h.sockets[0].fireClose(1006);
    expect(h.transport.reconnectAttempts()).toBe(1);
    h.timers.runAll();
    await Promise.resolve();
    h.sockets[1].fireOpen();
    h.sockets[1].fireClose(1006);
    expect(h.transport.reconnectAttempts()).toBe(2);

    // A connection that survives past the stability window resets it.
    h.timers.runAll();
    await Promise.resolve();
    h.sockets[2].fireOpen();
    clock += STABLE_CONNECTION_MS;
    h.sockets[2].fireClose(1006);
    expect(h.transport.reconnectAttempts()).toBe(1); // fresh backoff run
  });

  it('an ordinary close while open backs off for a fresh socket', async () => {
    const h = makeHarness();
    h.transport.ensureConnected();
    await Promise.resolve();
    h.sockets[0].fireOpen();
    h.sockets[0].fireClose(1006);

    expect(h.onClose).toHaveBeenCalledWith(expect.objectContaining({ wasOpen: true, protocolIncompatible: false }));
    expect(h.transport.state()).toBe('backoff');
  });

  it('does not connect when shouldConnect() is false', async () => {
    const h = makeHarness({ shouldConnect: () => false });
    h.transport.ensureConnected();
    await Promise.resolve();
    expect(h.transport.state()).toBe('idle');
    expect(h.sockets).toHaveLength(0);
  });

  it('routes inbound messages to onMessage', async () => {
    const h = makeHarness();
    h.transport.ensureConnected();
    await Promise.resolve();
    h.sockets[0].fireOpen();
    h.sockets[0].onmessage?.({ data: '{"type":"ping"}' });
    expect(h.onMessage).toHaveBeenCalledWith('{"type":"ping"}');
  });

  it('send() returns false with no open socket, true once open', async () => {
    const h = makeHarness();
    expect(h.transport.send({ type: 'x' })).toBe(false);
    h.transport.ensureConnected();
    await Promise.resolve();
    h.sockets[0].fireOpen();
    expect(h.transport.send({ type: 'x' })).toBe(true);
    expect(h.sockets[0].sent).toEqual(['{"type":"x"}']);
  });
});
