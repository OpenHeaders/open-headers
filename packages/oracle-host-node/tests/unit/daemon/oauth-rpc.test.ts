/**
 * OAuth RPC plane — the eleven `oauth*` channels over mocked oracle flows
 * and a stub transport: channel ownership, the redirect URI read per
 * call, the authorize refusal on a host without a browser, the
 * authorize success shape (bundle + redirectUri) and its step-tagged
 * failure, the bundle channels' success / failure shapes, the device
 * grant's start / status / cancel, revoke, and the issuer discovery
 * walk's answer / refusal shapes.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOAuthRpc } from '../../../src/daemon/oauth-rpc';

const flows = vi.hoisted(() => ({
  performAuthorizationCodeFlow: vi.fn(),
  performClientCredentialsFlow: vi.fn(),
  performPasswordCredentialsFlow: vi.fn(),
  performJwtBearerFlow: vi.fn(),
  performRefresh: vi.fn(),
  deleteTokenBundle: vi.fn(),
  startDeviceFlow: vi.fn(),
  getDeviceFlowState: vi.fn(),
  cancelDeviceFlow: vi.fn(),
  discoverAuthorizationServer: vi.fn(),
}));

vi.mock('@openheaders/oracle/live/request-exec/oauth-flows', () => ({
  performAuthorizationCodeFlow: (...args: unknown[]) => flows.performAuthorizationCodeFlow(...(args as [])),
  performClientCredentialsFlow: (...args: unknown[]) => flows.performClientCredentialsFlow(...(args as [])),
  performPasswordCredentialsFlow: (...args: unknown[]) => flows.performPasswordCredentialsFlow(...(args as [])),
  performJwtBearerFlow: (...args: unknown[]) => flows.performJwtBearerFlow(...(args as [])),
}));
vi.mock('@openheaders/oracle/live/request-exec/oauth-refresh', () => ({
  performRefresh: (...args: unknown[]) => flows.performRefresh(...(args as [])),
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  deleteTokenBundle: (...args: unknown[]) => flows.deleteTokenBundle(...(args as [])),
}));
vi.mock('@openheaders/oracle/live/request-exec/oauth-discovery', () => ({
  discoverAuthorizationServer: (...args: unknown[]) => flows.discoverAuthorizationServer(...(args as [])),
}));
vi.mock('@openheaders/oracle/live/request-exec/oauth-device', () => ({
  startDeviceFlow: (...args: unknown[]) => flows.startDeviceFlow(...(args as [])),
  getDeviceFlowState: (...args: unknown[]) => flows.getDeviceFlowState(...(args as [])),
  cancelDeviceFlow: (...args: unknown[]) => flows.cancelDeviceFlow(...(args as [])),
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
  it('owns exactly the eleven oauth channels', () => {
    const rpc = makeRpc();
    for (const type of [
      'oauthAuthorize',
      'oauthClientCredentials',
      'oauthPasswordCredentials',
      'oauthJwtBearer',
      'oauthDeviceStart',
      'oauthDeviceStatus',
      'oauthDeviceCancel',
      'oauthRefresh',
      'oauthRevoke',
      'oauthGetRedirectUri',
      'oauthDiscover',
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

describe('oauthJwtBearer', () => {
  it('runs the jwt-bearer flow over the transport and answers the bundle shape', async () => {
    flows.performJwtBearerFlow.mockResolvedValue(BUNDLE);
    const rpc = makeRpc();
    const config: OAuth2Auth = { ...CONFIG, flow: 'jwt-bearer', assertionIssuer: 'svc@openheaders.io' };
    await expect(rpc.dispatch('oauthJwtBearer', { config, workspaceId: 'ws-1' })).resolves.toEqual({
      success: true,
      bundle: BUNDLE,
    });
    expect(flows.performJwtBearerFlow).toHaveBeenCalledWith(config, 'ws-1', transport);
  });

  it('a step-tagged failure answers success: false with the step named', async () => {
    flows.performJwtBearerFlow.mockRejectedValue(new OAuth2FlowError('jwt_bearer', 'invalid_grant'));
    const rpc = makeRpc();
    await expect(rpc.dispatch('oauthJwtBearer', { config: CONFIG })).resolves.toEqual({
      success: false,
      error: 'jwt_bearer: invalid_grant',
    });
  });
});

describe('the device grant channels', () => {
  const PENDING = {
    state: 'pending' as const,
    approval: {
      userCode: 'OHDC-1234',
      verificationUri: 'https://auth.openheaders.io/activate',
      expiresAt: Date.now() + 600_000,
      intervalSeconds: 5,
    },
    startedAt: Date.now(),
  };

  it('start runs the oracle runner over the transport and answers the pending state', async () => {
    flows.startDeviceFlow.mockResolvedValueOnce(PENDING);
    const config: OAuth2Auth = { ...CONFIG, flow: 'device-code' };
    await expect(makeRpc().dispatch('oauthDeviceStart', { config, workspaceId: 'ws-1' })).resolves.toEqual({
      success: true,
      state: PENDING,
    });
    expect(flows.startDeviceFlow).toHaveBeenCalledWith(config, 'ws-1', transport);
  });

  it('start needs no browser — a headless host runs it', async () => {
    flows.startDeviceFlow.mockResolvedValueOnce(PENDING);
    await expect(makeRpc(null).dispatch('oauthDeviceStart', { config: CONFIG })).resolves.toMatchObject({
      success: true,
    });
  });

  it('a step-tagged start failure answers success:false', async () => {
    flows.startDeviceFlow.mockRejectedValueOnce(new OAuth2FlowError('device_authorization', 'invalid_client'));
    await expect(makeRpc().dispatch('oauthDeviceStart', { config: CONFIG })).resolves.toEqual({
      success: false,
      error: 'device_authorization: invalid_client',
    });
  });

  it('status answers the registry state, null without a credentialRef', async () => {
    flows.getDeviceFlowState.mockReturnValueOnce(PENDING);
    await expect(
      makeRpc().dispatch('oauthDeviceStatus', { credentialRef: 'cred-1', workspaceId: 'ws-1' }),
    ).resolves.toEqual({ state: PENDING });
    expect(flows.getDeviceFlowState).toHaveBeenCalledWith('cred-1', 'ws-1');
    await expect(makeRpc().dispatch('oauthDeviceStatus', {})).resolves.toEqual({ state: null });
  });

  it('cancel reports whether a flow was there', async () => {
    flows.cancelDeviceFlow.mockReturnValueOnce(true);
    await expect(makeRpc().dispatch('oauthDeviceCancel', { credentialRef: 'cred-1' })).resolves.toEqual({
      success: true,
      cancelled: true,
    });
    expect(flows.cancelDeviceFlow).toHaveBeenCalledWith('cred-1', undefined);
    await expect(makeRpc().dispatch('oauthDeviceCancel', {})).resolves.toEqual({ success: false, cancelled: false });
  });
});

describe('oauthDiscover', () => {
  const METADATA = {
    issuer: 'https://auth.openheaders.io',
    authorizationEndpoint: 'https://auth.openheaders.io/authorize',
    tokenEndpoint: 'https://auth.openheaders.io/token',
  };

  it('walks the issuer over the transport and answers the document and the URL that carried it', async () => {
    flows.discoverAuthorizationServer.mockResolvedValueOnce({
      metadata: METADATA,
      url: 'https://auth.openheaders.io/.well-known/openid-configuration',
    });
    await expect(makeRpc().dispatch('oauthDiscover', { input: 'https://auth.openheaders.io' })).resolves.toEqual({
      success: true,
      metadata: METADATA,
      url: 'https://auth.openheaders.io/.well-known/openid-configuration',
    });
    expect(flows.discoverAuthorizationServer).toHaveBeenCalledWith('https://auth.openheaders.io', transport);
  });

  it('a step-tagged refusal answers success:false with the step named', async () => {
    flows.discoverAuthorizationServer.mockRejectedValueOnce(
      new OAuth2FlowError('discovery', 'the metadata document names issuer "https://other.openheaders.io"'),
    );
    await expect(makeRpc().dispatch('oauthDiscover', { input: 'https://auth.openheaders.io' })).resolves.toEqual({
      success: false,
      error: 'discovery: the metadata document names issuer "https://other.openheaders.io"',
    });
  });

  it('a missing input reaches the runner as an empty string', async () => {
    flows.discoverAuthorizationServer.mockRejectedValueOnce(new OAuth2FlowError('discovery', '"" is not a URL'));
    await expect(makeRpc().dispatch('oauthDiscover', {})).resolves.toEqual({
      success: false,
      error: 'discovery: "" is not a URL',
    });
    expect(flows.discoverAuthorizationServer).toHaveBeenCalledWith('', transport);
  });
});
