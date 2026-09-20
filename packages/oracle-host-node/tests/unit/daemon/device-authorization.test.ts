/**
 * The device flow's server side (the client sign-in plan §6) over a
 * real loopback socket composed behind admission, the spine's shape:
 * device routes ‖ pairing (with the client-view seam). The client's
 * start and poll, the device-authorization page in each of the four
 * gate states off the ONE server-side resolver, the approve form
 * (uniform 401, the audited bind, the redirect to the approved page),
 * "Not me", the approved page, and the law every page keeps: the
 * secret is never on it — the poll handle alone carries it, once.
 */

import { createServer, type Server } from 'node:http';
import {
  type AuditEntryInput,
  createDaemonPairingService,
  createDaemonUser,
  type DaemonPairingService,
  ensureSyntheticIdentity,
  listDaemonAuthTokens,
  setDaemonUserPassword,
  validateDaemonAuthToken,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { CHROME_EXTENSION_ID } from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAdmissionControl } from '../../../src/daemon/admission-control';
import { createGateModeResolver, type GateModeResolver } from '../../../src/daemon/gate-mode';
import { createDaemonPasswordLoginService } from '../../../src/daemon/password/password-login-service';
import { hashPassword } from '../../../src/daemon/password/password-verifier';
import { createDaemonSetupClaimService } from '../../../src/daemon/setup/setup-claim-service';
import { createDeviceAuthorizationHttp } from '../../../src/host-runtime/device-authorization-http';
import { createPairingHttpHandler } from '../../../src/host-runtime/pairing-http';
import { createHostStorageFake } from '../_host-storage-fake';

const CODE = '246810';

interface Rig {
  readonly origin: string;
  readonly pairing: DaemonPairingService;
  readonly audited: AuditEntryInput[];
}

interface RigOptions {
  /** An IdP is configured — the page offers the provider, the password form is absent. */
  ssoProvider?: string;
  gateMode?: GateModeResolver;
  limiter?: { maxFailures: number; windowMs: number; blockMs: number };
}

let server: Server | null = null;

async function startRig(options: RigOptions = {}): Promise<Rig> {
  // The first code is CODE; later starts in one rig take the next ones.
  let seq = 0;
  const pairing = createDaemonPairingService({
    generateCode: () => String(Number(CODE) + seq++),
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
    ...(options.limiter ? { limiter: options.limiter } : {}),
  });
  const device = createDeviceAuthorizationHttp({
    pairing,
    resolvePeer: admission.resolvePeer,
    gateMode,
    passwordLogin,
    emitAudit: (entry) => audited.push(entry),
  });
  const pairingHttp = createPairingHttpHandler({ pairing, clientPairView: device.renderPairView });
  const wrapped = admission.wrapHttpHandler((req, res) => device.handler(req, res) || pairingHttp(req, res));
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
  return { origin: `http://127.0.0.1:${port}`, pairing, audited };
}

interface Started {
  readonly code: string;
  readonly pollToken: string;
  readonly expiresAt: number;
  readonly approveUrl: string;
}

