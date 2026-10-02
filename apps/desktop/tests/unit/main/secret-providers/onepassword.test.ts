/**
 * The desktop's `onepassword` provider over an injected fake SDK: the
 * SDK loads on first use and never at construction, a probe never
 * creates a client, the two auth lanes build their auth value, one
 * client per connection reused across resolves and re-created after a
 * config edit or a session-expired error, and the vendor's errors map
 * onto the three typed failures.
 */

import type { Client } from '@1password/sdk';
import type { SecretLocator, SecretManagerConnection } from '@openheaders/core/secret-providers';
import { describe, expect, it, vi } from 'vitest';
import {
  createOnePasswordProvider,
  type OnePasswordSdk,
  SERVICE_ACCOUNT_TOKEN_ENV,
} from '../../../../src/main/secret-providers/onepassword';

class DesktopSessionExpiredError extends Error {}
class AuthExpiredError extends Error {}
class RateLimitExceededError extends Error {}
class DesktopAuth {
  constructor(public accountName: string) {}
}

function connection(config: Partial<Extract<SecretManagerConnection['config'], { provider: 'onepassword' }>> = {}) {
  return {
    uid: 'conn0001',
    label: 'Work',
    config: { provider: 'onepassword' as const, account: 'work', auth: 'app' as const, ...config },
  } satisfies SecretManagerConnection;
}

const LOCATOR: SecretLocator = {
  provider: 'onepassword',
  connectionId: 'conn0001',
  vault: 'Engineering',
  item: 'api.openheaders.io',
  field: 'token',
};

function fakeSdk(
  resolve: (reference: string) => Promise<string>,
  createFails?: () => Error,
  listVaults: () => Promise<unknown[]> = async () => [],
) {
  const created: unknown[] = [];
  const list = vi.fn(listVaults);
  const createClient = vi.fn(async (config: { auth?: unknown }) => {
    if (createFails) throw createFails();
    created.push(config.auth);
    return { secrets: { resolve }, vaults: { list } } as unknown as Client;
  });
  const sdk: OnePasswordSdk = {
    createClient,
    DesktopAuth,
    DesktopSessionExpiredError,
    AuthExpiredError,
    RateLimitExceededError,
  };
  const loadSdk = vi.fn(async () => sdk);
  return { sdk, loadSdk, createClient, created, list };
}

