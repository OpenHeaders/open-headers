/**
 * The authorization service (the client sign-in plan §14.3): both
 * grants over one pending table — the parked authorize request and its
 * refusals, the PKCE verification at redemption, the device code and
 * the user code, the §3.5 poll answers with `slow_down`, mint at
 * redemption exactly once, the caps, the shared failed-lookup budget,
 * the retire grace, and the in-memory restart semantics. The mint rides
 * the real `mintDaemonAuthToken` into the in-memory `HostStorage` fake.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDaemonAuthorizationService,
  DAEMON_CLI_CLIENT_ID,
  DAEMON_DESKTOP_CLIENT_ID,
  DAEMON_EXTENSION_CLIENT_ID,
  type DaemonAuthorizationService,
  type DaemonAuthorizationServiceOptions,
  defaultGenerateUserCode,
  listDaemonAuthTokens,
  normalizeUserCode,
  USER_CODE_ALPHABET,
} from '../../src/identity';
import { computeCodeChallenge, generateCodeVerifier } from '../../src/oauth';
import { setHostStorage } from '../../src/storage/host-storage';
import { createHostStorageFake } from './_host-storage-fake';

const REDIRECT = 'http://127.0.0.1:8137/oauth/callback';
const PEER = '192.168.1.20';

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

interface Pkce {
  readonly verifier: string;
  readonly challenge: string;
}

async function pkce(): Promise<Pkce> {
  const verifier = generateCodeVerifier(randomBytes);
  return { verifier, challenge: await computeCodeChallenge(verifier, sha256) };
}

let now = 1_000_000;

function service(overrides: DaemonAuthorizationServiceOptions = {}): DaemonAuthorizationService {
  let ids = 0;
  return createDaemonAuthorizationService({
    now: () => now,
    generateId: () => `auth-${++ids}`,
    generateUserCode: () => 'BCDF-GHJK',
    sessionTtlMs: 60_000,
    ...overrides,
  });
}

function codeRequest(
  challenge: string,
  overrides: Partial<Parameters<DaemonAuthorizationService['beginCode']>[0]> = {},
) {
  return {
    clientId: DAEMON_DESKTOP_CLIENT_ID,
    redirectUri: REDIRECT,
    state: 'st-1',
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
    peer: PEER,
    deviceLabel: ' Work laptop ',
    ...overrides,
  };
}

beforeEach(() => {
  now = 1_000_000;
  setHostStorage(createHostStorageFake());
});

describe('the authorization code grant', () => {
  it('parks a validated request under an opaque id with the code-grant TTL and exposes only public facts', async () => {
    const svc = service();
    const { challenge } = await pkce();
    const begun = svc.beginCode(codeRequest(challenge));
    expect(begun).toEqual({ ok: true, id: 'auth-1', expiresAt: now + 10 * 60_000 });
    expect(svc.facts('auth-1')).toEqual({
      id: 'auth-1',
      clientId: DAEMON_DESKTOP_CLIENT_ID,
      clientKind: 'desktop',
      clientName: 'the desktop app',
      grant: 'code',
      deviceLabel: 'Work laptop',
      peer: PEER,
      status: 'pending',
      expiresAt: now + 10 * 60_000,
    });
    expect(JSON.stringify(svc.facts('auth-1'))).not.toContain(challenge);
    expect(svc.facts('auth-2')).toBeNull();
  });

  it('refuses an unknown client, a client without the code grant, a foreign redirect, a missing state and a bad challenge — each by name', async () => {
    const svc = service();
    const { challenge } = await pkce();
    expect(svc.beginCode(codeRequest(challenge, { clientId: 'openheaders-phone' }))).toEqual({
      ok: false,
      reason: 'unknown-client',
    });
    expect(svc.beginCode(codeRequest(challenge, { clientId: DAEMON_CLI_CLIENT_ID }))).toEqual({
      ok: false,
      reason: 'unsupported-grant',
    });
    expect(svc.beginCode(codeRequest(challenge, { redirectUri: 'http://evil.openheaders.io/oauth/callback' }))).toEqual(
      { ok: false, reason: 'invalid-redirect' },
    );
    expect(svc.beginCode(codeRequest(challenge, { state: '' }))).toEqual({ ok: false, reason: 'invalid-state' });
    expect(svc.beginCode(codeRequest(challenge, { codeChallengeMethod: 'plain' }))).toEqual({
      ok: false,
      reason: 'invalid-challenge',
    });
    expect(svc.beginCode(codeRequest('too-short'))).toEqual({ ok: false, reason: 'invalid-challenge' });
    expect(svc.list()).toEqual([]);
  });

  it('approve mints the one-shot code once and answers the redirect target; nothing lands on the ledger', async () => {
    const svc = service({ generateAuthorizationCode: () => 'code-1' });
    const { challenge } = await pkce();
    svc.beginCode(codeRequest(challenge));
    const approved = await svc.approve('auth-1', 'user-alice');
    expect(approved).toEqual({ ok: true, grant: 'code', redirectUri: REDIRECT, code: 'code-1', state: 'st-1' });
    expect(await listDaemonAuthTokens()).toHaveLength(0);
    const [entry] = svc.list();
    expect(entry.status).toBe('approved');
    expect(entry.approvedUserId).toBe('user-alice');
    expect(entry.authorizationCodeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(entry)).not.toContain('code-1');
    expect(svc.facts('auth-1')?.status).toBe('approved');
    // A second decision on a decided record is refused.
    expect(await svc.approve('auth-1', 'user-bob')).toEqual({ ok: false, reason: 'consumed' });
    expect(svc.deny('auth-1')).toEqual({ ok: false, reason: 'consumed' });
  });

  it('redeemCode verifies the verifier, the client and the redirect, mints ONCE as a bound session token and settles consumed', async () => {
    const svc = service({ generateAuthorizationCode: () => 'code-1' });
    const { verifier, challenge } = await pkce();
    svc.beginCode(codeRequest(challenge));
    await svc.approve('auth-1', 'user-alice');
    const redeemed = await svc.redeemCode({
      code: 'code-1',
      codeVerifier: verifier,
      redirectUri: REDIRECT,
      clientId: DAEMON_DESKTOP_CLIENT_ID,
    });
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    expect(redeemed.secret).toMatch(/^oh_/);
    expect(redeemed.userId).toBe('user-alice');
    expect(redeemed.expiresAt).toBe(now + 60_000);
    const [token] = await listDaemonAuthTokens();
    expect(token).toMatchObject({
      id: redeemed.tokenId,
      kind: 'session',
      userId: 'user-alice',
      label: 'device:desktop:Work laptop',
      expiresAt: now + 60_000,
    });
    expect(svc.list()[0].status).toBe('consumed');
    expect(svc.facts('auth-1')?.status).toBe('consumed');
    // One-shot: the same code reads unknown afterwards, and nothing more is minted.
    const replay = await svc.redeemCode({
      code: 'code-1',
      codeVerifier: verifier,
      redirectUri: REDIRECT,
      clientId: DAEMON_DESKTOP_CLIENT_ID,
    });
    expect(replay).toEqual({ ok: false, reason: 'unknown' });
    expect(await listDaemonAuthTokens()).toHaveLength(1);
  });

  it('the code alone yields nothing: a wrong verifier, a wrong client and a wrong redirect are refused alike and mint nothing', async () => {
    const svc = service({ generateAuthorizationCode: () => 'code-1' });
    const { verifier, challenge } = await pkce();
    const other = await pkce();
    svc.beginCode(codeRequest(challenge));
    await svc.approve('auth-1', 'user-alice');
    const base = { code: 'code-1', codeVerifier: verifier, redirectUri: REDIRECT, clientId: DAEMON_DESKTOP_CLIENT_ID };
    expect(await svc.redeemCode({ ...base, codeVerifier: other.verifier })).toEqual({ ok: false, reason: 'mismatch' });
    expect(await svc.redeemCode({ ...base, codeVerifier: '' })).toEqual({ ok: false, reason: 'mismatch' });
    expect(await svc.redeemCode({ ...base, clientId: DAEMON_EXTENSION_CLIENT_ID })).toEqual({
      ok: false,
      reason: 'mismatch',
    });
    expect(await svc.redeemCode({ ...base, redirectUri: 'http://127.0.0.1:9999/oauth/callback' })).toEqual({
      ok: false,
      reason: 'mismatch',
    });
    expect(await listDaemonAuthTokens()).toHaveLength(0);
    // The record is still approved: the right verifier still redeems.
    expect((await svc.redeemCode(base)).ok).toBe(true);
  });

  it('an unredeemed code expires after 60 s while the record lives on; an unapproved record has no code', async () => {
    const svc = service({ generateAuthorizationCode: () => 'code-1' });
    const { verifier, challenge } = await pkce();
    svc.beginCode(codeRequest(challenge));
    const base = { code: 'code-1', codeVerifier: verifier, redirectUri: REDIRECT, clientId: DAEMON_DESKTOP_CLIENT_ID };
    expect(await svc.redeemCode(base)).toEqual({ ok: false, reason: 'unknown' });
    await svc.approve('auth-1', 'user-alice');
    now += 60_000;
    expect(await svc.redeemCode(base)).toEqual({ ok: false, reason: 'expired' });
    expect(svc.facts('auth-1')?.status).toBe('approved');
    expect(await listDaemonAuthTokens()).toHaveLength(0);
  });

  it('concurrent redemptions of one code mint exactly one token', async () => {
    const svc = service({ generateAuthorizationCode: () => 'code-1' });
    const { verifier, challenge } = await pkce();
    svc.beginCode(codeRequest(challenge));
    await svc.approve('auth-1', 'user-alice');
    const base = { code: 'code-1', codeVerifier: verifier, redirectUri: REDIRECT, clientId: DAEMON_DESKTOP_CLIENT_ID };
    const results = await Promise.all([svc.redeemCode(base), svc.redeemCode(base), svc.redeemCode(base)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(2);
    expect(await listDaemonAuthTokens()).toHaveLength(1);
  });

  it('a failed mint releases the approval so the client redeems again without a second approval', async () => {
    let fail = true;
    const svc = service({
      generateAuthorizationCode: () => 'code-1',
      mintToken: async (input) => {
        if (fail) throw new Error('storage down');
        return {
          secret: 'oh_minted',
          record: {
            id: 'token-1',
            tokenHash: 'h',
            label: input?.label,
            kind: 'session',
            createdAt: 0,
            lastUsedAt: null,
            revokedAt: null,
          },
        };
      },
    });
    const { verifier, challenge } = await pkce();
    svc.beginCode(codeRequest(challenge));
    await svc.approve('auth-1', 'user-alice');
    const base = { code: 'code-1', codeVerifier: verifier, redirectUri: REDIRECT, clientId: DAEMON_DESKTOP_CLIENT_ID };
    await expect(svc.redeemCode(base)).rejects.toThrow('storage down');
    expect(svc.list()[0].status).toBe('approved');
    fail = false;
    expect(await svc.redeemCode(base)).toMatchObject({ ok: true, secret: 'oh_minted', tokenId: 'token-1' });
  });

  it('deny settles the record: facts read denied, approve is refused, a later redemption is refused', async () => {
    const svc = service({ generateAuthorizationCode: () => 'code-1' });
    const { verifier, challenge } = await pkce();
    svc.beginCode(codeRequest(challenge));
    // The refusal names the client's redirect and state — the route
    // sends the browser there with error=access_denied.
    expect(svc.deny('auth-1')).toEqual({ ok: true, grant: 'code', redirectUri: REDIRECT, state: 'st-1' });
    expect(svc.facts('auth-1')?.status).toBe('denied');
    expect(await svc.approve('auth-1', 'user-alice')).toEqual({ ok: false, reason: 'denied' });
    expect(svc.deny('auth-1')).toEqual({ ok: false, reason: 'denied' });
    expect(svc.deny('auth-9')).toEqual({ ok: false, reason: 'unknown' });
    expect(await svc.approve('auth-9', 'user-alice')).toEqual({ ok: false, reason: 'unknown' });
    expect(
      await svc.redeemCode({
        code: 'code-1',
        codeVerifier: verifier,
        redirectUri: REDIRECT,
        clientId: DAEMON_DESKTOP_CLIENT_ID,
      }),
    ).toEqual({ ok: false, reason: 'unknown' });
  });

  it('a parked request nobody decided expires with its TTL and refuses approval; an approval nobody redeemed expires too', async () => {
    const svc = service({ generateAuthorizationCode: () => 'code-1' });
    const { verifier, challenge } = await pkce();
    svc.beginCode(codeRequest(challenge));
    svc.beginCode(codeRequest(challenge, { state: 'st-2' }));
    await svc.approve('auth-2', 'user-alice');
    now += 10 * 60_000;
    expect(svc.facts('auth-1')?.status).toBe('expired');
    expect(await svc.approve('auth-1', 'user-alice')).toEqual({ ok: false, reason: 'expired' });
    expect(svc.facts('auth-2')?.status).toBe('expired');
    expect(
      await svc.redeemCode({
        code: 'code-1',
        codeVerifier: verifier,
        redirectUri: REDIRECT,
        clientId: DAEMON_DESKTOP_CLIENT_ID,
      }),
    ).toEqual({ ok: false, reason: 'expired' });
    expect(await listDaemonAuthTokens()).toHaveLength(0);
  });
});

describe('the device authorization grant', () => {
  it('starts with a hashed device code, a hyphenated user code, the 5-minute TTL and the 5-second interval', async () => {
    const svc = service({ generateDeviceCode: () => 'device-code-1' });
    const begun = await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER, deviceLabel: 'ci-box' });
    expect(begun).toEqual({
      ok: true,
      id: 'auth-1',
      deviceCode: 'device-code-1',
      userCode: 'BCDF-GHJK',
      expiresAt: now + 5 * 60_000,
      intervalSeconds: 5,
    });
    const [entry] = svc.list();
    expect(entry.deviceCodeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(entry)).not.toContain('device-code-1');
    expect(svc.facts('auth-1')).toEqual({
      id: 'auth-1',
      clientId: DAEMON_CLI_CLIENT_ID,
      clientKind: 'cli',
      clientName: 'the command-line tool',
      grant: 'device',
      deviceLabel: 'ci-box',
      userCode: 'BCDF-GHJK',
      peer: PEER,
      status: 'pending',
      expiresAt: now + 5 * 60_000,
    });
  });

  it('refuses an unknown client and a client without the device grant', async () => {
    const svc = service();
    expect(await svc.beginDevice({ clientId: 'openheaders-phone', peer: PEER })).toEqual({
      ok: false,
      reason: 'unknown-client',
    });
    expect(await svc.beginDevice({ clientId: DAEMON_DESKTOP_CLIENT_ID, peer: PEER })).toEqual({
      ok: false,
      reason: 'unsupported-grant',
    });
    // The extension may fall back to the device grant.
    expect((await svc.beginDevice({ clientId: DAEMON_EXTENSION_CLIENT_ID, peer: PEER })).ok).toBe(true);
  });

  it('the user code is found case-folded with the hyphen optional; an unknown code draws the budget', async () => {
    const svc = service({ maxFailedLookups: 2, lockoutMs: 30_000 });
    await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER });
    expect(svc.lookupByUserCode('BCDF-GHJK')).toEqual({ ok: true, id: 'auth-1' });
    expect(svc.lookupByUserCode('bcdfghjk')).toEqual({ ok: true, id: 'auth-1' });
    expect(svc.lookupByUserCode(' bcdf ghjk ')).toEqual({ ok: true, id: 'auth-1' });
    expect(svc.lookupByUserCode('ZZZZ-ZZZZ')).toEqual({ ok: false, reason: 'unknown' });
    expect(svc.lookupByUserCode('ZZZZ-ZZZY')).toEqual({ ok: false, reason: 'unknown' });
    // Locked: even the live code is hidden until the cooldown elapses.
    expect(svc.lookupByUserCode('BCDF-GHJK')).toEqual({ ok: false, reason: 'unknown' });
    now += 30_001;
    expect(svc.lookupByUserCode('BCDF-GHJK')).toEqual({ ok: true, id: 'auth-1' });
  });

  it('the poll waits, then mints ONCE after approval — bound, labelled, expiring by the session TTL — and the device code is spent', async () => {
    const svc = service({ generateDeviceCode: () => 'device-code-1' });
    await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER, deviceLabel: 'ci-box' });
    const poll = { deviceCode: 'device-code-1', clientId: DAEMON_CLI_CLIENT_ID };
    expect(await svc.pollDevice(poll)).toEqual({ status: 'pending', intervalSeconds: 5 });
    expect(await svc.approve('auth-1', 'user-alice')).toEqual({ ok: true, grant: 'device' });
    expect(await listDaemonAuthTokens()).toHaveLength(0);
    now += 5_000;
    const minted = await svc.pollDevice(poll);
    expect(minted).toMatchObject({ status: 'approved', userId: 'user-alice', expiresAt: now + 60_000 });
    if (minted.status !== 'approved') return;
    expect(minted.secret).toMatch(/^oh_/);
    const [token] = await listDaemonAuthTokens();
    expect(token).toMatchObject({
      id: minted.tokenId,
      kind: 'session',
      userId: 'user-alice',
      label: 'device:cli:ci-box',
    });
    now += 5_000;
    expect(await svc.pollDevice(poll)).toEqual({ status: 'unknown' });
    expect(await listDaemonAuthTokens()).toHaveLength(1);
    expect(svc.facts('auth-1')?.status).toBe('consumed');
  });

  it('labels an unnamed device by its client kind alone', async () => {
    const svc = service({ generateDeviceCode: () => 'device-code-1' });
    await svc.beginDevice({ clientId: DAEMON_EXTENSION_CLIENT_ID, peer: PEER, deviceLabel: '  ' });
    await svc.approve('auth-1', 'user-alice');
    await svc.pollDevice({ deviceCode: 'device-code-1', clientId: DAEMON_EXTENSION_CLIENT_ID });
    expect((await listDaemonAuthTokens())[0].label).toBe('device:extension');
  });

  it('a poll faster than the interval answers slow_down and grows the interval by five for every later poll', async () => {
    const svc = service({ generateDeviceCode: () => 'device-code-1' });
    await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER });
    const poll = { deviceCode: 'device-code-1', clientId: DAEMON_CLI_CLIENT_ID };
    expect(await svc.pollDevice(poll)).toEqual({ status: 'pending', intervalSeconds: 5 });
    now += 1_000;
    expect(await svc.pollDevice(poll)).toEqual({ status: 'slow_down', intervalSeconds: 10 });
    now += 5_000;
    expect(await svc.pollDevice(poll)).toEqual({ status: 'slow_down', intervalSeconds: 15 });
    now += 15_000;
    expect(await svc.pollDevice(poll)).toEqual({ status: 'pending', intervalSeconds: 15 });
  });

  it('deny, expiry and a wrong client each answer the poll by name; the settled verdict outlives the expiry through the grace', async () => {
    const svc = service({ generateDeviceCode: () => 'device-code-1' });
    await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER });
    const poll = { deviceCode: 'device-code-1', clientId: DAEMON_CLI_CLIENT_ID };
    expect(await svc.pollDevice({ ...poll, clientId: DAEMON_EXTENSION_CLIENT_ID })).toEqual({ status: 'unknown' });
    expect(svc.deny('auth-1')).toEqual({ ok: true, grant: 'device' });
    expect(await svc.pollDevice(poll)).toEqual({ status: 'denied' });
    now += 5 * 60_000 + 1;
    expect(await svc.pollDevice(poll)).toEqual({ status: 'denied' });
    now += 5 * 60_000;
    expect(await svc.pollDevice(poll)).toEqual({ status: 'unknown' });
    expect(svc.facts('auth-1')).toBeNull();

    const expiring = service({ generateDeviceCode: () => 'device-code-2' });
    await expiring.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER });
    now += 5 * 60_000;
    expect(await expiring.pollDevice({ deviceCode: 'device-code-2', clientId: DAEMON_CLI_CLIENT_ID })).toEqual({
      status: 'expired',
    });
    expect(await expiring.approve('auth-1', 'user-alice')).toEqual({ ok: false, reason: 'expired' });
  });

  it('parallel polls on one approved device code mint exactly one token', async () => {
    const svc = service({ generateDeviceCode: () => 'device-code-1' });
    await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER });
    await svc.approve('auth-1', 'user-alice');
    const poll = { deviceCode: 'device-code-1', clientId: DAEMON_CLI_CLIENT_ID };
    const results = await Promise.all([svc.pollDevice(poll), svc.pollDevice(poll)]);
    expect(results.map((r) => r.status).sort()).toEqual(['approved', 'slow_down']);
    expect(await listDaemonAuthTokens()).toHaveLength(1);
  });

  it('a failed mint releases the approval so the next poll retries without a second approval', async () => {
    let fail = true;
    const svc = service({
      generateDeviceCode: () => 'device-code-1',
      mintToken: async (input) => {
        if (fail) throw new Error('storage down');
        return {
          secret: 'oh_minted',
          record: {
            id: 'token-1',
            tokenHash: 'h',
            label: input?.label,
            kind: 'session',
            createdAt: 0,
            lastUsedAt: null,
            revokedAt: null,
          },
        };
      },
    });
    await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER });
    await svc.approve('auth-1', 'user-alice');
    const poll = { deviceCode: 'device-code-1', clientId: DAEMON_CLI_CLIENT_ID };
    await expect(svc.pollDevice(poll)).rejects.toThrow('storage down');
    expect(svc.list()[0].status).toBe('approved');
    fail = false;
    now += 5_000;
    expect(await svc.pollDevice(poll)).toMatchObject({ status: 'approved', secret: 'oh_minted' });
  });

  it('an unknown device code and an unknown authorization code draw the one budget with the user code; a live poll never does', async () => {
    const svc = service({ generateDeviceCode: () => 'device-code-1', maxFailedLookups: 3, lockoutMs: 30_000 });
    await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER });
    const poll = { deviceCode: 'device-code-1', clientId: DAEMON_CLI_CLIENT_ID };
    for (let i = 0; i < 20; i++) {
      now += 5_000;
      expect(await svc.pollDevice(poll)).toEqual({ status: 'pending', intervalSeconds: 5 });
    }
    expect(await svc.pollDevice({ ...poll, deviceCode: 'nope' })).toEqual({ status: 'unknown' });
    expect(
      await svc.redeemCode({
        code: 'nope',
        codeVerifier: 'v',
        redirectUri: REDIRECT,
        clientId: DAEMON_DESKTOP_CLIENT_ID,
      }),
    ).toEqual({ ok: false, reason: 'unknown' });
    expect(svc.lookupByUserCode('ZZZZ-ZZZZ')).toEqual({ ok: false, reason: 'unknown' });
    // The budget tripped: the live device code and the live user code hide too.
    now += 5_000;
    expect(await svc.pollDevice(poll)).toEqual({ status: 'unknown' });
    expect(svc.lookupByUserCode('BCDF-GHJK')).toEqual({ ok: false, reason: 'unknown' });
    now += 30_001;
    expect(await svc.pollDevice(poll)).toEqual({ status: 'pending', intervalSeconds: 5 });
  });
});

describe('the caps', () => {
  it('holds 32 in-flight records across both grants and 4 per peer; a settled record frees its slot', async () => {
    const svc = service({ generateUserCode: defaultGenerateUserCode });
    const { challenge } = await pkce();
    let n = 0;
    for (let peer = 0; peer < 8; peer++) {
      for (let k = 0; k < 4; k++) {
        const result =
          n++ % 2 === 0
            ? svc.beginCode(codeRequest(challenge, { peer: `10.0.0.${peer}` }))
            : await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: `10.0.0.${peer}` });
        expect(result.ok).toBe(true);
      }
      expect(svc.beginCode(codeRequest(challenge, { peer: `10.0.0.${peer}` }))).toEqual({
        ok: false,
        reason: 'too-many-pending',
      });
    }
    expect(svc.beginCode(codeRequest(challenge, { peer: '10.0.0.99' }))).toEqual({
      ok: false,
      reason: 'too-many-pending',
    });
    expect(await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: '10.0.0.99' })).toEqual({
      ok: false,
      reason: 'too-many-pending',
    });
    svc.deny('auth-1');
    expect(svc.beginCode(codeRequest(challenge, { peer: '10.0.0.99' })).ok).toBe(true);
  });

  it('cancel drops a record: its facts, its user code and its device code all read unknown', async () => {
    const svc = service({ generateDeviceCode: () => 'device-code-1' });
    await svc.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER });
    svc.cancel('auth-1');
    expect(svc.facts('auth-1')).toBeNull();
    expect(svc.lookupByUserCode('BCDF-GHJK')).toEqual({ ok: false, reason: 'unknown' });
    expect(await svc.pollDevice({ deviceCode: 'device-code-1', clientId: DAEMON_CLI_CLIENT_ID })).toEqual({
      status: 'unknown',
    });
  });

  it('a fresh service knows nothing of another instance — a restart invalidates every pending authorization', async () => {
    const first = service({ generateDeviceCode: () => 'device-code-1' });
    await first.beginDevice({ clientId: DAEMON_CLI_CLIENT_ID, peer: PEER });
    await first.approve('auth-1', 'user-alice');
    const second = service({ generateDeviceCode: () => 'device-code-1' });
    expect(second.facts('auth-1')).toBeNull();
    expect(await second.pollDevice({ deviceCode: 'device-code-1', clientId: DAEMON_CLI_CLIENT_ID })).toEqual({
      status: 'unknown',
    });
    expect(await listDaemonAuthTokens()).toHaveLength(0);
    first.dispose();
    expect(() => first.beginCode(codeRequest('x'))).toThrow('disposed');
  });
});

describe('the user code generator', () => {
  it("draws eight letters of RFC 8628 §6.1's alphabet with a hyphen after four", () => {
    for (let i = 0; i < 50; i++) {
      const code = defaultGenerateUserCode();
      expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
    }
    expect(USER_CODE_ALPHABET).toHaveLength(20);
    expect(normalizeUserCode('bcdf-ghjk')).toBe('BCDFGHJK');
  });

  it('rejection-samples bytes ≥ 240 so no letter is over-represented', () => {
    const fed = [0, 19, 20, 240, 255, 39, 1, 2, 3, 4, 5];
    let cursor = 0;
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint8Array) for (let i = 0; i < array.length; i++) array[i] = fed[cursor++] ?? 0;
      return array;
    });
    try {
      // Accepted in order: 0→B, 19→Z, 20→B, (240, 255 skipped), 39→Z, 1→C, 2→D, 3→F, 4→G.
      expect(defaultGenerateUserCode()).toBe('BZBZ-CDFG');
    } finally {
      vi.restoreAllMocks();
    }
  });
});
