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
  identity: null as unknown,
  decision: { allow: true } as { allow: boolean; reason?: string },
  resolveSnapshot: vi.fn(async (_userId: string) => ({ kind: 'fake-snapshot' })),
  hasCapability: vi.fn((_snapshot: unknown, _capability: string, _ctx?: unknown) => h.decision),
  audits: [] as Record<string, unknown>[],
}));

vi.mock('@openheaders/core/identity', () => ({
  getIdentitySnapshot: () => h.identity,
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
  type DelegatedGrpcInvokeResult,
  encodeDelegatedGrpcRequest,
} from '@openheaders/oracle/live/grpc-exec/delegated-wire';
import {
  type GrpcTransport,
  GrpcTransportError,
  type GrpcTransportRequest,
  type GrpcTransportResponse,
} from '@openheaders/oracle/live/grpc-exec/transport';
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
import { createPeerExecuteOptIn } from '../../../src/daemon/peer-execute-opt-in';
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
  it('owns the delegateRequest and delegateGrpcInvoke channels alone', () => {
    const rpc = createDelegatedRequestsRpc({ transport: fakeTransport(async () => RESPONSE) });
    expect(rpc.owns('delegateRequest')).toBe(true);
    expect(rpc.owns('delegateGrpcInvoke')).toBe(true);
    expect(rpc.owns('delegateGrpcOpen')).toBe(false);
    expect(rpc.owns('executeGrpcRequest')).toBe(false);
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

  it('a server-posture gate allows a remote peer on an empty record and refuses it once the record says off', async () => {
    h.settings = {};
    const transport = fakeTransport(async () => RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport, peerExecute: createPeerExecuteOptIn({ hostKind: 'daemon' }) });
    await expect(rpc.dispatch(frame(), PEER)).resolves.toMatchObject({ success: true });
    h.settings = { 'backend.allowRemotePeerExecute': false };
    await expect(rpc.dispatch(frame(), PEER)).rejects.toThrow(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
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

// ── The unary gRPC call — the request half's second exchange ────────

const GRPC_REQUEST: GrpcTransportRequest = {
  authority: 'grpc.openheaders.io:443',
  tls: true,
  path: '/books.Books/GetBook',
  metadata: [{ key: 'authorization', value: 'Bearer resolved' }],
  message: new Uint8Array([10, 2, 104, 105]),
  maxBodyBytes: 4096,
};

const GRPC_RESPONSE: GrpcTransportResponse = {
  httpStatus: 200,
  headers: [{ key: 'content-type', value: 'application/grpc+proto' }],
  trailers: [{ key: 'grpc-status', value: '0' }],
  body: new Uint8Array([0, 0, 0, 0, 2, 8, 1]),
  bodyTruncated: false,
};

function grpcFrame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'delegateGrpcInvoke',
    sendId: 'grpc-1',
    workspaceId: 'ws-1',
    request: encodeDelegatedGrpcRequest(GRPC_REQUEST),
    ...overrides,
  };
}

interface FakeGrpcTransport extends GrpcTransport {
  calls: Array<{ request: GrpcTransportRequest; signal: AbortSignal | undefined }>;
}

function fakeGrpcTransport(
  run: (request: GrpcTransportRequest, signal?: AbortSignal) => Promise<GrpcTransportResponse>,
): FakeGrpcTransport {
  const calls: FakeGrpcTransport['calls'] = [];
  return {
    calls,
    invoke: (request, signal) => {
      calls.push({ request, signal });
      return run(request, signal);
    },
  };
}

describe('createDelegatedRequestsRpc — a unary gRPC call', () => {
  it('rides the same gate: refused off the opt-in, the workspace required, workspace.write audited', async () => {
    const grpc = fakeGrpcTransport(async () => GRPC_RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport: fakeTransport(async () => RESPONSE), grpcTransport: grpc });
    h.settings = {};
    await expect(rpc.dispatch(grpcFrame(), PEER)).rejects.toThrow(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
    h.settings = { 'backend.allowRemotePeerExecute': true };
    await expect(rpc.dispatch(grpcFrame({ workspaceId: '' }), PEER)).rejects.toThrow(
      DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE,
    );
    h.decision = { allow: false, reason: 'no-workspace-role-assignment' };
    await expect(rpc.dispatch(grpcFrame(), PEER)).rejects.toThrow(
      'permission denied: workspace.write on ws-1 (no-workspace-role-assignment)',
    );
    expect(h.audits).toEqual([
      { actorUserId: 'user-1', capability: 'workspace.write', workspaceId: 'ws-1', decision: h.decision },
    ]);
    expect(grpc.calls).toHaveLength(0);
  });

  it('hands the transport the seam request — the message decoded, the cap clamped — and answers the reply encoded, stamped', async () => {
    const grpc = fakeGrpcTransport(async () => GRPC_RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport: fakeTransport(async () => RESPONSE), grpcTransport: grpc });
    const result = (await rpc.dispatch(
      grpcFrame({ request: encodeDelegatedGrpcRequest({ ...GRPC_REQUEST, maxBodyBytes: 1 << 30 }) }),
      PEER,
    )) as DelegatedGrpcInvokeResult;
    expect(grpc.calls[0].request).toMatchObject({
      authority: GRPC_REQUEST.authority,
      path: GRPC_REQUEST.path,
      metadata: GRPC_REQUEST.metadata,
      maxBodyBytes: 2 * 1024 * 1024,
    });
    expect(Array.from(grpc.calls[0].request.message)).toEqual([10, 2, 104, 105]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.response).toEqual({
      httpStatus: 200,
      headers: GRPC_RESPONSE.headers,
      trailers: GRPC_RESPONSE.trailers,
      bodyBase64: 'AAAAAAIIAQ==',
      bodyTruncated: false,
    });
    expect(result.executedOn.kind).toBe('backend');
  });

  it('answers a structured refusal for a malformed invoke, past the gate, stamped, without dialing', async () => {
    const grpc = fakeGrpcTransport(async () => GRPC_RESPONSE);
    const rpc = createDelegatedRequestsRpc({ transport: fakeTransport(async () => RESPONSE), grpcTransport: grpc });
    const result = (await rpc.dispatch(grpcFrame({ request: { authority: 'x' } }), PEER)) as DelegatedGrpcInvokeResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/^Malformed delegated gRPC invoke frame at request\./);
    expect(result.executedOn.kind).toBe('backend');
    expect(h.audits).toHaveLength(1);
    expect(grpc.calls).toHaveLength(0);
  });

  it('registers the call under its id so abortRequestSend stops it — the shared registry', async () => {
    const grpc = fakeGrpcTransport(
      (_request, signal) =>
        new Promise<GrpcTransportResponse>((resolve) => {
          signal?.addEventListener('abort', () =>
            resolve({ ...GRPC_RESPONSE, body: new Uint8Array(), bodyTruncated: false }),
          );
        }),
    );
    const rpc = createDelegatedRequestsRpc({ transport: fakeTransport(async () => RESPONSE), grpcTransport: grpc });
    const pending = rpc.dispatch(grpcFrame({ sendId: 'grpc-stop' }), PEER);
    await vi.waitFor(() => expect(grpc.calls).toHaveLength(1));
    expect(stopActiveSend('grpc-stop')).toBe(true);
    const result = (await pending) as DelegatedGrpcInvokeResult;
    expect(result.success && result.response.bodyBase64).toBe('');
    expect(stopActiveSend('grpc-stop')).toBe(false);
  });

  it("answers the transport's classified pre-head failure with its canonical status and hint, stamped", async () => {
    const hint = {
      kind: 'trust-certificate' as const,
      host: 'grpc.openheaders.io',
      port: 443,
      code: 'CERT_HAS_EXPIRED',
    };
    const grpc = fakeGrpcTransport(async () => {
      throw new GrpcTransportError('TLS certificate error', 14, hint);
    });
    const rpc = createDelegatedRequestsRpc({ transport: fakeTransport(async () => RESPONSE), grpcTransport: grpc });
    const result = (await rpc.dispatch(grpcFrame(), PEER)) as DelegatedGrpcInvokeResult;
    expect(result).toMatchObject({ success: false, error: 'TLS certificate error', canonicalStatus: 14, hint });
    if (result.success) return;
    expect(result.executedOn.kind).toBe('backend');
    expect(stopActiveSend('grpc-1')).toBe(false);
  });
});
