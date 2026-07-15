import type { Collection, Environment, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
// Registers the `requests.*` setting definitions (import side effect) —
// the executor's success path reads the response-body cap, which throws
// on an unregistered key.
import '@openheaders/ui/workbench/settings/schema/requests';
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

// jsdom's `navigator.onLine` can default to `false` depending on
// harness version — force it to `true` so the executor's pre-flight
// offline guard doesn't short-circuit every test. Individual cases
// that exercise offline behavior override this explicitly.
Object.defineProperty(globalThis.navigator, 'onLine', {
  value: true,
  configurable: true,
  writable: true,
});

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getEnvironments: vi.fn(() => [] as Environment[]),
  getActiveEnvironmentId: vi.fn(() => null as string | null),
  getDefaultEnvironmentId: vi.fn(() => null as string | null),
  getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, variables: [] }) as WorkspaceVariables),
  getVault: vi.fn(() => ({ schemaVersion: 5, secrets: [] }) as Vault),
}));

vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: vi.fn(() => null),
  getRequestCollections: vi.fn(() => [] as Collection[]),
  getRequestCollectionsForWorkspace: vi.fn(() => [] as Collection[]),
  getRequestFolders: vi.fn(() => []),
  getRequestFoldersForWorkspace: vi.fn(() => []),
  getRequestUidsForWorkspace: vi.fn(() => null),
}));

vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: vi.fn(() => [] as Collection[]),
}));

// Pre-request scripts run through the offscreen sandbox — stub the
// bridge so mutation handling is testable without an offscreen doc.
// Partial mock: only requests carrying a preRequestScript reach it.
const mockRunScript = vi.fn();
vi.mock('@/background/modules/offscreen-host', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isOffscreenSupported: vi.fn(() => true),
  runScript: (req: unknown) => mockRunScript(req),
}));

