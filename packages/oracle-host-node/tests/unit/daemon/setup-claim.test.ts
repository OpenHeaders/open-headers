/**
 * Server claim (the front-door plan §4.2/§4.3) — the setup code's
 * shape and comparison, the claim service's ordering and refusals, and
 * the HTTP surface over a real loopback socket composed behind
 * admission: the meta probe, a loopback claim, the coded remote path,
 * the second-claim refusal, O3's revocations, and an SSO daemon that is
 * never unclaimed.
 */

import { createServer, type Server } from 'node:http';
import {
  createDaemonUser,
  ensureSyntheticIdentity,
  hasCapability,
  listDaemonAuthTokens,
  listWorkspaceRolesForPrincipal,
  mintDaemonAuthToken,
  type ResolvedAuditEntry,
  resetAuditSink,
  resolveDaemonPeerIdentitySnapshot,
  setAuditSink,
  validateDaemonAuthToken,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAdmissionControl } from '../../../src/daemon/admission-control';
import { PASSWORD_MIN_LENGTH } from '../../../src/daemon/password/password-verifier';
import {
  createDaemonSetupClaimService,
  type DaemonSetupClaimService,
  type DaemonSetupClaimServiceOptions,
} from '../../../src/daemon/setup/setup-claim-service';
import { generateSetupCode, normalizeSetupCode, setupCodeMatches } from '../../../src/daemon/setup/setup-code';
import { createSetupHttpHandler } from '../../../src/daemon/setup/setup-http';
import { createHostStorageFake } from '../_host-storage-fake';

const WORKSPACE_ID = 'ws-server-1';
const GOOD_PASSWORD = 'claim-password-2026';

function makeService(overrides: Partial<DaemonSetupClaimServiceOptions> = {}): {
  service: DaemonSetupClaimService;
  closed: string[];
  codes: (string | null)[];
} {
  const closed: string[] = [];
  const codes: (string | null)[] = [];
  const service = createDaemonSetupClaimService({
    oidcConfigured: false,
    listWorkspaceIds: () => [WORKSPACE_ID],
    closePeersByTokenId: (tokenId) => closed.push(tokenId),
    onSetupCodeChange: (code) => codes.push(code),
    ...overrides,
  });
  return { service, closed, codes };
}

describe('setup code', () => {
  it('mints the grouped shape over an unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateSetupCode();
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      // The glyphs a person confuses when retyping from a terminal.
      expect(code).not.toMatch(/[01ILO]/);
    }
    expect(new Set(Array.from({ length: 50 }, generateSetupCode)).size).toBe(50);
  });

  it('compares the way people retype it — case-folded, separators ignored', () => {
    const code = '4KFP-9QW2-XM31';
    expect(normalizeSetupCode(code)).toBe('4KFP9QW2XM31');
    expect(setupCodeMatches('4kfp 9qw2 xm31', code)).toBe(true);
    expect(setupCodeMatches('4KFP9QW2XM31', code)).toBe(true);
    expect(setupCodeMatches('4KFP-9QW2-XM32', code)).toBe(false);
    expect(setupCodeMatches('4KFP-9QW2', code)).toBe(false);
  });

  it('never matches on a claimed server, and never matches nothing', () => {
    expect(setupCodeMatches('4KFP-9QW2-XM31', null)).toBe(false);
    expect(setupCodeMatches(undefined, '4KFP-9QW2-XM31')).toBe(false);
    expect(setupCodeMatches('', '')).toBe(false);
  });
});

