/**
 * The device flow's client wire (the client sign-in plan §7) — the one
 * `serverSignIn` implementation every native client registers. Pins the
 * request shapes against the S3 server contract (`POST /pair` JSON with
 * the client kind, `GET /pair/poll` with the handle as the bearer, a
 * JSON-only meta GET) and the mapping of every status the server can
 * answer onto the typed results the wizard step consumes. The server
 * side is covered in oracle-host-node's `device-authorization` suite.
 */

import { describe, expect, it, vi } from 'vitest';
import { createServerSignInClient, fetchJsonDocument, wsUrlToHttpOrigin } from '../../src/identity';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

function htmlResponse(status = 200): Response {
  return new Response('<!doctype html>', { status, headers: { 'content-type': 'text/html' } });
}

const URL_WS = 'ws://10.0.0.5:8137';

describe('wsUrlToHttpOrigin', () => {
  it('maps ws→http and wss→https, refusing anything else', () => {
    expect(wsUrlToHttpOrigin('ws://10.0.0.5:8137')).toBe('http://10.0.0.5:8137');
    expect(wsUrlToHttpOrigin('wss://sync.openheaders.io')).toBe('https://sync.openheaders.io');
    expect(wsUrlToHttpOrigin('http://10.0.0.5:8137')).toBeNull();
    expect(wsUrlToHttpOrigin('not a url')).toBeNull();
  });
});

describe('createServerSignInClient.start', () => {
  it('posts the client kind and a trimmed label, answering the code, handle and approve URL', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        ok: true,
        code: '424242',
        pollToken: 'h',
        expiresAt: 1_700_000,
        approveUrl: 'http://x/pair/424242',
      }),
    );
    const api = createServerSignInClient({ client: 'extension', fetch: fetchFn as unknown as typeof fetch });
    const result = await api.start({ url: URL_WS, deviceLabel: '  Work Chrome ' });
    expect(result).toEqual({
      ok: true,
      code: '424242',
      pollToken: 'h',
      expiresAt: 1_700_000,
      approveUrl: 'http://x/pair/424242',
    });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://10.0.0.5:8137/pair');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Accept: 'application/json', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ client: 'extension', deviceLabel: 'Work Chrome' });
  });

  it('omits an empty label and names the client kind it was built for', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ ok: true, code: '1', pollToken: 'h', expiresAt: 1, approveUrl: 'http://x/pair/1' }),
    );
    const api = createServerSignInClient({ client: 'desktop', fetch: fetchFn as unknown as typeof fetch });
    await api.start({ url: URL_WS, deviceLabel: '   ' });
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ client: 'desktop' });
  });

  it('types every refusal the server can answer', async () => {
    const cases: Array<[Response, string]> = [
      [jsonResponse({ ok: false, reason: 'too-many-pending' }, 503), 'too-many-pending'],
      [jsonResponse({ error: 'too many failed attempts' }, 429), 'throttled'],
      [jsonResponse({ error: 'forbidden' }, 403), 'forbidden'],
      [jsonResponse({ ok: false, reason: 'malformed-request' }, 400), 'error'],
      [htmlResponse(200), 'error'],
      [jsonResponse({ ok: true, code: 1 }), 'error'],
    ];
    for (const [response, reason] of cases) {
      const api = createServerSignInClient({ client: 'cli', fetch: (async () => response) as typeof fetch });
      expect(await api.start({ url: URL_WS })).toEqual({ ok: false, reason });
    }
  });

  it('reads a thrown fetch as offline and a non-ws URL as an error without dialing', async () => {
    const offline = createServerSignInClient({
      client: 'cli',
      fetch: (async () => {
        throw new Error('ECONNREFUSED');
      }) as typeof fetch,
    });
    expect(await offline.start({ url: URL_WS })).toEqual({ ok: false, reason: 'offline' });
    const fetchFn = vi.fn();
    const api = createServerSignInClient({ client: 'cli', fetch: fetchFn as unknown as typeof fetch });
    expect(await api.start({ url: 'http://10.0.0.5:8137' })).toEqual({ ok: false, reason: 'error' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('createServerSignInClient.poll', () => {
  it('sends the handle as the bearer and reads a pending answer with its expiry', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ status: 'pending', expiresAt: 99 }));
    const api = createServerSignInClient({ client: 'extension', fetch: fetchFn as unknown as typeof fetch });
    expect(await api.poll({ url: URL_WS, pollToken: 'handle-1' })).toEqual({ status: 'pending', expiresAt: 99 });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://10.0.0.5:8137/pair/poll');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer handle-1', Accept: 'application/json' });
  });

  it('hands the approved secret through once, exactly as answered', async () => {
    const api = createServerSignInClient({
      client: 'extension',
      fetch: (async () => jsonResponse({ status: 'approved', secret: 'oh_s', tokenId: 'tid' })) as typeof fetch,
    });
    expect(await api.poll({ url: URL_WS, pollToken: 'h' })).toEqual({
      status: 'approved',
      secret: 'oh_s',
      tokenId: 'tid',
    });
  });

  it('maps denied, expired, an unknown handle, a transient 500 and a dead socket', async () => {
    const cases: Array<[() => Promise<Response>, unknown]> = [
      [async () => jsonResponse({ status: 'denied' }), { status: 'denied' }],
      [async () => jsonResponse({ status: 'expired' }), { status: 'expired' }],
      [async () => jsonResponse({ status: 'unknown' }, 404), { status: 'unknown' }],
      [async () => jsonResponse({ status: 'pending' }, 500), { status: 'pending', expiresAt: null }],
      [
        async () => {
          throw new Error('offline');
        },
        { status: 'offline' },
      ],
      [async () => htmlResponse(200), { status: 'offline' }],
      [async () => jsonResponse({ status: 'approved' }), { status: 'offline' }],
    ];
    for (const [fetchFn, expected] of cases) {
      const api = createServerSignInClient({ client: 'extension', fetch: fetchFn as typeof fetch });
      expect(await api.poll({ url: URL_WS, pollToken: 'h' })).toEqual(expected);
    }
  });
});