import {
  getActiveEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from '@openheaders/oracle/entity/environment-store';
import { getRequestCollections, getRequestFolders } from '@openheaders/oracle/entity/request-store';
import { needsSchemeNormalization } from '@openheaders/ui/shared/fetch';
import { ensureScheme, executeRequestDraft } from '@/background/modules/request-executor';

const mockEnvs = getEnvironments as ReturnType<typeof vi.fn>;
const mockActiveEnvId = getActiveEnvironmentId as ReturnType<typeof vi.fn>;
const mockWsVars = getWorkspaceVariables as ReturnType<typeof vi.fn>;
const mockVault = getVault as ReturnType<typeof vi.fn>;
const mockRequestCollections = getRequestCollections as ReturnType<typeof vi.fn>;
const mockRequestFolders = getRequestFolders as ReturnType<typeof vi.fn>;

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
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
    mockWsVars.mockReturnValue({ schemaVersion: 5, variables: [] });
    mockVault.mockReturnValue({ schemaVersion: 5, secrets: [] });
    mockRequestCollections.mockReturnValue([]);
    mockRequestFolders.mockReturnValue([]);
  });

  it('resolves workspace variables in URL', async () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ uid: '1abc6d8c', name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
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
        uid: 'rc-1',
        path: 'requests/auth-coll',
        name: 'Auth',
        variables: [{ uid: '9d864e7f', name: 'TOKEN', value: 'coll-token', type: 'default' }],
        pinnedEnvironmentIds: [],
        defaultEnvironmentId: null,
      } satisfies Collection,
    ]);
    const req = makeRequest({
      path: 'requests/auth-coll/login-abcd',
      url: 'https://api.openheaders.io',
      headers: [{ uid: 'tokenhdr', key: 'X-Token', value: '{{TOKEN}}' }],
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
          { uid: 'qparam01', key: 'q', value: 'hello' },
          { uid: 'qparam02', key: 'disabled', value: 'x', enabled: false },
          { uid: 'qparam03', key: 'lang', value: 'en' },
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

  it('skips a disabled auth contribution entirely', async () => {
    await executeRequestDraft(makeRequest({ auth: { type: 'bearer', token: 'abc123', disabled: true } }));
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('authorization')).toBeNull();
  });

  it('signs aws-sigv4 requests at the wire, resolving templated credentials', async () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [
        { uid: 'awssec01', name: 'AWS_SECRET', value: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', type: 'secret' },
      ],
    });
    await executeRequestDraft(
      makeRequest({
        headers: [{ uid: 'stalehdr', key: 'Authorization', value: 'Bearer stale-user-token' }],
        auth: {
          type: 'aws-sigv4',
          accessKeyId: 'AKIDEXAMPLE',
          secretAccessKey: '{{AWS_SECRET}}',
          service: 'execute-api',
          region: 'us-east-1',
        },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('x-amz-date')).toMatch(/^\d{8}T\d{6}Z$/);
    const auth = headers.get('authorization') ?? '';
    expect(auth).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
    expect(auth).toContain('/us-east-1/execute-api/aws4_request');
    expect(auth).toContain('SignedHeaders=host;x-amz-date');
    expect(auth).not.toContain('stale-user-token');
  });

  it('skips a disabled aws-sigv4 config entirely', async () => {
    await executeRequestDraft(
      makeRequest({
        auth: {
          type: 'aws-sigv4',
          accessKeyId: 'AKIDEXAMPLE',
          secretAccessKey: 'secret',
          service: 's3',
          region: 'us-east-1',
          disabled: true,
        },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-amz-date')).toBeNull();
  });

  it('skips a digest config on the browser runtime — the target 401 is the signal', async () => {
    await executeRequestDraft(makeRequest({ auth: { type: 'digest', username: 'cam-admin', password: 'pw' } }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('authorization')).toBeNull();
  });

  it('an inherit request resolves the collection-level bearer up the ancestor chain', async () => {
    mockRequestCollections.mockReturnValue([
      {
        schemaVersion: 5,
        uid: 'rc-1',
        path: 'requests/auth-coll',
        name: 'Auth',
        variables: [],
        pinnedEnvironmentIds: [],
        defaultEnvironmentId: null,
        auth: { type: 'bearer', token: 'tok-col' },
      } satisfies Collection,
    ]);
    await executeRequestDraft(makeRequest({ path: 'requests/auth-coll/login-abcd', auth: { type: 'inherit' } }));
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('authorization')).toBe('Bearer tok-col');
  });

  it('folder-level auth shadows the collection for inherit requests (innermost carrier wins)', async () => {
    mockRequestCollections.mockReturnValue([
      {
        schemaVersion: 5,
        uid: 'rc-1',
        path: 'requests/auth-coll',
        name: 'Auth',
        variables: [],
        pinnedEnvironmentIds: [],
        defaultEnvironmentId: null,
        auth: { type: 'bearer', token: 'tok-col' },
      } satisfies Collection,
    ]);
    mockRequestFolders.mockReturnValue([
      {
        schemaVersion: 5,
        uid: 'rf-1',
        path: 'requests/auth-coll/tokens-rf1',
        name: 'Tokens',
        auth: { type: 'bearer', token: 'tok-folder' },
      },
    ]);
    await executeRequestDraft(
      makeRequest({ path: 'requests/auth-coll/tokens-rf1/login-abcd', auth: { type: 'inherit' } }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('authorization')).toBe('Bearer tok-folder');
  });

  it('an inherit request with no ancestor carrier sends no Authorization header', async () => {
    await executeRequestDraft(makeRequest({ auth: { type: 'inherit' } }));
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('authorization')).toBeNull();
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
        headers: [{ uid: 'cthdr001', key: 'Content-Type', value: 'application/vnd.custom+json' }],
        body: { type: 'json', content: '{"a":1}' },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('content-type')).toBe('application/vnd.custom+json');
  });

  it('omits a GET body from the wire and stamps the omission on the snapshot', async () => {
    // Browser fetch() refuses to CONSTRUCT a GET/HEAD request with a
    // body — attaching it would fail the whole send before any wire
    // activity. Permissive: the request goes out bodiless and the
    // snapshot says so, instead of hard-failing.
    const snapshot = await executeRequestDraft(
      makeRequest({
        method: 'GET',
        body: { type: 'json', content: '{"a":1}' },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeUndefined();
    expect(snapshot.requestBodyOmitted).toBe(true);
    expect(snapshot.error).toBeNull();
  });

  it('keeps a POST body on the wire with no omission stamp', async () => {
    const snapshot = await executeRequestDraft(
      makeRequest({
        method: 'POST',
        body: { type: 'json', content: '{"a":1}' },
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe('{"a":1}');
    expect(snapshot.requestBodyOmitted).toBeUndefined();
  });

  it('captures a non-UTF-8 response body as base64 with wire-exact bodyBytes', async () => {
    const wire = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x0a, 0xe2, 0xe3, 0xcf, 0xd3]);
    const textFetch = globalThis.fetch;
    vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
      fetchMock(input, init);
      return Promise.resolve(
        new Response(wire, { status: 200, statusText: 'OK', headers: { 'content-type': 'application/pdf' } }),
      );
    });
    try {
      const snapshot = await executeRequestDraft(makeRequest({ method: 'GET' }));
      expect(snapshot.bodyEncoding).toBe('base64');
      expect(snapshot.bodyBytes).toBe(wire.byteLength);
      expect(Array.from(Uint8Array.from(atob(snapshot.body), (c) => c.charCodeAt(0)))).toEqual(Array.from(wire));
    } finally {
      vi.stubGlobal('fetch', textFetch);
    }
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

  it('prepends https:// for scheme-less public hosts', () => {
    expect(ensureScheme('api.openheaders.io')).toBe('https://api.openheaders.io');
    expect(ensureScheme('example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('prepends http:// for loopback hosts (localhost, 127.x, ::1)', () => {
    // Previously forced https:// on localhost, which is wrong — dev
    // servers almost never run TLS on loopback, so users were getting
    // "Failed to fetch" from a browser-enforced mixed-content block.
    expect(ensureScheme('localhost:3000')).toBe('http://localhost:3000');
    expect(ensureScheme('localhost:8080/api')).toBe('http://localhost:8080/api');
    expect(ensureScheme('localhost')).toBe('http://localhost');
    expect(ensureScheme('app.localhost')).toBe('http://app.localhost');
    expect(ensureScheme('127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    expect(ensureScheme('127.1.2.3/health')).toBe('http://127.1.2.3/health');
  });

  it('prepends http:// for RFC 1918 private IPv4 ranges', () => {
    // Intranet + Docker bridge networks typically serve plaintext.
    expect(ensureScheme('10.0.0.1/config')).toBe('http://10.0.0.1/config');
    expect(ensureScheme('192.168.1.1/admin')).toBe('http://192.168.1.1/admin');
    expect(ensureScheme('172.16.5.20:22')).toBe('http://172.16.5.20:22');
    expect(ensureScheme('172.31.255.255')).toBe('http://172.31.255.255');
    // 172.32.x is PUBLIC — stays https.
    expect(ensureScheme('172.32.0.1')).toBe('https://172.32.0.1');
    // Link-local (169.254/16) is also plaintext-by-convention.
    expect(ensureScheme('169.254.1.1/status')).toBe('http://169.254.1.1/status');
  });

  it('prepends http:// for mDNS .local hostnames', () => {
    // Bonjour / zero-config. Used for NAS boxes, printers, dev
    // machines on the same LAN. Never HTTPS in practice.
    expect(ensureScheme('mynas.local')).toBe('http://mynas.local');
    expect(ensureScheme('printer.local/print')).toBe('http://printer.local/print');
    expect(ensureScheme('devbox.local:8080')).toBe('http://devbox.local:8080');
  });

  it('prepends http:// for single-label hostnames (hosts file / intranet DNS)', () => {
    // A label with no dot can't be a public TLD (public TLDs always
    // have at least one dot). So it's a hosts-file alias or
    // intranet-DNS name. Mirrors Chrome's own omnibox heuristic.
    expect(ensureScheme('nas/files')).toBe('http://nas/files');
    expect(ensureScheme('router/admin')).toBe('http://router/admin');
    expect(ensureScheme('devbox:8443/health')).toBe('http://devbox:8443/health');
    expect(ensureScheme('local.dev')).toBe('https://local.dev'); // has a dot → public
  });

  it('upgrades protocol-relative URLs with the same inference', () => {
    expect(ensureScheme('//example.com/path')).toBe('https://example.com/path');
    expect(ensureScheme('//localhost:3000/')).toBe('http://localhost:3000/');
    expect(ensureScheme('//10.0.0.5/api')).toBe('http://10.0.0.5/api');
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

// ── Pre-flight guards (URL validation + offline) ──────────────────
//
// Browsers opaque every non-TLS network error into `TypeError: Failed
// to fetch`, so we need pre-flight guards to surface actionable
// messages BEFORE the fetch runs. These tests pin the two guard
// paths: malformed URLs and `navigator.onLine === false`.

describe('pre-flight URL validation', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockEnvs.mockReturnValue([] as Environment[]);
    mockActiveEnvId.mockReturnValue(null);
    mockWsVars.mockReturnValue({ schemaVersion: 5, variables: [] } as WorkspaceVariables);
    mockVault.mockReturnValue({ schemaVersion: 5, secrets: [] } as Vault);
    mockRequestCollections.mockReturnValue([] as Collection[]);
  });

  it('surfaces "Invalid URL" for malformed inputs without calling fetch', async () => {
    // `http://` with no host — `new URL()` accepts but fetch would
    // fail with an opaque TypeError. Our pre-flight check catches
    // this and produces a clean message.
    const req = makeRequest({ url: 'http:///' });
    const res = await executeRequestDraft(req, {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.error).toBeTruthy();
    expect(res.error).toMatch(/Invalid URL/);
  });

  it('surfaces "Invalid URL" for unparseable inputs', async () => {
    // Triple-slash after scheme → URL parser rejects.
    const req = makeRequest({ url: 'http://// /invalid' });
    const res = await executeRequestDraft(req, {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.error).toBeTruthy();
    expect(res.error).toMatch(/Invalid URL/);
  });

  it('returns a clean offline message when navigator.onLine is false', async () => {
    const originalOnLine = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine');
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });
    try {
      const req = makeRequest({ url: 'https://api.openheaders.io/v1/ping' });
      const res = await executeRequestDraft(req, {});
      expect(fetchMock).not.toHaveBeenCalled();
      expect(res.error).toMatch(/offline/i);
    } finally {
      if (originalOnLine) Object.defineProperty(globalThis.navigator, 'onLine', originalOnLine);
    }
  });
});

// ── Generic fetch-failure classification ──────────────────────────
//
// Chromium's extension fetch returns `TypeError: Failed to fetch`
// for every non-TLS network error (DNS fail, connection refused,
// host unreachable, missing host permission, offline mid-flight).
// We can't extract the underlying OS error — browser won't expose
// it — but we CAN replace the content-free default with a hostname
// + likely-cause breakdown so the user knows where to look. Matches
// Postman's UX for the SDK/browser variants of the client.

describe('fetch-failure classification', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockEnvs.mockReturnValue([] as Environment[]);
    mockActiveEnvId.mockReturnValue(null);
    mockWsVars.mockReturnValue({ schemaVersion: 5, variables: [] } as WorkspaceVariables);
    mockVault.mockReturnValue({ schemaVersion: 5, secrets: [] } as Vault);
    mockRequestCollections.mockReturnValue([] as Collection[]);
  });

  it('expands "Failed to fetch" for a public host into an actionable message', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    try {
      const req = makeRequest({ url: 'https://api.openheaders.io/v1/ping' });
      const res = await executeRequestDraft(req, {});
      expect(res.status).toBe(0);
      expect(res.error).toContain('api.openheaders.io');
      expect(res.error).toMatch(/host not found|connection refused|TLS|permission/i);
      // HTTPS failure may be a certificate error — offer the tab hint.
      expect(res.errorHint).toEqual({ kind: 'open-in-tab', url: 'https://api.openheaders.io/v1/ping' });
    } finally {
      vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
        fetchMock(input, init);
        return Promise.resolve(new Response('ok', { status: 200 }));
      });
    }
  });

  it('explains the self-signed certificate case for local HTTPS targets and hints open-in-tab', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    try {
      const req = makeRequest({ url: 'https://localhost:8080/v1/workspaces/123/rules' });
      const res = await executeRequestDraft(req, {});
      expect(res.status).toBe(0);
      expect(res.error).toContain('localhost');
      expect(res.error).toMatch(/self-signed|certificate/i);
      // Step-by-step guidance moved out of the prose — the hint drives
      // the response pane's CertTrustSteps walkthrough instead.
      expect(res.error).toMatch(/untrusted certificates/i);
      expect(res.errorHint).toEqual({
        kind: 'open-in-tab',
        url: 'https://localhost:8080/v1/workspaces/123/rules',
        certificate: true,
      });
    } finally {
      vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
        fetchMock(input, init);
        return Promise.resolve(new Response('ok', { status: 200 }));
      });
    }
  });

  it('classifies the Firefox spelling of the opaque failure the same way', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('NetworkError when attempting to fetch resource.')));
    try {
      const req = makeRequest({ url: 'https://localhost:8080/v1/ping' });
      const res = await executeRequestDraft(req, {});
      expect(res.status).toBe(0);
      expect(res.error).toMatch(/self-signed|certificate/i);
      expect(res.errorHint).toEqual({ kind: 'open-in-tab', url: 'https://localhost:8080/v1/ping', certificate: true });
    } finally {
      vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
        fetchMock(input, init);
        return Promise.resolve(new Response('ok', { status: 200 }));
      });
    }
  });

  it('tailors the message for loopback targets ("Is the service running?")', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    try {
      const req = makeRequest({ url: 'http://localhost:3000/health' });
      const res = await executeRequestDraft(req, {});
      expect(res.error).toContain('localhost');
      expect(res.error).toMatch(/Is the service running/);
      // Plain-http failure has no certificate to accept — no tab hint.
      expect(res.errorHint).toBeUndefined();
    } finally {
      vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
        fetchMock(input, init);
        return Promise.resolve(new Response('ok', { status: 200 }));
      });
    }
  });

  it('tailors the message for hosts-file / intranet single-label hostnames', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    try {
      const req = makeRequest({ url: 'example-local' });
      const res = await executeRequestDraft(req, {});
      // `example-local` has a dash but no dot → single-label → http://
      expect(res.error).toContain('example-local');
      expect(res.error).toMatch(/Is the service running/);
    } finally {
      vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
        fetchMock(input, init);
        return Promise.resolve(new Response('ok', { status: 200 }));
      });
    }
  });

  it('passes through non-generic fetch errors verbatim (e.g. AbortError)', async () => {
    vi.stubGlobal('fetch', () => {
      const e = new Error('The operation was aborted.');
      e.name = 'AbortError';
      return Promise.reject(e);
    });
    try {
      const req = makeRequest({ url: 'https://api.openheaders.io/v1/ping' });
      const res = await executeRequestDraft(req, {});
      // Non-"Failed to fetch" messages are preserved verbatim.
      expect(res.error).toBe('The operation was aborted.');
    } finally {
      vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
        fetchMock(input, init);
        return Promise.resolve(new Response('ok', { status: 200 }));
      });
    }
  });

  it('aborts at the per-request timeout with a message naming the configured limit', async () => {
    vi.useFakeTimers();
    // A fetch that never resolves on its own — it only rejects when the
    // executor's deadline fires its abort signal, like a stalled server.
    vi.stubGlobal(
      'fetch',
      (_input: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    try {
      const pending = executeRequestDraft(makeRequest({ timeoutMs: 1000 }));
      await vi.advanceTimersByTimeAsync(1000);
      const res = await pending;
      expect(res.status).toBe(0);
      expect(res.error).toBe('Request timed out after 1000 ms.');
    } finally {
      vi.useRealTimers();
      vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
        fetchMock(input, init);
        return Promise.resolve(new Response('ok', { status: 200 }));
      });
    }
  });

  it('does not arm a deadline when the request has no timeout', async () => {
    await executeRequestDraft(makeRequest());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeUndefined();
  });
});

describe('pre-request script mutations', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockRunScript.mockReset();
  });

  function scriptResult(mutation: unknown) {
    return {
      executionId: 'e1',
      succeeded: true,
      mutation,
      assertions: [],
      consoleLog: [],
      durationMs: 1,
    };
  }

  it('re-derives Content-Type when a script sets a JSON body on a body-less request', async () => {
    mockRunScript.mockResolvedValue(scriptResult({ body: { type: 'json', content: '{"name":"value"}' } }));
    const req = makeRequest({ method: 'POST', preRequestScript: `oh.setBody({ type: 'json', content: '…' });` });
    await executeRequestDraft(req, {});
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get('content-type')).toBe('application/json');
    expect(init.body).toBe('{"name":"value"}');
  });

  it('keeps an explicit Content-Type header over the derived one', async () => {
    mockRunScript.mockResolvedValue(scriptResult({ body: { type: 'json', content: '{}' } }));
    const req = makeRequest({
      method: 'POST',
      headers: [{ uid: 'h1', key: 'Content-Type', value: 'application/vnd.openheaders+json', enabled: true }],
      preRequestScript: 'x',
    });
    await executeRequestDraft(req, {});
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get('content-type')).toBe('application/vnd.openheaders+json');
  });
});
