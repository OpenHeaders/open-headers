/**
 * OIDC login flow engine (Phase 5 slice 3) — pure-service rows over a
 * stubbed issuer fetch and an injected ID-token decoder: authorization
 * URL shape (PKCE/state/nonce), one-shot state consumption, nonce
 * binding, the directory join (unknown email refused vs auto-provision),
 * session-token mint with expiry, and the one-shot claim swap. The full
 * HTTP + JWKS + real-socket path is the e2e gate's job.
 */

import {
  createDaemonUser,
  deactivateDaemonUser,
  ensureSyntheticIdentity,
  listDaemonUsers,
  validateDaemonAuthToken,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DaemonOidcConfig } from '../../../src/daemon/oidc/oidc-config';
import {
  createDaemonOidcService,
  type OidcIdTokenClaims,
  type OidcServiceDeps,
} from '../../../src/daemon/oidc/oidc-service';
import { createHostStorageFake } from '../_host-storage-fake';

const ISSUER = 'https://sso.openheaders.io';
const DISCOVERY = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  jwks_uri: `${ISSUER}/jwks`,
};

interface RigOptions {
  config?: Partial<DaemonOidcConfig>;
  /** Claims the stub decoder returns; `nonce` is filled from the flow when left undefined. */
  claims?: Partial<OidcIdTokenClaims>;
  tokenEndpointStatus?: number;
  discoveryStatus?: number;
  now?: () => number;
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function buildRig(options: RigOptions = {}) {
  const exchanges: Array<Record<string, string>> = [];
  let flowNonce: string | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/.well-known/openid-configuration')) {
      return jsonResponse(options.discoveryStatus ?? 200, DISCOVERY);
    }
    if (url === DISCOVERY.token_endpoint) {
      const body = new URLSearchParams(String(init?.body));
      exchanges.push(Object.fromEntries(body.entries()));
      return jsonResponse(options.tokenEndpointStatus ?? 200, { id_token: 'stub-id-token' });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const deps: OidcServiceDeps = {
    fetchImpl,
    ...(options.now ? { now: options.now } : {}),
    verifyIdToken: async () => ({
      nonce: flowNonce,
      email: 'alice@openheaders.io',
      ...options.claims,
    }),
  };
  const service = createDaemonOidcService({ issuer: ISSUER, clientId: 'oh-daemon', ...options.config }, deps);
  return {
    service,
    exchanges,
    setFlowNonce: (nonce: string | undefined) => {
      flowNonce = nonce;
    },
  };
}

/** Run begin → extract state/nonce from the authorization URL + the binding nonce. */
async function begin(rig: ReturnType<typeof buildRig>, origin = 'https://oh.openheaders.io') {
  const begun = await rig.service.beginLogin(origin);
  expect(begun.ok).toBe(true);
  if (!begun.ok) throw new Error('beginLogin refused');
  const url = new URL(begun.authorizationUrl);
  const state = url.searchParams.get('state') ?? '';
  rig.setFlowNonce(url.searchParams.get('nonce') ?? undefined);
  return { url, state, bindingNonce: begun.bindingNonce };
}

describe('daemon OIDC service', () => {
  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon' });
  });

