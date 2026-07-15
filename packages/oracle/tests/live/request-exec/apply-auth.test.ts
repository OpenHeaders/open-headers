/**
 * applyAuth — the executor's auth-folding step, tested directly with a
 * stub resolveStr. Covers the auth-wins replacement contract
 * (setAuthHeader replaces same-key user headers instead of duplicating),
 * the `disabled` gate, api-key header/query paths, and the OAuth 2.0
 * bundle attach/refresh branches (token store mocked).
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { AuthConfig } from '@openheaders/core/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAuth } from '../../../src/live/request-exec/resolve-request';

const getTokenBundleMock = vi.fn();
vi.mock('../../../src/entity/oauth-token-store', () => ({
  getTokenBundle: (...args: unknown[]) => getTokenBundleMock(...args),
}));

afterEach(() => {
  getTokenBundleMock.mockReset();
});

type Pair = { key: string; value: string };

const identity = (s: string): string => s;

function makeOAuthAuth(overrides: Partial<Extract<AuthConfig, { type: 'oauth2' }>> = {}): AuthConfig {
  return {
    type: 'oauth2',
    credentialRef: 'cred-1',
    flow: 'authorization-code-pkce',
    tokenEndpoint: 'https://auth.openheaders.io/token',
    clientId: 'client-1',
    scopes: [],
    ...overrides,
  };
}

function makeBundle(overrides: Partial<OAuth2TokenBundle> = {}): OAuth2TokenBundle {
  return {
    accessToken: 'at-live',
    tokenType: 'Bearer',
    expiresAt: Date.now() + 3_600_000,
    issuedAt: Date.now(),
    scope: '',
    ...overrides,
  };
}

async function run(auth: AuthConfig, headers: Pair[] = [], params: Pair[] = [], resolveStr = identity) {
  await applyAuth(auth, headers, params, resolveStr, { workspaceId: 'ws-1' });
  return { headers, params };
}

describe('applyAuth', () => {
  it('bearer adds an Authorization header', async () => {
    const { headers } = await run({ type: 'bearer', token: 'tok-1' });
    expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer tok-1' }]);
  });

  it('bearer REPLACES a same-key user header instead of duplicating (auth-wins)', async () => {
    const { headers } = await run({ type: 'bearer', token: 'tok-1' }, [
      { key: 'Authorization', value: 'Bearer stale-user-token' },
    ]);
    expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer tok-1' }]);
  });

  it('replacement is case-insensitive and removes every colliding row', async () => {
    const { headers } = await run({ type: 'bearer', token: 'tok-1' }, [
      { key: 'authorization', value: 'a' },
      { key: 'X-Keep', value: 'kept' },
      { key: 'AUTHORIZATION', value: 'b' },
    ]);
    expect(headers).toEqual([
      { key: 'X-Keep', value: 'kept' },
      { key: 'Authorization', value: 'Bearer tok-1' },
    ]);
  });

  it('resolves templates in the bearer token', async () => {
    const resolveStr = (s: string) => s.replace('{{vault.token}}', 'resolved-tok');
    const { headers } = await run({ type: 'bearer', token: '{{vault.token}}' }, [], [], resolveStr);
    expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer resolved-tok' }]);
  });

  it('disabled suspends the contribution and leaves the user header untouched', async () => {
    const { headers } = await run({ type: 'bearer', token: 'tok-1', disabled: true }, [
      { key: 'Authorization', value: 'Bearer user-token' },
    ]);
    expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer user-token' }]);
  });

  it('none and inherit contribute nothing', async () => {
    for (const auth of [{ type: 'none' }, { type: 'inherit' }] as AuthConfig[]) {
      const { headers, params } = await run(auth, [{ key: 'X-A', value: '1' }]);
      expect(headers).toEqual([{ key: 'X-A', value: '1' }]);
      expect(params).toEqual([]);
    }
  });

  it('digest folds nothing at resolve time — the transport answers the challenge', async () => {
    const { headers, params } = await run({ type: 'digest', username: 'u', password: 'p' }, [
      { key: 'X-A', value: '1' },
    ]);
    expect(headers).toEqual([{ key: 'X-A', value: '1' }]);
    expect(params).toEqual([]);
  });

  it('basic encodes username:password as UTF-8 base64 and replaces the user row', async () => {
    const { headers } = await run({ type: 'basic', username: 'alice', password: 'pässwörd' }, [
      { key: 'Authorization', value: 'Basic old' },
    ]);
    expect(headers).toHaveLength(1);
    const value = headers[0].value;
    expect(value.startsWith('Basic ')).toBe(true);
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(value.slice('Basic '.length)), (c) => c.charCodeAt(0)),
    );
    expect(decoded).toBe('alice:pässwörd');
  });

  it('api-key in header replaces a same-key user header', async () => {
    const { headers } = await run({ type: 'api-key', key: 'X-Api-Key', value: 'k-1', in: 'header' }, [
      { key: 'x-api-key', value: 'user-key' },
      { key: 'X-Other', value: 'kept' },
    ]);
    expect(headers).toEqual([
      { key: 'X-Other', value: 'kept' },
      { key: 'X-Api-Key', value: 'k-1' },
    ]);
  });

  it('api-key in query APPENDS to params (no replacement there)', async () => {
    const { headers, params } = await run(
      { type: 'api-key', key: 'api_key', value: 'k-1', in: 'query' },
      [],
      [{ key: 'api_key', value: 'user-key' }],
    );
    expect(headers).toEqual([]);
    expect(params).toEqual([
      { key: 'api_key', value: 'user-key' },
      { key: 'api_key', value: 'k-1' },
    ]);
  });

  it('api-key disabled contributes to neither headers nor params', async () => {
    const { headers, params } = await run({
      type: 'api-key',
      key: 'api_key',
      value: 'k-1',
      in: 'query',
      disabled: true,
    });
    expect(headers).toEqual([]);
    expect(params).toEqual([]);
  });

  it('oauth2 attaches the stored bundle as an Authorization header', async () => {
    getTokenBundleMock.mockResolvedValue(makeBundle());
    const { headers } = await run(makeOAuthAuth(), [{ key: 'Authorization', value: 'Bearer user-token' }]);
    expect(getTokenBundleMock).toHaveBeenCalledWith('cred-1', 'ws-1');
    expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer at-live' }]);
  });

  it('oauth2 sendAs query appends access_token to params', async () => {
    getTokenBundleMock.mockResolvedValue(makeBundle());
    const { headers, params } = await run(makeOAuthAuth({ sendAs: 'query' }));
    expect(headers).toEqual([]);
    expect(params).toEqual([{ key: 'access_token', value: 'at-live' }]);
  });

  it('oauth2 with no stored bundle contributes nothing', async () => {
    getTokenBundleMock.mockResolvedValue(null);
    const { headers, params } = await run(makeOAuthAuth());
    expect(headers).toEqual([]);
    expect(params).toEqual([]);
  });

  it('oauth2 refreshes an expired bundle when a refresh token + host hook exist', async () => {
    getTokenBundleMock.mockResolvedValue(makeBundle({ expiresAt: Date.now() - 1000, refreshToken: 'rt-1' }));
    const refreshOAuth = vi.fn().mockResolvedValue(makeBundle({ accessToken: 'at-fresh' }));
    const headers: Pair[] = [];
    await applyAuth(makeOAuthAuth(), headers, [], identity, { workspaceId: 'ws-1', refreshOAuth });
    expect(refreshOAuth).toHaveBeenCalledOnce();
    expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer at-fresh' }]);
  });

  it('oauth2 attaches the stale bundle when refresh returns null', async () => {
    getTokenBundleMock.mockResolvedValue(makeBundle({ expiresAt: Date.now() - 1000, refreshToken: 'rt-1' }));
    const refreshOAuth = vi.fn().mockResolvedValue(null);
    const headers: Pair[] = [];
    await applyAuth(makeOAuthAuth(), headers, [], identity, { workspaceId: 'ws-1', refreshOAuth });
    expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer at-live' }]);
  });

  it('oauth2 skips refresh when the bundle has no refresh token', async () => {
    getTokenBundleMock.mockResolvedValue(makeBundle({ expiresAt: Date.now() - 1000 }));
    const refreshOAuth = vi.fn();
    const headers: Pair[] = [];
    await applyAuth(makeOAuthAuth(), headers, [], identity, { workspaceId: 'ws-1', refreshOAuth });
    expect(refreshOAuth).not.toHaveBeenCalled();
    expect(headers).toEqual([{ key: 'Authorization', value: 'Bearer at-live' }]);
  });
});
