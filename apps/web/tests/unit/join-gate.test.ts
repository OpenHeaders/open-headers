/**
 * Login-gate decision logic — the mount/gate boot decision and the
 * join-outcome classification the gate UI drives. The wire is faked as
 * a pair of subscriber registries; the token module is mocked so the
 * persist-only-after-WELCOME-accept contract is observable.
 */

import type { HandshakeRejectReason } from '@openheaders/core/protocol';
import type { InitiatorState } from '@openheaders/oracle/sync/client/sync-handshake-initiator';
import type { TransportState } from '@openheaders/oracle/sync/client/transport-connection';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tokenModule = vi.hoisted(() => ({
  hasDaemonToken: vi.fn(() => false),
  setCandidateDaemonToken: vi.fn(),
  persistDaemonToken: vi.fn(async () => {}),
}));
vi.mock('@/host/daemon-token', () => tokenModule);

import type { DaemonWire } from '@/host/daemon-wire';
import { awaitJoinOutcome, decideGate, submitDaemonToken } from '@/host/join-gate';

interface FakeWire {
  wire: DaemonWire;
  emitHandshake: (state: InitiatorState) => void;
  emitTransport: (state: TransportState) => void;
  reconnect: ReturnType<typeof vi.fn>;
  setRejectReason: (reason: HandshakeRejectReason | null) => void;
}

function makeFakeWire(initialHandshake: InitiatorState = 'idle'): FakeWire {
  const handshakeSubs = new Set<(s: InitiatorState) => void>();
  const transportSubs = new Set<(s: TransportState) => void>();
  let handshakeState: InitiatorState = initialHandshake;
  let rejectReason: HandshakeRejectReason | null = null;
  const reconnect = vi.fn();
  const wire: DaemonWire = {
    start: vi.fn(),
    reconnect,
    isConnected: () => handshakeState === 'synced',
    transportState: () => 'open',
    handshakeState: () => handshakeState,
    rejectReason: () => rejectReason,
    subscribeHandshake: (cb) => {
      handshakeSubs.add(cb);
      return () => handshakeSubs.delete(cb);
    },
    subscribeTransport: (cb) => {
      transportSubs.add(cb);
      return () => transportSubs.delete(cb);
    },
  };
  return {
    wire,
    reconnect,
    emitHandshake: (state) => {
      handshakeState = state;
      for (const cb of [...handshakeSubs]) cb(state);
    },
    emitTransport: (state) => {
      for (const cb of [...transportSubs]) cb(state);
    },
    setRejectReason: (reason) => {
      rejectReason = reason;
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  tokenModule.hasDaemonToken.mockReturnValue(false);
  tokenModule.setCandidateDaemonToken.mockClear();
  tokenModule.persistDaemonToken.mockClear();
});

describe('decideGate', () => {
  it('mounts straight away when a token is stored — no probe fired', async () => {
    tokenModule.hasDaemonToken.mockReturnValue(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await decideGate()).toBe('mount');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('gates when no token is stored and the daemon answers /healthz', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true })),
    );
    expect(await decideGate()).toBe('gate');
  });

  it('mounts offline-first when the daemon is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    expect(await decideGate()).toBe('mount');
  });
});

describe('awaitJoinOutcome', () => {
  it('resolves joined once the handshake passes WELCOME', async () => {
    const fake = makeFakeWire();
    const outcome = awaitJoinOutcome(fake.wire);
    fake.emitHandshake('hello-sent');
    fake.emitHandshake('welcomed');
    expect(await outcome).toBe('joined');
  });

  it('resolves auth-required on an auth-rejecting WELCOME', async () => {
    const fake = makeFakeWire();
    const outcome = awaitJoinOutcome(fake.wire);
    fake.setRejectReason('auth-required');
    fake.emitHandshake('rejected');
    expect(await outcome).toBe('auth-required');
  });

  it('resolves offline when the transport gives up into backoff', async () => {
    const fake = makeFakeWire();
    const outcome = awaitJoinOutcome(fake.wire);
    fake.emitTransport('backoff');
    expect(await outcome).toBe('offline');
  });

  it('resolves immediately from an already-terminal handshake state', async () => {
    const fake = makeFakeWire('synced');
    expect(await awaitJoinOutcome(fake.wire)).toBe('joined');
  });

  it('resolves offline after the budget elapses with no outcome', async () => {
    vi.useFakeTimers();
    try {
      const fake = makeFakeWire();
      const outcome = awaitJoinOutcome(fake.wire, 5000);
      await vi.advanceTimersByTimeAsync(5001);
      expect(await outcome).toBe('offline');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('submitDaemonToken', () => {
  it('persists the candidate only after the daemon accepts it', async () => {
    const fake = makeFakeWire();
    const result = submitDaemonToken(fake.wire, '  tok-abc  ');
    expect(tokenModule.setCandidateDaemonToken).toHaveBeenCalledWith('tok-abc');
    expect(fake.reconnect).toHaveBeenCalledTimes(1);
    fake.emitHandshake('welcomed');
    expect(await result).toEqual({ ok: true });
    expect(tokenModule.persistDaemonToken).toHaveBeenCalledTimes(1);
  });

  it('reports rejected without persisting on an auth-required reject', async () => {
    const fake = makeFakeWire();
    const result = submitDaemonToken(fake.wire, 'bad-token');
    fake.setRejectReason('auth-required');
    fake.emitHandshake('rejected');
    expect(await result).toEqual({ ok: false, reason: 'rejected' });
    expect(tokenModule.persistDaemonToken).not.toHaveBeenCalled();
  });

  it('reports offline without persisting when the wire never answers', async () => {
    const fake = makeFakeWire();
    const result = submitDaemonToken(fake.wire, 'tok');
    fake.emitTransport('backoff');
    expect(await result).toEqual({ ok: false, reason: 'offline' });
    expect(tokenModule.persistDaemonToken).not.toHaveBeenCalled();
  });
});
