/**
 * The client side of the person sign-in (the client sign-in plan §14.9)
 * — the one OAuth 2.0 public client every native host runs. Pins the
 * wire against the S8 server contract: the RFC 8414 metadata read
 * first (the issuer checked, no path hardcoded past the well-known
 * one), the code grant's authorize URL and its PKCE pair, the
 * redirect's `state` and RFC 9207 `iss` checks, the one-shot
 * redemption, the device grant's start and its poll at `interval` with
 * `slow_down` honoured and an early poll squelched, every verdict the
 * token endpoint can answer mapped onto the typed results the wizard
 * step and the CLI consume, the registered client's grants deciding
 * which grant runs, and RFC 7009 revocation as the sign-out.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  type AuthorizationUserAgent,
  createServerSignInClient,
  fetchJsonDocument,
  wsUrlToHttpOrigin,
} from '../../src/identity';

const URL_WS = 'ws://10.0.0.5:8137';
const ORIGIN = 'http://10.0.0.5:8137';
const METADATA = {
  issuer: ORIGIN,
  authorization_endpoint: `${ORIGIN}/auth/oauth/authorize`,
  token_endpoint: `${ORIGIN}/auth/oauth/token`,
  device_authorization_endpoint: `${ORIGIN}/auth/oauth/device`,
  revocation_endpoint: `${ORIGIN}/auth/oauth/revoke`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'urn:ietf:params:oauth:grant-type:device_code'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
};
const DEVICE_STARTED = {
  device_code: 'dev-secret',
  user_code: 'BCDF-GHJK',
  verification_uri: `${ORIGIN}/auth/oauth/device/verify`,
  verification_uri_complete: `${ORIGIN}/auth/oauth/device/verify?user_code=BCDF-GHJK`,
  expires_in: 300,
  interval: 5,
};
const REDIRECT_URI = 'http://127.0.0.1:8137/oauth/callback';

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

function html(status = 200): Response {
  return new Response('<!doctype html>', { status, headers: { 'content-type': 'text/html' } });
}

interface Dial {
  url: string;
  method: string;
  headers: Record<string, string>;
  form: Record<string, string>;
}

interface ServerScript {
  metadata?: Response | Error;
  device?: (Response | Error)[];
  token?: (Response | Error)[];
  revoke?: (Response | Error)[];
}

/** A daemon answering the metadata read, then the scripted answers per route in order. */
function makeServer(script: ServerScript = {}) {
  const dials: Dial[] = [];
  const queues = {
    device: [...(script.device ?? [])],
    token: [...(script.token ?? [])],
    revoke: [...(script.revoke ?? [])],
  };
  const fetchFn = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
    dials.push({
      url,
      method: init.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      form: Object.fromEntries(new URLSearchParams(typeof init.body === 'string' ? init.body : '')),
    });
    const answer = ((): Response | Error => {
      if (url === `${ORIGIN}/.well-known/oauth-authorization-server`) return script.metadata ?? json(METADATA);
      if (url === METADATA.device_authorization_endpoint) return queues.device.shift() ?? new Error('unscripted');
      if (url === METADATA.token_endpoint) return queues.token.shift() ?? new Error('unscripted');
      if (url === METADATA.revocation_endpoint) return queues.revoke.shift() ?? new Error('unscripted');
      return new Error(`unexpected dial ${url}`);
    })();
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return { dials, fetch: fetchFn as unknown as typeof fetch };
}

/** A browser hop the test settles by hand. */
function makeUserAgent() {
  let settle: { resolve: (url: string) => void; reject: (err: Error) => void } | null = null;
  const launch = vi.fn(
    (_url: string, _state: string) =>
      new Promise<string>((resolve, reject) => {
        settle = { resolve, reject };
      }),
  );
  const agent: AuthorizationUserAgent = { redirectUri: () => REDIRECT_URI, launch };
  return {
    agent,
    launch,
    land: (url: string) => settle?.resolve(url),
    abort: () => settle?.reject(new Error('window closed')),
    authorizeUrl: () => new URL(launch.mock.calls[0][0]),
    state: () => launch.mock.calls[0][1],
  };
}

