/**
 * Local password login (enterprise Phase 3) — the scrypt verifier
 * roundtrip, the login service (session-kind mint, uniform refusals,
 * per-account lockout, the decoy-burn timing posture is exercised but
 * not timed), the operator setPassword admin channel, and the HTTP
 * surface over a real loopback socket composed behind admission
 * (uniform 401, meta probe, claimed-prefix 404).
 */

import { createServer, type Server } from 'node:http';
import {
  createDaemonPairingService,
  createDaemonUser,
  deactivateDaemonUser,
  ensureSyntheticIdentity,
  findDaemonUserByEmail,
  listDaemonAuthTokens,
  setDaemonUserPassword,
  validateDaemonAuthToken,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAdminChannelHandlers, PASSWORD_MIN_LENGTH } from '../../../src/daemon/admin-channels';
import { createAdmissionControl } from '../../../src/daemon/admission-control';
import { createPasswordHttpHandler } from '../../../src/daemon/password/password-http';
import { createDaemonPasswordLoginService } from '../../../src/daemon/password/password-login-service';
import { hashPassword, verifyPassword } from '../../../src/daemon/password/password-verifier';
import { createHostStorageFake } from '../_host-storage-fake';

async function addUser(email: string, displayName = 'Alice'): Promise<string> {
  const created = await createDaemonUser({ displayName, email });
  if (!created.ok) throw new Error(`setup failed: ${created.reason}`);
  return created.record.user.id;
}

async function setPassword(userId: string, password: string): Promise<void> {
  const result = await setDaemonUserPassword(userId, await hashPassword(password));
  if (!result.ok) throw new Error(`setup failed: ${result.reason}`);
}

