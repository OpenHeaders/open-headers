/**
 * Peer-facing request-execution plane — the gating laws over the ten
 * workbench channels: `executeRequest` / `executeGrpcRequest` refuse
 * (honestly, naming the setting) while `backend.allowPeerExecute` is
 * off, with no identity resolution and no audit row; past the opt-in,
 * every channel resolves the peer's snapshot fresh, gates on the
 * workspace capability (`workspace.write` for send + clear + per-entry
 * delete, `workspace.read` for the summary and the script-posture
 * fact), audits the decision, and only then reaches the handler.
 * `abortRequestSend` and the gRPC upstream riders ride ahead of the
 * capability tier (the caller-minted sendId is the authorization), as
 * does the `getCliStatusSummary` probe (authenticated admission is the
 * whole gate — coarse state only, null when unbacked or failed); a
 * forwarded send's live frames fan to the calling user's peers only.
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

import type { GrpcStreamEventWire, RequestStreamEventWire } from '@openheaders/core/bridge';
import { registerActiveGrpcStream } from '@openheaders/oracle/live/grpc-exec/stream-plane';
import { registerActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import type { ExecuteGrpcRequestRpcResult } from '../../../src/daemon/execute-grpc-request-rpc';
import type { ExecuteRequestRpcResult } from '../../../src/daemon/execute-request-rpc';
import { createPeerRequestsRpc, PEER_EXECUTE_DISABLED_MESSAGE } from '../../../src/daemon/peer-requests-rpc';
import { setHostScriptCapabilities } from '../../../src/daemon/script-capability';
import { setWsPeerServer } from '../../../src/daemon/ws-peer-slot';
import type { OracleWsServer, PeerSummary } from '../../../src/host-runtime/ws-server';

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
  it('owns exactly the ten request channels', () => {
    const rpc = createPeerRequestsRpc();
    expect(rpc.owns('executeRequest')).toBe(true);
    expect(rpc.owns('executeGrpcRequest')).toBe(true);
    expect(rpc.owns('abortRequestSend')).toBe(true);
    expect(rpc.owns('sendGrpcStreamMessage')).toBe(true);
    expect(rpc.owns('endGrpcClientStream')).toBe(true);
    expect(rpc.owns('getCookieJarSummary')).toBe(true);
    expect(rpc.owns('clearCookieJar')).toBe(true);
    expect(rpc.owns('deleteCookieJarEntry')).toBe(true);
    expect(rpc.owns('getScriptRuntimeInfo')).toBe(true);
    expect(rpc.owns('getCliStatusSummary')).toBe(true);
    expect(rpc.owns('getStatusSnapshot')).toBe(false);
    expect(rpc.owns('oh.daemon.users.list')).toBe(false);
  });
});

describe('createPeerRequestsRpc — getCliStatusSummary', () => {
  it('answers the coarse state alone — no identity resolution, no audit, no opt-in, no detail fields', async () => {
    h.settings = {};
    const rpc = createPeerRequestsRpc({
      cliStatus: async () => ({
        configPath: '/home/user/.config/openheaders/cli.json',
        state: 'configured',
        tokenId: 'tok-1',
        label: 'CLI — machine',
        daemonUrl: 'http://127.0.0.1:8137',
      }),
    });
    await expect(rpc.dispatch({ type: 'getCliStatusSummary' }, PEER)).resolves.toEqual({ state: 'configured' });
    expect(h.resolveSnapshot).not.toHaveBeenCalled();
    expect(h.audits).toHaveLength(0);
  });

  it('answers state: null when composed without the backing', async () => {
    const rpc = createPeerRequestsRpc();
    await expect(rpc.dispatch({ type: 'getCliStatusSummary' }, PEER)).resolves.toEqual({ state: null });
  });

  it('answers state: null when the backing throws — unknown, never fabricated', async () => {
    const rpc = createPeerRequestsRpc({
      cliStatus: async () => {
        throw new Error('disk unavailable');
      },
    });
    await expect(rpc.dispatch({ type: 'getCliStatusSummary' }, PEER)).resolves.toEqual({ state: null });
  });
});

describe('createPeerRequestsRpc — abortRequestSend', () => {
  it('stops a registered send by its id without identity resolution or an audit row', async () => {
    let stopped = false;
    const unregister = registerActiveSend('send-abc', () => {
      stopped = true;
    });
    try {
      const rpc = createPeerRequestsRpc();
      await expect(rpc.dispatch({ type: 'abortRequestSend', sendId: 'send-abc' }, PEER)).resolves.toEqual({
        success: true,
      });
      expect(stopped).toBe(true);
      // The sendId IS the authorization — no capability tier runs.
      expect(h.resolveSnapshot).not.toHaveBeenCalled();
      expect(h.audits).toHaveLength(0);
    } finally {
      unregister();
    }
  });

  it('answers success: false for an unknown or already-settled send', async () => {
    const rpc = createPeerRequestsRpc();
    await expect(rpc.dispatch({ type: 'abortRequestSend', sendId: 'never-registered' }, PEER)).resolves.toEqual({
      success: false,
    });
    await expect(rpc.dispatch({ type: 'abortRequestSend' }, PEER)).resolves.toEqual({ success: false });
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
    expect(execute).toHaveBeenCalledWith(message, expect.any(Function));
  });

  it("hands the handler a frame sink that fans requestStreamEvent frames to the calling user's peers", async () => {
    const frames: Array<{ frame: Record<string, unknown>; opts?: { filterPeer?: (peer: PeerSummary) => boolean } }> =
      [];
    setWsPeerServer({
      broadcastFrame: (frame: Record<string, unknown>, opts?: { filterPeer?: (peer: PeerSummary) => boolean }) => {
        frames.push({ frame, ...(opts !== undefined ? { opts } : {}) });
      },
    } as unknown as OracleWsServer);
    try {
      const event = { sendId: 's-1', seq: 0, kind: 'done' };
      const execute = vi.fn(
        async (_message: Record<string, unknown>, emitStreamFrame: (e: RequestStreamEventWire) => void) => {
          emitStreamFrame(event as RequestStreamEventWire);
          return { success: true };
        },
      );
      const rpc = createPeerRequestsRpc({ executeRequest: execute });
      await rpc.dispatch({ type: 'executeRequest', draft: {} }, PEER);
      expect(frames).toHaveLength(1);
      expect(frames[0].frame).toEqual({ type: 'requestStreamEvent', payload: event });
      // Same-user law: only the calling user's peers see the frames.
      const filterPeer = frames[0].opts?.filterPeer;
      expect(filterPeer?.({ userId: 'user-1' } as PeerSummary)).toBe(true);
      expect(filterPeer?.({ userId: 'user-2' } as PeerSummary)).toBe(false);
    } finally {
      setWsPeerServer(null);
    }
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

describe('createPeerRequestsRpc — executeGrpcRequest', () => {
  it('shares the executeRequest opt-in — refuses with no identity resolution, audit, or handler call', async () => {
    h.settings = {};
    const execute = vi.fn(async () => ({ success: true }));
    const rpc = createPeerRequestsRpc({ executeGrpcRequest: execute });
    await expect(rpc.dispatch({ type: 'executeGrpcRequest', draft: {} }, PEER)).rejects.toThrow(
      PEER_EXECUTE_DISABLED_MESSAGE,
    );
    expect(h.resolveSnapshot).not.toHaveBeenCalled();
    expect(h.audits).toHaveLength(0);
    expect(execute).not.toHaveBeenCalled();
  });

  it('gates on workspace.write for the frame workspace as the peer, audited, then dispatches', async () => {
    const executed: ExecuteGrpcRequestRpcResult = { success: true };
    const execute = vi.fn(async () => executed);
    const rpc = createPeerRequestsRpc({ executeGrpcRequest: execute });
    const message = { type: 'executeGrpcRequest', draft: {}, workspaceId: 'ws-tab' };
    await expect(rpc.dispatch(message, PEER)).resolves.toBe(executed);
    expect(h.hasCapability).toHaveBeenCalledWith({ kind: 'fake-snapshot' }, 'workspace.write', {
      workspaceId: 'ws-tab',
    });
    expect(h.audits).toEqual([
      { actorUserId: 'user-1', capability: 'workspace.write', workspaceId: 'ws-tab', decision: { allow: true } },
    ]);
    expect(execute).toHaveBeenCalledWith(message, expect.any(Function));
  });

  it("hands the handler a sink that fans grpcStreamEvent frames to the calling user's peers", async () => {
    const frames: Array<{ frame: Record<string, unknown>; opts?: { filterPeer?: (peer: PeerSummary) => boolean } }> =
      [];
    setWsPeerServer({
      broadcastFrame: (frame: Record<string, unknown>, opts?: { filterPeer?: (peer: PeerSummary) => boolean }) => {
        frames.push({ frame, ...(opts !== undefined ? { opts } : {}) });
      },
    } as unknown as OracleWsServer);
    try {
      const event = { sendId: 's-1', seq: 0, kind: 'end' };
      const execute = vi.fn(
        async (_message: Record<string, unknown>, emitStreamEvent: (e: GrpcStreamEventWire) => void) => {
          emitStreamEvent(event as GrpcStreamEventWire);
          return { success: true };
        },
      );
      const rpc = createPeerRequestsRpc({ executeGrpcRequest: execute });
      await rpc.dispatch({ type: 'executeGrpcRequest', draft: {} }, PEER);
      expect(frames).toHaveLength(1);
      expect(frames[0].frame).toEqual({ type: 'grpcStreamEvent', payload: event });
      const filterPeer = frames[0].opts?.filterPeer;
      expect(filterPeer?.({ userId: 'user-1' } as PeerSummary)).toBe(true);
      expect(filterPeer?.({ userId: 'user-2' } as PeerSummary)).toBe(false);
    } finally {
      setWsPeerServer(null);
    }
  });

  it('stamps executedOn onto the returned snapshot — this host dialed the gRPC target', async () => {
    const snapshot = { httpStatus: 200, grpcStatus: 0, error: null };
    const execute = vi.fn(async () => ({ success: true, snapshot }) as unknown as ExecuteGrpcRequestRpcResult);
    const rpc = createPeerRequestsRpc({ executeGrpcRequest: execute });
    const result = (await rpc.dispatch({ type: 'executeGrpcRequest', draft: {} }, PEER)) as ExecuteGrpcRequestRpcResult;
    expect(result.snapshot?.executedOn?.kind).toBe('backend');
    expect(result.snapshot?.httpStatus).toBe(200);
  });
});

describe('createPeerRequestsRpc — gRPC upstream riders', () => {
  it('writes into a registered stream by its sendId without identity resolution or an audit row', async () => {
    const sent: string[] = [];
    const unregister = registerActiveGrpcStream('grpc-abc', {
      send: (messageText: string) => {
        sent.push(messageText);
        return { success: true };
      },
      end: () => {},
    });
    try {
      const rpc = createPeerRequestsRpc();
      await expect(
        rpc.dispatch({ type: 'sendGrpcStreamMessage', sendId: 'grpc-abc', messageText: '{"x":1}' }, PEER),
      ).resolves.toEqual({ success: true });
      expect(sent).toEqual(['{"x":1}']);
      expect(h.resolveSnapshot).not.toHaveBeenCalled();
      expect(h.audits).toHaveLength(0);
    } finally {
      unregister();
    }
  });

  it('half-closes a registered stream and answers false for unknown ids', async () => {
    let ended = false;
    const unregister = registerActiveGrpcStream('grpc-abc', {
      send: () => ({ success: true }),
      end: () => {
        ended = true;
      },
    });
    try {
      const rpc = createPeerRequestsRpc();
      await expect(rpc.dispatch({ type: 'endGrpcClientStream', sendId: 'grpc-abc' }, PEER)).resolves.toEqual({
        success: true,
      });
      expect(ended).toBe(true);
      await expect(rpc.dispatch({ type: 'endGrpcClientStream', sendId: 'unknown' }, PEER)).resolves.toEqual({
        success: false,
      });
    } finally {
      unregister();
    }
  });

  it('answers a structured refusal for a malformed send frame', async () => {
    const rpc = createPeerRequestsRpc();
    await expect(rpc.dispatch({ type: 'sendGrpcStreamMessage', sendId: 'grpc-abc' }, PEER)).resolves.toEqual({
      success: false,
      error: 'No stream id or message provided',
    });
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
