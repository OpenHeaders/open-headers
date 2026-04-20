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
  getDefaultEnvironmentId: vi.fn(() => null as string | null),
  getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, version: 1, variables: [] }) as V5.WorkspaceVariables),
  getVault: vi.fn(() => ({ schemaVersion: 5, version: 1, secrets: [] }) as V5.Vault),
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
import { ensureScheme, executeRequestDraft } from '@/background/modules/request-executor';
import { getRequestCollections } from '@/background/modules/request-store';
import { needsSchemeNormalization } from '@/shared/fetch/ensure-scheme';

const mockEnvs = getEnvironments as ReturnType<typeof vi.fn>;
const mockActiveEnvId = getActiveEnvironmentId as ReturnType<typeof vi.fn>;
const mockWsVars = getWorkspaceVariables as ReturnType<typeof vi.fn>;
const mockVault = getVault as ReturnType<typeof vi.fn>;
const mockRequestCollections = getRequestCollections as ReturnType<typeof vi.fn>;

function makeRequest(overrides: Partial<V5.Request> = {}): V5.Request {
  return {
    schemaVersion: 5,
    version: 1,
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
    mockWsVars.mockReturnValue({ schemaVersion: 5, version: 1, variables: [] });
    mockVault.mockReturnValue({ schemaVersion: 5, version: 1, secrets: [] });
    mockRequestCollections.mockReturnValue([]);
  });

  it('resolves workspace variables in URL', async () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
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
        schemaVersion: 5,
        version: 1,
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

  // ── Cookie-jar policy (ARCHITECTURE.md §14) ────────────────────────

  it("defaults to credentials: 'omit' when the request doesn't opt in", async () => {
    await executeRequestDraft(makeRequest());
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe('omit');
  });

  it("explicit credentialsMode: 'omit' stays omit", async () => {
    await executeRequestDraft(makeRequest({ credentialsMode: 'omit' }));
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe('omit');
  });

  it("credentialsMode: 'include' rides the browser cookie jar", async () => {
    await executeRequestDraft(makeRequest({ credentialsMode: 'include' }));
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe('include');
  });

  // ── Redirect policy ───────────────────────────────────────────────

  it("defaults to redirect: 'follow' when the request doesn't opt out", async () => {
    await executeRequestDraft(makeRequest());
    const [, init] = fetchMock.mock.calls[0];
    expect(init.redirect).toBe('follow');
  });

  it("followRedirects: true keeps redirect: 'follow'", async () => {
    await executeRequestDraft(makeRequest({ followRedirects: true }));
    const [, init] = fetchMock.mock.calls[0];
    expect(init.redirect).toBe('follow');
  });

  it("followRedirects: false flips to redirect: 'manual' so 3xx hops surface", async () => {
    await executeRequestDraft(makeRequest({ followRedirects: false }));
    const [, init] = fetchMock.mock.calls[0];
    expect(init.redirect).toBe('manual');
  });

  it('prepends https:// to scheme-less URLs (prevents SW-origin ERR_FILE_NOT_FOUND)', async () => {
    // Regression: entering "example.com" previously resolved to
    // `chrome-extension://<id>/example.com` (the SW's origin) and
    // hit the extension's asset filesystem, producing an opaque
    // `Failed to fetch` with `net::ERR_FILE_NOT_FOUND` in DevTools.
    await executeRequestDraft(makeRequest({ url: 'example.com' }));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com');
  });

  it('honors an explicit scheme on bare URLs', async () => {
    await executeRequestDraft(makeRequest({ url: 'http://example.com' }));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://example.com');
  });
});

describe('ensureScheme', () => {
  it('leaves URLs with a scheme://... untouched', () => {
    expect(ensureScheme('https://api.openheaders.io')).toBe('https://api.openheaders.io');
    expect(ensureScheme('http://example.com')).toBe('http://example.com');
    expect(ensureScheme('ws://example.com/ws')).toBe('ws://example.com/ws');
    expect(ensureScheme('wss://example.com/ws')).toBe('wss://example.com/ws');
    expect(ensureScheme('file:///tmp/x')).toBe('file:///tmp/x');
  });

  it('prepends https:// for scheme-less URLs', () => {
    expect(ensureScheme('api.openheaders.io')).toBe('https://api.openheaders.io');
    expect(ensureScheme('example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('treats host:port as host:port, not a scheme (prepends https://)', () => {
    // Regression: `localhost:3000` is a common dev URL. Without this,
    // the RFC-3986 scheme regex matched `localhost:` and left the
    // URL unchanged, so fetch() blew up on an invalid scheme.
    expect(ensureScheme('localhost:3000')).toBe('https://localhost:3000');
    expect(ensureScheme('localhost:8080/api')).toBe('https://localhost:8080/api');
    expect(ensureScheme('127.0.0.1:3000')).toBe('https://127.0.0.1:3000');
  });

  it('upgrades protocol-relative URLs to https://', () => {
    expect(ensureScheme('//example.com/path')).toBe('https://example.com/path');
  });

  it('leaves template-only URLs alone', () => {
    // `{{BASE_URL}}/x` — the template may carry a scheme at resolve time.
    expect(ensureScheme('{{BASE_URL}}/x')).toBe('{{BASE_URL}}/x');
    expect(ensureScheme('{{HOST}}')).toBe('{{HOST}}');
  });

  it('prepends https:// when template is after a plain host', () => {
    // `example.com/{{path}}` still needs a scheme — only `{{…}}` at
    // the very start opts out of the prefix.
    expect(ensureScheme('example.com/{{path}}')).toBe('https://example.com/{{path}}');
  });
});

describe('needsSchemeNormalization', () => {
  it('returns true when ensureScheme would rewrite the URL', () => {
    expect(needsSchemeNormalization('example.com')).toBe(true);
    expect(needsSchemeNormalization('localhost:3000')).toBe(true);
    expect(needsSchemeNormalization('//example.com')).toBe(true);
  });

  it('returns false when the URL already has an explicit scheme', () => {
    expect(needsSchemeNormalization('https://example.com')).toBe(false);
    expect(needsSchemeNormalization('http://example.com')).toBe(false);
    expect(needsSchemeNormalization('ws://example.com')).toBe(false);
    expect(needsSchemeNormalization('file:///tmp/x')).toBe(false);
  });

  it('returns false for empty / whitespace-only URLs (no hint when nothing to render)', () => {
    expect(needsSchemeNormalization('')).toBe(false);
    expect(needsSchemeNormalization('   ')).toBe(false);
  });

  it('returns false for bare-template URLs (template may carry its own scheme)', () => {
    expect(needsSchemeNormalization('{{BASE_URL}}')).toBe(false);
    expect(needsSchemeNormalization('{{BASE_URL}}/x')).toBe(false);
  });
});