describe('password verifier', () => {
  it('roundtrips and refuses a wrong password', async () => {
    const verifier = await hashPassword('correct horse battery');
    expect(verifier.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', verifier)).toBe(true);
    expect(await verifyPassword('correct horse batterz', verifier)).toBe(false);
    expect(await verifyPassword('', verifier)).toBe(false);
  });

  it('salts every mint — two verifiers for one password differ, both verify', async () => {
    const [a, b] = await Promise.all([hashPassword('shared-secret'), hashPassword('shared-secret')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('shared-secret', a)).toBe(true);
    expect(await verifyPassword('shared-secret', b)).toBe(true);
  });

  it('verifies at the parameters the verifier declares (cost agility)', async () => {
    const verifier = await hashPassword('pw');
    const parts = verifier.split('$');
    // A tampered cost derives a different key — refused, not crashed.
    const tampered = ['scrypt', '4', parts[2], parts[3], parts[4], parts[5]].join('$');
    expect(await verifyPassword('pw', tampered)).toBe(false);
  });

  it('refuses malformed verifiers', async () => {
    expect(await verifyPassword('pw', '')).toBe(false);
    expect(await verifyPassword('pw', 'bcrypt$x$y')).toBe(false);
    expect(await verifyPassword('pw', 'scrypt$a$b$c$d$e')).toBe(false);
    expect(await verifyPassword('pw', 'scrypt$32768$8$1$$')).toBe(false);
  });
});

describe('password login service', () => {
  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon' });
  });

  it('mints a bound, expiring session-kind token on a verified credential', async () => {
    const userId = await addUser('alice@openheaders.io');
    await setPassword(userId, 'alice-password-1');
    const service = createDaemonPasswordLoginService();
    const result = await service.login('Alice@OPENHEADERS.IO', 'alice-password-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userId).toBe(userId);
    const validated = await validateDaemonAuthToken(result.secret);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.userId).toBe(userId);
    const [token] = await listDaemonAuthTokens();
    expect(token.kind).toBe('session');
    expect(token.userId).toBe(userId);
    expect(token.label).toBe('password:alice@openheaders.io');
    expect(token.expiresAt).toBeGreaterThan(Date.now());
  });

  it('refuses unknown emails, deactivated users, passwordless and cleared accounts, and wrong passwords', async () => {
    const userId = await addUser('alice@openheaders.io');
    const service = createDaemonPasswordLoginService();
    expect(await service.login('nobody@openheaders.io', 'x')).toEqual({ ok: false, reason: 'unknown-user' });
    expect(await service.login('alice@openheaders.io', 'x')).toEqual({ ok: false, reason: 'no-password' });
    await setPassword(userId, 'alice-password-1');
    expect(await service.login('alice@openheaders.io', 'wrong')).toEqual({ ok: false, reason: 'bad-password' });
    await setDaemonUserPassword(userId, null);
    expect(await service.login('alice@openheaders.io', 'alice-password-1')).toEqual({
      ok: false,
      reason: 'no-password',
    });
    await setPassword(userId, 'alice-password-1');
    await deactivateDaemonUser(userId);
    expect(await service.login('alice@openheaders.io', 'alice-password-1')).toEqual({
      ok: false,
      reason: 'user-deactivated',
    });
    expect(await listDaemonAuthTokens()).toHaveLength(0);
  });

  it('locks the account after repeated failures — even the correct password is refused until the block expires', async () => {
    let clock = 1_000_000;
    const now = () => clock;
    const userId = await addUser('alice@openheaders.io');
    await setPassword(userId, 'alice-password-1');
    const service = createDaemonPasswordLoginService({ now });
    for (let i = 0; i < 5; i++) {
      expect((await service.login('alice@openheaders.io', `wrong-${i}`)).ok).toBe(false);
    }
    expect(await service.login('alice@openheaders.io', 'alice-password-1')).toEqual({
      ok: false,
      reason: 'account-locked',
    });
    // The lockout keys the ACCOUNT — another user logs in fine.
    const bobId = await addUser('bob@openheaders.io', 'Bob');
    await setPassword(bobId, 'bob-password-22');
    expect((await service.login('bob@openheaders.io', 'bob-password-22')).ok).toBe(true);
    // Block expiry restores the account.
    clock += 16 * 60_000;
    expect((await service.login('alice@openheaders.io', 'alice-password-1')).ok).toBe(true);
  });

  it('enabled() reflects whether any ACTIVE user holds a password', async () => {
    const service = createDaemonPasswordLoginService();
    expect(await service.enabled()).toBe(false);
    const userId = await addUser('alice@openheaders.io');
    expect(await service.enabled()).toBe(false);
    await setPassword(userId, 'alice-password-1');
    expect(await service.enabled()).toBe(true);
    await deactivateDaemonUser(userId);
    expect(await service.enabled()).toBe(false);
  });
});

