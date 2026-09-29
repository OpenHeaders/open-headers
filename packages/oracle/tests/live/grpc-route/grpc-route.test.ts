/**
 * The host-neutral gRPC route over a fake host seam — the laws every
 * gRPC host inherits: the frame's place reaches the seam by explicit
 * backend id (absent = the host's own HTTP/2 stack) with the read
 * workspace as the gate's subject, and the lease's stamp lands on the
 * snapshot; the entity and its linked spec load from the read
 * workspace's slots (the spec is the CONTEXT's — the executor gets it,
 * whatever place opens the session); the pin rules verbatim (unpinned
 * on the active workspace, pinned on a foreign one — a forwarded call
 * — and on an explicit No-environment); the script host and the OAuth
 * renewal are the seam's; a host without an active workspace and no
 * stated one answers an error snapshot; uid over draft, a missing uid
 * an error snapshot; a throw past the gates is `success: false`.
 */

import type { GrpcRequest, Spec } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  activeWorkspaceId: 'ws-active' as string | null,
  slots: new Map<string, unknown[]>(),
  runs: [] as { request: unknown; options: Record<string, unknown> }[],
  refreshHooks: [] as { workspaceId: string | undefined; transport: unknown }[],
}));

vi.mock('../../../src/workspace/extension-workspace-store', () => ({
  peekActiveWorkspaceId: () => h.activeWorkspaceId,
}));
vi.mock('../../../src/storage', () => ({
  wsKeys: (workspaceId: string) => ({
    grpcRequests: `${workspaceId}:grpcRequests`,
    specs: `${workspaceId}:specs`,
  }),
  hostStorage: { getValidatedArray: async (key: string) => h.slots.get(key) ?? [] },
}));
vi.mock('../../../src/live/grpc-exec/execute', async (importActual) => {
  const actual = await importActual<typeof import('../../../src/live/grpc-exec/execute')>();
  return {
    ...actual,
    executeGrpcInvoke: async (request: unknown, options: Record<string, unknown>) => {
      h.runs.push({ request, options });
      return { ...actual.errorGrpcSnapshot('stub'), error: null };
    },
  };
});
vi.mock('../../../src/live/request-exec/oauth-refresh', () => ({
  buildRefreshOAuthHook: (workspaceId: string | undefined, transport: unknown) => {
    h.refreshHooks.push({ workspaceId, transport });
    return async () => null;
  },
}));

import type { GrpcTransport } from '../../../src/live/grpc-exec/transport';
import type { GrpcRouteHost } from '../../../src/live/grpc-route/host';
import { executeGrpcRequestRoute } from '../../../src/live/grpc-route/route';
import type { RequestTransport } from '../../../src/live/request-exec/transport';
import { ownTransportLease, type SessionTransportLease } from '../../../src/live/session-route/host';

const OWN: GrpcTransport = { invoke: () => Promise.reject(new Error('the own stack is never dialed here')) };
const REFRESH: RequestTransport = {
  send: async () => {
    throw new Error('the renewal leg is never dialed here');
  },
};
const STAMP = { kind: 'backend' as const, name: 'workbox' };

const SPEC: Spec = {
  schemaVersion: 5,
  uid: 'spec0001',
  path: 'specs/library-spec0001',
  name: 'Library',
  format: 'protobuf',
  rootFileUid: 'file0001',
  files: [{ uid: 'file0001', fileName: 'index.proto', content: 'syntax = "proto3";' }],
};

function grpcRequest(overrides: Partial<GrpcRequest> = {}): GrpcRequest {
  return {
    schemaVersion: 5,
    uid: 'grpc0001',
    path: 'requests/library-grpc0001',
    name: 'GetNote',
    url: 'grpc.openheaders.io:443',
    tls: true,
    method: { service: 'library.v1.Library', rpc: 'GetNote' },
    message: '{}',
    metadata: [],
    specLink: { specUid: SPEC.uid },
    ...overrides,
  };
}

/** A seam that records what the route asked of it and stamps a
 *  delegated lease when the frame names a place. */
function fakeHost(): GrpcRouteHost & {
  leases: { placeBackendId: string | undefined; workspaceId: string }[];
  scriptAsks: { workspaceId: string; forwarded: boolean }[];
  refreshAsks: string[];
} {
  const host = {
    leases: [] as { placeBackendId: string | undefined; workspaceId: string }[],
    scriptAsks: [] as { workspaceId: string; forwarded: boolean }[],
    refreshAsks: [] as string[],
    transportFor(placeBackendId: string | undefined, workspaceId: string): SessionTransportLease<GrpcTransport> {
      host.leases.push({ placeBackendId, workspaceId });
      return placeBackendId !== undefined ? { transport: OWN, executedOn: () => STAMP } : ownTransportLease(OWN);
    },
    async resolveScriptHost(input: { workspaceId: string; forwarded: boolean }) {
      host.scriptAsks.push(input);
      return null;
    },
    refreshTransportFor(workspaceId: string): RequestTransport {
      host.refreshAsks.push(workspaceId);
      return REFRESH;
    },
    emitStreamEvent: () => {},
  };
  return host;
}

beforeEach(() => {
  h.activeWorkspaceId = 'ws-active';
  h.slots.clear();
  h.slots.set('ws-active:specs', [SPEC]);
  h.runs = [];
  h.refreshHooks = [];
});

