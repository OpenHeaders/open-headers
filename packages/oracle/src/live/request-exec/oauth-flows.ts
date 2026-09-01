/**
 * OAuth 2.0 token-acquisition flows — the host-neutral legs behind the
 * editor's "Get new access token": Client Credentials, Password
 * Credentials, JWT Bearer (RFC 7523 §2.1 — the signed assertion IS the
 * grant), and Authorization Code (with or without PKCE). Each builds
 * its grant from `@openheaders/core/oauth`, exchanges it through
 * {@link exchangeForTokens} over the host's {@link RequestTransport},
 * and persists the bundle under the config's `credentialRef` in the
 * per-workspace token store. A config on an assertion client
 * authentication (`private-key-jwt` / `client-secret-jwt`) mints its
 * client assertion here, per POST, before the body builds.
 *
 * The authorization-code leg needs a user agent: the host hands in a
 * {@link AuthorizationLauncher} that opens the authorize URL and
 * resolves with the redirect URL the provider sent the agent back to —
 * the same contract a browser's identity API offers, so the node
 * hosts' system-browser + loopback-callback launcher and a browser
 * host's identity window both fit. State and the PKCE pair mint here
 * from the platform `crypto` (WebCrypto is global on every host).
 */

import {
  base64UrlEncode,
  buildAuthorizationCodeTokenBody,
  buildAuthorizationUrl,
  buildClientAuthHeader,
  buildClientCredentialsTokenBody,
  buildJwtBearerTokenBody,
  buildPasswordCredentialsTokenBody,
  computeCodeChallenge,
  findOAuth2Preset,
  generateCodeVerifier,
  mintClientAssertion,
  mintGrantAssertion,
  nonBodyExtraParams,
  type OAuth2TokenBundle,
  parseAuthorizationRedirect,
  usesPkce,
} from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { putTokenBundle } from '../../entity/oauth-token-store';
import { exchangeForTokens, OAuth2FlowError } from './oauth-exchange';
import type { RequestTransport } from './transport';

/** Opens `authUrl` for the user and resolves with the full redirect
 *  URL the provider sent the agent back to (query or fragment). */
export type AuthorizationLauncher = (authUrl: string, state: string) => Promise<string>;

export interface AuthorizationCodeFlowOptions {
  /** The registered redirect target — what the launcher's callback listens on. */
  redirectUri: string;
  launch: AuthorizationLauncher;
}

export interface AuthorizationCodeFlowResult {
  bundle: OAuth2TokenBundle;
  redirectUri: string;
}

const randomBytes = (n: number): Uint8Array => {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
};

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

export async function performAuthorizationCodeFlow(
  config: OAuth2Auth,
  workspaceId: string | undefined,
  transport: RequestTransport,
  options: AuthorizationCodeFlowOptions,
): Promise<AuthorizationCodeFlowResult> {
  if (config.flow !== 'authorization-code-pkce') {
    throw new OAuth2FlowError(
      'precondition',
      `authorization code flow requires flow=authorization-code-pkce, got ${config.flow}`,
    );
  }
  const { redirectUri } = options;
  const state = base64UrlEncode(randomBytes(16));
  // Plain authorization-code (grantType: 'authorization-code') skips
  // the PKCE pair on both legs; the exchange is otherwise identical.
  const codeVerifier = usesPkce(config) ? generateCodeVerifier(randomBytes) : undefined;
  const codeChallenge = codeVerifier !== undefined ? await computeCodeChallenge(codeVerifier, sha256) : undefined;
  const preset = findOAuth2Preset(config.providerPresetId);
  const authUrl = buildAuthorizationUrl({
    config,
    redirectUri,
    state,
    codeChallenge,
    presetExtras: preset?.extraAuthParams ?? [],
  });
  const responseUrl = await options.launch(authUrl, state).catch((err: Error) => {
    throw new OAuth2FlowError('authorize', `Authorization did not complete: ${err.message}`);
  });
  const parsed = parseAuthorizationRedirect(responseUrl);
  if (parsed.error) {
    throw new OAuth2FlowError(
      'authorize',
      `Provider returned error: ${parsed.error} ${parsed.errorDescription ?? ''}`.trim(),
    );
  }
  if (parsed.state !== state) {
    throw new OAuth2FlowError('authorize', 'state parameter did not round-trip (possible CSRF attack)');
  }
  if (!parsed.code) {
    throw new OAuth2FlowError('authorize', 'Redirect did not include an authorization code');
  }
  const bundle = await exchangeForTokens(transport, {
    endpoint: config.tokenEndpoint,
    body: buildAuthorizationCodeTokenBody({
      config,
      code: parsed.code,
      codeVerifier,
      redirectUri,
      clientAssertion: await mintClientAssertionOrFail(config, 'authorization_code'),
    }),
    step: 'authorization_code',
    clientAuthHeader: buildClientAuthHeader(config),
    extras: nonBodyExtraParams(config.extraTokenParams),
  });
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return { bundle, redirectUri };
}

