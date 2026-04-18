import type { V5 } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the URL fetch is called with so we can assert resolved output.
const fetchMock = vi.fn();

vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
  fetchMock(input, init);
  return Promise.resolve(
    new Response('ok', {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/plain' },
    }),
  );
});

vi.mock('@/background/modules/environment-store', () => ({
  getEnvironments: vi.fn(() => [] as V5.Environment[]),
  getActiveEnvironmentId: vi.fn(() => null as string | null),
  getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 1, variables: [] }) as V5.WorkspaceVariables),
  getVault: vi.fn(() => ({ schemaVersion: 1, secrets: [] }) as V5.Vault),
}));

vi.mock('@/background/modules/request-store', () => ({
  getRequest: vi.fn(() => null),
  getRequestCollections: vi.fn(() => [] as V5.Collection[]),
}));

vi.mock('@/background/modules/rule-store', () => ({
  getCollections: vi.fn(() => [] as V5.Collection[]),
}));

import {
  getActiveEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from '@/background/modules/environment-store';
import { executeRequestDraft } from '@/background/modules/request-executor';
import { getRequestCollections } from '@/background/modules/request-store';

const mockEnvs = getEnvironments as ReturnType<typeof vi.fn>;
const mockActiveEnvId = getActiveEnvironmentId as ReturnType<typeof vi.fn>;
const mockWsVars = getWorkspaceVariables as ReturnType<typeof vi.fn>;
const mockVault = getVault as ReturnType<typeof vi.fn>;
const mockRequestCollections = getRequestCollections as ReturnType<typeof vi.fn>;

function makeRequest(overrides: Partial<V5.Request> = {}): V5.Request {
  return {
    schemaVersion: 1,
    uid: 'r1',
    path: 'requests/default-xxxx/r1',
    name: 'R',
    method: 'GET',
    url: 'https://api.openheaders.io/v1/ping',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

describe('RequestExecutor', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockEnvs.mockReturnValue([]);
    mockActiveEnvId.mockReturnValue(null);
    mockWsVars.mockReturnValue({ schemaVersion: 1, variables: [] });
    mockVault.mockReturnValue({ schemaVersion: 1, secrets: [] });
    mockRequestCollections.mockReturnValue([]);
  });

  it('resolves workspace variables in URL', async () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 1,
      variables: [{ name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
    });
    await executeRequestDraft(makeRequest({ url: 'https://{{HOST}}/v1/ping' }));
    expect(fetchMock).toHaveBeenCalledWith('https://api.openheaders.io/v1/ping', expect.any(Object));
  });

  it('resolves REQUEST-collection-scoped variables (not just rule-collection)', async () => {
    // Request collection owns its own variables — regression test for
    // the bug where the executor looked in rule-collections instead.
    mockRequestCollections.mockReturnValue([
      {
        schemaVersion: 1,
        uid: 'rc-1',
        path: 'requests/auth-coll',
        name: 'Auth',
        variables: [{ name: 'TOKEN', value: 'coll-token', type: 'default' }],
      } satisfies V5.Collection,
    ]);
    const req = makeRequest({
      path: 'requests/auth-coll/login-abcd',
      url: 'https://api.openheaders.io',
      headers: [{ key: 'X-Token', value: '{{TOKEN}}' }],
    });
    await executeRequestDraft(req);
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('x-token')).toBe('coll-token');
  });

  it('appends enabled query params to the URL', async () => {
    await executeRequestDraft(
      makeRequest({
        url: 'https://api.openheaders.io/search',
        params: [
          { key: 'q', value: 'hello' },
          { key: 'disabled', value: 'x', enabled: false },
          { key: 'lang', value: 'en' },
        ],
      }),
    );
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openheaders.io/search?q=hello&lang=en');
  });

  it('applies basic auth with UTF-8 characters without crashing', async () => {
    await executeRequestDraft(
      makeRequest({
        auth: { type: 'basic', username: 'ünicode', password: 'pässwörd' },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    const auth = (init.headers as Headers).get('authorization');
    expect(auth).toMatch(/^Basic /);
    // Verify round-trip: base64 decoded back through TextDecoder
    // matches the original UTF-8 pair.
    const decoded = atob(auth!.slice('Basic '.length));
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe('ünicode:pässwörd');
  });

  it('applies bearer token auth', async () => {
    await executeRequestDraft(makeRequest({ auth: { type: 'bearer', token: 'abc123' } }));
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('authorization')).toBe('Bearer abc123');
  });

  it('places api-key in header when in=header', async () => {
    await executeRequestDraft(
      makeRequest({ auth: { type: 'api-key', key: 'X-Api-Key', value: 'secret', in: 'header' } }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('x-api-key')).toBe('secret');
  });

  it('places api-key in query when in=query', async () => {
    await executeRequestDraft(makeRequest({ auth: { type: 'api-key', key: 'api_key', value: 'secret', in: 'query' } }));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openheaders.io/v1/ping?api_key=secret');
  });

  it('injects Content-Type when body type is set and user has no Content-Type header', async () => {
    await executeRequestDraft(
      makeRequest({
        method: 'POST',
        body: { type: 'json', content: '{"a":1}' },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('content-type')).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('does NOT inject Content-Type when user already provided one', async () => {
    await executeRequestDraft(
      makeRequest({
        method: 'POST',
        headers: [{ key: 'Content-Type', value: 'application/vnd.custom+json' }],
        body: { type: 'json', content: '{"a":1}' },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('content-type')).toBe('application/vnd.custom+json');
  });

  it('passes body to fetch for any method — browser decides spec compliance', async () => {
    // GET-with-body is spec-questionable but some APIs accept it; we
    // no longer drop silently. If the browser's fetch() rejects it,
    // the error surfaces in the response panel instead of being
    // swallowed here.
    await executeRequestDraft(
      makeRequest({
        method: 'GET',
        body: { type: 'json', content: '{"a":1}' },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe('{"a":1}');
  });

  it('returns error snapshot for empty URL', async () => {
    const snapshot = await executeRequestDraft(makeRequest({ url: '' }));
    expect(snapshot.error).toBe('URL is empty');
    expect(snapshot.status).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
