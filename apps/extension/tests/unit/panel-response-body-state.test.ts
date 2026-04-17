import { describe, expect, it } from 'vitest';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';
import { classifyBodyState } from '@/panel/data/response-body-state';
import type { InspectorRequest } from '@/panel/data/types';

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
  };
}

function makeRequest(overrides: Partial<InspectorRequest> = {}): InspectorRequest {
  const harEntry = overrides.harEntry ?? makeHar();
  return {
    id: 'GET|https://api.openheaders.io/v2/config|2026-04-16T00:00:00.000Z',
    harEntry,
    method: harEntry.request?.method ?? 'GET',
    url: harEntry.request?.url ?? 'https://api.openheaders.io/v2/config',
    timestamp: Date.parse(harEntry.startedDateTime),
    statusCode: harEntry.response?.status,
    statusText: harEntry.response?.statusText,
    mimeType: harEntry.response?.content?.mimeType,
    responseSize: harEntry.response?.content?.size,
    fires: [],
    arrivalIndex: 0,
    displayId: 1,
    ...overrides,
  };
}

describe('classifyBodyState — per-protocol no-body cases', () => {
  it('preflight OPTIONS returns not-applicable:preflight', () => {
    const req = makeRequest({ method: 'OPTIONS', resourceType: 'preflight', responseBody: '' });
    const state = classifyBodyState(req);
    expect(state).toEqual({
      kind: 'not-applicable',
      reason: 'preflight',
      message: expect.stringContaining('preflight'),
    });
  });

  it('HEAD request returns not-applicable:head', () => {
    const req = makeRequest({ method: 'HEAD', responseBody: '' });
    expect(classifyBodyState(req).kind).toBe('not-applicable');
    expect(classifyBodyState(req)).toMatchObject({ reason: 'head' });
  });

  it('CONNECT request returns not-applicable:connect', () => {
    const req = makeRequest({ method: 'CONNECT', responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'not-applicable', reason: 'connect' });
  });

  it('status 204 returns not-applicable:status-204', () => {
    const req = makeRequest({ statusCode: 204, responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'not-applicable', reason: 'status-204' });
  });

  it('status 205 returns not-applicable:status-205', () => {
    const req = makeRequest({ statusCode: 205, responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'not-applicable', reason: 'status-205' });
  });

  it('status 304 returns not-applicable:status-304', () => {
    const req = makeRequest({ statusCode: 304, responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'not-applicable', reason: 'status-304' });
  });

  it('1xx informational returns not-applicable:informational', () => {
    const req = makeRequest({ statusCode: 103, responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'not-applicable', reason: 'informational' });
  });

  it('101 Switching Protocols routes to websocket (has Messages tab)', () => {
    const req = makeRequest({ statusCode: 101, responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'not-applicable', reason: 'websocket' });
  });

  it('websocket resourceType routes to websocket', () => {
    const req = makeRequest({ statusCode: 200, resourceType: 'websocket', responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'not-applicable', reason: 'websocket' });
  });
});

describe('classifyBodyState — transport failure', () => {
  it('blocked request returns unavailable:blocked', () => {
    const req = makeRequest({ statusCode: 0, statusText: 'blocked', responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'unavailable', reason: 'blocked' });
  });

  it('negative status code returns unavailable:failed', () => {
    const req = makeRequest({ statusCode: -1, statusText: '', responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'unavailable', reason: 'failed' });
  });
});

describe('classifyBodyState — loading / empty / content', () => {
  it('undefined responseBody returns loading', () => {
    const req = makeRequest({ responseBody: undefined });
    expect(classifyBodyState(req).kind).toBe('loading');
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
    const req = makeRequest({ harEntry: har, responseSize: 0, responseBody: '' });
    expect(classifyBodyState(req).kind).toBe('empty');
  });

  it('empty body with cache signal returns unavailable:cache', () => {
    const har = makeHar({ _fromCache: 'disk' });
    const req = makeRequest({ harEntry: har, responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'unavailable', reason: 'cache' });
  });

  it('empty body with no identifiable cause returns unavailable:unknown', () => {
    const req = makeRequest({ responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'unavailable', reason: 'unknown' });
  });

  it('base64 encoded body returns binary', () => {
    const req = makeRequest({ responseBody: 'SGVsbG8=', responseBodyEncoding: 'base64' });
    const state = classifyBodyState(req);
    expect(state.kind).toBe('binary');
    if (state.kind === 'binary') expect(state.base64).toBe('SGVsbG8=');
  });

  it('plain text body returns text', () => {
    const req = makeRequest({ responseBody: '{"ok":true}' });
    const state = classifyBodyState(req);
    expect(state.kind).toBe('text');
    if (state.kind === 'text') expect(state.content).toBe('{"ok":true}');
  });
});

describe('classifyBodyState — precedence', () => {
  it('preflight trumps empty-body classification even when body is present', () => {
    // preflight responses are definitively body-less regardless of what
    // Chrome forwards over har-body — matches Chrome's own UI.
    const req = makeRequest({ resourceType: 'preflight', responseBody: '' });
    expect(classifyBodyState(req).kind).toBe('not-applicable');
  });

  it('blocked request with HEAD method prefers head (spec trumps transport)', () => {
    // HEAD never carries a body; the "blocked" nuance is irrelevant to
    // what the Response tab should say.
    const req = makeRequest({ method: 'HEAD', statusCode: 0, statusText: 'blocked', responseBody: '' });
    expect(classifyBodyState(req)).toMatchObject({ kind: 'not-applicable', reason: 'head' });
  });
});
