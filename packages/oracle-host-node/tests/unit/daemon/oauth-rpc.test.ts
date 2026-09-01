/**
 * OAuth RPC plane — the six `oauth*` channels over mocked oracle flows
 * and a stub transport: channel ownership, the redirect URI read per
 * call, the authorize refusal on a host without a browser, the
 * authorize success shape (bundle + redirectUri) and its step-tagged
 * failure, the bundle channels' success / failure shapes, and revoke.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOAuthRpc } from '../../../src/daemon/oauth-rpc';

const flows = vi.hoisted(() => ({
  performAuthorizationCodeFlow: vi.fn(),
  performClientCredentialsFlow: vi.fn(),
  performPasswordCredentialsFlow: vi.fn(),
  performRefresh: vi.fn(),
  deleteTokenBundle: vi.fn(),
}));

vi.mock('@openheaders/oracle/live/request-exec/oauth-flows', () => ({
  performAuthorizationCodeFlow: (...args: unknown[]) => flows.performAuthorizationCodeFlow(...(args as [])),
  performClientCredentialsFlow: (...args: unknown[]) => flows.performClientCredentialsFlow(...(args as [])),
  performPasswordCredentialsFlow: (...args: unknown[]) => flows.performPasswordCredentialsFlow(...(args as [])),
}));
vi.mock('@openheaders/oracle/live/request-exec/oauth-refresh', () => ({
  performRefresh: (...args: unknown[]) => flows.performRefresh(...(args as [])),
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  deleteTokenBundle: (...args: unknown[]) => flows.deleteTokenBundle(...(args as [])),
}));

import { OAuth2FlowError } from '@openheaders/oracle/live/request-exec/oauth-exchange';

const transport = { send: vi.fn() };
const REDIRECT = 'http://127.0.0.1:8137/oauth/callback';

const CONFIG: OAuth2Auth = {
  type: 'oauth2',
  credentialRef: 'cred-1',
  flow: 'authorization-code-pkce',
  authorizationEndpoint: 'https://auth.openheaders.io/authorize',
  tokenEndpoint: 'https://auth.openheaders.io/token',
  clientId: 'client-1',
  scopes: [],
};

const BUNDLE: OAuth2TokenBundle = {
  accessToken: 'at-1',
  tokenType: 'Bearer',
  expiresAt: Date.now() + 3_600_000,
  issuedAt: Date.now(),
  scope: '',
};

function makeRpc(launch: ((authUrl: string, state: string) => Promise<string>) | null = null) {
  return createOAuthRpc({ transport, redirectUri: () => REDIRECT, launchAuthorization: launch });
}

beforeEach(() => {
  for (const fn of Object.values(flows)) fn.mockReset();
});

describe('createOAuthRpc', () => {
  it('owns exactly the six oauth channels', () => {
    const rpc = makeRpc();
    for (const type of [
      'oauthAuthorize',
      'oauthClientCredentials',
      'oauthPasswordCredentials',
      'oauthRefresh',
      'oauthRevoke',
      'oauthGetRedirectUri',
    ]) {
      expect(rpc.owns(type)).toBe(true);
    }
    expect(rpc.owns('oauthSomethingElse')).toBe(false);
    expect(rpc.owns(undefined)).toBe(false);
  });

  it('answers the redirect URI from the getter', async () => {
    await expect(makeRpc().dispatch('oauthGetRedirectUri', {})).resolves.toEqual({ redirectUri: REDIRECT });
  });

  it('refuses authorize honestly on a host without a browser, without launching a flow', async () => {
    const res = await makeRpc(null).dispatch('oauthAuthorize', { config: CONFIG });
    expect(res).toMatchObject({ success: false, error: expect.stringContaining('no browser') });
    expect(flows.performAuthorizationCodeFlow).not.toHaveBeenCalled();
  });

  it('runs the authorization-code flow with the launcher and answers bundle + redirectUri', async () => {
    const launch = vi.fn(async () => `${REDIRECT}?code=c&state=s`);
    flows.performAuthorizationCodeFlow.mockResolvedValueOnce({ bundle: BUNDLE, redirectUri: REDIRECT });
    const res = await makeRpc(launch).dispatch('oauthAuthorize', { config: CONFIG, workspaceId: 'ws-1' });
    expect(res).toEqual({ success: true, bundle: BUNDLE, redirectUri: REDIRECT });
    expect(flows.performAuthorizationCodeFlow).toHaveBeenCalledWith(CONFIG, 'ws-1', transport, {
      redirectUri: REDIRECT,
      launch,
    });
  });

  it('a flow failure answers success:false with the step-tagged message', async () => {
    flows.performAuthorizationCodeFlow.mockRejectedValueOnce(new OAuth2FlowError('authorize', 'state mismatch'));
    const res = await makeRpc(async () => '').dispatch('oauthAuthorize', { config: CONFIG });
    expect(res).toEqual({ success: false, error: 'authorize: state mismatch' });
  });

  it('client credentials / password / refresh answer the bundle', async () => {
    flows.performClientCredentialsFlow.mockResolvedValueOnce(BUNDLE);
    flows.performPasswordCredentialsFlow.mockResolvedValueOnce(BUNDLE);
    flows.performRefresh.mockResolvedValueOnce(BUNDLE);
    const rpc = makeRpc();
    await expect(rpc.dispatch('oauthClientCredentials', { config: CONFIG, workspaceId: 'ws-1' })).resolves.toEqual({
      success: true,
      bundle: BUNDLE,
    });
    expect(flows.performClientCredentialsFlow).toHaveBeenCalledWith(CONFIG, 'ws-1', transport);
    await expect(rpc.dispatch('oauthPasswordCredentials', { config: CONFIG })).resolves.toEqual({
      success: true,
      bundle: BUNDLE,
    });
    await expect(rpc.dispatch('oauthRefresh', { config: CONFIG })).resolves.toEqual({ success: true, bundle: BUNDLE });
    expect(flows.performRefresh).toHaveBeenCalledWith(CONFIG, undefined, transport);
  });

  it('an unexpected error answers its bare message', async () => {
    flows.performClientCredentialsFlow.mockRejectedValueOnce(new Error('Proxy connection refused'));
    await expect(makeRpc().dispatch('oauthClientCredentials', { config: CONFIG })).resolves.toEqual({
      success: false,
      error: 'Proxy connection refused',
    });
  });

  it('revoke deletes the bundle and reports whether one was there', async () => {
    flows.deleteTokenBundle.mockResolvedValueOnce(true);
    await expect(makeRpc().dispatch('oauthRevoke', { credentialRef: 'cred-1', workspaceId: 'ws-1' })).resolves.toEqual({
      success: true,
      removed: true,
    });
    expect(flows.deleteTokenBundle).toHaveBeenCalledWith('cred-1', 'ws-1');
    await expect(makeRpc().dispatch('oauthRevoke', {})).resolves.toMatchObject({ success: false, removed: false });
  });
});
