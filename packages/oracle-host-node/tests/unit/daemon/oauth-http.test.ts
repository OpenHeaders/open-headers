/**
 * The daemon's authorization server over a real loopback socket
 * composed behind admission (the client sign-in plan §14.2): the RFC
 * 8414 metadata, the authorize entry parking a request and handing the
 * browser to the consent rendering (the SPA's fragment where the web
 * app can boot, the server-rendered page elsewhere), the device grant's
 * start and verify page, the consent page in each gate state, the
 * decision by the page's credential form and by the SPA's session
 * bearer, the token endpoint's two grants with the RFC error
 * vocabulary and the handler-reported guesses, and revoke. The law
 * every page keeps: the token is never on it — the code alone yields
 * nothing, the verifier or the device code binds the client, the mint
 * happens at the token endpoint.
 */

import { createServer, request as httpRequest, type Server } from 'node:http';
import {
  type AuditEntryInput,
  createDaemonAuthorizationService,
  createDaemonUser,
  DAEMON_CLI_CLIENT_ID,
  DAEMON_DESKTOP_CLIENT_ID,
  DAEMON_EXTENSION_CLIENT_ID,
  type DaemonAuthorizationService,
  ensureSyntheticIdentity,
  listDaemonAuthTokens,
  mintDaemonAuthToken,
  setDaemonUserPassword,
  validateDaemonAuthToken,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { computeCodeChallenge, DEVICE_CODE_GRANT_TYPE, generateCodeVerifier } from '@openheaders/core/oauth';
import { CHROME_EXTENSION_ID } from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAdmissionControl } from '../../../src/daemon/admission-control';
import { createGateModeResolver, type GateModeResolver } from '../../../src/daemon/gate-mode';
import { createConsentRouter, isLoopbackHostHeader } from '../../../src/daemon/oauth/consent-route';
import { createOAuthHttp } from '../../../src/daemon/oauth/oauth-http';
import { createDaemonPasswordLoginService } from '../../../src/daemon/password/password-login-service';
import { hashPassword } from '../../../src/daemon/password/password-verifier';
import { createDaemonSetupClaimService } from '../../../src/daemon/setup/setup-claim-service';
import { createHostStorageFake } from '../_host-storage-fake';

const REDIRECT = 'http://127.0.0.1:8137/oauth/callback';

interface Rig {
  readonly origin: string;
  readonly port: number;
  readonly authorization: DaemonAuthorizationService;
  readonly audited: AuditEntryInput[];
  advance(ms: number): void;
}

interface RigOptions {
  /** An IdP is configured — the page offers the provider, the password form is absent. */
  ssoProvider?: string;
  gateMode?: GateModeResolver;
  limiter?: { maxFailures: number; windowMs: number; blockMs: number };
  spaServed?: boolean;
  trustedProxy?: boolean;
}

let server: Server | null = null;

async function startRig(options: RigOptions = {}): Promise<Rig> {
  let now = Date.now();
  let ids = 0;
  let codes = 0;
  // The first device start reads BCDF-GHJK; later starts in one rig take the next letters.
  const authorization = createDaemonAuthorizationService({
    now: () => now,
    generateId: () => `auth-${++ids}`,
    generateUserCode: () => `BCDF-GHJ${'KLMNPQRSTVWXZ'[codes++ % 13]}`,
    sessionTtlMs: 60_000,
  });
  const audited: AuditEntryInput[] = [];
  const oidcConfigured = options.ssoProvider !== undefined;
  const passwordLogin = oidcConfigured ? null : createDaemonPasswordLoginService();
  const setup = createDaemonSetupClaimService({
    oidcConfigured,
    listWorkspaceIds: () => [],
    closePeersByTokenId: () => undefined,
  });
  const gateMode =
    options.gateMode ??
    createGateModeResolver({
      ssoProvider: options.ssoProvider === undefined ? null : () => options.ssoProvider ?? '',
      setupMeta: (peerIsLoopback) => setup.meta(peerIsLoopback),
      passwordEnabled: () => passwordLogin?.enabled() ?? Promise.resolve(false),
    });
  const admission = createAdmissionControl({
    passwordEnabled: !oidcConfigured,
    oidcEnabled: oidcConfigured,
    webEnabled: options.spaServed ?? false,
    ...(options.trustedProxy ? { trustedProxy: true } : {}),
    ...(options.limiter ? { limiter: options.limiter } : {}),
  });
  const oauth = createOAuthHttp({
    authorization,
    resolvePeer: admission.resolvePeer,
    gateMode,
    passwordLogin,
    consent: createConsentRouter({
      spaServed: () => options.spaServed ?? false,
      ...(options.trustedProxy ? { trustedProxy: true } : {}),
    }),
    ...(options.trustedProxy ? { trustedProxy: true } : {}),
    reportGuess: admission.recordFailure,
    emitAudit: (entry) => audited.push(entry),
  });
  const wrapped = admission.wrapHttpHandler((req, res) => oauth.handler(req, res));
  server = createServer((req, res) => {
    if (!wrapped(req, res)) {
      res.statusCode = 400;
      res.end();
    }
  });
  const port = await new Promise<number>((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(0, '127.0.0.1', () => {
      const addr = server?.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    authorization,
    audited,
    advance: (ms) => {
      now += ms;
    },
  };
}

interface Pkce {
  readonly verifier: string;
  readonly challenge: string;
}

async function pkce(): Promise<Pkce> {
  const verifier = generateCodeVerifier((n) => crypto.getRandomValues(new Uint8Array(n)));
  const challenge = await computeCodeChallenge(verifier, async (bytes) => {
    const buf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buf).set(bytes);
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  });
  return { verifier, challenge };
}

function authorizeUrl(rig: Rig, challenge: string, overrides: Record<string, string | null> = {}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: DAEMON_DESKTOP_CLIENT_ID,
    redirect_uri: REDIRECT,
    state: 'st-1',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    device_label: 'Work laptop',
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return `${rig.origin}/auth/oauth/authorize?${params.toString()}`;
}

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, { headers, redirect: 'manual' });
}

