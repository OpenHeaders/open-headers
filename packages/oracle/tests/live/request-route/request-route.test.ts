/**
 * The host-neutral request route over a fake host seam — the laws
 * every send host inherits: the frame's place reaches the seam by
 * explicit backend id (absent = the host's own socket) with the read
 * workspace as the gate's subject; the pin rules verbatim (unpinned
 * on the active workspace, pinned on a foreign one — a forwarded send
 * — and on an explicit No-environment); a host without an active
 * workspace and no stated one answers an error snapshot; uid over
 * draft, a missing uid an error snapshot; a GraphQL Query compiles
 * ONCE into the same run; the live frames ride the seam's sink under
 * the caller's send id; the script gate asks the seam only when the
 * chain carries a script and by the forwarded flag, and a resolved
 * runner rides the interactive pipeline with the mode stamped; a seam
 * without a runner keeps the step runner.
 */

import type { Request } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  activeWorkspaceId: 'ws-active' as string | null,
  request: null as Request | null,
  slots: new Map<string, unknown[]>(),
  chain: { pre: [] as unknown[], post: [] as unknown[] },
  stepRuns: [] as { request: Request; options: Record<string, unknown> }[],
  interactiveRuns: [] as { request: Request; options: Record<string, unknown> }[],
  refreshHooks: [] as { workspaceId: string | undefined; transport: unknown }[],
}));

vi.mock('../../../src/workspace/extension-workspace-store', () => ({
  peekActiveWorkspaceId: () => h.activeWorkspaceId,
}));
vi.mock('../../../src/entity/request-store', () => ({
  getRequest: (uid: string) => (h.request?.uid === uid ? h.request : undefined),
}));
vi.mock('../../../src/storage', () => ({
  wsKeys: (workspaceId: string) => ({ graphqlRequests: `${workspaceId}:graphqlRequests` }),
  hostStorage: { getValidatedArray: async (key: string) => h.slots.get(key) ?? [] },
}));
vi.mock('../../../src/live/request-exec/script-chain', () => ({
  collectScriptChain: () => h.chain,
}));
vi.mock('../../../src/live/request-exec/run-step-request', () => ({
  runStepRequest: async (request: Request, options: Record<string, unknown>) => {
    h.stepRuns.push({ request, options });
    return { status: 200, error: null, url: request.url, scripts: null };
  },
}));
vi.mock('../../../src/live/request-exec/run-interactive-send', () => ({
  runInteractiveSend: async (request: Request, options: Record<string, unknown>) => {
    h.interactiveRuns.push({ request, options });
    return { status: 200, error: null, url: request.url, scripts: { mode: 'unset' } };
  },
}));
vi.mock('../../../src/live/request-exec/oauth-refresh', () => ({
  buildRefreshOAuthHook: (workspaceId: string | undefined, transport: unknown) => {
    h.refreshHooks.push({ workspaceId, transport });
    return async () => null;
  },
}));

import type { RequestTransport } from '../../../src/live/request-exec/transport';
import type { RequestRouteHost } from '../../../src/live/request-route/host';
import { executeGraphqlRequestRoute, executeRequestRoute } from '../../../src/live/request-route/route';

const OWN: RequestTransport = {
  send: async () => {
    throw new Error('never dialed here');
  },
};
const PLACE: RequestTransport = {
  send: async () => {
    throw new Error('never dialed here');
  },
};

const REQUEST: Request = {
  schemaVersion: 5,
  uid: 'req0001',
  path: 'requests/items-req0001',
  name: 'Items',
  method: 'GET',
  url: 'https://api.openheaders.io/items',
  headers: [],
  params: [],
  auth: { type: 'none' },
  body: { type: 'none' },
};

const GRAPHQL = {
  schemaVersion: 5,
  uid: 'gqrq0001',
  path: 'requests/viewer-gqrq0001',
  name: 'Viewer',
  url: 'https://api.openheaders.io/graphql',
  query: 'query Viewer { viewer { id } }',
  headers: [],
  auth: { type: 'inherit' as const },
};

