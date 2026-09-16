/**
 * The DELEGATED request plane's gating laws: the same two-tier egress
 * opt-in as the context family (refused first, no identity resolution,
 * no audit); a frame MUST name its workspace (never the host's active
 * one); `workspace.write` as the peer on that workspace, audited; a
 * malformed request answers a structured refusal; a valid one rides
 * the transport's streaming leg with the head and chunk frames fanned
 * to the calling user's peers, the shared Stop registry aborting it,
 * and every answer — success or the transport's classified failure —
 * stamped with this host's label. Nothing here resolves anything.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  decision: { allow: true } as { allow: boolean; reason?: string },
  resolveSnapshot: vi.fn(async (_userId: string) => ({ kind: 'fake-snapshot' })),
  hasCapability: vi.fn((_snapshot: unknown, _capability: string, _ctx?: unknown) => h.decision),
  audits: [] as Record<string, unknown>[],
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

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import {
  DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE,
  LOCAL_PEER_EXECUTE_DISABLED_MESSAGE,
  REMOTE_PEER_EXECUTE_DISABLED_MESSAGE,
} from '@openheaders/core/protocol';
import {
  type DelegatedRequestResult,
  encodeDelegatedRequest,
} from '@openheaders/oracle/live/request-exec/delegated-wire';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import {
  type RequestTransport,
  TransportError,
  type TransportRequest,
  type TransportResponse,
  type TransportStreamObserver,
} from '@openheaders/oracle/live/request-exec/transport';
import { createDelegatedRequestsRpc } from '../../../src/daemon/delegated-requests-rpc';
import { setWsPeerServer } from '../../../src/daemon/ws-peer-slot';
import type { OracleWsServer, PeerSummary } from '../../../src/host-runtime/ws-server';

const PEER = { userId: 'user-1' };
const LOOPBACK_PEER = { userId: 'user-1', isLoopback: true };

const REQUEST: TransportRequest = {
  method: 'GET',
  url: 'https://api.openheaders.io/status',
  headers: [{ key: 'Authorization', value: 'Bearer resolved' }],
  body: { kind: 'none' },
  redirect: 'follow',
  credentials: 'omit',
  maxBodyBytes: 4096,
};

const RESPONSE: TransportResponse = {
  status: 200,
  statusText: 'OK',
  url: 'https://api.openheaders.io/status',
  headers: [{ key: 'content-type', value: 'application/json' }],
  body: '{"ok":true}',
  bodyTruncated: false,
  bodyBytes: 11,
};

function frame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'delegateRequest',
    sendId: 'send-1',
    workspaceId: 'ws-1',
    request: encodeDelegatedRequest(REQUEST),
    ...overrides,
  };
}

interface FakeTransport extends RequestTransport {
  calls: TransportRequest[];
}

function fakeTransport(
  run: (
    request: TransportRequest,
    observer: TransportStreamObserver,
    signal?: AbortSignal,
  ) => Promise<TransportResponse>,
): FakeTransport {
  const calls: TransportRequest[] = [];
  return {
    calls,
    send: async (request) => {
      calls.push(request);
      return run(request, { onHead: () => {}, onChunk: () => {} });
    },
    sendStreaming: async (request, observer, signal) => {
      calls.push(request);
      return run(request, observer, signal);
    },
  };
}

function captureFrames(): {
  frames: Array<{ frame: Record<string, unknown>; filterPeer?: (p: PeerSummary) => boolean }>;
} {
  const captured: Array<{ frame: Record<string, unknown>; filterPeer?: (p: PeerSummary) => boolean }> = [];
  setWsPeerServer({
    broadcastFrame: (f: Record<string, unknown>, opts?: { filterPeer?: (p: PeerSummary) => boolean }) => {
      captured.push({ frame: f, ...(opts?.filterPeer !== undefined ? { filterPeer: opts.filterPeer } : {}) });
    },
  } as unknown as OracleWsServer);
  return { frames: captured };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.settings = { 'backend.allowRemotePeerExecute': true };
  h.decision = { allow: true };
  h.audits = [];
  setWsPeerServer(null);
});

describe('createDelegatedRequestsRpc — ownership', () => {
  it('owns exactly the delegateRequest channel', () => {
    const rpc = createDelegatedRequestsRpc({ transport: fakeTransport(async () => RESPONSE) });
    expect(rpc.owns('delegateRequest')).toBe(true);
    expect(rpc.owns('executeRequest')).toBe(false);
    expect(rpc.owns('abortRequestSend')).toBe(false);
  });
});

describe('createDelegatedRequestsRpc — the gate', () => {
  it('refuses a non-loopback peer while the remote opt-in is off — no identity resolution, no audit, no socket', async () => {
    h.settings = {};
    const transport = fakeTransport(async () => RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport });
    await expect(rpc.dispatch(frame(), PEER)).rejects.toThrow(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
    expect(h.resolveSnapshot).not.toHaveBeenCalled();
    expect(h.audits).toHaveLength(0);
    expect(transport.calls).toHaveLength(0);
  });

  it('allows a loopback peer by default and refuses it with the LOCAL message when that opt-in is off', async () => {
    h.settings = {};
    const transport = fakeTransport(async () => RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport });
    await expect(rpc.dispatch(frame(), LOOPBACK_PEER)).resolves.toMatchObject({ success: true });
    h.settings = { 'backend.allowLocalPeerExecute': false };
    await expect(rpc.dispatch(frame(), LOOPBACK_PEER)).rejects.toThrow(LOCAL_PEER_EXECUTE_DISABLED_MESSAGE);
    expect(transport.calls).toHaveLength(1);
  });

  it('requires the frame to name its workspace — never the host active one', async () => {
    const transport = fakeTransport(async () => RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport });
    await expect(rpc.dispatch(frame({ workspaceId: undefined }), PEER)).rejects.toThrow(
      DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE,
    );
    await expect(rpc.dispatch(frame({ workspaceId: '' }), PEER)).rejects.toThrow(
      DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE,
    );
    expect(h.resolveSnapshot).not.toHaveBeenCalled();
    expect(h.audits).toHaveLength(0);
    expect(transport.calls).toHaveLength(0);
  });

  it('gates on workspace.write for the frame workspace as the peer, audited, then opens the socket', async () => {
    const transport = fakeTransport(async () => RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport });
    await rpc.dispatch(frame({ workspaceId: 'ws-tab' }), PEER);
    expect(h.resolveSnapshot).toHaveBeenCalledWith('user-1');
    expect(h.hasCapability).toHaveBeenCalledWith({ kind: 'fake-snapshot' }, 'workspace.write', {
      workspaceId: 'ws-tab',
    });
    expect(h.audits).toEqual([
      { actorUserId: 'user-1', capability: 'workspace.write', workspaceId: 'ws-tab', decision: { allow: true } },
    ]);
    expect(transport.calls).toHaveLength(1);
  });

  it('denies without opening the socket, with the decision audited', async () => {
    h.decision = { allow: false, reason: 'no-workspace-role-assignment' };
    const transport = fakeTransport(async () => RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport });
    await expect(rpc.dispatch(frame({ workspaceId: 'ws-x' }), PEER)).rejects.toThrow(
      'permission denied: workspace.write on ws-x (no-workspace-role-assignment)',
    );
    expect(h.audits).toHaveLength(1);
    expect(transport.calls).toHaveLength(0);
  });

  it('answers a structured refusal for a malformed request, past the gate, stamped', async () => {
    const transport = fakeTransport(async () => RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport });
    const result = (await rpc.dispatch(frame({ request: { method: 'GET' } }), PEER)) as DelegatedRequestResult;
    expect(result).toMatchObject({ success: false, executedOn: { kind: 'backend' } });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/^Malformed delegated send frame at request\./);
    expect(h.audits).toHaveLength(1);
    expect(transport.calls).toHaveLength(0);
  });
});

describe('createDelegatedRequestsRpc — the exchange', () => {
  it('hands the transport the seam request as sent — resolved headers verbatim, no jar key — and answers the response stamped', async () => {
    const transport = fakeTransport(async () => RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport });
    const result = (await rpc.dispatch(frame(), PEER)) as DelegatedRequestResult;
    expect(transport.calls[0]).toMatchObject({
      method: 'GET',
      url: REQUEST.url,
      headers: [{ key: 'Authorization', value: 'Bearer resolved' }],
    });
    expect(transport.calls[0]).not.toHaveProperty('cookieJarKey');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.response).toBe(RESPONSE);
    expect(result.executedOn.kind).toBe('backend');
    expect(result.executedOn.name).toMatch(/^[^.]+$/);
  });

  it("fans the head and body chunks to the calling user's peers as requestStreamEvent frames, then done", async () => {
    vi.useFakeTimers();
    try {
      const { frames } = captureFrames();
      const transport = fakeTransport(async (_request, observer) => {
        observer.onHead({ status: 200, statusText: 'OK', url: REQUEST.url, headers: [] });
        observer.onChunk(new TextEncoder().encode('{"ok"'), 5);
        // The emitter engages on the time window — a body still
        // arriving when it fires is a live stream.
        await vi.advanceTimersByTimeAsync(150);
        observer.onChunk(new TextEncoder().encode(':true}'), 11);
        return RESPONSE;
      });
      const rpc = createDelegatedRequestsRpc({ transport });
      await rpc.dispatch(frame(), PEER);
      const kinds = frames.map((f) => (f.frame.payload as RequestStreamEventWire).kind);
      expect(kinds).toEqual(['head', 'chunk', 'chunk', 'done']);
      for (const f of frames) {
        expect(f.frame.type).toBe('requestStreamEvent');
        expect((f.frame.payload as RequestStreamEventWire).sendId).toBe('send-1');
        expect(f.filterPeer?.({ userId: 'user-1' } as PeerSummary)).toBe(true);
        expect(f.filterPeer?.({ userId: 'user-2' } as PeerSummary)).toBe(false);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('registers the send under its id so abortRequestSend stops it — the shared registry', async () => {
    const transport = fakeTransport(
      (_request, _observer, signal) =>
        new Promise<TransportResponse>((resolve) => {
          signal?.addEventListener('abort', () =>
            resolve({ ...RESPONSE, body: '{"ok"', bodyBytes: 5, streamEndedEarly: { reason: 'aborted' } }),
          );
        }),
    );
    const rpc = createDelegatedRequestsRpc({ transport });
    const pending = rpc.dispatch(frame({ sendId: 'send-stop' }), PEER);
    await vi.waitFor(() => expect(transport.calls).toHaveLength(1));
    expect(stopActiveSend('send-stop')).toBe(true);
    const result = (await pending) as DelegatedRequestResult;
    expect(result.success && result.response.streamEndedEarly).toEqual({ reason: 'aborted' });
    // Settled sends leave the registry.
    expect(stopActiveSend('send-stop')).toBe(false);
  });

  it("answers the transport's classified failure with its hint, stamped — where it failed is still this host", async () => {
    const transport = fakeTransport(async () => {
      throw new TransportError('self signed certificate', {
        kind: 'trust-certificate',
        host: 'api.openheaders.io',
        port: 443,
        code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
      });
    });
    const rpc = createDelegatedRequestsRpc({ transport });
    const result = (await rpc.dispatch(frame(), PEER)) as DelegatedRequestResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe('self signed certificate');
    expect(result.hint).toMatchObject({ kind: 'trust-certificate', code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
    expect(result.executedOn.kind).toBe('backend');
    expect(stopActiveSend('send-1')).toBe(false);
  });

  it('falls back to the buffered send on a transport without the streaming leg', async () => {
    const calls: TransportRequest[] = [];
    const transport: RequestTransport = {
      send: async (request) => {
        calls.push(request);
        return RESPONSE;
      },
    };
    const rpc = createDelegatedRequestsRpc({ transport });
    const result = (await rpc.dispatch(frame(), PEER)) as DelegatedRequestResult;
    expect(calls).toHaveLength(1);
    expect(result.success).toBe(true);
  });
});
