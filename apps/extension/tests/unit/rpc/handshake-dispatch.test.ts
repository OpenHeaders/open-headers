/**
 * Phase C handshake dispatcher — `evaluateHello` + `handleStateVector`.
 *
 * Pure unit coverage. `evaluateHello` is synchronous and only touches
 * schema + protocol-band math. `handleStateVector` is async but its
 * responder is stubbed via the `respond` option so the test stays
 * isolated from the per-workspace service registry.
 */
import {
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
  HANDSHAKE_MESSAGE_TYPES,
  evaluateHello,
  handleStateVector,
  type LocalHandshakeIdentity,
} from '@openheaders/oracle/rpc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installSyntheticIdentityForTests } from '../sync/_identity-test-setup';
import { clearIdentitySnapshot } from '@openheaders/core/identity';

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
  it('accepts a well-formed HELLO at the current protocol version', () => {
    const outcome = evaluateHello(validHello as unknown as Record<string, unknown>, localIdentity);
    expect(outcome.kind).toBe('accept');
    if (outcome.kind !== 'accept') return;
    expect(outcome.welcome.accepted).toBe(true);
    expect(outcome.welcome.type).toBe(SYNC_WELCOME_TYPE);
    if (outcome.welcome.accepted) {
      expect(outcome.welcome.role).toBe(localIdentity.role);
      expect(outcome.welcome.workspaceId).toBe('ws-1');
      expect(outcome.welcome.nodeId).toBe(localIdentity.nodeId);
    }
  });

  it('rejects HELLO that fails schema validation', () => {
    const outcome = evaluateHello({ type: SYNC_HELLO_TYPE, protocolVersion: 'oops' }, localIdentity);
    expect(outcome.kind).toBe('reject');
    if (outcome.kind === 'reject') {
      expect(outcome.welcome.accepted).toBe(false);
      expect(outcome.reason).toBeDefined();
    }
  });

  it('rejects HELLO with a future protocol version using PROTOCOL_TOO_NEW', () => {
    const outcome = evaluateHello(
      { ...validHello, protocolVersion: PROTOCOL_VERSION + 1 } as unknown as Record<string, unknown>,
      localIdentity,
    );
    expect(outcome.kind).toBe('reject');
    if (outcome.kind === 'reject') {
      expect(outcome.reason).toBe(HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_NEW);
    }
  });

  it('throws when called with a non-HELLO frame (caller wiring bug)', () => {
    expect(() => evaluateHello({ type: 'oh.sync.welcome' }, localIdentity)).toThrow();
  });

  it('publishes the canonical set of handshake message types', () => {
    expect(HANDSHAKE_MESSAGE_TYPES.has(SYNC_HELLO_TYPE)).toBe(true);
    expect(HANDSHAKE_MESSAGE_TYPES.has(SYNC_STATE_VECTOR_TYPE)).toBe(true);
  });

  describe('with requireAuth enabled (non-loopback bind)', () => {
    let teardown: () => void = () => undefined;

    afterEach(() => {
      teardown();
      clearIdentitySnapshot();
    });

    it('rejects with AUTH_REQUIRED when no identity snapshot is installed', () => {
      clearIdentitySnapshot();
      const outcome = evaluateHello(
        validHello as unknown as Record<string, unknown>,
        localIdentity,
        { requireAuth: true },
      );
      expect(outcome.kind).toBe('reject');
      if (outcome.kind === 'reject') {
        expect(outcome.reason).toBe(HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED);
        expect(outcome.welcome.accepted).toBe(false);
      }
    });

    it('accepts when the local LocalAdmin snapshot resolves daemon.admin to ALLOW', async () => {
      teardown = await installSyntheticIdentityForTests([]);
      const outcome = evaluateHello(
        validHello as unknown as Record<string, unknown>,
        localIdentity,
        { requireAuth: true },
      );
      expect(outcome.kind).toBe('accept');
    });

    it('is a no-op when requireAuth is false even without a snapshot', () => {
      clearIdentitySnapshot();
      const outcome = evaluateHello(
        validHello as unknown as Record<string, unknown>,
        localIdentity,
        { requireAuth: false },
      );
      expect(outcome.kind).toBe('accept');
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

  it('rejects when the inbound workspaceId does not match the peer connection', async () => {
    const { conn } = makePeer('ws-other');
    const respond = vi.fn();
    const outcome = await handleStateVector(stateVector as unknown as Record<string, unknown>, conn, {
      respond,
    });
    expect(outcome.kind).toBe('rejected');
    if (outcome.kind === 'rejected') expect(outcome.reason).toBe('workspace-mismatch');
    expect(respond).not.toHaveBeenCalled();
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