async function startDevice(
  rig: Rig,
  body: Record<string, unknown> = { client: 'extension', deviceLabel: 'Work Chrome' },
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${rig.origin}/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function startedDevice(rig: Rig): Promise<Started> {
  const response = await startDevice(rig);
  expect(response.status).toBe(200);
  return (await response.json()) as Started;
}

async function poll(rig: Rig, handle: string): Promise<Response> {
  return fetch(`${rig.origin}/pair/poll`, { headers: { authorization: `Bearer ${handle}` } });
}

async function approve(rig: Rig, code: string, email: string, password: string): Promise<Response> {
  return fetch(`${rig.origin}/pair/${code}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password }).toString(),
    redirect: 'manual',
  });
}

async function addPasswordUser(email: string, password: string): Promise<string> {
  const created = await createDaemonUser({ displayName: 'Alice', email });
  if (!created.ok) throw new Error(`setup failed: ${created.reason}`);
  const set = await setDaemonUserPassword(created.record.user.id, await hashPassword(password));
  if (!set.ok) throw new Error(`setup failed: ${set.reason}`);
  return created.record.user.id;
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

describe('gate mode — the one server-side truth', () => {
  it('resolves SSO first, then the claim, then the password holder, else no-login', async () => {
    const setupMeta = async (peerIsLoopback: boolean) => ({ unclaimed: true, requiresCode: !peerIsLoopback });
    const sso = createGateModeResolver({ ssoProvider: () => 'Stub SSO', setupMeta, passwordEnabled: async () => true });
    expect(await sso(true)).toEqual({ kind: 'sso', provider: 'Stub SSO' });
    const unclaimed = createGateModeResolver({ ssoProvider: null, setupMeta, passwordEnabled: async () => true });
    expect(await unclaimed(true)).toEqual({ kind: 'setup', requiresCode: false });
    expect(await unclaimed(false)).toEqual({ kind: 'setup', requiresCode: true });
    const claimed = async () => ({ unclaimed: false, requiresCode: false });
    const password = createGateModeResolver({
      ssoProvider: null,
      setupMeta: claimed,
      passwordEnabled: async () => true,
    });
    expect(await password(true)).toEqual({ kind: 'password' });
    const none = createGateModeResolver({ ssoProvider: null, setupMeta: claimed, passwordEnabled: async () => false });
    expect(await none(true)).toEqual({ kind: 'no-login' });
  });
});

describe('the client start', () => {
  it('answers the code, the poll handle, the expiry and the approve URL at the origin the client reached', async () => {
    const rig = await startRig();
    const started = await startedDevice(rig);
    expect(started.code).toBe(CODE);
    expect(started.pollToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.expiresAt).toBeGreaterThan(Date.now());
    expect(started.approveUrl).toBe(`${rig.origin}/pair/${CODE}`);
    // The pair names the admission-resolved peer, for the page.
    expect(rig.pairing.peek(CODE)).toMatchObject({
      initiative: 'client',
      client: 'extension',
      deviceLabel: 'Work Chrome',
      peer: '127.0.0.1',
    });
  });

  it('refuses a malformed body, an unknown client kind and an over-long label with 400; GET is 405', async () => {
    const rig = await startRig();
    expect((await startDevice(rig, { client: 'phone' })).status).toBe(400);
    expect((await startDevice(rig, {})).status).toBe(400);
    expect((await startDevice(rig, { client: 'cli', deviceLabel: 'x'.repeat(65) })).status).toBe(400);
    const notJson = await fetch(`${rig.origin}/pair`, { method: 'POST', body: 'client=cli' });
    expect(notJson.status).toBe(400);
    expect((await fetch(`${rig.origin}/pair`)).status).toBe(405);
  });

  it('admits the extension origin and refuses a foreign page at admission', async () => {
    const rig = await startRig();
    const fromExtension = await startDevice(
      rig,
      { client: 'extension' },
      { origin: `chrome-extension://${CHROME_EXTENSION_ID}` },
    );
    expect(fromExtension.status).toBe(200);
    const forged = await startDevice(rig, { client: 'extension' }, { origin: 'https://evil.example.com' });
    expect(forged.status).toBe(403);
  });

  it('answers 503 too-many-pending once the per-peer cap is full — a start is refused, never counted', async () => {
    const rig = await startRig({ limiter: { maxFailures: 1, windowMs: 60_000, blockMs: 120_000 } });
    for (let k = 0; k < 4; k++) expect((await startDevice(rig, { client: 'cli' })).status).toBe(200);
    const refused = await startDevice(rig, { client: 'cli' });
    expect(refused.status).toBe(503);
    expect(await refused.json()).toEqual({ ok: false, reason: 'too-many-pending' });
    // Not a brute-force signal: the peer is not throttled by it.
    expect((await startDevice(rig, { client: 'cli' })).status).toBe(503);
    // Settling one frees the slot.
    rig.pairing.cancel(CODE);
    expect((await startDevice(rig, { client: 'cli' })).status).toBe(200);
  });
});