async function postForm(url: string, body: Record<string, string>, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(body).toString(),
    redirect: 'manual',
  });
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
}

/** fetch (undici) refuses to override Host, so drive node:http directly. */
function getWithHost(
  rig: Rig,
  path: string,
  headers: Record<string, string>,
): Promise<{ status: number; location: string | undefined }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(`${rig.origin}${path}`, { headers }, (res) => {
      res.resume();
      resolve({ status: res.statusCode ?? 0, location: res.headers.location });
    });
    req.on('error', reject);
    req.end();
  });
}

async function addPasswordUser(email: string, password: string): Promise<string> {
  const created = await createDaemonUser({ displayName: 'Alice', email });
  if (!created.ok) throw new Error(`setup failed: ${created.reason}`);
  const set = await setDaemonUserPassword(created.record.user.id, await hashPassword(password));
  if (!set.ok) throw new Error(`setup failed: ${set.reason}`);
  return created.record.user.id;
}

async function parkedCode(rig: Rig, challenge: string): Promise<string> {
  const response = await get(authorizeUrl(rig, challenge));
  expect(response.status).toBe(302);
  const location = response.headers.get('location') ?? '';
  expect(location).toBe('/auth/oauth/authorize/auth-1');
  return 'auth-1';
}

interface DeviceStarted {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

async function startedDevice(rig: Rig, clientId = DAEMON_CLI_CLIENT_ID): Promise<DeviceStarted> {
  const response = await postForm(`${rig.origin}/auth/oauth/device`, { client_id: clientId, device_label: 'ci-box' });
  expect(response.status).toBe(200);
  return (await response.json()) as DeviceStarted;
}

async function pollToken(rig: Rig, deviceCode: string, clientId = DAEMON_CLI_CLIENT_ID): Promise<Response> {
  return postForm(`${rig.origin}/auth/oauth/token`, {
    grant_type: DEVICE_CODE_GRANT_TYPE,
    device_code: deviceCode,
    client_id: clientId,
  });
}

beforeEach(async () => {
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
  setHostStorage(createHostStorageFake());
  await ensureSyntheticIdentity({ hostKind: 'daemon' });
});

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

describe('the metadata document (RFC 8414)', () => {
  it('names the issuer as the origin the client reached and the endpoints under it; served no-store to any Host', async () => {
    const rig = await startRig();
    const response = await get(`${rig.origin}/.well-known/oauth-authorization-server`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      issuer: rig.origin,
      authorization_endpoint: `${rig.origin}/auth/oauth/authorize`,
      token_endpoint: `${rig.origin}/auth/oauth/token`,
      device_authorization_endpoint: `${rig.origin}/auth/oauth/device`,
      revocation_endpoint: `${rig.origin}/auth/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', DEVICE_CODE_GRANT_TYPE],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
    expect((await getWithHost(rig, '/.well-known/oauth-authorization-server', { host: 'oh.example' })).status).toBe(
      200,
    );
    const fromExtension = await get(`${rig.origin}/.well-known/oauth-authorization-server`, {
      origin: `chrome-extension://${CHROME_EXTENSION_ID}`,
    });
    expect(fromExtension.status).toBe(200);
    expect((await fetch(`${rig.origin}/.well-known/oauth-authorization-server`, { method: 'POST' })).status).toBe(405);
  });

  it('behind a trusted proxy the issuer takes the forwarded scheme', async () => {
    const rig = await startRig({ trustedProxy: true });
    const response = await get(`${rig.origin}/.well-known/oauth-authorization-server`, {
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '203.0.113.9',
    });
    const body = (await response.json()) as { issuer: string; token_endpoint: string };
    expect(body.issuer).toBe(`https://127.0.0.1:${rig.port}`);
    expect(body.token_endpoint).toBe(`https://127.0.0.1:${rig.port}/auth/oauth/token`);
  });
});