function fakeHost(): RequestRouteHost & {
  asks: { placeBackendId: string | undefined; workspaceId: string }[];
  scriptAsks: { workspaceId: string; forwarded: boolean }[];
  emitted: unknown[];
} {
  const host = {
    asks: [] as { placeBackendId: string | undefined; workspaceId: string }[],
    scriptAsks: [] as { workspaceId: string; forwarded: boolean }[],
    emitted: [] as unknown[],
    transportFor(placeBackendId: string | undefined, workspaceId: string): RequestTransport {
      host.asks.push({ placeBackendId, workspaceId });
      return placeBackendId !== undefined ? PLACE : OWN;
    },
    async resolveScriptRunner(input: { workspaceId: string; forwarded: boolean }) {
      host.scriptAsks.push(input);
      return {
        mode: 'safe' as const,
        runner: async () => ({ executionId: 'e', succeeded: true, assertions: [], consoleLog: [], durationMs: 0 }),
      };
    },
    emitStreamEvent: (event: unknown) => {
      host.emitted.push(event);
    },
  };
  return host;
}

beforeEach(() => {
  h.activeWorkspaceId = 'ws-active';
  h.request = REQUEST;
  h.slots.clear();
  h.chain = { pre: [], post: [] };
  h.stepRuns = [];
  h.interactiveRuns = [];
  h.refreshHooks = [];
});

describe('the request route — the host seam', () => {
  it("takes the host's own transport for a frame naming no place, the place's otherwise, the read workspace as the gate subject", async () => {
    const host = fakeHost();
    await executeRequestRoute({ draft: REQUEST }, host);
    await executeRequestRoute(
      { draft: REQUEST, executionPlace: { backendId: 'srv-1' }, workspaceId: 'ws-other' },
      host,
    );
    await executeRequestRoute({ draft: REQUEST, executionPlace: { backendId: '' } }, host);
    expect(host.asks).toEqual([
      { placeBackendId: undefined, workspaceId: 'ws-active' },
      { placeBackendId: 'srv-1', workspaceId: 'ws-other' },
      { placeBackendId: undefined, workspaceId: 'ws-active' },
    ]);
    expect(h.stepRuns.map((r) => r.options.transport)).toEqual([OWN, PLACE, OWN]);
    // The OAuth renewal rides the send's own transport, keyed by the pinned workspace.
    expect(h.refreshHooks).toEqual([
      { workspaceId: undefined, transport: OWN },
      { workspaceId: 'ws-other', transport: PLACE },
      { workspaceId: undefined, transport: OWN },
    ]);
  });

  it('streams the live frames on the seam sink under the caller send id; no send id, no stream', async () => {
    const host = fakeHost();
    await executeRequestRoute({ draft: REQUEST, sendId: 'send-1' }, host);
    const stream = h.stepRuns[0].options.stream as { sendId: string; emitFrame: (e: unknown) => void };
    expect(stream.sendId).toBe('send-1');
    stream.emitFrame({ sendId: 'send-1', seq: 0 });
    expect(host.emitted).toEqual([{ sendId: 'send-1', seq: 0 }]);
    await executeRequestRoute({ draft: REQUEST }, host);
    expect(h.stepRuns[1].options.stream).toBeUndefined();
  });
});

describe('the request route — the pin rules', () => {
  it('runs unpinned on the active workspace, pinned on a foreign one, pinned env-free on an explicit No environment', async () => {
    const host = fakeHost();
    await executeRequestRoute({ draft: REQUEST, environmentId: 'env-1' }, host);
    await executeRequestRoute({ draft: REQUEST, workspaceId: 'ws-peer' }, host);
    await executeRequestRoute({ draft: REQUEST, environmentId: null }, host);
    expect(h.stepRuns.map((r) => [r.options.workspaceId, r.options.environmentId])).toEqual([
      [null, 'env-1'],
      ['ws-peer', undefined],
      ['ws-active', null],
    ]);
  });

  it('a host with no active workspace and no stated one answers an error snapshot on both routes', async () => {
    h.activeWorkspaceId = null;
    const host = fakeHost();
    const send = await executeRequestRoute({ draft: REQUEST }, host);
    expect(send).toEqual({ success: true, snapshot: expect.objectContaining({ error: 'No active workspace' }) });
    const query = await executeGraphqlRequestRoute({ draft: GRAPHQL }, host);
    expect(query.snapshot?.error).toBe('No active workspace');
    expect(host.asks).toEqual([]);
    expect(h.stepRuns).toEqual([]);
  });
});

