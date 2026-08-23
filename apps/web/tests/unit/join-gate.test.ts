/**
 * Login-gate decision logic — the mount/gate boot decision, which of
 * the front door's states the card draws, and the join-outcome
 * classification the gate UI drives. The wire is faked as a pair of
 * subscriber registries; the token module is mocked so the
 * persist-only-after-WELCOME-accept contract is observable, and the
 * three meta probes ride a path-dispatching `fetch` rather than module
 * mocks so their real JSON-only guards stay in the loop.
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
import { awaitJoinOutcome, decideGate, resolveGateMode, submitDaemonToken } from '@/host/join-gate';

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

describe('resolveGateMode', () => {
  /** Answer each probe path from one map; anything unlisted is the SPA fallback. */
  function stubProbes(answers: Record<string, unknown>): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const body = answers[input];
        return body === undefined
          ? new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })
          : new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
      }),
    );
  }

  it('draws the setup form on an unclaimed server, carrying whether the code is asked for', async () => {
    stubProbes({ '/auth/setup/meta': { unclaimed: true, requiresCode: true } });
    expect(await resolveGateMode()).toEqual({ kind: 'setup', requiresCode: true });
  });

  it('draws the password form on a claimed server with a password holder', async () => {
    stubProbes({
      '/auth/setup/meta': { unclaimed: false, requiresCode: false },
      '/auth/password/meta': { enabled: true },
    });
    expect(await resolveGateMode()).toEqual({ kind: 'password' });
  });

  it('draws the provider button when an IdP is configured', async () => {
    stubProbes({
      '/auth/oidc/meta': { enabled: true, provider: 'Okta' },
      '/auth/setup/meta': { unclaimed: false, requiresCode: false },
    });
    expect(await resolveGateMode()).toEqual({ kind: 'sso', provider: 'Okta' });
  });

  it('names the provider generically when the daemon does not', async () => {
    stubProbes({ '/auth/oidc/meta': { enabled: true }, '/auth/setup/meta': { unclaimed: false } });
    expect(await resolveGateMode()).toEqual({ kind: 'sso', provider: 'SSO' });
  });

  it('says so plainly when a claimed server has nothing a browser can sign in with', async () => {
    stubProbes({ '/auth/setup/meta': { unclaimed: false, requiresCode: false } });
    expect(await resolveGateMode()).toEqual({ kind: 'no-login' });
  });

  it('never offers to set up a server whose probes all fall through to the SPA', async () => {
    stubProbes({});
    expect(await resolveGateMode()).toEqual({ kind: 'no-login' });
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