describe('the authorize entry', () => {
  it('parks a valid request and hands the browser to the server-rendered page when the web app is not served', async () => {
    const rig = await startRig();
    const { challenge } = await pkce();
    const response = await get(authorizeUrl(rig, challenge));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/auth/oauth/authorize/auth-1');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(rig.authorization.facts('auth-1')).toMatchObject({
      clientId: DAEMON_DESKTOP_CLIENT_ID,
      grant: 'code',
      deviceLabel: 'Work laptop',
      peer: '127.0.0.1',
      status: 'pending',
    });
  });

  it("hands the browser to the SPA's fragment entry where the web app can boot: a loopback Host or an https scheme, never a plain-http LAN address", async () => {
    const rig = await startRig({ spaServed: true, trustedProxy: true });
    const { challenge } = await pkce();
    const path = authorizeUrl(rig, challenge).slice(rig.origin.length);
    const loopback = await getWithHost(rig, path, { host: `127.0.0.1:${rig.port}` });
    expect(loopback).toEqual({ status: 302, location: '/#authorize=auth-1' });
    const localhost = await getWithHost(rig, path, { host: `localhost:${rig.port}` });
    expect(localhost).toEqual({ status: 302, location: '/#authorize=auth-2' });
    const lan = await getWithHost(rig, path, { host: '192.168.1.20:8137' });
    expect(lan).toEqual({ status: 302, location: '/auth/oauth/authorize/auth-3' });
    const tls = await getWithHost(rig, path, { host: '192.168.1.20:8137', 'x-forwarded-proto': 'https' });
    expect(tls).toEqual({ status: 302, location: '/#authorize=auth-4' });
    expect(isLoopbackHostHeader('[::1]:8137')).toBe(true);
    expect(isLoopbackHostHeader('app.localhost')).toBe(true);
    expect(isLoopbackHostHeader('10.0.0.1')).toBe(false);
    expect(isLoopbackHostHeader(undefined)).toBe(false);
  });

  it('refuses a malformed request ON THE PAGE — never a redirect — naming the reason; GET only', async () => {
    const rig = await startRig();
    const { challenge } = await pkce();
    const cases: Array<[Record<string, string | null>, string]> = [
      [{ response_type: 'token' }, 'response type this server does not issue'],
      [{ client_id: 'openheaders-phone' }, 'a client this server does not know'],
      [{ client_id: DAEMON_CLI_CLIENT_ID }, 'cannot use this sign-in'],
      [{ redirect_uri: 'http://evil.openheaders.io/oauth/callback' }, 'not registered for its client'],
      [{ state: null }, 'carries no state'],
      [{ code_challenge_method: 'plain' }, 'no valid S256 code challenge'],
      [{ code_challenge: 'short' }, 'no valid S256 code challenge'],
      [{ device_label: 'x'.repeat(65) }, 'over-long device label'],
    ];
    for (const [overrides, line] of cases) {
      const response = await get(authorizeUrl(rig, challenge, overrides));
      expect(response.status).toBe(400);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(await response.text()).toContain(line);
    }
    expect(rig.authorization.list()).toEqual([]);
    expect((await fetch(authorizeUrl(rig, challenge), { method: 'POST' })).status).toBe(405);
  });

  it('refuses a foreign page at admission and answers 503 once the caps are full', async () => {
    const rig = await startRig();
    const { challenge } = await pkce();
    const forged = await get(authorizeUrl(rig, challenge), { origin: 'https://evil.example.com' });
    expect(forged.status).toBe(403);
    for (let k = 0; k < 4; k++) expect((await get(authorizeUrl(rig, challenge))).status).toBe(302);
    const full = await get(authorizeUrl(rig, challenge));
    expect(full.status).toBe(503);
    expect(await full.text()).toContain('Too many sign-ins are waiting');
  });
});