describe('the device-authorization page', () => {
  it('password mode: names the device, the client kind and the peer, offers the form and Not me, never the secret', async () => {
    await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    const started = await startedDevice(rig);
    const page = await fetch(started.approveUrl);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.headers.get('x-frame-options')).toBe('DENY');
    const html = await page.text();
    expect(html).toContain('Approve this device?');
    expect(html).toContain('Work Chrome');
    expect(html).toContain('the browser extension');
    expect(html).toContain('<code>127.0.0.1</code>');
    expect(html).toContain(`action="/pair/${CODE}/approve"`);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('Not me');
    expect(html).toContain(`action="/pair/${CODE}/deny"`);
    expect(html).not.toContain('/auth/oidc/start');
    expect(html).not.toContain(started.pollToken);
  });

  it('unclaimed: says there is no administrator and points at the claim', async () => {
    const rig = await startRig();
    const started = await startedDevice(rig);
    const html = await (await fetch(started.approveUrl)).text();
    expect(html).toContain('Approve this device?');
    expect(html).toContain('This server has no administrator yet.');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('name="password"');
  });

  it('SSO: offers the provider link into the OIDC start with the device code, and Not me', async () => {
    const rig = await startRig({ ssoProvider: 'Stub SSO' });
    const started = await startedDevice(rig);
    const html = await (await fetch(started.approveUrl)).text();
    expect(html).toContain('Sign in with Stub SSO');
    expect(html).toContain(`href="/auth/oidc/start?device=${CODE}"`);
    expect(html).toContain('Not me');
    expect(html).not.toContain('name="password"');
    expect(html).not.toContain(started.pollToken);
  });

  it('no-login: a claimed server with no password holder says so and offers nothing', async () => {
    const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    expect(created.ok).toBe(true);
    const rig = await startRig();
    const started = await startedDevice(rig);
    const html = await (await fetch(started.approveUrl)).text();
    expect(html).toContain('Nobody can sign in to this server from a browser.');
    expect(html).toContain('pairing code');
    expect(html).not.toContain('name="password"');
    expect(html).not.toContain('/auth/oidc/start');
  });

  it("renders the OIDC arm's refusal as a fixed sentence, never the URL's own words", async () => {
    const rig = await startRig({ ssoProvider: 'Stub SSO' });
    const started = await startedDevice(rig);
    const known = await (await fetch(`${started.approveUrl}?error=unknown-user`)).text();
    expect(known).toContain('That account is not a user on this server.');
    const unknown = await (await fetch(`${started.approveUrl}?error=%3Cscript%3Ecall%20us%3C%2Fscript%3E`)).text();
    expect(unknown).toContain('The sign-in did not complete. Try again.');
    expect(unknown).not.toContain('call us');
  });

  it('a cli pair without a label is named by its client kind alone', async () => {
    const rig = await startRig();
    const response = await startDevice(rig, { client: 'cli' });
    const started = (await response.json()) as Started;
    const html = await (await fetch(started.approveUrl)).text();
    expect(html).toContain('the command-line tool');
  });
});

