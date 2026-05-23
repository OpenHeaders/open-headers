/**
 * Phase C handshake dispatcher — `evaluateHello` + `handleStateVector`.
 *
 * Pure unit coverage. `evaluateHello` is async (it reads the daemon
 * auth-token ledger under `requireAuth`) but touches no transport.
 * `handleStateVector`'s responder is stubbed via the `respond` option
 * so the test stays isolated from the per-workspace service registry.
 */

import { clearIdentitySnapshot } from '@openheaders/core/identity';
import {
  BACKEND_REACH,
  HANDSHAKE_REJECT_REASONS,
  HANDSHAKE_ROLES,
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncHelloMessage,
  type SyncStateVectorMessage,
} from '@openheaders/core/protocol';
import { createPeerConnection } from '@openheaders/oracle/host-runtime/peer-connection';
import {
  evaluateHello,
  HANDSHAKE_MESSAGE_TYPES,
  handleStateVector,
  type LocalHandshakeIdentity,
} from '@openheaders/oracle/rpc';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const localIdentity: LocalHandshakeIdentity = {
  role: HANDSHAKE_ROLES.DESKTOP,
  nodeId: 'desktop-test',
  agent: '@openheaders/desktop@0.0.0-test',
};

const validHello: SyncHelloMessage = {
  type: SYNC_HELLO_TYPE,
  protocolVersion: PROTOCOL_VERSION,
  role: HANDSHAKE_ROLES.EXTENSION,
  nodeId: 'sw-1',
  workspaceId: 'ws-1',
  agent: '@openheaders/extension@0.0.0-test',
};

function makePeer(workspaceId = 'ws-1') {
  const send = vi.fn(() => true);
  const close = vi.fn();
  const conn = createPeerConnection({
    peerId: 'peer-1',
    nodeId: 'sw-1',
    role: HANDSHAKE_ROLES.EXTENSION,
    agent: '@openheaders/extension@0.0.0-test',
    workspaceId,
    protocolVersion: PROTOCOL_VERSION,
    send,
    close,
  });
  return { conn, send, close };
}

