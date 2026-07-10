/**
 * OIDC login e2e (Phase 5 slice 3) — the full flow over real sockets
 * against a REAL stub issuer: a local HTTP IdP serving discovery, an
 * authorize endpoint that 302s back with a code, a PKCE-verifying token
 * endpoint minting jose-signed ID tokens, and a JWKS route — so the
 * production verification path (remote JWKS fetch, RS256 signature,
 * iss/aud/exp, nonce) runs for real, no seams substituted.
 *
 * Daemon side mirrors the spine's composition: admission-wrapped
 * healthz ‖ oidc handlers on one bound HTTP socket, plus the WS server
 * for the final leg — the SSO-minted session token admitted at HELLO
 * as the directory user.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  clearIdentitySnapshot,
  createDaemonUser,
  ensureSyntheticIdentity,
  type ResolvedAuditEntry,
  resetAuditSink,
  setAuditSink,
  validateDaemonAuthToken,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { PROTOCOL_VERSION, SYNC_HELLO_TYPE, SYNC_WELCOME_TYPE } from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createAdmissionControl } from '../../../src/daemon/admission-control';
import { createHealthzHandler } from '../../../src/daemon/healthz';
import type { DaemonOidcConfig } from '../../../src/daemon/oidc/oidc-config';
import { createOidcHttpHandler } from '../../../src/daemon/oidc/oidc-http';
import { createDaemonOidcService, type DaemonOidcService } from '../../../src/daemon/oidc/oidc-service';
import { type OracleWsServer, startOracleWsServer } from '../../../src/host-runtime/ws-server';
import { createHostStorageFake } from '../_host-storage-fake';

const CLIENT_ID = 'oh-daemon-e2e';

interface StubIssuer {
  readonly issuer: string;
  /** email/name/nonce-behavior the next ID token carries. */
  setUser(user: { email: string; name?: string; emailVerified?: boolean }): void;
  close(): Promise<void>;
}

interface PendingCode {
  readonly challenge: string;
  readonly nonce: string;
  readonly redirectUri: string;
}