  it('beginLogin builds a PKCE authorization URL against the discovered endpoint', async () => {
    const rig = buildRig();
    const { url } = await begin(rig);
    expect(url.origin + url.pathname).toBe(DISCOVERY.authorization_endpoint);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('oh-daemon');
    expect(url.searchParams.get('redirect_uri')).toBe('https://oh.openheaders.io/auth/oidc/callback');
    expect(url.searchParams.get('scope')).toContain('openid');
    expect(url.searchParams.get('scope')).toContain('email');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('completes a login for a pre-created directory user and mints a bound, expiring session token', async () => {
    const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const nowMs = 1_000_000;
    const rig = buildRig({ config: { sessionTtlDays: 1 }, now: () => nowMs });
    const { state, bindingNonce } = await begin(rig);
    const completed = await rig.service.completeLogin({ code: 'authcode', state, bindingNonce });
    expect(completed).toMatchObject({ ok: true, userId: created.record.user.id, email: 'alice@openheaders.io' });
    if (!completed.ok) return;
    // The exchange carried PKCE + the flow's redirect_uri.
    expect(rig.exchanges).toHaveLength(1);
    expect(rig.exchanges[0].grant_type).toBe('authorization_code');
    expect(rig.exchanges[0].code).toBe('authcode');
    expect(rig.exchanges[0].code_verifier).toBeTruthy();
    expect(rig.exchanges[0].redirect_uri).toBe('https://oh.openheaders.io/auth/oidc/callback');
    // Claim is one-shot and yields a token bound to the user…
    const claimed = rig.service.claimToken(completed.claimCode);
    expect(claimed).not.toBeNull();
    expect(rig.service.claimToken(completed.claimCode)).toBeNull();
    const valid = await validateDaemonAuthToken(claimed?.secret, () => nowMs);
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.userId).toBe(created.record.user.id);
    // …that expires after the configured TTL (1 day here).
    const afterTtl = await validateDaemonAuthToken(claimed?.secret, () => nowMs + 24 * 60 * 60_000);
    expect(afterTtl.ok).toBe(false);
    if (!afterTtl.ok) expect(afterTtl.reason).toBe('expired');
  });

  it('consumes state one-shot: an unknown or replayed callback dies as state-mismatch', async () => {
    await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    const rig = buildRig();
    const { state, bindingNonce } = await begin(rig);
    expect(await rig.service.completeLogin({ code: 'c', state: 'forged', bindingNonce })).toMatchObject({
      ok: false,
      reason: 'state-mismatch',
    });
    expect((await rig.service.completeLogin({ code: 'c', state, bindingNonce })).ok).toBe(true);
    expect(await rig.service.completeLogin({ code: 'c', state, bindingNonce })).toMatchObject({
      ok: false,
      reason: 'state-mismatch',
    });
  });

  it('refuses a callback whose binding nonce is not the one the flow started with', async () => {
    await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    const rig = buildRig();
    const { state } = await begin(rig);
    // Wrong browser: valid state, foreign binding — indistinguishable
    // from a forged state, and the state is spent by the attempt.
    expect(await rig.service.completeLogin({ code: 'c', state, bindingNonce: 'foreign-nonce' })).toMatchObject({
      ok: false,
      reason: 'state-mismatch',
    });
    expect(await rig.service.completeLogin({ code: 'c', state, bindingNonce: 'foreign-nonce' })).toMatchObject({
      ok: false,
      reason: 'state-mismatch',
    });
    expect(rig.exchanges).toHaveLength(0);
  });

  it('refuses an ID token whose nonce is not the flow nonce', async () => {
    await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    const rig = buildRig();
    const { state, bindingNonce } = await begin(rig);
    rig.setFlowNonce('some-other-nonce');
    expect(await rig.service.completeLogin({ code: 'c', state, bindingNonce })).toMatchObject({
      ok: false,
      reason: 'nonce-mismatch',
    });
  });

  it('refuses an unknown email when autoProvision is off (the default)', async () => {
    const rig = buildRig();
    const { state, bindingNonce } = await begin(rig);
    expect(await rig.service.completeLogin({ code: 'c', state, bindingNonce })).toMatchObject({
      ok: false,
      reason: 'unknown-user',
    });
    expect(await listDaemonUsers()).toHaveLength(0);
  });

  it('auto-provisions a directory user with zero grants when enabled', async () => {
    const rig = buildRig({ config: { autoProvision: true }, claims: { name: 'Alice A.' } });
    const { state, bindingNonce } = await begin(rig);
    const completed = await rig.service.completeLogin({ code: 'c', state, bindingNonce });
    expect(completed.ok).toBe(true);
    const users = await listDaemonUsers();
    expect(users).toHaveLength(1);
    expect(users[0].user.displayName).toBe('Alice A.');
    expect(users[0].userIdentity.value).toBe('alice@openheaders.io');
    if (completed.ok) expect(completed.userId).toBe(users[0].user.id);
  });

  it('refuses a deactivated directory user instead of provisioning a duplicate', async () => {
    const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    if (!created.ok) throw new Error('setup failed');
    await deactivateDaemonUser(created.record.user.id);
    const rig = buildRig({ config: { autoProvision: true } });
    const { state, bindingNonce } = await begin(rig);
    expect(await rig.service.completeLogin({ code: 'c', state, bindingNonce })).toMatchObject({
      ok: false,
      reason: 'user-deactivated',
    });
    expect(await listDaemonUsers()).toHaveLength(1);
  });

  it('refuses a provider-attested unverified email and a claims set with no email', async () => {
    const noEmail = buildRig({ claims: { email: undefined } });
    const first = await begin(noEmail);
    expect(
      await noEmail.service.completeLogin({ code: 'c', state: first.state, bindingNonce: first.bindingNonce }),
    ).toMatchObject({
      ok: false,
      reason: 'no-email',
    });
    const unverified = buildRig({ claims: { emailVerified: false } });
    const second = await begin(unverified);
    expect(
      await unverified.service.completeLogin({ code: 'c', state: second.state, bindingNonce: second.bindingNonce }),
    ).toMatchObject({
      ok: false,
      reason: 'email-unverified',
    });
  });

  it('reports exchange-failed when the token endpoint refuses the code', async () => {
    await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    const rig = buildRig({ tokenEndpointStatus: 400 });
    const { state, bindingNonce } = await begin(rig);
    expect(await rig.service.completeLogin({ code: 'bad', state, bindingNonce })).toMatchObject({
      ok: false,
      reason: 'exchange-failed',
    });
  });

  it('surfaces provider-unavailable on discovery failure and retries on the next attempt', async () => {
    let status = 500;
    const fetchImpl: typeof fetch = async () => jsonResponse(status, status === 200 ? DISCOVERY : {});
    const service = createDaemonOidcService(
      { issuer: ISSUER, clientId: 'oh-daemon' },
      { fetchImpl, verifyIdToken: async () => ({}) },
    );
    expect(await service.beginLogin('http://127.0.0.1:8137')).toMatchObject({
      ok: false,
      reason: 'provider-unavailable',
    });
    status = 200;
    expect((await service.beginLogin('http://127.0.0.1:8137')).ok).toBe(true);
  });

  it('sends client_secret_basic on the exchange only for confidential clients', async () => {
    await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    const seen: Array<string | undefined> = [];
    const makeFetch =
      (record: boolean): typeof fetch =>
      async (input, init) => {
        const url = String(input);
        if (url.endsWith('/.well-known/openid-configuration')) return jsonResponse(200, DISCOVERY);
        if (record) {
          const headers = new Headers(init?.headers);
          seen.push(headers.get('authorization') ?? undefined);
        }
        return jsonResponse(200, { id_token: 'stub' });
      };
    for (const clientSecret of [undefined, 's3cret']) {
      let nonce: string | undefined;
      const service = createDaemonOidcService(
        { issuer: ISSUER, clientId: 'oh-daemon', ...(clientSecret ? { clientSecret } : {}) },
        {
          fetchImpl: makeFetch(true),
          verifyIdToken: async () => ({ nonce, email: 'alice@openheaders.io' }),
        },
      );
      const begun = await service.beginLogin('http://127.0.0.1:8137');
      if (!begun.ok) throw new Error('begin refused');
      const url = new URL(begun.authorizationUrl);
      nonce = url.searchParams.get('nonce') ?? undefined;
      const completed = await service.completeLogin({
        code: 'c',
        state: url.searchParams.get('state') ?? '',
        bindingNonce: begun.bindingNonce,
      });
      expect(completed.ok).toBe(true);
    }
    expect(seen[0]).toBeUndefined();
    expect(seen[1]).toMatch(/^Basic /);
  });
});