describe('evaluateHello', () => {
  it('accepts a well-formed HELLO at the current protocol version', async () => {
    const outcome = await evaluateHello(validHello as unknown as Record<string, unknown>, localIdentity);
    expect(outcome.kind).toBe('accept');
    if (outcome.kind !== 'accept') return;
    // Loopback bind — trust-by-process, no token gate, null join key.
    expect(outcome.tokenId).toBeNull();
    expect(outcome.welcome.accepted).toBe(true);
    expect(outcome.welcome.type).toBe(SYNC_WELCOME_TYPE);
    if (outcome.welcome.accepted) {
      expect(outcome.welcome.role).toBe(localIdentity.role);
      expect(outcome.welcome.workspaceId).toBe('ws-1');
      expect(outcome.welcome.nodeId).toBe(localIdentity.nodeId);
    }
  });

  it('omits the backend Org from WELCOME when no identity snapshot is hydrated', async () => {
    // Pre-bootstrap responder — nothing to authorize the joiner against.
    const outcome = await evaluateHello(validHello as unknown as Record<string, unknown>, localIdentity);
    expect(outcome.kind).toBe('accept');
    if (outcome.kind === 'accept' && outcome.welcome.accepted) {
      expect(outcome.welcome.org).toBeUndefined();
    }
  });

  describe('U5.2 — backend home Org in WELCOME accept', () => {
    afterEach(() => {
      clearIdentitySnapshot();
    });

    it('carries the responding backend home Org so the joiner can authorize it', async () => {
      const homeOrgId = '01900000-0000-7000-8000-0000000000aa';
      installTestIdentitySnapshot(homeOrgId);
      const outcome = await evaluateHello(validHello as unknown as Record<string, unknown>, localIdentity);
      expect(outcome.kind).toBe('accept');
      if (outcome.kind === 'accept' && outcome.welcome.accepted) {
        expect(outcome.welcome.org).toEqual({
          id: homeOrgId,
          name: 'Test Org',
          hostKind: 'browser',
          isPrivate: true,
        });
      }
    });
  });

  it('rejects HELLO that fails schema validation', async () => {
    const outcome = await evaluateHello({ type: SYNC_HELLO_TYPE, protocolVersion: 'oops' }, localIdentity);
    expect(outcome.kind).toBe('reject');
    if (outcome.kind === 'reject') {
      expect(outcome.welcome.accepted).toBe(false);
      expect(outcome.reason).toBeDefined();
    }
  });

  it('rejects HELLO with a future protocol version using PROTOCOL_TOO_NEW', async () => {
    const outcome = await evaluateHello(
      { ...validHello, protocolVersion: PROTOCOL_VERSION + 1 } as unknown as Record<string, unknown>,
      localIdentity,
    );
    expect(outcome.kind).toBe('reject');
    if (outcome.kind === 'reject') {
      expect(outcome.reason).toBe(HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_NEW);
    }
  });

  it('throws when called with a non-HELLO frame (caller wiring bug)', async () => {
    await expect(evaluateHello({ type: 'oh.sync.welcome' }, localIdentity)).rejects.toThrow();
  });

  it('stamps `reach` from options onto the accept', async () => {
    const outcome = await evaluateHello(validHello as unknown as Record<string, unknown>, localIdentity, {
      reach: BACKEND_REACH.LAN,
    });
    expect(outcome.kind).toBe('accept');
    if (outcome.kind === 'accept' && outcome.welcome.accepted) {
      expect(outcome.welcome.reach).toBe(BACKEND_REACH.LAN);
    }
  });

  it('omits `reach` from the accept when no option is passed', async () => {
    const outcome = await evaluateHello(validHello as unknown as Record<string, unknown>, localIdentity);
    expect(outcome.kind).toBe('accept');
    if (outcome.kind === 'accept' && outcome.welcome.accepted) {
      expect(outcome.welcome.reach).toBeUndefined();
    }
  });

  it('publishes the canonical set of handshake message types', () => {
    expect(HANDSHAKE_MESSAGE_TYPES.has(SYNC_HELLO_TYPE)).toBe(true);
    expect(HANDSHAKE_MESSAGE_TYPES.has(SYNC_STATE_VECTOR_TYPE)).toBe(true);
  });

  describe('with requireAuth enabled (non-loopback bind)', () => {
    afterEach(() => {
      clearIdentitySnapshot();
    });

    it('rejects with AUTH_REQUIRED when the peer presents no token', async () => {
      const outcome = await evaluateHello(validHello as unknown as Record<string, unknown>, localIdentity, {
        requireAuth: true,
        validate: async () => ({ ok: false, reason: 'no-token' }),
      });
      expect(outcome.kind).toBe('reject');
      if (outcome.kind === 'reject') {
        expect(outcome.reason).toBe(HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED);
        expect(outcome.welcome.accepted).toBe(false);
        if (!outcome.welcome.accepted) {
          expect(outcome.welcome.detail).toBe('no-token');
        }
      }
    });

    it('rejects with AUTH_REQUIRED when the peer presents an unknown token', async () => {
      const outcome = await evaluateHello(
        { ...validHello, authToken: 'oh_garbage' } as unknown as Record<string, unknown>,
        localIdentity,
        {
          requireAuth: true,
          validate: async () => ({ ok: false, reason: 'unknown' }),
        },
      );
      expect(outcome.kind).toBe('reject');
      if (outcome.kind === 'reject' && !outcome.welcome.accepted) {
        expect(outcome.welcome.detail).toBe('unknown');
      }
    });

    it('rejects with AUTH_REQUIRED when the peer presents a revoked token', async () => {
      const outcome = await evaluateHello(
        { ...validHello, authToken: 'oh_revoked' } as unknown as Record<string, unknown>,
        localIdentity,
        {
          requireAuth: true,
          validate: async () => ({ ok: false, reason: 'revoked' }),
        },
      );
      expect(outcome.kind).toBe('reject');
      if (outcome.kind === 'reject' && !outcome.welcome.accepted) {
        expect(outcome.welcome.detail).toBe('revoked');
      }
    });

    it('accepts when the peer presents a valid daemon auth token', async () => {
      const outcome = await evaluateHello(
        { ...validHello, authToken: 'oh_valid' } as unknown as Record<string, unknown>,
        localIdentity,
        {
          requireAuth: true,
          validate: async () => ({ ok: true, tokenId: 'token-123', label: 'phone' }),
        },
      );
      expect(outcome.kind).toBe('accept');
      // The validated token id is threaded onto the accept outcome so
      // the host can stamp it on the PeerConnection (U3.4 join key).
      if (outcome.kind === 'accept') expect(outcome.tokenId).toBe('token-123');
    });

    it('is a no-op when requireAuth is false even without a token', async () => {
      const outcome = await evaluateHello(validHello as unknown as Record<string, unknown>, localIdentity, {
        requireAuth: false,
      });
      expect(outcome.kind).toBe('accept');
      if (outcome.kind === 'accept') expect(outcome.tokenId).toBeNull();
    });
  });
});