describe('the gRPC route — the host seam', () => {
  it("leases the host's own stack for a frame naming no place, hands the executor the linked spec, and stamps nothing", async () => {
    const host = fakeHost();
    const result = await executeGrpcRequestRoute({ draft: grpcRequest(), sendId: 's-1' }, host);
    expect(result.success).toBe(true);
    expect(result.snapshot?.executedOn).toBeUndefined();
    expect(host.leases).toEqual([{ placeBackendId: undefined, workspaceId: 'ws-active' }]);
    expect(h.runs[0].options.transport).toBe(OWN);
    expect(h.runs[0].options.spec).toBe(SPEC);
    expect(h.runs[0].options.sendId).toBe('s-1');
    expect(h.runs[0].options.emitStreamEvent).toBe(host.emitStreamEvent);
  });

  it('hands the frame’s explicit place to the seam with the read workspace, and stamps who answered', async () => {
    const host = fakeHost();
    h.slots.set('ws-other:specs', [SPEC]);
    const own = await executeGrpcRequestRoute(
      { draft: grpcRequest(), sendId: 's-2', executionPlace: { backendId: 'srv-1' } },
      host,
    );
    expect(own.snapshot?.executedOn).toEqual(STAMP);
    const foreign = await executeGrpcRequestRoute(
      { draft: grpcRequest(), sendId: 's-3', executionPlace: { backendId: 'srv-1' }, workspaceId: 'ws-other' },
      host,
    );
    expect(foreign.snapshot?.executedOn).toEqual(STAMP);
    expect(host.leases).toEqual([
      { placeBackendId: 'srv-1', workspaceId: 'ws-active' },
      { placeBackendId: 'srv-1', workspaceId: 'ws-other' },
    ]);
    // A blank id is no place.
    await executeGrpcRequestRoute({ draft: grpcRequest(), sendId: 's-4', executionPlace: { backendId: '' } }, host);
    expect(host.leases[2].placeBackendId).toBeUndefined();
  });

  it("asks the seam for the script host by the read workspace and the forwarded flag, and renews OAuth through the seam's transport", async () => {
    const host = fakeHost();
    h.slots.set('ws-peer:specs', [SPEC]);
    await executeGrpcRequestRoute({ draft: grpcRequest() }, host);
    await executeGrpcRequestRoute({ draft: grpcRequest(), workspaceId: 'ws-peer' }, host);
    expect(host.scriptAsks).toEqual([
      { workspaceId: 'ws-active', forwarded: false },
      { workspaceId: 'ws-peer', forwarded: true },
    ]);
    expect(host.refreshAsks).toEqual(['ws-active', 'ws-peer']);
    expect(h.refreshHooks).toEqual([
      { workspaceId: undefined, transport: REFRESH },
      { workspaceId: 'ws-peer', transport: REFRESH },
    ]);
  });
});

describe('the gRPC route — the pin rules and the loads', () => {
  it('runs unpinned on the active workspace, pinned on a foreign one and on an explicit No-environment', async () => {
    const host = fakeHost();
    h.slots.set('ws-peer:specs', [SPEC]);
    await executeGrpcRequestRoute({ draft: grpcRequest() }, host);
    await executeGrpcRequestRoute({ draft: grpcRequest(), workspaceId: 'ws-active' }, host);
    await executeGrpcRequestRoute({ draft: grpcRequest(), workspaceId: 'ws-peer', environmentId: 'env-1' }, host);
    await executeGrpcRequestRoute({ draft: grpcRequest(), environmentId: null }, host);
    expect(h.runs.map((r) => [r.options.workspaceId, r.options.environmentId])).toEqual([
      [null, undefined],
      [null, undefined],
      ['ws-peer', 'env-1'],
      ['ws-active', null],
    ]);
  });

  it('loads the stored entity by uid over a draft, and the spec from the read workspace — a missing spec is null, a missing uid an error snapshot', async () => {
    const host = fakeHost();
    const stored = grpcRequest({ name: 'Stored', specLink: { specUid: 'spec-gone' } });
    h.slots.set('ws-active:grpcRequests', [stored]);
    const byUid = await executeGrpcRequestRoute({ grpcRequestUid: 'grpc0001', draft: grpcRequest() }, host);
    expect(byUid.success).toBe(true);
    expect(h.runs[0].request).toBe(stored);
    expect(h.runs[0].options.spec).toBeNull();
    const missing = await executeGrpcRequestRoute({ grpcRequestUid: 'grpc-none' }, host);
    expect(missing).toMatchObject({ success: true, snapshot: { error: 'gRPC request grpc-none not found' } });
    expect(await executeGrpcRequestRoute({}, host)).toEqual({
      success: false,
      error: 'No gRPC request or draft provided',
    });
  });

  it('answers an error snapshot with no active workspace and no stated one, and success: false on a throw past the gates', async () => {
    const host = fakeHost();
    h.activeWorkspaceId = null;
    const none = await executeGrpcRequestRoute({ draft: grpcRequest() }, host);
    expect(none).toMatchObject({ success: true, snapshot: { error: 'No active workspace' } });
    h.activeWorkspaceId = 'ws-active';
    const throwing: GrpcRouteHost = {
      ...host,
      transportFor: () => {
        throw new Error('no lease');
      },
    };
    expect(await executeGrpcRequestRoute({ draft: grpcRequest() }, throwing)).toEqual({
      success: false,
      error: 'no lease',
    });
  });
});
