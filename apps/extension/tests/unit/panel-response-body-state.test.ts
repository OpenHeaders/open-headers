import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import { classifyBodyState } from '@openheaders/ui/panel/data/response-body-state';
import { describe, expect, it } from 'vitest';

function makeHar(overrides: Partial<InspectorHarEntry> = {}): InspectorHarEntry {
  return {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: {
      method: 'GET',
      url: 'https://api.openheaders.io/v2/config',
      headers: [],
      queryString: [],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [],
      content: { size: 12, mimeType: 'application/json' },
    },
    ...overrides,
  } as InspectorHarEntry;
}

function makeBody(content: string, encoding = ''): InspectorHarBody {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v2/config',
    startedDateTime: '2026-04-16T00:00:00.000Z',
    content,
    encoding,
  };
}

interface LifecycleOpts {
  method?: string;
  resourceType?: string;
  statusCode?: number | undefined;
  statusText?: string | undefined;
  body?: InspectorHarBody | null;
  har?: InspectorHarEntry;
  fromCache?: boolean;
}

function makeLifecycle(opts: LifecycleOpts = {}): RequestLifecycle {
  const har = opts.har ?? makeHar();
  const harBody = opts.body === undefined ? null : opts.body;
  return {
    tabId: 1,
    requestId: 'req-1',
    url: har.request?.url ?? 'https://api.openheaders.io/v2/config',
    method: opts.method ?? har.request?.method ?? 'GET',
    resourceType: opts.resourceType ?? 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 0,
    hopStartedAtMs: 0,
    statusCode: 'statusCode' in opts ? opts.statusCode : har.response?.status ?? 200,
    statusText: 'statusText' in opts ? opts.statusText : har.response?.statusText,
    fromCache: opts.fromCache,
    har: new Map([[0, har]]),
    harBodyByHop: harBody ? new Map([[0, harBody]]) : new Map(),
  };
}

describe('classifyBodyState — per-protocol no-body cases', () => {
  it('preflight OPTIONS returns not-applicable:preflight', () => {
    const lc = makeLifecycle({ method: 'OPTIONS', resourceType: 'preflight', body: makeBody('') });
    expect(classifyBodyState(lc)).toEqual({
      kind: 'not-applicable',
      reason: 'preflight',
      message: expect.stringContaining('preflight'),
    });
  });

  it('HEAD request returns not-applicable:head', () => {
    const lc = makeLifecycle({ method: 'HEAD', body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'not-applicable', reason: 'head' });
  });

  it('CONNECT request returns not-applicable:connect', () => {
    const lc = makeLifecycle({ method: 'CONNECT', body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'not-applicable', reason: 'connect' });
  });

  it('status 204 returns not-applicable:status-204', () => {
    const lc = makeLifecycle({ statusCode: 204, body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'not-applicable', reason: 'status-204' });
  });

  it('status 205 returns not-applicable:status-205', () => {
    const lc = makeLifecycle({ statusCode: 205, body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'not-applicable', reason: 'status-205' });
  });

  it('status 304 returns not-applicable:status-304', () => {
    const lc = makeLifecycle({ statusCode: 304, body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'not-applicable', reason: 'status-304' });
  });

  it('1xx informational returns not-applicable:informational', () => {
    const lc = makeLifecycle({ statusCode: 103, body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'not-applicable', reason: 'informational' });
  });

  it('101 Switching Protocols routes to websocket', () => {
    const lc = makeLifecycle({ statusCode: 101, body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'not-applicable', reason: 'websocket' });
  });

  it('websocket resourceType routes to websocket', () => {
    const lc = makeLifecycle({ statusCode: 200, resourceType: 'websocket', body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'not-applicable', reason: 'websocket' });
  });
});

describe('classifyBodyState — transport failure', () => {
  it('blocked request returns unavailable:blocked', () => {
    const lc = makeLifecycle({ statusCode: 0, statusText: 'blocked', body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'unavailable', reason: 'blocked' });
  });

  it('negative status code returns unavailable:failed', () => {
    const lc = makeLifecycle({ statusCode: -1, statusText: '', body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'unavailable', reason: 'failed' });
  });
});

describe('classifyBodyState — loading / empty / content', () => {
  it('no attached body returns loading', () => {
    const lc = makeLifecycle({ body: null });
    expect(classifyBodyState(lc).kind).toBe('loading');
  });

  it('legitimate empty body (Content-Length: 0) returns empty', () => {
    const har = makeHar({
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Length', value: '0' }],
        content: { size: 0, mimeType: 'text/plain' },
        bodySize: 0,
      },
    });
    const lc = makeLifecycle({ har, body: makeBody('') });
    expect(classifyBodyState(lc).kind).toBe('empty');
  });

  it('empty body with cache signal returns unavailable:cache', () => {
    const har = makeHar({ _fromCache: 'disk' });
    const lc = makeLifecycle({ har, body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'unavailable', reason: 'cache' });
  });

  it('empty body with no identifiable cause returns unavailable:unknown', () => {
    const lc = makeLifecycle({ body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'unavailable', reason: 'unknown' });
  });

  it('base64 encoded body returns binary', () => {
    const lc = makeLifecycle({ body: makeBody('SGVsbG8=', 'base64') });
    const state = classifyBodyState(lc);
    expect(state.kind).toBe('binary');
    if (state.kind === 'binary') expect(state.base64).toBe('SGVsbG8=');
  });

  it('plain text body returns text', () => {
    const lc = makeLifecycle({ body: makeBody('{"ok":true}') });
    const state = classifyBodyState(lc);
    expect(state.kind).toBe('text');
    if (state.kind === 'text') expect(state.content).toBe('{"ok":true}');
  });
});

describe('classifyBodyState — precedence', () => {
  it('preflight trumps empty-body classification even when body is present', () => {
    const lc = makeLifecycle({ resourceType: 'preflight', body: makeBody('') });
    expect(classifyBodyState(lc).kind).toBe('not-applicable');
  });

  it('blocked request with HEAD method prefers head (spec trumps transport)', () => {
    const lc = makeLifecycle({ method: 'HEAD', statusCode: 0, statusText: 'blocked', body: makeBody('') });
    expect(classifyBodyState(lc)).toMatchObject({ kind: 'not-applicable', reason: 'head' });
  });
});
