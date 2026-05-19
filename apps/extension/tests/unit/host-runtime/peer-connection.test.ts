/**
 * Phase C handshake — `PeerConnection` identity + reply seam.
 *
 * Pure unit coverage of the host-runtime value type. No oracle, no
 * sockets — verifies isOpen / reply / close semantics that the
 * ws-server and handshake-responder both rely on.
 */
import { HANDSHAKE_ROLES } from '@openheaders/core/protocol';
import { createPeerConnection } from '@openheaders/oracle/host-runtime/peer-connection';
import { describe, expect, it, vi } from 'vitest';

function makeConn(overrides: Partial<Parameters<typeof createPeerConnection>[0]> = {}) {
  const send = vi.fn<(frame: object) => boolean>(() => true);
  const close = vi.fn<(code?: number, reason?: string) => void>();
  const conn = createPeerConnection({
    peerId: 'peer-1',
    nodeId: 'sw-abc',
    role: HANDSHAKE_ROLES.EXTENSION,
    agent: '@openheaders/extension@0.0.0-test',
    workspaceId: 'ws-1',
    protocolVersion: 1,
    send,
    close,
    now: () => 1_700_000_000_000,
    ...overrides,
  });
  return { conn, send, close };
}

describe('PeerConnection', () => {
  it('exposes the spec identity verbatim + stamps connectedAt from the clock', () => {
    const { conn } = makeConn();
    expect(conn.peerId).toBe('peer-1');
    expect(conn.nodeId).toBe('sw-abc');
    expect(conn.role).toBe('extension');
    expect(conn.workspaceId).toBe('ws-1');
    expect(conn.protocolVersion).toBe(1);
    expect(conn.connectedAt).toBe(1_700_000_000_000);
    expect(conn.claims).toBeNull();
    // Defaults to null — loopback peers carry no token gate.
    expect(conn.tokenId).toBeNull();
    expect(conn.isOpen()).toBe(true);
  });

  it('carries the validated tokenId for the U3.4 known-devices join key', () => {
    const { conn } = makeConn({ tokenId: 'token-abc' });
    expect(conn.tokenId).toBe('token-abc');
  });

  it('forwards reply() to the transport when open', () => {
    const { conn, send } = makeConn();
    expect(conn.reply({ type: 'oh.sync.synced', workspaceId: 'ws-1', stateVectorAfter: {} })).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ type: 'oh.sync.synced' });
  });

  it('flips to closed + returns false from reply() when transport send fails', () => {
    const { conn, send } = makeConn({ send: vi.fn<(frame: object) => boolean>(() => false) });
    expect(conn.reply({ type: 'oh.sync.synced', workspaceId: 'ws-1', stateVectorAfter: {} })).toBe(false);
    expect(conn.isOpen()).toBe(false);
    // Subsequent reply attempts short-circuit without calling transport.
    send.mockClear();
    expect(conn.reply({ type: 'x' })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('close() is idempotent and stops further replies', () => {
    const { conn, close, send } = makeConn();
    conn.close(1001, 'bye');
    conn.close(1001, 'bye'); // second call is a no-op
    expect(close).toHaveBeenCalledTimes(1);
    expect(close.mock.calls[0]).toEqual([1001, 'bye']);
    expect(conn.isOpen()).toBe(false);
    expect(conn.reply({ type: 'x' })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('carries optional claims unchanged for Phase D auth wiring', () => {
    const claims = {
      userId: 'u-1',
      deviceId: 'd-1',
      capabilities: new Set(['workspace:read', 'workspace:write']),
    };
    const { conn } = makeConn({ claims });
    expect(conn.claims).toBe(claims);
  });
});