describe('setup claim service', () => {
  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon' });
  });

  afterEach(() => {
    resetAuditSink();
  });

  it('mints a code while unclaimed and reports it; a claimed directory gets none', async () => {
    const { service, codes } = makeService();
    const minted = await service.ensureSetupCode();
    expect(minted).not.toBeNull();
    expect(codes).toEqual([minted]);
    expect(await service.meta()).toEqual({ unclaimed: true, requiresCode: true });

    await createDaemonUser({ displayName: 'John Doe', email: 'john@openheaders.io' });
    const second = makeService();
    expect(await second.service.ensureSetupCode()).toBeNull();
    expect(await second.service.meta()).toEqual({ unclaimed: false, requiresCode: false });
  });

  it('an SSO daemon is never unclaimed and refuses the claim outright (O4)', async () => {
    const { service } = makeService({ oidcConfigured: true });
    expect(await service.ensureSetupCode()).toBeNull();
    expect(await service.meta()).toEqual({ unclaimed: false, requiresCode: false });
    const result = await service.claim(
      { displayName: 'John Doe', email: 'john@openheaders.io', password: GOOD_PASSWORD },
      true,
    );
    expect(result).toEqual({ ok: false, kind: 'refused', reason: 'sso-configured' });
    expect(await listDaemonAuthTokens()).toHaveLength(0);
  });

  it('claims from loopback: admin role, owner grant, session token, and the code retires', async () => {
    const entries: ResolvedAuditEntry[] = [];
    setAuditSink((entry) => entries.push(entry));
    const { service, closed, codes } = makeService();
    await service.ensureSetupCode();
    // Two unbound tokens (a `show-token` bootstrap and a paired device)
    // and one already bound to somebody — only the unbound ones die.
    const bootstrap = await mintDaemonAuthToken({ label: 'show-token' });
    const device = await mintDaemonAuthToken({ label: 'laptop' });
    const bound = await mintDaemonAuthToken({ label: 'alice', userId: 'user-other' });

    const result = await service.claim(
      { displayName: 'John Doe', email: 'John@openheaders.io', password: GOOD_PASSWORD },
      true,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revokedTokens).toBe(2);

    // The secret is a working session credential bound to the new user.
    const validated = await validateDaemonAuthToken(result.secret);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.userId).toBe(result.userId);

    // …who administers the daemon and owns the server's workspace.
    const snapshot = await resolveDaemonPeerIdentitySnapshot(result.userId);
    expect(snapshot).not.toBeNull();
    if (snapshot === null) return;
    expect(hasCapability(snapshot, 'daemon.admin').allow).toBe(true);
    // O5 holds: administering the box is not an allow-all over it.
    expect(hasCapability(snapshot, 'daemon.operator').allow).toBe(false);
    const grants = await listWorkspaceRolesForPrincipal(snapshot.principal?.id ?? '');
    expect(grants).toEqual([expect.objectContaining({ workspaceId: WORKSPACE_ID, role: 'owner' })]);

    // O3: every unbound token revoked and its socket evicted; the bound
    // one is somebody's credential and survives.
    const tokens = await listDaemonAuthTokens();
    const byId = new Map(tokens.map((token) => [token.id, token]));
    expect(byId.get(bootstrap.record.id)?.revokedAt).not.toBeNull();
    expect(byId.get(device.record.id)?.revokedAt).not.toBeNull();
    expect(byId.get(bound.record.id)?.revokedAt).toBeNull();
    expect(closed).toEqual([bootstrap.record.id, device.record.id]);
    expect(
      entries.filter((entry) => entry.capability === 'daemon.admin' && entry.actorUserId === result.userId),
    ).toHaveLength(2);

    // The claim closed the door behind it.
    expect(codes[codes.length - 1]).toBeNull();
    expect(await service.meta()).toEqual({ unclaimed: false, requiresCode: false });
    const again = await service.claim(
      { displayName: 'Jane Doe', email: 'jane@openheaders.io', password: GOOD_PASSWORD },
      true,
    );
    expect(again).toEqual({ ok: false, kind: 'refused', reason: 'already-claimed' });
  });

  it('a remote claim needs the code; a loopback one never does', async () => {
    const { service } = makeService({ generateCode: () => '4KFP-9QW2-XM31' });
    await service.ensureSetupCode();
    const input = { displayName: 'John Doe', email: 'john@openheaders.io', password: GOOD_PASSWORD };

    expect(await service.claim(input, false)).toEqual({ ok: false, kind: 'refused', reason: 'bad-setup-code' });
    expect(await service.claim({ ...input, code: '4KFP-9QW2-XM32' }, false)).toEqual({
      ok: false,
      kind: 'refused',
      reason: 'bad-setup-code',
    });
    // Retyped the way a person would: lower case, spaces for dashes.
    const claimed = await service.claim({ ...input, code: '4kfp 9qw2 xm31' }, false);
    expect(claimed.ok).toBe(true);
  });

  it('refuses input the caller can fix without touching server state', async () => {
    const { service } = makeService();
    await service.ensureSetupCode();
    const base = { displayName: 'John Doe', email: 'john@openheaders.io', password: GOOD_PASSWORD };
    expect(await service.claim({ ...base, displayName: '   ' }, true)).toEqual({
      ok: false,
      kind: 'invalid',
      reason: 'display-name-required',
    });
    expect(await service.claim({ ...base, email: '' }, true)).toEqual({
      ok: false,
      kind: 'invalid',
      reason: 'email-required',
    });
    expect(await service.claim({ ...base, password: 'x'.repeat(PASSWORD_MIN_LENGTH - 1) }, true)).toEqual({
      ok: false,
      kind: 'invalid',
      reason: 'password-too-short',
    });
    // Nothing was written on any of those paths.
    expect(await service.meta()).toEqual({ unclaimed: true, requiresCode: true });
  });

  it('lets exactly one of two concurrent claims win', async () => {
    const { service } = makeService();
    await service.ensureSetupCode();
    const [a, b] = await Promise.all([
      service.claim({ displayName: 'John Doe', email: 'john@openheaders.io', password: GOOD_PASSWORD }, true),
      service.claim({ displayName: 'Jane Doe', email: 'jane@openheaders.io', password: GOOD_PASSWORD }, true),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const loser = a.ok ? b : a;
    expect(loser.ok === false && loser.kind === 'refused' && loser.reason).toBe('already-claimed');
  });
});