describe('the record and the consent page', () => {
  it('answers the public facts as JSON to the SPA and 404 for an unknown id; the facts carry no secret', async () => {
    const rig = await startRig();
    const { challenge } = await pkce();
    const id = await parkedCode(rig, challenge);
    const response = await get(`${rig.origin}/auth/oauth/authorize/${id}`, { accept: 'application/json' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; authorization: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(body.authorization).toEqual({
      id,
      clientId: DAEMON_DESKTOP_CLIENT_ID,
      clientKind: 'desktop',
      clientName: 'the desktop app',
      grant: 'code',
      deviceLabel: 'Work laptop',
      peer: '127.0.0.1',
      status: 'pending',
      expiresAt: expect.any(Number),
    });
    expect(JSON.stringify(body)).not.toContain(challenge);
    const unknown = await get(`${rig.origin}/auth/oauth/authorize/nope`, { accept: 'application/json' });
    expect(unknown.status).toBe(404);
    expect((await get(`${rig.origin}/auth/oauth/authorize/nope`)).status).toBe(404);
  });

  it('password mode: names the device and the client kind, offers the form and Not me, no code on the code grant, never a secret', async () => {
    await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    const { challenge } = await pkce();
    const id = await parkedCode(rig, challenge);
    const page = await get(`${rig.origin}/auth/oauth/authorize/${id}`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.headers.get('x-frame-options')).toBe('DENY');
    expect(page.headers.get('referrer-policy')).toBe('same-origin');
    const html = await page.text();
    expect(html).toContain('Approve this device?');
    expect(html).toContain('Work laptop');
    expect(html).toContain('the desktop app');
    expect(html).not.toContain('a different device');
    expect(html).not.toContain('check that it matches');
    expect(html).toContain(`action="/auth/oauth/authorize/${id}/approve"`);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('Not me');
    expect(html).toContain(`action="/auth/oauth/authorize/${id}/deny"`);
    expect(html).not.toContain('/auth/oidc/start');
    expect(html).not.toContain(challenge);
  });

  it('the device grant shows the user code and asks the person to check it; an unnamed CLI leads the sentence', async () => {
    await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    const started = await postForm(`${rig.origin}/auth/oauth/device`, { client_id: DAEMON_CLI_CLIENT_ID });
    expect(started.status).toBe(200);
    const html = await (await get(`${rig.origin}/auth/oauth/authorize/auth-1`)).text();
    expect(html).toContain('The command-line tool asked to sign in to this server as you.');
    expect(html).toContain('<code>BCDF-GHJK</code>');
    expect(html).toContain('check that it matches the code your device shows');
    expect(html).not.toContain(((await started.json()) as DeviceStarted).device_code);
  });

  it('a request from a different peer than the approving browser is called out — the phishing check', async () => {
    const rig = await startRig();
    const begun = await rig.authorization.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: '10.0.0.7' });
    if (!begun.ok) throw new Error('begin failed');
    const html = await (await get(`${rig.origin}/auth/oauth/authorize/${begun.id}`)).text();
    expect(html).toContain('This request came from a different device at <code>10.0.0.7</code>.');
    expect(html).toContain('click Not me');
  });

  it('unclaimed: says there is no administrator and points at the claim', async () => {
    const rig = await startRig();
    const { challenge } = await pkce();
    const id = await parkedCode(rig, challenge);
    const html = await (await get(`${rig.origin}/auth/oauth/authorize/${id}`)).text();
    expect(html).toContain('This server has no administrator yet.');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('name="password"');
  });

  it('SSO: offers the provider link into the OIDC start carrying the authorization id, renders its refusal as a fixed sentence', async () => {
    const rig = await startRig({ ssoProvider: 'Stub SSO' });
    const { challenge } = await pkce();
    const id = await parkedCode(rig, challenge);
    const html = await (await get(`${rig.origin}/auth/oauth/authorize/${id}`)).text();
    expect(html).toContain('Sign in with Stub SSO');
    expect(html).toContain(`href="/auth/oidc/start?authorize=${id}"`);
    expect(html).toContain('Not me');
    expect(html).not.toContain('name="password"');
    const known = await (await get(`${rig.origin}/auth/oauth/authorize/${id}?error=unknown-user`)).text();
    expect(known).toContain('That account is not a user on this server.');
    const unknown = await (
      await get(`${rig.origin}/auth/oauth/authorize/${id}?error=%3Cscript%3Ecall%20us%3C%2Fscript%3E`)
    ).text();
    expect(unknown).toContain('The sign-in did not complete. Try again.');
    expect(unknown).not.toContain('call us');
  });

  it('no-login: a claimed server with no password holder says so and offers nothing', async () => {
    await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    const rig = await startRig();
    const { challenge } = await pkce();
    const id = await parkedCode(rig, challenge);
    const html = await (await get(`${rig.origin}/auth/oauth/authorize/${id}`)).text();
    expect(html).toContain('Nobody can sign in to this server from a browser.');
    expect(html).not.toContain('name="password"');
    expect(html).not.toContain('/auth/oidc/start');
  });
});