describe('fetchMeta / fetchJsonDocument', () => {
  it('reads a JSON 2xx at the path on the back-end origin and nulls everything else', async () => {
    const answers: Record<string, Response> = {
      'http://10.0.0.5:8137/auth/oidc/meta': jsonResponse({ enabled: true, provider: 'Okta' }),
      'http://10.0.0.5:8137/auth/setup/meta': htmlResponse(200),
      'http://10.0.0.5:8137/auth/password/meta': jsonResponse({ error: 'forbidden' }, 403),
    };
    const fetchFn = vi.fn(async (url: string) => answers[url] ?? htmlResponse(404));
    const api = createServerSignInClient({ client: 'extension', fetch: fetchFn as unknown as typeof fetch });
    expect(await api.fetchMeta({ url: URL_WS, path: '/auth/oidc/meta' })).toEqual({ enabled: true, provider: 'Okta' });
    expect(await api.fetchMeta({ url: URL_WS, path: '/auth/setup/meta' })).toBeNull();
    expect(await api.fetchMeta({ url: URL_WS, path: '/auth/password/meta' })).toBeNull();
    expect(await api.fetchMeta({ url: URL_WS, path: '/nothing' })).toBeNull();
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ Accept: 'application/json' });
  });

  it('nulls a dead socket and a non-ws back-end URL', async () => {
    expect(
      await fetchJsonDocument('http://10.0.0.5:8137/auth/oidc/meta', (async () => {
        throw new Error('offline');
      }) as typeof fetch),
    ).toBeNull();
    const fetchFn = vi.fn();
    const api = createServerSignInClient({ client: 'extension', fetch: fetchFn as unknown as typeof fetch });
    expect(await api.fetchMeta({ url: 'http://10.0.0.5:8137', path: '/auth/oidc/meta' })).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