export async function performClientCredentialsFlow(
  config: OAuth2Auth,
  workspaceId: string | undefined,
  transport: RequestTransport,
): Promise<OAuth2TokenBundle> {
  if (config.flow !== 'client-credentials') {
    throw new OAuth2FlowError(
      'precondition',
      `client credentials flow requires flow=client-credentials, got ${config.flow}`,
    );
  }
  const bundle = await exchangeForTokens(transport, {
    endpoint: config.tokenEndpoint,
    body: buildClientCredentialsTokenBody(config, await mintClientAssertionOrFail(config, 'client_credentials')),
    step: 'client_credentials',
    clientAuthHeader: buildClientAuthHeader(config),
    extras: nonBodyExtraParams(config.extraTokenParams),
  });
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

export async function performPasswordCredentialsFlow(
  config: OAuth2Auth,
  workspaceId: string | undefined,
  transport: RequestTransport,
): Promise<OAuth2TokenBundle> {
  if (config.flow !== 'password-credentials') {
    throw new OAuth2FlowError(
      'precondition',
      `password credentials flow requires flow=password-credentials, got ${config.flow}`,
    );
  }
  const bundle = await exchangeForTokens(transport, {
    endpoint: config.tokenEndpoint,
    body: buildPasswordCredentialsTokenBody(config, await mintClientAssertionOrFail(config, 'password')),
    step: 'password',
    clientAuthHeader: buildClientAuthHeader(config),
    extras: nonBodyExtraParams(config.extraTokenParams),
  });
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

/**
 * The JWT bearer grant (RFC 7523 §2.1): no user agent, no refresh
 * token — the assertion mints fresh per exchange from the config's
 * signing key, so re-running the flow IS the refresh.
 */
export async function performJwtBearerFlow(
  config: OAuth2Auth,
  workspaceId: string | undefined,
  transport: RequestTransport,
): Promise<OAuth2TokenBundle> {
  if (config.flow !== 'jwt-bearer') {
    throw new OAuth2FlowError('precondition', `jwt bearer flow requires flow=jwt-bearer, got ${config.flow}`);
  }
  const assertion = await mintGrantAssertion(config).catch((err: Error) => {
    throw new OAuth2FlowError('precondition', err.message);
  });
  const bundle = await exchangeForTokens(transport, {
    endpoint: config.tokenEndpoint,
    body: buildJwtBearerTokenBody({
      config,
      assertion,
      clientAssertion: await mintClientAssertionOrFail(config, 'jwt_bearer'),
    }),
    step: 'jwt_bearer',
    clientAuthHeader: buildClientAuthHeader(config),
    extras: nonBodyExtraParams(config.extraTokenParams),
  });
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

/** The client assertion for one token POST, or `undefined` under the
 *  secret methods; a signing failure (a bad key, a wrong family) is
 *  the step's own precondition error. */
export async function mintClientAssertionOrFail(config: OAuth2Auth, step: string): Promise<string | undefined> {
  try {
    return await mintClientAssertion(config);
  } catch (err) {
    throw new OAuth2FlowError(step, `client assertion: ${(err as Error).message}`);
  }
}