describe('the code grant end to end — the page approves, the token endpoint mints', () => {
  it('approve by the credential form 303s to the registered redirect with code, state and iss; the verifier redeems ONCE', async () => {
    const userId = await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    const { verifier, challenge } = await pkce();
    const id = await parkedCode(rig, challenge);

    const approved = await postForm(`${rig.origin}/auth/oauth/authorize/${id}/approve`, {
      email: 'alice@openheaders.io',
      password: 'alice-password-1',
    });
    expect(approved.status).toBe(303);
    const target = new URL(approved.headers.get('location') ?? '');
    expect(`${target.origin}${target.pathname}`).toBe(REDIRECT);
    expect(target.searchParams.get('state')).toBe('st-1');
    expect(target.searchParams.get('iss')).toBe(rig.origin);
    const code = target.searchParams.get('code') ?? '';
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Approval minted nothing and signed the browser into nothing.
    expect(await listDaemonAuthTokens()).toHaveLength(0);
    expect(approved.headers.get('set-cookie')).toBeNull();
    expect(rig.audited).toEqual([
      { actorUserId: userId, capability: 'daemon.device-login', decision: { allow: true } },
    ]);
    // The page now reads approved and still carries nothing.
    const pageAfter = await (await get(`${rig.origin}/auth/oauth/authorize/${id}`)).text();
    expect(pageAfter).toContain('Device approved');
    expect(pageAfter).not.toContain(code);

    const wrongVerifier = await postForm(`${rig.origin}/auth/oauth/token`, {
      grant_type: 'authorization_code',
      code,
      code_verifier: 'not-the-verifier-not-the-verifier-not-the-verifier',
      redirect_uri: REDIRECT,
      client_id: DAEMON_DESKTOP_CLIENT_ID,
    });
    expect(wrongVerifier.status).toBe(400);
    expect(await wrongVerifier.json()).toEqual({ error: 'invalid_grant' });
    expect(await listDaemonAuthTokens()).toHaveLength(0);

    const minted = await postForm(`${rig.origin}/auth/oauth/token`, {
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT,
      client_id: DAEMON_DESKTOP_CLIENT_ID,
    });
    expect(minted.status).toBe(200);
    expect(minted.headers.get('cache-control')).toBe('no-store');
    expect(minted.headers.get('pragma')).toBe('no-cache');
    const payload = (await minted.json()) as { access_token: string; token_type: string; expires_in: number };
    expect(payload.token_type).toBe('Bearer');
    expect(payload.access_token).toMatch(/^oh_/);
    expect(payload.expires_in).toBeGreaterThan(50);
    expect(payload.expires_in).toBeLessThanOrEqual(60);
    const validated = await validateDaemonAuthToken(payload.access_token);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.userId).toBe(userId);
    const [token] = await listDaemonAuthTokens();
    expect(token).toMatchObject({ kind: 'session', userId, label: 'device:desktop:Work laptop' });

    // One-shot: the replay is an invalid_grant and mints nothing more.
    const replay = await postForm(`${rig.origin}/auth/oauth/token`, {
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT,
      client_id: DAEMON_DESKTOP_CLIENT_ID,
    });
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: 'invalid_grant' });
    expect(await listDaemonAuthTokens()).toHaveLength(1);
  });

  it("approve by the SPA's session bearer answers the redirect target as JSON — the person never retypes a credential", async () => {
    const userId = await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const session = await mintDaemonAuthToken({ userId, kind: 'session', label: 'sso:alice' });
    const rig = await startRig({ spaServed: true });
    const { verifier, challenge } = await pkce();
    const entry = await get(authorizeUrl(rig, challenge));
    expect(entry.headers.get('location')).toBe('/#authorize=auth-1');
    const approved = await postJson(
      `${rig.origin}/auth/oauth/authorize/auth-1/approve`,
      {},
      { authorization: `Bearer ${session.secret}`, origin: rig.origin },
    );
    expect(approved.status).toBe(200);
    const body = (await approved.json()) as { ok: boolean; redirectTo: string };
    expect(body.ok).toBe(true);
    const target = new URL(body.redirectTo);
    expect(`${target.origin}${target.pathname}`).toBe(REDIRECT);
    expect(target.searchParams.get('iss')).toBe(rig.origin);
    expect(rig.audited).toEqual([
      { actorUserId: userId, capability: 'daemon.device-login', decision: { allow: true } },
    ]);
    const minted = await postJson(`${rig.origin}/auth/oauth/token`, {
      grant_type: 'authorization_code',
      code: target.searchParams.get('code'),
      code_verifier: verifier,
      redirect_uri: REDIRECT,
      client_id: DAEMON_DESKTOP_CLIENT_ID,
    });
    expect(minted.status).toBe(200);
    expect((await listDaemonAuthTokens()).map((t) => t.label)).toEqual(['sso:alice', 'device:desktop:Work laptop']);
    // A decided record refuses a second decision; an unknown id is 404.
    const again = await postJson(
      `${rig.origin}/auth/oauth/authorize/auth-1/approve`,
      {},
      { authorization: `Bearer ${session.secret}` },
    );
    expect(again.status).toBe(410);
    expect(await again.json()).toEqual({ ok: false, reason: 'consumed' });
    const unknown = await postJson(
      `${rig.origin}/auth/oauth/authorize/nope/approve`,
      {},
      { authorization: `Bearer ${session.secret}` },
    );
    expect(unknown.status).toBe(404);
  });

  it('a refused bearer is a counted 401 that binds nothing; a deactivated or unknown binding is refused alike', async () => {
    const rig = await startRig({ limiter: { maxFailures: 2, windowMs: 60_000, blockMs: 120_000 } });
    const { challenge } = await pkce();
    const id = await parkedCode(rig, challenge);
    const stale = await mintDaemonAuthToken({ userId: 'user-gone', kind: 'session' });
    const bad = await postJson(
      `${rig.origin}/auth/oauth/authorize/${id}/approve`,
      {},
      { authorization: 'Bearer oh_nope' },
    );
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: 'invalid_token' });
    const gone = await postJson(
      `${rig.origin}/auth/oauth/authorize/${id}/approve`,
      {},
      { authorization: `Bearer ${stale.secret}` },
    );
    expect(gone.status).toBe(401);
    expect(rig.authorization.facts(id)?.status).toBe('pending');
    expect(rig.audited).toEqual([]);
    const throttled = await postJson(
      `${rig.origin}/auth/oauth/authorize/${id}/approve`,
      {},
      { authorization: 'Bearer x' },
    );
    expect(throttled.status).toBe(429);
  });

  it('every refused credential on the form answers ONE uniform 401 page, binds nothing and counts', async () => {
    await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig({ limiter: { maxFailures: 3, windowMs: 60_000, blockMs: 120_000 } });
    const { challenge } = await pkce();
    const id = await parkedCode(rig, challenge);
    const approve = `${rig.origin}/auth/oauth/authorize/${id}/approve`;
    const wrong = await postForm(approve, { email: 'alice@openheaders.io', password: 'nope-nope-nope' });
    const unknown = await postForm(approve, { email: 'nobody@openheaders.io', password: 'alice-password-1' });
    const malformed = await fetch(approve, { method: 'POST', body: 'email=only' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(malformed.status).toBe(401);
    const wrongHtml = await wrong.text();
    expect(wrongHtml).toBe(await unknown.text());
    expect(wrongHtml).toBe(await malformed.text());
    expect(wrongHtml).toContain('Sign-in refused');
    expect(wrongHtml).toContain(`href="/auth/oauth/authorize/${id}"`);
    expect(rig.authorization.facts(id)?.status).toBe('pending');
    expect(rig.audited).toEqual([]);
    expect((await postForm(approve, { email: 'alice@openheaders.io', password: 'x' })).status).toBe(429);
  });

  it('under SSO the credential form does not exist: 404, nothing bound; the bearer arm still approves', async () => {
    const userId = await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const session = await mintDaemonAuthToken({ userId, kind: 'session' });
    const rig = await startRig({ ssoProvider: 'Stub SSO' });
    const { challenge } = await pkce();
    const id = await parkedCode(rig, challenge);
    const posted = await postForm(`${rig.origin}/auth/oauth/authorize/${id}/approve`, {
      email: 'alice@openheaders.io',
      password: 'alice-password-1',
    });
    expect(posted.status).toBe(404);
    expect(rig.authorization.facts(id)?.status).toBe('pending');
    const approved = await postJson(
      `${rig.origin}/auth/oauth/authorize/${id}/approve`,
      {},
      { authorization: `Bearer ${session.secret}` },
    );
    expect(approved.status).toBe(200);
  });

  it('Not me settles the record: the denied page for the form, JSON for the SPA; a later approve is refused', async () => {
    await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    const { challenge } = await pkce();
    const id = await parkedCode(rig, challenge);
    const denied = await postForm(`${rig.origin}/auth/oauth/authorize/${id}/deny`, {});
    expect(denied.status).toBe(200);
    expect(await denied.text()).toContain('Sign-in denied');
    const late = await postForm(`${rig.origin}/auth/oauth/authorize/${id}/approve`, {
      email: 'alice@openheaders.io',
      password: 'alice-password-1',
    });
    expect(late.status).toBe(410);
    expect(await late.text()).toContain('Sign-in denied');
    expect(rig.audited).toEqual([]);
    expect((await get(`${rig.origin}/auth/oauth/authorize/${id}`)).status).toBe(410);
    const asJson = await postJson(`${rig.origin}/auth/oauth/authorize/${id}/deny`, {});
    expect(asJson.status).toBe(410);
    expect(await asJson.json()).toEqual({ ok: false, reason: 'denied' });
    expect((await postJson(`${rig.origin}/auth/oauth/authorize/nope/deny`, {})).status).toBe(404);
    // Methods gate.
    expect((await get(`${rig.origin}/auth/oauth/authorize/${id}/approve`)).status).toBe(405);
    expect((await get(`${rig.origin}/auth/oauth/authorize/${id}/deny`)).status).toBe(405);
    expect((await postForm(`${rig.origin}/auth/oauth/authorize/${id}`, {})).status).toBe(405);
  });
});

