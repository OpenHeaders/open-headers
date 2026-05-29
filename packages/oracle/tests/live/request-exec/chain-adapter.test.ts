/**
 * buildChainFetchAdapter — the FetchAdapter the core runner consumes.
 * Isolated from the resolve/execute stack: run-step-request, the request
 * store, and the rate limiter are mocked so we exercise only the
 * adapter's own contract (lookup, prepare hook, rate-limit wrapping,
 * StepResponse mapping, error→throw).
 */

import type { ExecutedRequestSnapshot, Request, WorkflowStep } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildChainFetchAdapter } from '../../../src/live/request-exec/chain-adapter';
import type { RequestTransport } from '../../../src/live/request-exec/transport';

const getRequestInWorkspaceMock = vi.fn();
const runStepRequestMock = vi.fn();
const withRefreshRateLimitMock = vi.fn();

vi.mock('../../../src/entity/request-store', () => ({
  getRequestInWorkspace: (uid: string, ws: string) => getRequestInWorkspaceMock(uid, ws),
}));
vi.mock('../../../src/live/request-exec/run-step-request', () => ({
  runStepRequest: (...args: unknown[]) => runStepRequestMock(...args),
}));
vi.mock('../../../src/live/request-exec/rate-limiter', () => ({
  withRefreshRateLimit: (url: string, fn: () => Promise<unknown>) => withRefreshRateLimitMock(url, fn),
}));

const transport: RequestTransport = { send: vi.fn() };

function makeStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    uid: 'stplogin',
    id: 'login',
    requestUid: 'reqlogin1',
    captures: [{ uid: 'captoken', name: 'token', extractor: { kind: 'whole-body' } }],
    ...overrides,
  };
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'reqlogin1',
    path: 'requests/auth/login',
    name: 'Login',
    method: 'POST',
    url: 'https://api.openheaders.io/auth',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<ExecutedRequestSnapshot> = {}): ExecutedRequestSnapshot {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/auth',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body: '{"access_token":"tok"}',
    bodyTruncated: false,
    bodyBytes: 22,
    durationMs: 5,
    error: null,
    scripts: null,
    ...overrides,
  };
}

const ctx = { workflowUid: 'wf-1', workspaceId: 'ws-1', environmentId: null };

beforeEach(() => {
  getRequestInWorkspaceMock.mockReset();
  runStepRequestMock.mockReset();
  withRefreshRateLimitMock.mockReset();
  // Default: the rate limiter is a pass-through wrapper.
  withRefreshRateLimitMock.mockImplementation((_url: string, fn: () => Promise<unknown>) => fn());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('buildChainFetchAdapter', () => {
  it('throws when the step references a missing request', async () => {
    getRequestInWorkspaceMock.mockReturnValue(null);
    const adapter = buildChainFetchAdapter({ workspaceId: 'ws-1', environmentId: null, transport });
    await expect(adapter.executeStep(makeStep({ requestUid: 'gone' }), new Map(), ctx)).rejects.toThrow(
      /Step request gone not found/,
    );
    expect(runStepRequestMock).not.toHaveBeenCalled();
  });

  it('resolves the request from the dispatch workspace and maps a success to a StepResponse', async () => {
    getRequestInWorkspaceMock.mockReturnValue(makeRequest());
    runStepRequestMock.mockResolvedValue(makeSnapshot());
    const adapter = buildChainFetchAdapter({ workspaceId: 'ws-1', environmentId: 'env-prod', transport });
    const stepCaptures = new Map([['prior', new Map([['x', '1']])]]);

    const res = await adapter.executeStep(makeStep(), stepCaptures, ctx);

    expect(getRequestInWorkspaceMock).toHaveBeenCalledWith('reqlogin1', 'ws-1');
    expect(res).toEqual({
      status: 200,
      statusText: 'OK',
      url: 'https://api.openheaders.io/auth',
      headers: [{ key: 'content-type', value: 'application/json' }],
      body: '{"access_token":"tok"}',
    });
    const [req, opts] = runStepRequestMock.mock.calls[0];
    expect(req).toEqual(makeRequest());
    expect(opts).toMatchObject({ workspaceId: 'ws-1', environmentId: 'env-prod', stepCaptures, transport });
  });

  it('wraps the step fetch in the per-origin rate limiter keyed on the request URL', async () => {
    getRequestInWorkspaceMock.mockReturnValue(makeRequest({ url: 'https://api.openheaders.io/auth' }));
    runStepRequestMock.mockResolvedValue(makeSnapshot());
    const adapter = buildChainFetchAdapter({ workspaceId: 'ws-1', environmentId: null, transport });
    await adapter.executeStep(makeStep(), new Map(), ctx);
    expect(withRefreshRateLimitMock).toHaveBeenCalledWith('https://api.openheaders.io/auth', expect.any(Function));
  });

  it('applies the prepareRequest hook before resolve (DNR-bypass stamping)', async () => {
    getRequestInWorkspaceMock.mockReturnValue(makeRequest());
    runStepRequestMock.mockResolvedValue(makeSnapshot());
    const prepareRequest = vi.fn((r: Request) => ({ ...r, name: 'stamped' }));
    const adapter = buildChainFetchAdapter({ workspaceId: 'ws-1', environmentId: null, transport, prepareRequest });
    await adapter.executeStep(makeStep(), new Map(), ctx);
    expect(prepareRequest).toHaveBeenCalledTimes(1);
    expect(runStepRequestMock.mock.calls[0][0]).toMatchObject({ name: 'stamped' });
  });

  it('throws when the snapshot carries an error so the runner classifies a fetch failure', async () => {
    getRequestInWorkspaceMock.mockReturnValue(makeRequest());
    runStepRequestMock.mockResolvedValue(makeSnapshot({ status: 0, error: 'Connection refused' }));
    const adapter = buildChainFetchAdapter({ workspaceId: 'ws-1', environmentId: null, transport });
    await expect(adapter.executeStep(makeStep(), new Map(), ctx)).rejects.toThrow('Connection refused');
  });

  it('passes the refreshOAuth hook through to the step runner', async () => {
    getRequestInWorkspaceMock.mockReturnValue(makeRequest());
    runStepRequestMock.mockResolvedValue(makeSnapshot());
    const refreshOAuth = vi.fn();
    const adapter = buildChainFetchAdapter({ workspaceId: 'ws-1', environmentId: null, transport, refreshOAuth });
    await adapter.executeStep(makeStep(), new Map(), ctx);
    expect(runStepRequestMock.mock.calls[0][1]).toMatchObject({ refreshOAuth });
  });
});