async function listen(server: Server): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function json(res: ServerResponse, payload: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

/** A minimal, spec-honest OIDC provider on a real loopback socket. */
async function startStubIssuer(): Promise<StubIssuer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'stub-key', alg: 'RS256', use: 'sig' };
  const codes = new Map<string, PendingCode>();
  let user: { email: string; name?: string; emailVerified?: boolean } = { email: 'alice@openheaders.io' };
  let issuer = '';
  let codeSeq = 0;

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', issuer);
      if (url.pathname === '/.well-known/openid-configuration') {
        json(res, {
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
        });
        return;
      }
      if (url.pathname === '/jwks') {
        json(res, { keys: [jwk] });
        return;
      }
      if (url.pathname === '/authorize') {
        // The user "signs in" instantly: mint a code bound to the PKCE
        // challenge + nonce and bounce back to the client's redirect_uri.
        const redirectUri = url.searchParams.get('redirect_uri') ?? '';
        const code = `code-${++codeSeq}`;
        codes.set(code, {
          challenge: url.searchParams.get('code_challenge') ?? '',
          nonce: url.searchParams.get('nonce') ?? '',
          redirectUri,
        });
        const back = new URL(redirectUri);
        back.searchParams.set('code', code);
        back.searchParams.set('state', url.searchParams.get('state') ?? '');
        res.statusCode = 302;
        res.setHeader('location', back.toString());
        res.end();
        return;
      }
      if (url.pathname === '/token' && req.method === 'POST') {
        const body = new URLSearchParams(await readBody(req));
        const pending = codes.get(body.get('code') ?? '');
        codes.delete(body.get('code') ?? '');
        const verifier = body.get('code_verifier') ?? '';
        const { createHash } = await import('node:crypto');
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        if (!pending || challenge !== pending.challenge || body.get('redirect_uri') !== pending.redirectUri) {
          json(res, { error: 'invalid_grant' }, 400);
          return;
        }
        const idToken = await new SignJWT({
          nonce: pending.nonce,
          email: user.email,
          ...(user.emailVerified !== undefined ? { email_verified: user.emailVerified } : {}),
          ...(user.name ? { name: user.name } : {}),
        })
          .setProtectedHeader({ alg: 'RS256', kid: 'stub-key' })
          .setIssuer(issuer)
          .setAudience(CLIENT_ID)
          .setSubject('stub-subject')
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(privateKey);
        json(res, { access_token: 'stub-access', token_type: 'Bearer', id_token: idToken });
        return;
      }
      res.statusCode = 404;
      res.end();
    })();
  });
  const port = await listen(server);
  issuer = `http://127.0.0.1:${port}`;
  return {
    issuer,
    setUser(next) {
      user = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

interface DaemonRig {
  readonly origin: string;
  close(): Promise<void>;
}

/** The spine's HTTP composition for this plane: admission → healthz ‖ oidc. */
async function startDaemonHttp(service: DaemonOidcService): Promise<DaemonRig> {
  const admission = createAdmissionControl({ oidcEnabled: true });
  const healthz = createHealthzHandler();
  let origin = '';
  const oidc = createOidcHttpHandler({ service });
  const composed = admission.wrapHttpHandler((req, res) => healthz(req, res) || oidc(req, res));
  const server = createServer((req, res) => {
    if (!composed(req, res)) {
      res.statusCode = 400;
      res.end();
    }
  });
  const port = await listen(server);
  origin = `http://127.0.0.1:${port}`;
  return {
    origin,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/** GET without following redirects; returns status + Location. */
async function getRedirect(url: string, origin?: string): Promise<{ status: number; location: string }> {
  const response = await fetch(url, { redirect: 'manual', ...(origin ? { headers: { origin } } : {}) });
  return { status: response.status, location: response.headers.get('location') ?? '' };
}

/** Drive start → authorize → callback; returns the SPA fragment the flow ends on. */
async function runLoginFlow(daemonOrigin: string): Promise<string> {
  const start = await getRedirect(`${daemonOrigin}/auth/oidc/start`);
  expect(start.status).toBe(302);
  const authorize = await getRedirect(start.location);
  expect(authorize.status).toBe(302);
  expect(authorize.location.startsWith(`${daemonOrigin}/auth/oidc/callback`)).toBe(true);
  const callback = await getRedirect(authorize.location);
  expect(callback.status).toBe(302);
  return callback.location;
}

let issuerStub: StubIssuer | null = null;
let daemonRig: DaemonRig | null = null;
let wsServer: OracleWsServer | null = null;
let audits: ResolvedAuditEntry[] = [];

function buildService(overrides: Partial<DaemonOidcConfig> = {}): DaemonOidcService {
  if (!issuerStub) throw new Error('issuer not started');
  return createDaemonOidcService({ issuer: issuerStub.issuer, clientId: CLIENT_ID, ...overrides });
}

beforeAll(() => {
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
});

beforeEach(async () => {
  audits = [];
  setAuditSink((entry) => audits.push(entry));
  setHostStorage(createHostStorageFake());
  await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-10T00:00:00.000Z' });
  issuerStub = await startStubIssuer();
});

afterEach(async () => {
  await wsServer?.close();
  wsServer = null;
  await daemonRig?.close();
  daemonRig = null;
  await issuerStub?.close();
  issuerStub = null;
  resetAuditSink();
  clearIdentitySnapshot();
});

describe('OIDC login e2e — stub issuer over real sockets', () => {
  it('start → authorize → callback → claim mints a session token HELLO admits as the directory user', async () => {
    const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    if (!created.ok) throw new Error('directory create failed');
    const service = buildService();
    daemonRig = await startDaemonHttp(service);

    const fragment = await runLoginFlow(daemonRig.origin);
    expect(fragment).toMatch(/^\/#oidc=/);
    const claimCode = decodeURIComponent(fragment.slice('/#oidc='.length));

    // Claim swaps the one-shot code for the session token…
    const claim = await fetch(`${daemonRig.origin}/auth/oidc/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: daemonRig.origin },
      body: JSON.stringify({ code: claimCode }),
    });
    expect(claim.status).toBe(200);
    const claimed = (await claim.json()) as { ok: boolean; secret: string };
    expect(claimed.ok).toBe(true);
    expect(claimed.secret).toMatch(/^oh_/);
    // …one-shot: the same code is spent.
    const replay = await fetch(`${daemonRig.origin}/auth/oidc/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: daemonRig.origin },
      body: JSON.stringify({ code: claimCode }),
    });
    expect(replay.status).toBe(404);

    // The token is bound to Alice and expires (default 30 days).
    const validated = await validateDaemonAuthToken(claimed.secret);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.userId).toBe(created.record.user.id);
    const expired = await validateDaemonAuthToken(claimed.secret, () => Date.now() + 31 * 24 * 60 * 60_000);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.reason).toBe('expired');

    // Final leg: a real HELLO over a real WS socket admits AS Alice.
    const port = await new Promise<number>((resolve) => {
      const probe = createServer();
      probe.listen(0, '127.0.0.1', () => {
        const addr = probe.address();
        const p = typeof addr === 'object' && addr ? addr.port : 0;
        probe.close(() => resolve(p));
      });
    });
    wsServer = await startOracleWsServer({
      host: '127.0.0.1',
      port,
      handshakeIdentity: { role: 'daemon', nodeId: 'oidc-e2e-node', agent: '@openheaders/daemon@test' },
    });
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      client.once('open', () => resolve());
      client.once('error', reject);
    });
    const welcome = new Promise<{ accepted: boolean }>((resolve) => {
      client.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === SYNC_WELCOME_TYPE) resolve(msg);
      });
    });
    client.send(
      JSON.stringify({
        type: SYNC_HELLO_TYPE,
        protocolVersion: PROTOCOL_VERSION,
        role: 'web',
        nodeId: 'oidc-web-tab',
        workspaceId: '__global__',
        agent: '@openheaders/web@test',
        authToken: claimed.secret,
      }),
    );
    expect((await welcome).accepted).toBe(true);
    client.close();
    const gate = audits.find((a) => a.capability === 'daemon.admin' && a.actorUserId === created.record.user.id);
    expect(gate?.decision.allow).toBe(true);
  });

  it('an email the directory does not hold is refused in the callback redirect', async () => {
    issuerStub?.setUser({ email: 'mallory@openheaders.io' });
    daemonRig = await startDaemonHttp(buildService());
    const fragment = await runLoginFlow(daemonRig.origin);
    expect(fragment).toBe('/#oidc-error=unknown-user');
  });

  it('autoProvision admits a fresh email and the minted token resolves to the new user', async () => {
    issuerStub?.setUser({ email: 'carol@openheaders.io', name: 'Carol C.' });
    daemonRig = await startDaemonHttp(buildService({ autoProvision: true }));
    const fragment = await runLoginFlow(daemonRig.origin);
    expect(fragment).toMatch(/^\/#oidc=/);
    const claim = await fetch(`${daemonRig.origin}/auth/oidc/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: decodeURIComponent(fragment.slice('/#oidc='.length)) }),
    });
    const claimed = (await claim.json()) as { ok: boolean; secret: string };
    const validated = await validateDaemonAuthToken(claimed.secret);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.userId).toBeTruthy();
  });

  it('meta answers JSON with the provider label; foreign-origin claims are refused at admission', async () => {
    daemonRig = await startDaemonHttp(buildService({ providerLabel: 'Stub SSO' }));
    const meta = await fetch(`${daemonRig.origin}/auth/oidc/meta`);
    expect(meta.headers.get('content-type')).toContain('application/json');
    expect(await meta.json()).toEqual({ enabled: true, provider: 'Stub SSO' });
    // A drive-by page's POST dies at the admission wall, not in the handler.
    const forged = await fetch(`${daemonRig.origin}/auth/oidc/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example.com' },
      body: JSON.stringify({ code: 'whatever' }),
    });
    expect(forged.status).toBe(403);
  });

  it('a replayed callback (spent state) redirects into the error fragment', async () => {
    await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    daemonRig = await startDaemonHttp(buildService());
    const start = await getRedirect(`${daemonRig.origin}/auth/oidc/start`);
    const authorize = await getRedirect(start.location);
    const first = await getRedirect(authorize.location);
    expect(first.location).toMatch(/^\/#oidc=/);
    const replayed = await getRedirect(authorize.location);
    expect(replayed.location).toBe('/#oidc-error=state-mismatch');
  });
});