describe('the device grant end to end — the start, the verify page, the poll', () => {
  it('the start answers RFC 8628 §3.2 to a form or JSON body, from the extension origin too', async () => {
    const rig = await startRig();
    const started = await startedDevice(rig);
    expect(started.device_code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.user_code).toBe('BCDF-GHJK');
    expect(started.verification_uri).toBe(`${rig.origin}/auth/oauth/device/verify`);
    expect(started.verification_uri_complete).toBe(`${rig.origin}/auth/oauth/device/verify?user_code=BCDF-GHJK`);
    expect(started.expires_in).toBeGreaterThan(290);
    expect(started.expires_in).toBeLessThanOrEqual(300);
    expect(started.interval).toBe(5);
    expect(rig.authorization.facts('auth-1')).toMatchObject({
      grant: 'device',
      deviceLabel: 'ci-box',
      peer: '127.0.0.1',
    });
    const asJson = await postJson(
      `${rig.origin}/auth/oauth/device`,
      { client_id: DAEMON_EXTENSION_CLIENT_ID, device_label: 'Safari · macOS' },
      { origin: `chrome-extension://${CHROME_EXTENSION_ID}` },
    );
    expect(asJson.status).toBe(200);
    expect(rig.authorization.facts('auth-2')).toMatchObject({ clientKind: 'extension', deviceLabel: 'Safari · macOS' });
  });

  it('refuses a missing client, an unknown client, a client without the device grant and an over-long label by the RFC names; the caps answer 503', async () => {
    const rig = await startRig({ limiter: { maxFailures: 1, windowMs: 60_000, blockMs: 120_000 } });
    const start = `${rig.origin}/auth/oauth/device`;
    expect(await (await postForm(start, {})).json()).toEqual({ error: 'invalid_request' });
    expect(await (await postForm(start, { client_id: 'openheaders-phone' })).json()).toEqual({
      error: 'invalid_client',
    });
    expect(await (await postForm(start, { client_id: DAEMON_DESKTOP_CLIENT_ID })).json()).toEqual({
      error: 'unauthorized_client',
    });
    expect(
      await (await postForm(start, { client_id: DAEMON_CLI_CLIENT_ID, device_label: 'x'.repeat(65) })).json(),
    ).toEqual({ error: 'invalid_request' });
    expect(
      (await fetch(start, { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } })).status,
    ).toBe(400);
    expect((await get(start)).status).toBe(405);
    for (let k = 0; k < 4; k++) expect((await postForm(start, { client_id: DAEMON_CLI_CLIENT_ID })).status).toBe(200);
    const full = await postForm(start, { client_id: DAEMON_CLI_CLIENT_ID });
    expect(full.status).toBe(503);
    expect(await full.json()).toEqual({ error: 'temporarily_unavailable' });
    // A refused start is never a guess: the peer is not throttled.
    expect((await postForm(start, { client_id: DAEMON_CLI_CLIENT_ID })).status).toBe(503);
  });

  it('the verify page: the code-entry form without a code, a 404 form on an unknown code, the consent routing on a known one (case-folded, hyphen optional)', async () => {
    const rig = await startRig();
    const plain = await get(`${rig.origin}/auth/oauth/device/verify`);
    expect(plain.status).toBe(200);
    const html = await plain.text();
    expect(html).toContain('Enter the code your device shows');
    expect(html).toContain('name="user_code"');
    expect(html).toContain('action="/auth/oauth/device/verify"');
    await startedDevice(rig);
    const unknown = await get(`${rig.origin}/auth/oauth/device/verify?user_code=ZZZZ-ZZZZ`);
    expect(unknown.status).toBe(404);
    expect(await unknown.text()).toContain('That code was not found');
    for (const code of ['BCDF-GHJK', 'bcdfghjk', 'bcdf-ghjk']) {
      const found = await get(`${rig.origin}/auth/oauth/device/verify?user_code=${code}`);
      expect(found.status).toBe(302);
      expect(found.headers.get('location')).toBe('/auth/oauth/authorize/auth-1');
    }
    expect((await fetch(`${rig.origin}/auth/oauth/device/verify`, { method: 'POST' })).status).toBe(405);
  });

  it('the whole leg: authorization_pending, the approval on the page, the poll mints once, the replay is invalid_grant', async () => {
    const userId = await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    const started = await startedDevice(rig);

    const pending = await pollToken(rig, started.device_code);
    expect(pending.status).toBe(400);
    expect(await pending.json()).toEqual({ error: 'authorization_pending' });

    const approved = await postForm(`${rig.origin}/auth/oauth/authorize/auth-1/approve`, {
      email: 'alice@openheaders.io',
      password: 'alice-password-1',
    });
    expect(approved.status).toBe(303);
    expect(approved.headers.get('location')).toBe('/auth/oauth/authorize/auth-1');
    expect(await listDaemonAuthTokens()).toHaveLength(0);
    const approvedPage = await get(`${rig.origin}/auth/oauth/authorize/auth-1`);
    expect(approvedPage.status).toBe(200);
    expect(await approvedPage.text()).toContain('Device approved');

    rig.advance(5_000);
    const minted = await pollToken(rig, started.device_code);
    expect(minted.status).toBe(200);
    const payload = (await minted.json()) as { access_token: string; token_type: string };
    expect(payload.token_type).toBe('Bearer');
    const validated = await validateDaemonAuthToken(payload.access_token);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.userId).toBe(userId);
    const [token] = await listDaemonAuthTokens();
    expect(token).toMatchObject({ kind: 'session', userId, label: 'device:cli:ci-box' });

    rig.advance(5_000);
    const replay = await pollToken(rig, started.device_code);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: 'invalid_grant' });
    expect(await listDaemonAuthTokens()).toHaveLength(1);
  });

  it('slow_down on a fast poll, access_denied after Not me, expired_token past the window', async () => {
    const rig = await startRig();
    const started = await startedDevice(rig);
    expect(await (await pollToken(rig, started.device_code)).json()).toEqual({ error: 'authorization_pending' });
    expect(await (await pollToken(rig, started.device_code)).json()).toEqual({ error: 'slow_down' });
    rig.advance(10_000);
    expect(await (await pollToken(rig, started.device_code)).json()).toEqual({ error: 'authorization_pending' });
    expect((await postJson(`${rig.origin}/auth/oauth/authorize/auth-1/deny`, {})).status).toBe(200);
    rig.advance(10_000);
    expect(await (await pollToken(rig, started.device_code)).json()).toEqual({ error: 'access_denied' });

    const second = await startedDevice(rig);
    rig.advance(5 * 60_000);
    expect(await (await pollToken(rig, second.device_code)).json()).toEqual({ error: 'expired_token' });
  });
});