describe('setup HTTP surface over a real socket', () => {
  let server: Server | null = null;

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon' });
  });

  afterEach(async () => {
    const running = server;
    server = null;
    if (running) await new Promise<void>((resolve) => running.close(() => resolve()));
  });

  /**
   * `peer` overrides admission's peer resolution so the remote path can
   * be exercised over a loopback socket — the same substitution a
   * trusted proxy makes in production, where the socket is local and
   * `X-Forwarded-For` names the real client.
   */
  async function startDaemonHttp(options: { service: DaemonSetupClaimService; peer?: string }): Promise<string> {
    const admission = createAdmissionControl();
    const handler = createSetupHttpHandler({
      service: options.service,
      resolvePeer: options.peer === undefined ? admission.resolvePeer : () => options.peer as string,
    });
    const wrapped = admission.wrapHttpHandler((req, res) => handler(req, res));
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
    return `http://127.0.0.1:${port}`;
  }

  const post = async (origin: string, body: unknown): Promise<Response> =>
    fetch(`${origin}/auth/setup/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('meta answers everyone, the claim answers a login-shaped body, and the second one is refused', async () => {
    const { service } = makeService();
    await service.ensureSetupCode();
    const origin = await startDaemonHttp({ service });

    const meta = await fetch(`${origin}/auth/setup/meta`);
    expect(meta.status).toBe(200);
    expect(await meta.json()).toEqual({ unclaimed: true, requiresCode: true });

    const claimed = await post(origin, {
      displayName: 'John Doe',
      email: 'john@openheaders.io',
      password: GOOD_PASSWORD,
    });
    expect(claimed.status).toBe(200);
    const payload = (await claimed.json()) as { ok: boolean; secret: string; revokedTokens: number };
    expect(payload.ok).toBe(true);
    expect(payload.revokedTokens).toBe(0);
    // The two fields the SPA consumes are the login response's two.
    expect((await validateDaemonAuthToken(payload.secret)).ok).toBe(true);

    expect(await (await fetch(`${origin}/auth/setup/meta`)).json()).toEqual({
      unclaimed: false,
      requiresCode: false,
    });
    const second = await post(origin, {
      displayName: 'Jane Doe',
      email: 'jane@openheaders.io',
      password: GOOD_PASSWORD,
    });
    expect(second.status).toBe(403);
    expect(await second.text()).toBe('{"ok":false}');
  });

  it('a remote peer is refused without the code and admitted with it', async () => {
    const { service } = makeService({ generateCode: () => '4KFP-9QW2-XM31' });
    await service.ensureSetupCode();
    const origin = await startDaemonHttp({ service, peer: '203.0.113.7' });
    const input = { displayName: 'John Doe', email: 'john@openheaders.io', password: GOOD_PASSWORD };

    const bare = await post(origin, input);
    const wrong = await post(origin, { ...input, code: '4KFP-9QW2-XM32' });
    expect(bare.status).toBe(403);
    expect(wrong.status).toBe(403);
    // Uniform: a claimed server and a wrong code are indistinguishable.
    expect(await bare.text()).toBe(await wrong.text());

    const coded = await post(origin, { ...input, code: '4KFP-9QW2-XM31' });
    expect(coded.status).toBe(200);
  });

  it('answers malformed and invalid input at 400 with a reason the form can render', async () => {
    const { service } = makeService();
    await service.ensureSetupCode();
    const origin = await startDaemonHttp({ service });

    const malformed = await fetch(`${origin}/auth/setup/claim`, { method: 'POST', body: 'not json' });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ ok: false, reason: 'malformed-request' });

    const short = await post(origin, {
      displayName: 'John Doe',
      email: 'john@openheaders.io',
      password: 'x',
    });
    expect(short.status).toBe(400);
    expect(await short.json()).toEqual({ ok: false, reason: 'password-too-short' });
    // The server is still there to be claimed properly.
    expect(await (await fetch(`${origin}/auth/setup/meta`)).json()).toEqual({ unclaimed: true, requiresCode: true });
  });

  it('holds the prefix: wrong methods and unknown subpaths never reach the SPA fallback', async () => {
    const { service } = makeService();
    await service.ensureSetupCode();
    const origin = await startDaemonHttp({ service });

    const badMethod = await fetch(`${origin}/auth/setup/meta`, { method: 'POST' });
    expect(badMethod.status).toBe(405);
    expect(badMethod.headers.get('allow')).toBe('GET');
    const claimGet = await fetch(`${origin}/auth/setup/claim`);
    expect(claimGet.status).toBe(405);
    expect(claimGet.headers.get('allow')).toBe('POST');
    const unknown = await fetch(`${origin}/auth/setup/anything`);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ ok: false });
  });
});