describe('users.setPassword admin channel', () => {
  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon' });
  });

  function channels() {
    return createAdminChannelHandlers({
      pairing: createDaemonPairingService(),
      getBoundPort: () => 0,
      getWsServer: () => null,
      queryAudit: () => [],
      license: {
        getSnapshot: () => ({ status: 'unlicensed' as const }),
        getInstalledText: async () => null,
        install: async () => ({ ok: false as const, error: 'not under test' }),
        remove: async () => ({ ok: true as const, snapshot: { status: 'unlicensed' as const } }),
        reload: async () => ({ status: 'unlicensed' as const }),
        dispose: () => undefined,
      },
      cliProvision: {
        status: async () => ({ configPath: '/dev/null', state: 'unconfigured' as const }),
        provision: async () => ({ ok: false as const, error: 'not under test' }),
      },
      proxyTrust: {
        status: async () => ({ ca: null, stores: [], changes: [] }),
        install: async () => ({ ok: false as const, error: 'not under test' }),
        remove: async () => ({ ok: true, results: [] }),
      },
    });
  }

  it('sets and clears a password; the projection carries hasPassword, never the verifier', async () => {
    const userId = await addUser('alice@openheaders.io');
    const table = channels();
    const setHandler = table.get('oh.daemon.users.setPassword');
    const listHandler = table.get('oh.daemon.users.list');
    if (!setHandler || !listHandler) throw new Error('channel missing');

    expect(await setHandler({ type: 'oh.daemon.users.setPassword', userId, password: 'alice-password-1' })).toEqual({
      ok: true,
    });
    const record = await findDaemonUserByEmail('alice@openheaders.io');
    expect(record?.passwordVerifier?.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('alice-password-1', record?.passwordVerifier ?? '')).toBe(true);

    const listed = (await listHandler({ type: 'oh.daemon.users.list' })) as {
      users: Array<Record<string, unknown>>;
    };
    expect(listed.users[0].hasPassword).toBe(true);
    expect(JSON.stringify(listed)).not.toContain('scrypt$');

    expect(await setHandler({ type: 'oh.daemon.users.setPassword', userId, password: null })).toEqual({ ok: true });
    expect((await findDaemonUserByEmail('alice@openheaders.io'))?.passwordVerifier).toBeUndefined();
  });

  it('refuses short passwords, missing ids, and deactivated users', async () => {
    const userId = await addUser('alice@openheaders.io');
    const table = channels();
    const setHandler = table.get('oh.daemon.users.setPassword');
    if (!setHandler) throw new Error('channel missing');
    const short = (await setHandler({
      type: 'oh.daemon.users.setPassword',
      userId,
      password: 'x'.repeat(PASSWORD_MIN_LENGTH - 1),
    })) as { ok: boolean };
    expect(short.ok).toBe(false);
    expect((await setHandler({ type: 'oh.daemon.users.setPassword', password: 'long-enough-pw' })) as object).toEqual({
      ok: false,
      error: 'missing userId',
    });
    await deactivateDaemonUser(userId);
    expect(await setHandler({ type: 'oh.daemon.users.setPassword', userId, password: 'long-enough-pw' })).toEqual({
      ok: false,
      error: 'user-deactivated',
    });
  });
});

describe('password HTTP surface over a real socket', () => {
  let server: Server | null = null;

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon' });
  });

  async function startDaemonHttp(): Promise<string> {
    const admission = createAdmissionControl({ passwordEnabled: true });
    const handler = createPasswordHttpHandler({ service: createDaemonPasswordLoginService() });
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

  it('meta reports enabled; login answers the secret on success and a uniform 401 on every refusal', async () => {
    const userId = await addUser('alice@openheaders.io');
    const origin = await startDaemonHttp();

    const metaBefore = await fetch(`${origin}/auth/password/meta`);
    expect(await metaBefore.json()).toEqual({ enabled: false });
    await setPassword(userId, 'alice-password-1');
    const metaAfter = await fetch(`${origin}/auth/password/meta`);
    expect(await metaAfter.json()).toEqual({ enabled: true });

    const login = async (email: string, password: string) =>
      fetch(`${origin}/auth/password/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

    const ok = await login('alice@openheaders.io', 'alice-password-1');
    expect(ok.status).toBe(200);
    const payload = (await ok.json()) as { ok: boolean; secret: string };
    expect(payload.ok).toBe(true);
    expect((await validateDaemonAuthToken(payload.secret)).ok).toBe(true);

    // Uniform refusal: wrong password, unknown email, malformed body —
    // byte-identical bodies, one status.
    const wrong = await login('alice@openheaders.io', 'nope-nope-nope');
    const unknown = await login('nobody@openheaders.io', 'alice-password-1');
    const malformed = await fetch(`${origin}/auth/password/login`, { method: 'POST', body: 'not json' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(await wrong.text()).toBe(await unknown.text());

    // Claimed prefix: unknown subpaths never fall through; methods gate.
    expect((await fetch(`${origin}/auth/password/whatever`)).status).toBe(404);
    expect((await fetch(`${origin}/auth/password/login`)).status).toBe(405);
    expect((await fetch(`${origin}/auth/password/meta`, { method: 'POST' })).status).toBe(405);

    server?.close();
    server = null;
  });

  it('a foreign browser Origin is refused by admission before the handler runs', async () => {
    const origin = await startDaemonHttp();
    const forged = await fetch(`${origin}/auth/password/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ email: 'alice@openheaders.io', password: 'x' }),
    });
    expect(forged.status).toBe(403);
    server?.close();
    server = null;
  });
});