describe('the token endpoint', () => {
  it('names the RFC errors: unsupported grant, unknown client, a client without the grant, missing fields; GET is 405', async () => {
    const rig = await startRig();
    const token = `${rig.origin}/auth/oauth/token`;
    expect(await (await postForm(token, { grant_type: 'password' })).json()).toEqual({
      error: 'unsupported_grant_type',
    });
    expect(await (await postForm(token, { grant_type: 'authorization_code', client_id: 'x' })).json()).toEqual({
      error: 'invalid_client',
    });
    expect(
      await (await postForm(token, { grant_type: 'authorization_code', client_id: DAEMON_CLI_CLIENT_ID })).json(),
    ).toEqual({ error: 'unauthorized_client' });
    expect(
      await (await postForm(token, { grant_type: DEVICE_CODE_GRANT_TYPE, client_id: DAEMON_DESKTOP_CLIENT_ID })).json(),
    ).toEqual({ error: 'unauthorized_client' });
    expect(
      await (await postForm(token, { grant_type: 'authorization_code', client_id: DAEMON_DESKTOP_CLIENT_ID })).json(),
    ).toEqual({ error: 'invalid_request' });
    expect(
      await (await postForm(token, { grant_type: DEVICE_CODE_GRANT_TYPE, client_id: DAEMON_CLI_CLIENT_ID })).json(),
    ).toEqual({ error: 'invalid_request' });
    expect(
      (await fetch(token, { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } })).status,
    ).toBe(400);
    expect((await get(token)).status).toBe(405);
    const fromExtension = await postJson(
      token,
      { grant_type: DEVICE_CODE_GRANT_TYPE, client_id: DAEMON_EXTENSION_CLIENT_ID, device_code: 'x' },
      { origin: `chrome-extension://${CHROME_EXTENSION_ID}` },
    );
    expect(fromExtension.status).toBe(400);
    expect((await postForm(token, { grant_type: 'x' }, { origin: 'https://evil.example.com' })).status).toBe(403);
  });

  it('an invalid_grant on an unknown code or device code is reported as a guess and throttles the peer; a live pending poll never does', async () => {
    const rig = await startRig({ limiter: { maxFailures: 3, windowMs: 60_000, blockMs: 120_000 } });
    const started = await startedDevice(rig);
    for (let k = 0; k < 5; k++) {
      rig.advance(5_000);
      expect(await (await pollToken(rig, started.device_code)).json()).toEqual({ error: 'authorization_pending' });
    }
    const guessCode = () =>
      postForm(`${rig.origin}/auth/oauth/token`, {
        grant_type: 'authorization_code',
        code: 'guess',
        code_verifier: 'v',
        redirect_uri: REDIRECT,
        client_id: DAEMON_DESKTOP_CLIENT_ID,
      });
    expect(await (await guessCode()).json()).toEqual({ error: 'invalid_grant' });
    expect(await (await pollToken(rig, 'guess')).json()).toEqual({ error: 'invalid_grant' });
    expect(await (await guessCode()).json()).toEqual({ error: 'invalid_grant' });
    expect((await guessCode()).status).toBe(429);
  });
});

describe('revoke (RFC 7009)', () => {
  it("revokes the presented token; an unknown token and a spent one both answer 200; a missing one is the caller's error", async () => {
    const rig = await startRig();
    const minted = await mintDaemonAuthToken({ kind: 'session', label: 'device:cli:ci-box' });
    const revoked = await postForm(`${rig.origin}/auth/oauth/revoke`, { token: minted.secret });
    expect(revoked.status).toBe(200);
    expect(await validateDaemonAuthToken(minted.secret)).toEqual({ ok: false, reason: 'revoked' });
    expect((await postForm(`${rig.origin}/auth/oauth/revoke`, { token: minted.secret })).status).toBe(200);
    expect((await postJson(`${rig.origin}/auth/oauth/revoke`, { token: 'oh_nope' })).status).toBe(200);
    expect((await postForm(`${rig.origin}/auth/oauth/revoke`, {})).status).toBe(400);
    expect((await get(`${rig.origin}/auth/oauth/revoke`)).status).toBe(405);
  });
});

describe('the claimed prefix', () => {
  it('answers 404 JSON under an unknown OAuth subpath — never the SPA fallback', async () => {
    const rig = await startRig({ spaServed: true });
    const response = await get(`${rig.origin}/auth/oauth/nope`);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});
