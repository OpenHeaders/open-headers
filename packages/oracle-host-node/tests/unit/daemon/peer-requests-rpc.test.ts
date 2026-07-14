/**
 * Peer-facing request-execution plane — the gating laws over the five
 * workbench channels: `executeRequest` refuses (honestly, naming the
 * setting) while `backend.allowPeerExecute` is off, with no identity
 * resolution and no audit row; past the opt-in, every channel resolves
 * the peer's snapshot fresh, gates on the workspace capability
 * (`workspace.write` for send + clear + per-entry delete,
 * `workspace.read` for the summary and the script-posture fact),
 * audits the decision, and only then reaches the handler.
 * The target workspace is the frame's, falling back to the host's
 * active one.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  decision: { allow: true } as { allow: boolean; reason?: string },
  resolveSnapshot: vi.fn(async (_userId: string) => ({ kind: 'fake-snapshot' })),
  hasCapability: vi.fn((_snapshot: unknown, _capability: string, _ctx?: unknown) => h.decision),
  audits: [] as Record<string, unknown>[],
  jars: new Map<
    string,
    { list: () => unknown[]; clear: () => void; delete?: (name: string, domain: string, path: string) => void }
  >(),
}));

vi.mock('@openheaders/core/identity', () => ({
  resolveDaemonPeerIdentitySnapshot: (userId: string) => h.resolveSnapshot(userId),
  hasCapability: (snapshot: unknown, capability: string, ctx?: unknown) => h.hasCapability(snapshot, capability, ctx),
  emitAuditEntry: (entry: Record<string, unknown>) => {
    h.audits.push(entry);
  },
}));
vi.mock('@openheaders/core/storage', () => ({
  hostStorage: { get: async () => h.settings },
  OH: { settingsUser: 'oh.settingsUser' },
}));
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-active',
}));
vi.mock('../../../src/live/cookie-jar', () => ({
  peekCookieJar: (key: string) => h.jars.get(key),
}));

import type { ExecuteRequestRpcResult } from '../../../src/daemon/execute-request-rpc';
import { createPeerRequestsRpc, PEER_EXECUTE_DISABLED_MESSAGE } from '../../../src/daemon/peer-requests-rpc';
import { setHostScriptCapabilities } from '../../../src/daemon/script-capability';

const PEER = { userId: 'user-1' };

beforeEach(() => {
  vi.clearAllMocks();
  h.settings = { 'backend.allowPeerExecute': true };
  h.decision = { allow: true };
  h.audits = [];
  h.jars = new Map();
  setHostScriptCapabilities(null);
});

describe('createPeerRequestsRpc — ownership', () => {
  it('owns exactly the five request channels', () => {
    const rpc = createPeerRequestsRpc();
    expect(rpc.owns('executeRequest')).toBe(true);
    expect(rpc.owns('getCookieJarSummary')).toBe(true);
    expect(rpc.owns('clearCookieJar')).toBe(true);
    expect(rpc.owns('deleteCookieJarEntry')).toBe(true);
    expect(rpc.owns('getScriptRuntimeInfo')).toBe(true);
    expect(rpc.owns('getStatusSnapshot')).toBe(false);
    expect(rpc.owns('oh.daemon.users.list')).toBe(false);
  });
});

describe('createPeerRequestsRpc — script posture', () => {
  it('answers the Safe capability presence under workspace.read — no opt-in required', async () => {
    h.settings = {};
    setHostScriptCapabilities({
      safe: {
        mode: 'safe',
        runScript: async () => ({ executionId: 'e', succeeded: true, assertions: [], consoleLog: [], durationMs: 0 }),
      },
    });
    const rpc = createPeerRequestsRpc();
    await expect(rpc.dispatch({ type: 'getScriptRuntimeInfo' }, PEER)).resolves.toEqual({ scriptRuntime: 'safe' });
    expect(h.hasCapability).toHaveBeenCalledWith(expect.anything(), 'workspace.read', { workspaceId: 'ws-active' });
    expect(h.audits).toHaveLength(1);
  });

  it('answers null on a scriptless host — the honest "don\'t run here" fact', async () => {
    setHostScriptCapabilities(null);
    const rpc = createPeerRequestsRpc();
    await expect(rpc.dispatch({ type: 'getScriptRuntimeInfo' }, PEER)).resolves.toEqual({ scriptRuntime: null });
  });
});

describe('createPeerRequestsRpc — executeRequest', () => {
  it('refuses while the opt-in is off — no identity resolution, no audit, no handler call', async () => {
    h.settings = {};
    const execute = vi.fn(async () => ({ success: true }));
    const rpc = createPeerRequestsRpc({ executeRequest: execute });
    await expect(rpc.dispatch({ type: 'executeRequest', draft: {} }, PEER)).rejects.toThrow(
      PEER_EXECUTE_DISABLED_MESSAGE,
    );
    expect(h.resolveSnapshot).not.toHaveBeenCalled();
    expect(h.audits).toHaveLength(0);
    expect(execute).not.toHaveBeenCalled();
  });

  it('gates on workspace.write for the frame workspace as the peer, audited, then dispatches', async () => {
    const executed: ExecuteRequestRpcResult = { success: true };
    const execute = vi.fn(async () => executed);
    const rpc = createPeerRequestsRpc({ executeRequest: execute });
    const message = { type: 'executeRequest', draft: {}, workspaceId: 'ws-tab' };
    await expect(rpc.dispatch(message, PEER)).resolves.toBe(executed);
    expect(h.resolveSnapshot).toHaveBeenCalledWith('user-1');
    expect(h.hasCapability).toHaveBeenCalledWith({ kind: 'fake-snapshot' }, 'workspace.write', {
      workspaceId: 'ws-tab',
    });
    expect(h.audits).toEqual([
      { actorUserId: 'user-1', capability: 'workspace.write', workspaceId: 'ws-tab', decision: { allow: true } },
    ]);
    expect(execute).toHaveBeenCalledWith(message);
  });

  it('falls back to the host active workspace when the frame names none', async () => {
    const execute = vi.fn(async () => ({ success: true }));
    const rpc = createPeerRequestsRpc({ executeRequest: execute });
    await rpc.dispatch({ type: 'executeRequest', draft: {} }, PEER);
    expect(h.hasCapability).toHaveBeenCalledWith(expect.anything(), 'workspace.write', { workspaceId: 'ws-active' });
  });

  it('stamps executedOn onto the returned snapshot — this host made the egress connection', async () => {
    const snapshot = { status: 200, statusText: 'OK', url: 'https://api.openheaders.io/x', error: null };
    const execute = vi.fn(async () => ({ success: true, snapshot }) as unknown as ExecuteRequestRpcResult);
    const rpc = createPeerRequestsRpc({ executeRequest: execute });
    const result = (await rpc.dispatch({ type: 'executeRequest', draft: {} }, PEER)) as ExecuteRequestRpcResult;
    expect(result.success).toBe(true);
    expect(result.snapshot?.executedOn?.kind).toBe('backend');
    expect(result.snapshot?.executedOn?.name).toMatch(/^[^.]+$/);
    expect(result.snapshot?.executedOn?.name.length).toBeGreaterThan(0);
    // The stamp decorates — the wire facts pass through untouched.
    expect(result.snapshot?.status).toBe(200);
  });

  it('stamps executedOn on error snapshots too — where the send failed is still this host', async () => {
    const snapshot = { status: 0, statusText: '', url: '', error: 'socket hang up' };
    const execute = vi.fn(async () => ({ success: true, snapshot }) as unknown as ExecuteRequestRpcResult);
    const rpc = createPeerRequestsRpc({ executeRequest: execute });
    const result = (await rpc.dispatch({ type: 'executeRequest', draft: {} }, PEER)) as ExecuteRequestRpcResult;
    expect(result.snapshot?.error).toBe('socket hang up');
    expect(result.snapshot?.executedOn?.kind).toBe('backend');
  });

  it('denies without reaching the handler, with the decision audited', async () => {
    h.decision = { allow: false, reason: 'no-grant' };
    const execute = vi.fn(async () => ({ success: true }));
    const rpc = createPeerRequestsRpc({ executeRequest: execute });
    await expect(rpc.dispatch({ type: 'executeRequest', draft: {}, workspaceId: 'ws-x' }, PEER)).rejects.toThrow(
      'permission denied: workspace.write on ws-x (no-grant)',
    );
    expect(h.audits).toEqual([
      {
        actorUserId: 'user-1',
        capability: 'workspace.write',
        workspaceId: 'ws-x',
        decision: { allow: false, reason: 'no-grant' },
      },
    ]);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('createPeerRequestsRpc — cookie-jar channels', () => {
  it('answers the summary from the frame workspace jar under workspace.read — no opt-in required', async () => {
    h.settings = {};
    h.jars.set('ws-tab', { list: () => [{ name: 'sid' }], clear: () => {} });
    const rpc = createPeerRequestsRpc();
    await expect(rpc.dispatch({ type: 'getCookieJarSummary', workspaceId: 'ws-tab' }, PEER)).resolves.toEqual({
      cookies: [{ name: 'sid' }],
    });
    expect(h.hasCapability).toHaveBeenCalledWith(expect.anything(), 'workspace.read', { workspaceId: 'ws-tab' });
    expect(h.audits).toHaveLength(1);
  });

  it('answers an empty summary when no jar exists — inspection never mints one', async () => {
    const rpc = createPeerRequestsRpc();
    await expect(rpc.dispatch({ type: 'getCookieJarSummary' }, PEER)).resolves.toEqual({ cookies: [] });
    expect(h.hasCapability).toHaveBeenCalledWith(expect.anything(), 'workspace.read', { workspaceId: 'ws-active' });
  });

  it('clears under workspace.write and reports success', async () => {
    const clear = vi.fn();
    h.jars.set('ws-active', { list: () => [], clear });
    const rpc = createPeerRequestsRpc();
    await expect(rpc.dispatch({ type: 'clearCookieJar' }, PEER)).resolves.toEqual({ success: true });
    expect(h.hasCapability).toHaveBeenCalledWith(expect.anything(), 'workspace.write', { workspaceId: 'ws-active' });
    expect(clear).toHaveBeenCalledOnce();
  });

  it('deletes one entry by its (name, domain, path) identity under workspace.write', async () => {
    const del = vi.fn();
    h.jars.set('ws-tab', { list: () => [], clear: () => {}, delete: del });
    const rpc = createPeerRequestsRpc();
    const message = {
      type: 'deleteCookieJarEntry',
      workspaceId: 'ws-tab',
      name: 'sid',
      domain: 'openheaders.io',
      path: '/',
    };
    await expect(rpc.dispatch(message, PEER)).resolves.toEqual({ success: true });
    expect(h.hasCapability).toHaveBeenCalledWith(expect.anything(), 'workspace.write', { workspaceId: 'ws-tab' });
    expect(del).toHaveBeenCalledWith('sid', 'openheaders.io', '/');
  });

  it('a capability deny leaves the jar untouched', async () => {
    h.decision = { allow: false, reason: 'no-grant' };
    const clear = vi.fn();
    h.jars.set('ws-tab', { list: () => [], clear });
    const rpc = createPeerRequestsRpc();
    await expect(rpc.dispatch({ type: 'clearCookieJar', workspaceId: 'ws-tab' }, PEER)).rejects.toThrow(
      'permission denied: workspace.write on ws-tab (no-grant)',
    );
    expect(clear).not.toHaveBeenCalled();
  });
});