describe('desktop onepassword provider', () => {
  it('loads the SDK on first use, never at construction; a probe never creates a client', async () => {
    const { loadSdk, createClient } = fakeSdk(async () => 'v');
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(loadSdk).not.toHaveBeenCalled();
    expect(await provider.probe(connection())).toEqual({ available: true });
    expect(loadSdk).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('an SDK that cannot load reads not-installed with the detail', async () => {
    const provider = createOnePasswordProvider({
      integrationVersion: '2026.10.1',
      loadSdk: async () => {
        throw new Error('wasm missing');
      },
      env: {},
    });
    expect(await provider.probe(connection())).toEqual({
      available: false,
      reason: 'not-installed',
      detail: 'wasm missing',
    });
  });

  it('the app lane needs an account; the service-account lane needs the environment token', async () => {
    const { loadSdk } = fakeSdk(async () => 'v');
    const bare = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await bare.probe(connection({ account: ' ' }))).toMatchObject({
      available: false,
      reason: 'no-credentials',
    });
    expect(await bare.probe(connection({ auth: 'service-account' }))).toMatchObject({
      available: false,
      reason: 'no-credentials',
    });
    const withToken = createOnePasswordProvider({
      integrationVersion: '2026.10.1',
      loadSdk,
      env: { [SERVICE_ACCOUNT_TOKEN_ENV]: 'ops_token' },
    });
    expect(await withToken.probe(connection({ auth: 'service-account' }))).toEqual({ available: true });
  });

  it('resolves through one client per connection, built for the lane, and reuses it', async () => {
    const resolve = vi.fn(async (reference: string) => `value-of:${reference}`);
    const { loadSdk, createClient, created } = fakeSdk(resolve);
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.resolve(connection(), LOCATOR)).toEqual({
      ok: true,
      value: 'value-of:op://Engineering/api.openheaders.io/token',
    });
    expect(await provider.resolve(connection(), { ...LOCATOR, field: 'url' })).toEqual({
      ok: true,
      value: 'value-of:op://Engineering/api.openheaders.io/url',
    });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ integrationName: 'OpenHeaders', integrationVersion: '2026.10.1' }),
    );
    expect(created[0]).toBeInstanceOf(DesktopAuth);
    expect((created[0] as DesktopAuth).accountName).toBe('work');
  });

  it('concurrent first uses of one connection create one client, so a send prompts once', async () => {
    const { loadSdk, createClient } = fakeSdk(async () => 'v');
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    const results = await Promise.all([
      provider.resolve(connection(), LOCATOR),
      provider.resolve(connection(), { ...LOCATOR, field: 'url' }),
      provider.resolve(connection(), { ...LOCATOR, field: 'username' }),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('the service-account lane hands the SDK the environment token itself', async () => {
    const { loadSdk, created } = fakeSdk(async () => 'v');
    const provider = createOnePasswordProvider({
      integrationVersion: '2026.10.1',
      loadSdk,
      env: { [SERVICE_ACCOUNT_TOKEN_ENV]: ' ops_token ' },
    });
    expect(await provider.resolve(connection({ auth: 'service-account' }), LOCATOR)).toEqual({ ok: true, value: 'v' });
    expect(created[0]).toBe('ops_token');
  });

  it('an edited connection config re-creates the client', async () => {
    const { loadSdk, createClient } = fakeSdk(async () => 'v');
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    await provider.resolve(connection(), LOCATOR);
    await provider.resolve(connection({ account: 'other' }), LOCATOR);
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('a session-expired error reads authorization-required and drops the client for the next use', async () => {
    let calls = 0;
    const { loadSdk, createClient } = fakeSdk(async () => {
      calls++;
      if (calls === 1) throw new DesktopSessionExpiredError('session ended');
      return 'fresh';
    });
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.resolve(connection(), LOCATOR)).toEqual({
      ok: false,
      reason: 'authorization-required',
      detail: 'session ended',
    });
    expect(await provider.resolve(connection(), LOCATOR)).toEqual({ ok: true, value: 'fresh' });
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it("a resolve-time not-found is the row's failure, never the connection's standing state", async () => {
    const { loadSdk } = fakeSdk(async () => {
      throw new Error('error resolving secret reference: no vault matched the secret reference query');
    });
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.resolve(connection(), LOCATOR)).toMatchObject({ ok: false, reason: 'not-found' });
    expect(await provider.probe(connection())).toMatchObject({ available: true });
  });

  it('a Test with a held client is a round trip: it lists the vaults and refreshes the verified moment', async () => {
    let clock = 1_000;
    const { loadSdk, createClient, list } = fakeSdk(async () => 'v');
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {}, now: () => clock });
    expect(await provider.authorize?.(connection())).toEqual({ ok: true });
    clock = 5_000;
    expect(await provider.authorize?.(connection())).toEqual({ ok: true });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(2);
    expect(await provider.probe(connection())).toEqual({ available: true, verifiedAt: 5_000 });
  });

  it('a Test whose session lapsed re-creates the client, prompting again', async () => {
    let lapsed = false;
    const { loadSdk, createClient } = fakeSdk(
      async () => 'v',
      undefined,
      async () => {
        if (lapsed) {
          lapsed = false;
          throw new DesktopSessionExpiredError('session ended');
        }
        return [];
      },
    );
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.authorize?.(connection())).toEqual({ ok: true });
    lapsed = true;
    expect(await provider.authorize?.(connection())).toEqual({ ok: true });
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it("a Test the manager refuses becomes the connection's standing state and drops the client", async () => {
    let refuse = false;
    const { loadSdk, createClient } = fakeSdk(
      async () => 'v',
      undefined,
      async () => {
        if (refuse) throw new Error('Denied authorization for SDK client');
        return [];
      },
    );
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.authorize?.(connection())).toEqual({ ok: true });
    refuse = true;
    expect(await provider.authorize?.(connection())).toEqual({
      ok: false,
      reason: 'denied',
      detail: 'Denied authorization for SDK client',
    });
    expect(await provider.probe(connection())).toMatchObject({ available: false, reason: 'denied' });
    refuse = false;
    expect(await provider.authorize?.(connection())).toEqual({ ok: true });
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('a stale handle after a lock re-creates the client on Test instead of reading a refusal', async () => {
    let stale = false;
    const { loadSdk, createClient } = fakeSdk(
      async () => 'v',
      undefined,
      async () => {
        if (stale) {
          stale = false;
          throw new Error('invalid client id');
        }
        return [];
      },
    );
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.authorize?.(connection())).toEqual({ ok: true });
    stale = true;
    expect(await provider.authorize?.(connection())).toEqual({ ok: true });
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(await provider.probe(connection())).toMatchObject({ available: true });
  });

  it('a stale handle after a lock re-creates the client and retries the same send once', async () => {
    let stale = false;
    const resolve = vi.fn(async (reference: string) => {
      if (stale) {
        stale = false;
        throw new Error('invalid client id');
      }
      return `value-of:${reference}`;
    });
    const { loadSdk, createClient } = fakeSdk(resolve);
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.resolve(connection(), LOCATOR)).toMatchObject({ ok: true });
    stale = true;
    expect(await provider.resolve(connection(), LOCATOR)).toEqual({
      ok: true,
      value: 'value-of:op://Engineering/api.openheaders.io/token',
    });
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledTimes(3);
  });

  it('a prompt declined while the SDK rebuilt its session mid-resolve reads as authorization required, and the next send asks again', async () => {
    let decline = false;
    const resolve = vi.fn(async (reference: string) => {
      if (decline) {
        decline = false;
        throw new Error('Denied authorization for SDK client');
      }
      return `value-of:${reference}`;
    });
    const { loadSdk, createClient } = fakeSdk(resolve);
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.resolve(connection(), LOCATOR)).toMatchObject({ ok: true });
    decline = true;
    expect(await provider.resolve(connection(), LOCATOR)).toEqual({
      ok: false,
      reason: 'authorization-required',
      detail: 'Denied authorization for SDK client',
    });
    expect(await provider.probe(connection())).toMatchObject({ available: false, reason: 'denied' });
    expect(await provider.resolve(connection(), LOCATOR)).toMatchObject({ ok: true });
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('a probe carries the last successful contact while the client is held, and nothing once the session ends', async () => {
    let clock = 1_000;
    let expire = false;
    const { loadSdk } = fakeSdk(async () => {
      if (expire) throw new DesktopSessionExpiredError('session ended');
      return 'v';
    });
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {}, now: () => clock });
    expect(await provider.probe(connection())).toEqual({ available: true });
    expect(await provider.authorize?.(connection())).toEqual({ ok: true });
    expect(await provider.probe(connection())).toEqual({ available: true, verifiedAt: 1_000 });
    clock = 2_000;
    expect(await provider.resolve(connection(), LOCATOR)).toEqual({ ok: true, value: 'v' });
    expect(await provider.probe(connection())).toEqual({ available: true, verifiedAt: 2_000 });
    expire = true;
    expect(await provider.resolve(connection(), LOCATOR)).toMatchObject({
      ok: false,
      reason: 'authorization-required',
    });
    expect(await provider.probe(connection())).toEqual({ available: true });
  });

  it('maps the vendor resolve errors onto the typed failures', async () => {
    const cases: Array<[Error, string]> = [
      [new AuthExpiredError('expired'), 'authorization-required'],
      [new RateLimitExceededError('slow down'), 'unavailable'],
      [new Error('error resolving secret reference: vault not found'), 'not-found'],
      [new Error('error resolving secret reference: no vault matched the secret reference query'), 'not-found'],
      [new Error('invalid secret reference format'), 'not-found'],
      [new Error('network down'), 'unavailable'],
    ];
    for (const [err, reason] of cases) {
      const { loadSdk } = fakeSdk(async () => {
        throw err;
      });
      const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
      expect(await provider.resolve(connection(), LOCATOR)).toMatchObject({ ok: false, reason, detail: err.message });
    }
  });

  it('a client the app refuses to create becomes the standing probe state and the honest resolve failure', async () => {
    const { loadSdk } = fakeSdk(
      async () => 'v',
      () => new Error('the integration is disabled in the app'),
    );
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.authorize?.(connection())).toEqual({
      ok: false,
      reason: 'integration-disabled',
      detail: 'the integration is disabled in the app',
    });
    expect(await provider.probe(connection())).toEqual({
      available: false,
      reason: 'integration-disabled',
      detail: 'the integration is disabled in the app',
    });
    expect(await provider.resolve(connection(), LOCATOR)).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it("the SDK's missing-app and unloadable-library texts read not-installed", async () => {
    for (const text of ['1Password desktop application not found', 'Native library is not available.']) {
      const { loadSdk } = fakeSdk(
        async () => 'v',
        () => new Error(text),
      );
      const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
      expect(await provider.authorize?.(connection())).toEqual({ ok: false, reason: 'not-installed', detail: text });
      expect(await provider.probe(connection())).toEqual({ available: false, reason: 'not-installed', detail: text });
    }
  });

  it('a denied prompt reads denied on the probe and authorization-required on resolve', async () => {
    const text =
      'An error occurred when processing SDK request: Error { msg: Denied authorization for SDK client, inner: None }';
    const { loadSdk } = fakeSdk(
      async () => 'v',
      () => new Error(text),
    );
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.resolve(connection(), LOCATOR)).toEqual({
      ok: false,
      reason: 'authorization-required',
      detail: text,
    });
    expect(await provider.probe(connection())).toEqual({ available: false, reason: 'denied', detail: text });
    expect(await provider.authorize?.(connection())).toEqual({ ok: false, reason: 'denied', detail: text });
  });

  it('a locked manager reads locked on the probe and authorization-required on resolve', async () => {
    const { loadSdk } = fakeSdk(
      async () => 'v',
      () => new Error('the app is locked'),
    );
    const provider = createOnePasswordProvider({ integrationVersion: '2026.10.1', loadSdk, env: {} });
    expect(await provider.resolve(connection(), LOCATOR)).toMatchObject({
      ok: false,
      reason: 'authorization-required',
    });
    expect(await provider.probe(connection())).toMatchObject({ available: false, reason: 'locked' });
  });
});