/** Deterministic entropy: each draw is the draw's index repeated, so the verifier, handle and state differ. */
function makeRandom() {
  let draw = 0;
  return (n: number): Uint8Array => {
    draw += 1;
    return new Uint8Array(n).fill(draw);
  };
}

function s256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function makeClock(start = 1_700_000_000_000) {
  let at = start;
  return {
    now: () => at,
    advance: (ms: number): void => {
      at += ms;
    },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

describe('wsUrlToHttpOrigin', () => {
  it('maps ws→http and wss→https, refusing anything else', () => {
    expect(wsUrlToHttpOrigin('ws://10.0.0.5:8137')).toBe('http://10.0.0.5:8137');
    expect(wsUrlToHttpOrigin('wss://sync.openheaders.io')).toBe('https://sync.openheaders.io');
    expect(wsUrlToHttpOrigin('http://10.0.0.5:8137')).toBeNull();
    expect(wsUrlToHttpOrigin('not a url')).toBeNull();
  });
});

describe('discovery', () => {
  it('reads the RFC 8414 document at the well-known path first and refuses a document naming another issuer', async () => {
    const server = makeServer({ device: [json(DEVICE_STARTED)] });
    const api = createServerSignInClient({ client: 'cli', fetch: server.fetch });
    expect((await api.start({ url: URL_WS })).ok).toBe(true);
    expect(server.dials[0]).toMatchObject({
      url: `${ORIGIN}/.well-known/oauth-authorization-server`,
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    const foreign = makeServer({ metadata: json({ ...METADATA, issuer: 'http://10.0.0.6:8137' }) });
    const refused = createServerSignInClient({ client: 'cli', fetch: foreign.fetch });
    expect(await refused.start({ url: URL_WS })).toEqual({ ok: false, reason: 'error' });
    expect(foreign.dials).toHaveLength(1);
  });

  it('types every refusal the metadata read can meet, and a non-ws URL without dialing', async () => {
    const cases: Array<[Response | Error, string]> = [
      [json({ error: 'forbidden' }, 403), 'forbidden'],
      [json({ error: 'too many failed attempts' }, 429), 'throttled'],
      [new Error('ECONNREFUSED'), 'offline'],
      [html(200), 'error'],
      [json({ error: 'not found' }, 404), 'error'],
      [json({ ...METADATA, token_endpoint: undefined }), 'error'],
    ];
    for (const [metadata, reason] of cases) {
      const server = makeServer({ metadata });
      const api = createServerSignInClient({ client: 'cli', fetch: server.fetch });
      expect(await api.start({ url: URL_WS }), reason).toEqual({ ok: false, reason });
    }
    const server = makeServer();
    const api = createServerSignInClient({ client: 'cli', fetch: server.fetch });
    expect(await api.start({ url: ORIGIN })).toEqual({ ok: false, reason: 'error' });
    expect(server.dials).toEqual([]);
  });
});

describe('the grant per client', () => {
  it('runs the code grant when the registration allows it and the host brings a user agent, else the device grant', async () => {
    const ua = makeUserAgent();
    const extensionWithIdentity = createServerSignInClient({
      client: 'extension',
      userAgent: ua.agent,
      fetch: makeServer().fetch,
    });
    expect(await extensionWithIdentity.start({ url: URL_WS })).toMatchObject({ ok: true, kind: 'redirect' });

    const extensionWithout = createServerSignInClient({
      client: 'extension',
      fetch: makeServer({ device: [json(DEVICE_STARTED)] }).fetch,
    });
    expect(await extensionWithout.start({ url: URL_WS })).toMatchObject({ ok: true, kind: 'device' });

    // The CLI is registered for the device grant only — a user agent changes nothing.
    const cli = createServerSignInClient({
      client: 'cli',
      userAgent: makeUserAgent().agent,
      fetch: makeServer({ device: [json(DEVICE_STARTED)] }).fetch,
    });
    expect(await cli.start({ url: URL_WS })).toMatchObject({ ok: true, kind: 'device' });

    // The desktop is registered for the code grant only — without a browser hop there is no grant to run.
    const desktopHeadless = createServerSignInClient({ client: 'desktop', fetch: makeServer().fetch });
    expect(await desktopHeadless.start({ url: URL_WS })).toEqual({ ok: false, reason: 'error' });
  });
});

describe('the authorization code grant', () => {
  function makeCodeRig(script: ServerScript = {}, label?: () => string) {
    const server = makeServer(script);
    const ua = makeUserAgent();
    const clock = makeClock();
    const api = createServerSignInClient({
      client: 'desktop',
      userAgent: ua.agent,
      fetch: server.fetch,
      randomBytes: makeRandom(),
      now: clock.now,
      deviceLabel: label,
    });
    return { server, ua, clock, api };
  }

  it('opens the authorize URL with the six standard parameters, the S256 challenge and the device label, answering redirect', async () => {
    const { server, ua, api } = makeCodeRig({}, () => '  Daniels-MacBook-Pro  ');
    const started = await api.start({ url: URL_WS });
    expect(started).toMatchObject({ ok: true, kind: 'redirect' });
    expect(server.dials).toHaveLength(1);

    const url = ua.authorizeUrl();
    expect(`${url.origin}${url.pathname}`).toBe(METADATA.authorization_endpoint);
    const params = Object.fromEntries(url.searchParams);
    expect(params).toEqual({
      response_type: 'code',
      client_id: 'openheaders-desktop',
      redirect_uri: REDIRECT_URI,
      state: ua.state(),
      code_challenge: params.code_challenge,
      code_challenge_method: 'S256',
      device_label: 'Daniels-MacBook-Pro',
    });
    expect(params.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(params.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('waits without dialing while the browser leg is open, then redeems the code with the verifier once', async () => {
    const { server, ua, api } = makeCodeRig({
      token: [json({ access_token: 'oh_session', token_type: 'Bearer', expires_in: 2_592_000 })],
    });
    const started = await api.start({ url: URL_WS });
    if (!started.ok) throw new Error('start refused');
    expect(await api.poll({ handle: started.handle })).toEqual({ status: 'pending', retryAfterMs: 1000 });
    expect(server.dials).toHaveLength(1);

    ua.land(`${REDIRECT_URI}?code=one-shot&state=${ua.state()}&iss=${encodeURIComponent(ORIGIN)}`);
    await flush();
    const [first, second] = await Promise.all([
      api.poll({ handle: started.handle }),
      api.poll({ handle: started.handle }),
    ]);
    expect(first).toEqual({ status: 'approved', secret: 'oh_session' });
    expect(second).toEqual(first);

    const redemptions = server.dials.filter((d) => d.url === METADATA.token_endpoint);
    expect(redemptions).toHaveLength(1);
    expect(redemptions[0]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    });
    const form = redemptions[0].form;
    expect(form).toEqual({
      grant_type: 'authorization_code',
      code: 'one-shot',
      code_verifier: form.code_verifier,
      redirect_uri: REDIRECT_URI,
      client_id: 'openheaders-desktop',
    });
    // RFC 7636 §4.2: the challenge the server saw is S256 of the verifier it now receives.
    expect(s256(form.code_verifier)).toBe(ua.authorizeUrl().searchParams.get('code_challenge'));
    // The handle is consumed with the secret.
    expect(await api.poll({ handle: started.handle })).toEqual({ status: 'unknown' });
  });

  it("refuses a redirect whose state or issuer is not ours, and reads the person's refusal as denied", async () => {
    const cases: Array<[(state: string) => string, string]> = [
      [(state) => `${REDIRECT_URI}?code=c&state=${state}x&iss=${encodeURIComponent(ORIGIN)}`, 'abandoned'],
      [(state) => `${REDIRECT_URI}?code=c&state=${state}`, 'abandoned'],
      [
        (state) => `${REDIRECT_URI}?code=c&state=${state}&iss=${encodeURIComponent('http://10.0.0.6:8137')}`,
        'abandoned',
      ],
      [(state) => `${REDIRECT_URI}?error=access_denied&state=${state}&iss=${encodeURIComponent(ORIGIN)}`, 'denied'],
      [(state) => `${REDIRECT_URI}?error=server_error&state=${state}`, 'abandoned'],
      [(state) => `${REDIRECT_URI}?state=${state}&iss=${encodeURIComponent(ORIGIN)}`, 'abandoned'],
    ];
    for (const [redirect, status] of cases) {
      const { server, ua, api } = makeCodeRig();
      const started = await api.start({ url: URL_WS });
      if (!started.ok) throw new Error('start refused');
      ua.land(redirect(ua.state()));
      await flush();
      expect(await api.poll({ handle: started.handle }), status).toEqual({ status });
      expect(server.dials.filter((d) => d.url === METADATA.token_endpoint)).toEqual([]);
      expect(await api.poll({ handle: started.handle })).toEqual({ status: 'unknown' });
    }
  });

  it('a browser leg that ends without a redirect is abandoned; one that outlives the request is expired', async () => {
    const closed = makeCodeRig();
    const started = await closed.api.start({ url: URL_WS });
    if (!started.ok) throw new Error('start refused');
    closed.ua.abort();
    await flush();
    expect(await closed.api.poll({ handle: started.handle })).toEqual({ status: 'abandoned' });

    const slow = makeCodeRig();
    const late = await slow.api.start({ url: URL_WS });
    if (!late.ok) throw new Error('start refused');
    slow.clock.advance(10 * 60 * 1000);
    expect(await slow.api.poll({ handle: late.handle })).toEqual({ status: 'expired' });
    expect(await slow.api.poll({ handle: late.handle })).toEqual({ status: 'unknown' });
  });

  it('a refused redemption is the code running out; a dead socket keeps the code for the next poll', async () => {
    const refused = makeCodeRig({ token: [json({ error: 'invalid_grant' }, 400)] });
    const started = await refused.api.start({ url: URL_WS });
    if (!started.ok) throw new Error('start refused');
    refused.ua.land(`${REDIRECT_URI}?code=stale&state=${refused.ua.state()}&iss=${encodeURIComponent(ORIGIN)}`);
    await flush();
    expect(await refused.api.poll({ handle: started.handle })).toEqual({ status: 'expired' });

    const flaky = makeCodeRig({
      token: [new Error('socket reset'), json({ access_token: 'oh_late', token_type: 'Bearer', expires_in: 1 })],
    });
    const again = await flaky.api.start({ url: URL_WS });
    if (!again.ok) throw new Error('start refused');
    flaky.ua.land(`${REDIRECT_URI}?code=c&state=${flaky.ua.state()}&iss=${encodeURIComponent(ORIGIN)}`);
    await flush();
    expect(await flaky.api.poll({ handle: again.handle })).toEqual({ status: 'offline' });
    expect(await flaky.api.poll({ handle: again.handle })).toEqual({ status: 'approved', secret: 'oh_late' });
    expect(flaky.server.dials.filter((d) => d.url === METADATA.token_endpoint)).toHaveLength(2);
  });

  it('cancel forgets the handle — a redirect landing later is never redeemed', async () => {
    const { server, ua, api } = makeCodeRig();
    const started = await api.start({ url: URL_WS });
    if (!started.ok) throw new Error('start refused');
    await api.cancel({ handle: started.handle });
    ua.land(`${REDIRECT_URI}?code=c&state=${ua.state()}&iss=${encodeURIComponent(ORIGIN)}`);
    await flush();
    expect(await api.poll({ handle: started.handle })).toEqual({ status: 'unknown' });
    expect(server.dials.filter((d) => d.url === METADATA.token_endpoint)).toEqual([]);
  });
});

describe('the device authorization grant', () => {
  function makeDeviceRig(script: ServerScript = {}, label?: () => string) {
    const server = makeServer({ device: [json(DEVICE_STARTED)], ...script });
    const clock = makeClock();
    const api = createServerSignInClient({
      client: 'cli',
      fetch: server.fetch,
      randomBytes: makeRandom(),
      now: clock.now,
      deviceLabel: label,
    });
    return { server, clock, api };
  }

  it('starts on the device endpoint as the registered client with a bounded label, answering the code and the links', async () => {
    const { server, clock, api } = makeDeviceRig({}, () => `  ${'x'.repeat(70)}  `);
    const started = await api.start({ url: URL_WS });
    expect(started).toEqual({
      ok: true,
      kind: 'device',
      handle: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
      userCode: 'BCDF-GHJK',
      verificationUri: DEVICE_STARTED.verification_uri,
      verificationUriComplete: DEVICE_STARTED.verification_uri_complete,
      expiresAt: clock.now() + 300_000,
      intervalSeconds: 5,
    });
    expect(server.dials[1]).toMatchObject({
      url: METADATA.device_authorization_endpoint,
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      form: { client_id: 'openheaders-cli', device_label: 'x'.repeat(64) },
    });
  });

  it("a caller's own label wins and an empty one is omitted", async () => {
    const own = makeDeviceRig({}, () => 'build box');
    await own.api.start({ url: URL_WS, deviceLabel: 'ci runner' });
    expect(own.server.dials[1].form).toEqual({ client_id: 'openheaders-cli', device_label: 'ci runner' });
    const none = makeDeviceRig();
    await none.api.start({ url: URL_WS, deviceLabel: '   ' });
    expect(none.server.dials[1].form).toEqual({ client_id: 'openheaders-cli' });
  });

  it('types every refusal of the start', async () => {
    const cases: Array<[Response | Error, string]> = [
      [json({ error: 'temporarily_unavailable' }, 503), 'too-many-pending'],
      [json({ error: 'forbidden' }, 403), 'forbidden'],
      [json({ error: 'too many failed attempts' }, 429), 'throttled'],
      [new Error('ECONNREFUSED'), 'offline'],
      [json({ error: 'invalid_client' }, 400), 'error'],
      [html(200), 'error'],
      [json({ ...DEVICE_STARTED, device_code: undefined }), 'error'],
      [json({ ...DEVICE_STARTED, verification_uri_complete: undefined }), 'error'],
    ];
    for (const [answer, reason] of cases) {
      const server = makeServer({ device: [answer] });
      const api = createServerSignInClient({ client: 'cli', fetch: server.fetch });
      expect(await api.start({ url: URL_WS }), reason).toEqual({ ok: false, reason });
    }
  });

  it('polls the token endpoint at the interval with the device code, never earlier', async () => {
    const { server, clock, api } = makeDeviceRig({
      token: [json({ error: 'authorization_pending' }, 400), json({ access_token: 'oh_s', token_type: 'Bearer' })],
    });
    const started = await api.start({ url: URL_WS });
    if (!started.ok || started.kind !== 'device') throw new Error('start refused');
    const handle = started.handle;

    // Early polls answer from the clock alone — the server never hears them.
    clock.advance(2_000);
    expect(await api.poll({ handle })).toEqual({ status: 'pending', retryAfterMs: 3_000 });
    expect(server.dials).toHaveLength(2);

    clock.advance(3_000);
    expect(await api.poll({ handle })).toEqual({ status: 'pending', retryAfterMs: 5_000 });
    expect(server.dials[2]).toMatchObject({
      url: METADATA.token_endpoint,
      method: 'POST',
      form: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: 'dev-secret',
        client_id: 'openheaders-cli',
      },
    });
    clock.advance(1_000);
    expect(await api.poll({ handle })).toEqual({ status: 'pending', retryAfterMs: 4_000 });
    expect(server.dials).toHaveLength(3);

    clock.advance(4_000);
    expect(await api.poll({ handle })).toEqual({ status: 'approved', secret: 'oh_s' });
    expect(await api.poll({ handle })).toEqual({ status: 'unknown' });
  });

  it('honours slow_down by growing the interval for every later poll', async () => {
    const { server, clock, api } = makeDeviceRig({
      token: [json({ error: 'slow_down' }, 400), json({ error: 'authorization_pending' }, 400)],
    });
    const started = await api.start({ url: URL_WS });
    if (!started.ok) throw new Error('start refused');
    clock.advance(5_000);
    expect(await api.poll({ handle: started.handle })).toEqual({ status: 'pending', retryAfterMs: 10_000 });
    clock.advance(5_000);
    expect(await api.poll({ handle: started.handle })).toEqual({ status: 'pending', retryAfterMs: 5_000 });
    expect(server.dials).toHaveLength(3);
    clock.advance(5_000);
    expect(await api.poll({ handle: started.handle })).toEqual({ status: 'pending', retryAfterMs: 10_000 });
    expect(server.dials).toHaveLength(4);
  });

  it('maps denied, expired, an unknown device code, a server fault and a dead socket', async () => {
    const cases: Array<[Response | Error, unknown, boolean]> = [
      [json({ error: 'access_denied' }, 400), { status: 'denied' }, false],
      [json({ error: 'expired_token' }, 400), { status: 'expired' }, false],
      [json({ error: 'invalid_grant' }, 400), { status: 'unknown' }, false],
      [json({ error: 'server_error' }, 500), { status: 'pending', retryAfterMs: 5_000 }, true],
      [new Error('socket reset'), { status: 'offline' }, true],
      [html(200), { status: 'offline' }, true],
    ];
    for (const [answer, expected, kept] of cases) {
      const { clock, api } = makeDeviceRig({ token: [answer] });
      const started = await api.start({ url: URL_WS });
      if (!started.ok) throw new Error('start refused');
      clock.advance(5_000);
      expect(await api.poll({ handle: started.handle }), JSON.stringify(expected)).toEqual(expected);
      const next = await api.poll({ handle: started.handle });
      expect(next.status === 'unknown', JSON.stringify(expected)).toBe(!kept);
    }
  });

  it('a wait that would outlive the code is its expiry', async () => {
    const { clock, api } = makeDeviceRig({ token: [json({ error: 'authorization_pending' }, 400)] });
    const started = await api.start({ url: URL_WS });
    if (!started.ok) throw new Error('start refused');
    clock.advance(298_000);
    expect(await api.poll({ handle: started.handle })).toEqual({ status: 'expired' });
  });

  it('concurrent polls share one dial, an unknown handle answers unknown, cancel forgets the handle', async () => {
    const { server, clock, api } = makeDeviceRig({ token: [json({ error: 'authorization_pending' }, 400)] });
    const started = await api.start({ url: URL_WS });
    if (!started.ok) throw new Error('start refused');
    clock.advance(5_000);
    const [a, b] = await Promise.all([api.poll({ handle: started.handle }), api.poll({ handle: started.handle })]);
    expect(a).toEqual(b);
    expect(server.dials).toHaveLength(3);
    expect(await api.poll({ handle: 'nobody' })).toEqual({ status: 'unknown' });
    await api.cancel({ handle: started.handle });
    expect(await api.poll({ handle: started.handle })).toEqual({ status: 'unknown' });
  });
});

describe('signOut', () => {
  it('posts the token to the revocation endpoint the metadata names', async () => {
    const server = makeServer({ revoke: [new Response(null, { status: 200 })] });
    const api = createServerSignInClient({ client: 'extension', fetch: server.fetch });
    expect(await api.signOut({ url: URL_WS, token: 'oh_session' })).toEqual({ ok: true });
    expect(server.dials[1]).toMatchObject({
      url: METADATA.revocation_endpoint,
      method: 'POST',
      form: { token: 'oh_session' },
    });
  });

  it('is not ok when the server refuses, is unreachable, or names no revocation endpoint', async () => {
    const refused = createServerSignInClient({
      client: 'extension',
      fetch: makeServer({ revoke: [json({ error: 'forbidden' }, 403)] }).fetch,
    });
    expect(await refused.signOut({ url: URL_WS, token: 't' })).toEqual({ ok: false });
    const dead = createServerSignInClient({
      client: 'extension',
      fetch: makeServer({ revoke: [new Error('x')] }).fetch,
    });
    expect(await dead.signOut({ url: URL_WS, token: 't' })).toEqual({ ok: false });
    const none = createServerSignInClient({
      client: 'extension',
      fetch: makeServer({ metadata: json({ ...METADATA, revocation_endpoint: undefined }) }).fetch,
    });
    expect(await none.signOut({ url: URL_WS, token: 't' })).toEqual({ ok: false });
  });
});

describe('fetchMeta / fetchJsonDocument', () => {
  it('reads a JSON 2xx at the path on the back-end origin and nulls everything else', async () => {
    const answers: Record<string, Response> = {
      'http://10.0.0.5:8137/auth/oidc/meta': json({ enabled: true, provider: 'Okta' }),
      'http://10.0.0.5:8137/auth/setup/meta': html(200),
      'http://10.0.0.5:8137/auth/password/meta': json({ error: 'forbidden' }, 403),
    };
    const fetchFn = vi.fn(async (url: string) => answers[url] ?? html(404));
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