describe('approve, deny, approved and the poll', () => {
  it('the whole password leg: pending → approve → redirect → approved page; the poll mints once, bound, audited', async () => {
    const userId = await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    const started = await startedDevice(rig);

    const pending = await poll(rig, started.pollToken);
    expect(pending.status).toBe(200);
    expect(await pending.json()).toEqual({ status: 'pending', expiresAt: started.expiresAt });

    const approved = await approve(rig, CODE, 'alice@openheaders.io', 'alice-password-1');
    expect(approved.status).toBe(303);
    expect(approved.headers.get('location')).toBe(`/pair/${CODE}/approved`);
    // Approval minted nothing and signed the browser into nothing.
    expect(await listDaemonAuthTokens()).toHaveLength(0);
    expect(approved.headers.get('set-cookie')).toBeNull();
    expect(rig.audited).toEqual([
      { actorUserId: userId, capability: 'daemon.device-login', decision: { allow: true } },
    ]);

    const approvedPage = await fetch(`${rig.origin}/pair/${CODE}/approved`);
    expect(approvedPage.status).toBe(200);
    const approvedHtml = await approvedPage.text();
    expect(approvedHtml).toContain('Device approved');
    expect(approvedHtml).toContain('You can close this tab.');
    expect(approvedHtml).not.toContain('oh_');
    expect(approvedHtml).not.toContain(started.pollToken);
    // The page itself now reads approved too — and still carries nothing.
    const pageAfter = await (await fetch(started.approveUrl)).text();
    expect(pageAfter).toContain('Device approved');
    expect(pageAfter).not.toContain('name="password"');

    const minted = await poll(rig, started.pollToken);
    expect(minted.status).toBe(200);
    const payload = (await minted.json()) as { status: string; secret: string; tokenId: string };
    expect(payload.status).toBe('approved');
    expect(payload.secret).toMatch(/^oh_/);
    const validated = await validateDaemonAuthToken(payload.secret);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.userId).toBe(userId);
    const [token] = await listDaemonAuthTokens();
    expect(token).toMatchObject({
      id: payload.tokenId,
      kind: 'session',
      userId,
      label: 'device:extension:Work Chrome',
    });
    expect(token.expiresAt).toBeGreaterThan(Date.now());
    // One-shot: the handle is spent; nothing more is minted.
    const replay = await poll(rig, started.pollToken);
    expect(replay.status).toBe(404);
    expect(await replay.json()).toEqual({ status: 'unknown' });
    expect(await listDaemonAuthTokens()).toHaveLength(1);
    // The approved page keeps answering for the person's tab.
    expect((await fetch(`${rig.origin}/pair/${CODE}/approved`)).status).toBe(200);
  });

  it('every refused credential answers ONE uniform 401 page and binds nothing', async () => {
    await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    const started = await startedDevice(rig);
    const wrong = await approve(rig, CODE, 'alice@openheaders.io', 'nope-nope-nope');
    const unknown = await approve(rig, CODE, 'nobody@openheaders.io', 'alice-password-1');
    const malformed = await fetch(`${rig.origin}/pair/${CODE}/approve`, { method: 'POST', body: 'email=only' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(malformed.status).toBe(401);
    const wrongHtml = await wrong.text();
    expect(wrongHtml).toBe(await unknown.text());
    expect(wrongHtml).toBe(await malformed.text());
    expect(wrongHtml).toContain('Sign-in refused');
    expect(wrongHtml).toContain(`href="/pair/${CODE}"`);
    expect(rig.pairing.peek(CODE)?.status).toBe('pending');
    expect(rig.audited).toEqual([]);
    expect(await (await poll(rig, started.pollToken)).json()).toMatchObject({ status: 'pending' });
  });

  it('a JSON approve body is accepted like the form', async () => {
    await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    await startedDevice(rig);
    const approved = await fetch(`${rig.origin}/pair/${CODE}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@openheaders.io', password: 'alice-password-1' }),
      redirect: 'manual',
    });
    expect(approved.status).toBe(303);
  });

  it('Not me settles the pair: the denied page, the poll reads denied, a later approve is refused', async () => {
    await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    const started = await startedDevice(rig);
    const denied = await fetch(`${rig.origin}/pair/${CODE}/deny`, { method: 'POST' });
    expect(denied.status).toBe(200);
    expect(await denied.text()).toContain('Sign-in denied');
    expect(await (await poll(rig, started.pollToken)).json()).toEqual({ status: 'denied' });
    const late = await approve(rig, CODE, 'alice@openheaders.io', 'alice-password-1');
    expect(late.status).toBe(410);
    expect(await late.text()).toContain('Sign-in denied');
    expect(rig.audited).toEqual([]);
    // The page and the approved page both read the verdict.
    expect((await fetch(started.approveUrl)).status).toBe(410);
    expect((await fetch(`${rig.origin}/pair/${CODE}/approved`)).status).toBe(410);
  });

  it('the approved page of a still-pending pair sends the person back to the page that asks', async () => {
    const rig = await startRig();
    await startedDevice(rig);
    const early = await fetch(`${rig.origin}/pair/${CODE}/approved`, { redirect: 'manual' });
    expect(early.status).toBe(303);
    expect(early.headers.get('location')).toBe(`/pair/${CODE}`);
  });

  it('under SSO the approve form does not exist: 404, nothing bound', async () => {
    const rig = await startRig({ ssoProvider: 'Stub SSO' });
    await startedDevice(rig);
    const posted = await approve(rig, CODE, 'alice@openheaders.io', 'alice-password-1');
    expect(posted.status).toBe(404);
    expect(rig.pairing.peek(CODE)?.status).toBe('pending');
  });

  it('unknown codes answer the not-found page on approve, deny and approved', async () => {
    await addPasswordUser('alice@openheaders.io', 'alice-password-1');
    const rig = await startRig();
    expect((await approve(rig, '000000', 'alice@openheaders.io', 'alice-password-1')).status).toBe(404);
    expect((await fetch(`${rig.origin}/pair/000000/deny`, { method: 'POST' })).status).toBe(404);
    expect((await fetch(`${rig.origin}/pair/000000/approved`)).status).toBe(404);
    // Methods gate.
    expect((await fetch(`${rig.origin}/pair/000000/approve`)).status).toBe(405);
    expect((await fetch(`${rig.origin}/pair/000000/deny`)).status).toBe(405);
    expect((await fetch(`${rig.origin}/pair/000000/approved`, { method: 'POST' })).status).toBe(405);
  });

  it('the admin initiative keeps its own confirm page and its verbs refuse a client pair', async () => {
    const rig = await startRig();
    rig.pairing.startPair({ deviceLabel: 'admin pair' });
    const html = await (await fetch(`${rig.origin}/pair/${CODE}`)).text();
    expect(html).toContain('Confirm pairing with this device');
    expect(html).not.toContain('Approve this device?');
    expect((await fetch(`${rig.origin}/pair/${CODE}/deny`, { method: 'POST' })).status).toBe(404);
  });
});

describe('the poll', () => {
  it('needs a bearer handle; an unknown handle is a counted 404', async () => {
    const rig = await startRig({ limiter: { maxFailures: 2, windowMs: 60_000, blockMs: 120_000 } });
    expect((await fetch(`${rig.origin}/pair/poll`)).status).toBe(400);
    expect((await fetch(`${rig.origin}/pair/poll`, { method: 'POST' })).status).toBe(405);
    expect((await poll(rig, 'not-a-handle')).status).toBe(404);
    expect((await poll(rig, 'still-not')).status).toBe(404);
    // Two unknown handles trip the peer's budget on this route.
    expect((await poll(rig, 'third')).status).toBe(429);
  });
});