describe('the request route — the contract', () => {
  it('prefers the stored request over a draft; a missing uid is an error snapshot; no input is success: false', async () => {
    const host = fakeHost();
    await executeRequestRoute(
      { requestUid: 'req0001', draft: { ...REQUEST, url: 'https://draft.openheaders.io' } },
      host,
    );
    expect(h.stepRuns[0].request).toBe(REQUEST);
    const missing = await executeRequestRoute({ requestUid: 'nope' }, host);
    expect(missing.success).toBe(true);
    expect(missing.snapshot?.error).toBe('Request nope not found');
    expect(await executeRequestRoute({}, host)).toEqual({ success: false, error: 'No request or draft provided' });
  });

  it('compiles a GraphQL Query once into the same run, by draft or by uid from the read workspace', async () => {
    const host = fakeHost();
    await executeGraphqlRequestRoute({ draft: GRAPHQL, sendId: 's-1' }, host);
    expect(h.stepRuns[0].request.method).toBe('POST');
    expect(h.stepRuns[0].request.uid).toBe('gqrq0001');
    h.slots.set('ws-peer:graphqlRequests', [GRAPHQL]);
    await executeGraphqlRequestRoute({ graphqlRequestUid: 'gqrq0001', workspaceId: 'ws-peer' }, host);
    expect(h.stepRuns[1].request.uid).toBe('gqrq0001');
    expect(h.stepRuns[1].options.workspaceId).toBe('ws-peer');
    const missing = await executeGraphqlRequestRoute({ graphqlRequestUid: 'nope' }, host);
    expect(missing.snapshot?.error).toBe('GraphQL request nope not found');
    expect(await executeGraphqlRequestRoute({}, host)).toEqual({
      success: false,
      error: 'No GraphQL request or draft provided',
    });
  });
});

describe('the request route — the script gate', () => {
  it('asks the seam only when the chain carries a script, by the read workspace and the forwarded flag, and stamps the mode on the interactive run', async () => {
    const host = fakeHost();
    await executeRequestRoute({ draft: REQUEST }, host);
    expect(host.scriptAsks).toEqual([]);
    expect(h.interactiveRuns).toEqual([]);
    h.chain = { pre: [{ source: 'oh.setHeader("X", "1")' }], post: [] };
    const local = await executeRequestRoute({ draft: REQUEST, sendId: 's-2' }, host);
    const forwarded = await executeRequestRoute({ draft: REQUEST, workspaceId: 'ws-peer' }, host);
    expect(host.scriptAsks).toEqual([
      { workspaceId: 'ws-active', forwarded: false },
      { workspaceId: 'ws-peer', forwarded: true },
    ]);
    expect(h.interactiveRuns).toHaveLength(2);
    expect(h.interactiveRuns[0].options.scriptRunner).toBeTypeOf('function');
    expect((h.interactiveRuns[0].options.stream as { sendId: string }).sendId).toBe('s-2');
    expect(local.snapshot?.scripts).toEqual({ mode: 'safe' });
    expect(forwarded.snapshot?.scripts).toEqual({ mode: 'safe' });
    expect(h.stepRuns).toHaveLength(1);
  });

  it('a seam without a runner keeps the step runner even when the chain carries a script', async () => {
    const host = fakeHost();
    const bare: RequestRouteHost = { transportFor: host.transportFor, emitStreamEvent: host.emitStreamEvent };
    h.chain = { pre: [{ source: 'oh.setHeader("X", "1")' }], post: [] };
    const result = await executeRequestRoute({ draft: REQUEST }, bare);
    expect(h.interactiveRuns).toEqual([]);
    expect(h.stepRuns).toHaveLength(1);
    expect(result.snapshot?.scripts).toBeNull();
  });
});
