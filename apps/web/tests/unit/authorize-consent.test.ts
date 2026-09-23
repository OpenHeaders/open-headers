/**
 * SPA side of the consent contract (the client sign-in plan §14.4) —
 * the fragment entry (one-shot, history-stripped, the SSO refusal
 * beside the id), the facts read, the decision over the session bearer
 * (the code grant's opaque redirect, the device grant's bare ok, the
 * settled-record refusals, the stale bearer), the deny without a
 * credential, the card's state derivation, and the re-gate that drops
 * the session and reloads on the consent fragment.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const tokenModule = vi.hoisted(() => ({
  peekDaemonToken: vi.fn((): string | null => 'oh_session'),
  clearDaemonToken: vi.fn(async () => {}),
}));
vi.mock('@/host/daemon-token', () => tokenModule);

const storageModule = vi.hoisted(() => ({
  hostStorage: { remove: vi.fn(async () => {}) },
  OH: { joinedOrgs: 'oh.joinedOrgs', webBackendToken: 'oh.webBackendToken' },
}));
vi.mock('@openheaders/core/storage', () => storageModule);

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  approveAuthorization,
  authorizeLocation,
  consentStateFromRead,
  consentStateFromRefusal,
  consumeAuthorizeHash,
  denyAuthorization,
  fetchAuthorizationFacts,
  reGateWithAuthorization,
} from '@/host/authorize-consent';
import { startOidcLogin } from '@/host/oidc-login';

const FACTS = {
  id: 'abc_123',
  clientId: 'openheaders-extension',
  clientKind: 'extension',
  clientName: 'the browser extension',
  grant: 'device',
  deviceLabel: 'Chrome · macOS',
  userCode: 'BCDF-GHJK',
  peer: '172.17.0.1',
  status: 'pending',
  expiresAt: 1_800_000_000_000,
} as const;

interface Call {
  url: string;
  init: RequestInit;
}

function stubFetch(status: number, body: unknown, calls: Call[] = []): typeof fetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

const offlineFetch = vi.fn(async () => {
  throw new Error('offline');
}) as unknown as typeof fetch;

describe('consumeAuthorizeHash', () => {
  it('consumes the id and strips the fragment from the URL', () => {
    const replaced: string[] = [];
    expect(consumeAuthorizeHash({ hash: '#authorize=abc_123' }, (url) => replaced.push(url))).toEqual({
      id: 'abc_123',
    });
    expect(replaced).toEqual(['/']);
  });

  it('carries the SSO refusal that landed beside the id', () => {
    const replaced: string[] = [];
    expect(
      consumeAuthorizeHash({ hash: '#authorize=abc_123&error=unknown-user' }, (url) => replaced.push(url)),
    ).toEqual({ id: 'abc_123', error: 'unknown-user' });
    expect(replaced).toEqual(['/']);
  });

  it('strips an empty id and yields nothing to decide', () => {
    const replaced: string[] = [];
    expect(consumeAuthorizeHash({ hash: '#authorize=' }, (url) => replaced.push(url))).toBeNull();
    expect(replaced).toEqual(['/']);
  });

  it('leaves unrelated hashes alone — the OIDC fragments included', () => {
    const replaced: string[] = [];
    expect(consumeAuthorizeHash({ hash: '' }, (url) => replaced.push(url))).toBeNull();
    expect(consumeAuthorizeHash({ hash: '#oidc=claim' }, (url) => replaced.push(url))).toBeNull();
    expect(consumeAuthorizeHash({ hash: '#some-anchor' }, (url) => replaced.push(url))).toBeNull();
    expect(replaced).toEqual([]);
  });

  it('rebuilds the fragment the boot lands on', () => {
    expect(authorizeLocation('abc_123')).toBe('/#authorize=abc_123');
  });
});

describe('fetchAuthorizationFacts', () => {
  it('reads the facts as JSON from the record route', async () => {
    const calls: Call[] = [];
    const read = await fetchAuthorizationFacts('abc_123', stubFetch(200, { ok: true, authorization: FACTS }, calls));
    expect(read).toEqual({ ok: true, facts: FACTS });
    expect(calls[0].url).toBe('/auth/oauth/authorize/abc_123');
    expect(calls[0].init.method).toBe('GET');
    expect((calls[0].init.headers as Record<string, string>).Accept).toBe('application/json');
  });

  it('reads a 404 as an unknown id', async () => {
    expect(await fetchAuthorizationFacts('nope', stubFetch(404, { ok: false }))).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('reads an unreachable server, a refusal, or a malformed answer as offline', async () => {
    expect(await fetchAuthorizationFacts('abc_123', offlineFetch)).toEqual({ ok: false, reason: 'offline' });
    expect(await fetchAuthorizationFacts('abc_123', stubFetch(500, {}))).toEqual({ ok: false, reason: 'offline' });
    expect(
      await fetchAuthorizationFacts('abc_123', stubFetch(200, { ok: true, authorization: { id: 'abc_123' } })),
    ).toEqual({ ok: false, reason: 'offline' });
  });
});

describe('approveAuthorization', () => {
  beforeEach(() => {
    tokenModule.peekDaemonToken.mockReturnValue('oh_session');
  });

  it('posts an empty JSON body with the session bearer and answers the code grant’s redirect', async () => {
    const calls: Call[] = [];
    const outcome = await approveAuthorization(
      'abc_123',
      stubFetch(200, { ok: true, redirectTo: 'http://127.0.0.1:4321/oauth/callback?code=x&state=s' }, calls),
    );
    expect(outcome).toEqual({ ok: true, redirectTo: 'http://127.0.0.1:4321/oauth/callback?code=x&state=s' });
    expect(calls[0].url).toBe('/auth/oauth/authorize/abc_123/approve');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBe('{}');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer oh_session');
    expect(headers['content-type']).toBe('application/json');
  });

  it('answers the device grant with no redirect', async () => {
    expect(await approveAuthorization('abc_123', stubFetch(200, { ok: true }))).toEqual({ ok: true, redirectTo: null });
  });

  it('reads a 401 as the bearer refused, never as the record', async () => {
    expect(await approveAuthorization('abc_123', stubFetch(401, { error: 'invalid_token' }))).toEqual({
      ok: false,
      reason: 'session-refused',
    });
  });

  it('refuses without a fetch when this tab holds no session', async () => {
    tokenModule.peekDaemonToken.mockReturnValue(null);
    const calls: Call[] = [];
    expect(await approveAuthorization('abc_123', stubFetch(200, { ok: true }, calls))).toEqual({
      ok: false,
      reason: 'session-refused',
    });
    expect(calls).toEqual([]);
  });

  it('carries the settled-record refusals by status and reason', async () => {
    expect(await approveAuthorization('abc_123', stubFetch(410, { ok: false, reason: 'denied' }))).toEqual({
      ok: false,
      reason: 'denied',
    });
    expect(await approveAuthorization('abc_123', stubFetch(410, { ok: false, reason: 'consumed' }))).toEqual({
      ok: false,
      reason: 'consumed',
    });
    expect(await approveAuthorization('abc_123', stubFetch(410, { ok: false, reason: 'expired' }))).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(await approveAuthorization('nope', stubFetch(404, { ok: false, reason: 'unknown' }))).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('reads an unreachable server or a server fault as offline', async () => {
    expect(await approveAuthorization('abc_123', offlineFetch)).toEqual({ ok: false, reason: 'offline' });
    expect(await approveAuthorization('abc_123', stubFetch(500, { error: 'server_error' }))).toEqual({
      ok: false,
      reason: 'offline',
    });
  });
});

describe('denyAuthorization', () => {
  it('posts a JSON body with no credential and settles the record; the code grant answers the redirect', async () => {
    const calls: Call[] = [];
    expect(await denyAuthorization('abc_123', stubFetch(200, { ok: true }, calls))).toEqual({
      ok: true,
      redirectTo: null,
    });
    expect(
      await denyAuthorization(
        'abc_123',
        stubFetch(200, { ok: true, redirectTo: 'http://127.0.0.1:52111/oauth/callback?error=access_denied&state=s' }),
      ),
    ).toEqual({ ok: true, redirectTo: 'http://127.0.0.1:52111/oauth/callback?error=access_denied&state=s' });
    expect(calls[0].url).toBe('/auth/oauth/authorize/abc_123/deny');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect((calls[0].init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('carries the settled-record refusals and reads a fault as offline', async () => {
    expect(await denyAuthorization('abc_123', stubFetch(410, { ok: false, reason: 'consumed' }))).toEqual({
      ok: false,
      reason: 'consumed',
    });
    expect(await denyAuthorization('nope', stubFetch(404, { ok: false, reason: 'unknown' }))).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(await denyAuthorization('abc_123', offlineFetch)).toEqual({ ok: false, reason: 'offline' });
  });
});

describe('the card’s state', () => {
  it('draws a pending record as the card and a settled one as its verdict', () => {
    expect(consentStateFromRead({ ok: true, facts: FACTS })).toEqual({ kind: 'pending', facts: FACTS });
    expect(consentStateFromRead({ ok: true, facts: { ...FACTS, status: 'approved' } })).toEqual({ kind: 'approved' });
    expect(consentStateFromRead({ ok: true, facts: { ...FACTS, status: 'consumed' } })).toEqual({ kind: 'approved' });
    expect(consentStateFromRead({ ok: true, facts: { ...FACTS, status: 'denied' } })).toEqual({ kind: 'denied' });
    expect(consentStateFromRead({ ok: true, facts: { ...FACTS, status: 'expired' } })).toEqual({ kind: 'expired' });
    expect(consentStateFromRead({ ok: false, reason: 'unknown' })).toEqual({ kind: 'unknown' });
    expect(consentStateFromRead({ ok: false, reason: 'offline' })).toEqual({ kind: 'offline' });
  });

  it('settles from a decision’s refusal — a consumed record is an approval the client redeemed', () => {
    expect(consentStateFromRefusal('unknown')).toEqual({ kind: 'unknown' });
    expect(consentStateFromRefusal('expired')).toEqual({ kind: 'expired' });
    expect(consentStateFromRefusal('denied')).toEqual({ kind: 'denied' });
    expect(consentStateFromRefusal('consumed')).toEqual({ kind: 'approved' });
  });
});

describe('reGateWithAuthorization', () => {
  beforeEach(() => {
    tokenModule.clearDaemonToken.mockClear();
    storageModule.hostStorage.remove.mockClear();
  });

  it('drops the session as a sign-out does, then navigates with the id kept', async () => {
    const navigate = vi.fn();
    await reGateWithAuthorization('abc_123', navigate);
    expect(tokenModule.clearDaemonToken).toHaveBeenCalledOnce();
    expect(storageModule.hostStorage.remove).toHaveBeenCalledWith(storageModule.OH.joinedOrgs);
    expect(navigate).toHaveBeenCalledOnce();
  });
});

describe('startOidcLogin on the authorization arm', () => {
  it('carries the id on the start URL, alone and beside a personal-seat key', () => {
    const urls: string[] = [];
    startOidcLogin((url) => urls.push(url), { authorizationId: 'abc_123' });
    startOidcLogin((url) => urls.push(url), { personalLicense: ' oh-license.k ', authorizationId: 'abc_123' });
    startOidcLogin((url) => urls.push(url), { personalLicense: 'oh-license.k' });
    startOidcLogin((url) => urls.push(url));
    expect(urls).toEqual([
      '/auth/oidc/start?authorize=abc_123',
      '/auth/oidc/start?individual_license=oh-license.k&authorize=abc_123',
      '/auth/oidc/start?individual_license=oh-license.k',
      '/auth/oidc/start',
    ]);
  });
});
