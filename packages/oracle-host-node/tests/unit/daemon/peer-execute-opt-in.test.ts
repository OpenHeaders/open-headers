/**
 * The egress opt-in gate — two tiers by the peer's loopback fact, the
 * remote tier's default the HOST's (on for a standalone server, off for
 * the desktop app), the stored record overriding either; the admin
 * write keeps the rest of the settings record.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  writes: [] as Array<Record<string, unknown>>,
}));

vi.mock('@openheaders/core/storage', () => ({
  hostStorage: {
    get: async () => h.settings,
    set: async (_key: unknown, value: Record<string, unknown>) => {
      h.writes.push(value);
      h.settings = value;
    },
  },
  OH: { settingsUser: 'oh.settingsUser' },
}));

import { LOCAL_PEER_EXECUTE_DISABLED_MESSAGE, REMOTE_PEER_EXECUTE_DISABLED_MESSAGE } from '@openheaders/core/protocol';
import { createPeerExecuteOptIn, defaultPeerExecuteOptIn } from '../../../src/daemon/peer-execute-opt-in';

const REMOTE_PEER = { userId: 'user-1' };
const LOOPBACK_PEER = { userId: 'user-1', isLoopback: true };

beforeEach(() => {
  h.settings = {};
  h.writes = [];
});

describe('createPeerExecuteOptIn — the remote tier follows the host default until the record speaks', () => {
  it('a server posture allows a remote peer on an empty record; the desktop posture refuses it', async () => {
    const server = createPeerExecuteOptIn({ remoteDefault: true });
    const desktop = createPeerExecuteOptIn({ remoteDefault: false });
    await expect(server.assert(REMOTE_PEER)).resolves.toBeUndefined();
    await expect(desktop.assert(REMOTE_PEER)).rejects.toThrow(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
    expect(await server.read()).toEqual({ remote: true });
    expect(await desktop.read()).toEqual({ remote: false });
  });

  it('the record overrides either default, and junk in the slot reads as absent', async () => {
    const server = createPeerExecuteOptIn({ remoteDefault: true });
    const desktop = createPeerExecuteOptIn({ remoteDefault: false });
    h.settings = { 'backend.allowRemotePeerExecute': false };
    await expect(server.assert(REMOTE_PEER)).rejects.toThrow(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
    h.settings = { 'backend.allowRemotePeerExecute': true };
    await expect(desktop.assert(REMOTE_PEER)).resolves.toBeUndefined();
    h.settings = { 'backend.allowRemotePeerExecute': 'true' };
    expect(await desktop.read()).toEqual({ remote: false });
    expect(await server.read()).toEqual({ remote: true });
  });

  it('the local tier is on by default on every posture and off only when the record says so', async () => {
    const server = createPeerExecuteOptIn({ remoteDefault: true });
    await expect(server.assert(LOOPBACK_PEER)).resolves.toBeUndefined();
    h.settings = { 'backend.allowLocalPeerExecute': false, 'backend.allowRemotePeerExecute': true };
    await expect(server.assert(LOOPBACK_PEER)).rejects.toThrow(LOCAL_PEER_EXECUTE_DISABLED_MESSAGE);
    await expect(server.assert(REMOTE_PEER)).resolves.toBeUndefined();
  });

  it('setRemote writes the key into the settings record and keeps every other slot', async () => {
    const server = createPeerExecuteOptIn({ remoteDefault: true });
    h.settings = { 'mcp.enabled': true, 'backend.bindPort': 9137 };
    await server.setRemote(false);
    expect(h.writes).toEqual([
      { 'mcp.enabled': true, 'backend.bindPort': 9137, 'backend.allowRemotePeerExecute': false },
    ]);
    expect(await server.read()).toEqual({ remote: false });
    await expect(server.assert(REMOTE_PEER)).rejects.toThrow(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
  });

  it('the default gate is the desktop posture', async () => {
    await expect(defaultPeerExecuteOptIn().assert(REMOTE_PEER)).rejects.toThrow(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
  });
});