describe('handleStateVector', () => {
  const stateVector: SyncStateVectorMessage = {
    type: SYNC_STATE_VECTOR_TYPE,
    workspaceId: 'ws-1',
    perNodeMaxHlc: {},
  };

  it('routes through the responder when peer + workspace align', async () => {
    const { conn } = makePeer('ws-1');
    const respond = vi.fn(async () => ({
      sentSnapshot: false,
      deltasSent: 0,
      syncedSent: true,
      stateVectorAfter: {},
    }));
    const outcome = await handleStateVector(stateVector as unknown as Record<string, unknown>, conn, {
      respond,
    });
    expect(outcome.kind).toBe('ok');
    expect(respond).toHaveBeenCalledTimes(1);
  });

  it('routes a STATE_VECTOR whose scope differs from the HELLO workspace (U6.3 per-frame scope)', async () => {
    // A single socket carries catch-up for many scopes — `__global__`
    // then each consumed workspace. The connection binds to the HELLO
    // workspace, but each STATE_VECTOR names its own scope.
    const { conn } = makePeer('ws-other');
    const respond = vi.fn(async () => ({
      sentSnapshot: false,
      deltasSent: 0,
      syncedSent: true,
      stateVectorAfter: {},
    }));
    const outcome = await handleStateVector(stateVector as unknown as Record<string, unknown>, conn, {
      respond,
    });
    expect(outcome.kind).toBe('ok');
    expect(respond).toHaveBeenCalledTimes(1);
  });

  it('rejects when the frame fails schema validation', async () => {
    const { conn } = makePeer('ws-1');
    const respond = vi.fn();
    const outcome = await handleStateVector(
      { type: SYNC_STATE_VECTOR_TYPE, workspaceId: 'ws-1' } as unknown as Record<string, unknown>,
      conn,
      { respond },
    );
    expect(outcome.kind).toBe('rejected');
    if (outcome.kind === 'rejected') expect(outcome.reason).toBe('schema-invalid');
    expect(respond).not.toHaveBeenCalled();
  });

  it('rejects when the connection has already closed', async () => {
    const { conn } = makePeer('ws-1');
    conn.close();
    const respond = vi.fn();
    const outcome = await handleStateVector(stateVector as unknown as Record<string, unknown>, conn, {
      respond,
    });
    expect(outcome.kind).toBe('rejected');
    if (outcome.kind === 'rejected') expect(outcome.reason).toBe('connection-closed');
    expect(respond).not.toHaveBeenCalled();
  });

  it('throws when called with a non-STATE_VECTOR frame (caller wiring bug)', async () => {
    const { conn } = makePeer('ws-1');
    await expect(
      handleStateVector({ type: SYNC_HELLO_TYPE } as unknown as Record<string, unknown>, conn),
    ).rejects.toThrow();
  });
});
