/**
 * OAuth 2.0 token-acquisition flows — the host-neutral legs behind the
 * editor's "Get new access token": Client Credentials, Password
 * Credentials, and Authorization Code (with or without PKCE). Each
 * builds its grant from `@openheaders/core/oauth`, exchanges it through
 * {@link exchangeForTokens} over the host's {@link RequestTransport},
 * and persists the bundle under the config's `credentialRef` in the
 * per-workspace token store.
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
  buildPasswordCredentialsTokenBody,
  computeCodeChallenge,
  findOAuth2Preset,
  generateCodeVerifier,
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
    body: buildAuthorizationCodeTokenBody({ config, code: parsed.code, codeVerifier, redirectUri }),
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
    body: buildClientCredentialsTokenBody(config),
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
    body: buildPasswordCredentialsTokenBody(config),
    step: 'password',
    clientAuthHeader: buildClientAuthHeader(config),
    extras: nonBodyExtraParams(config.extraTokenParams),
  });
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}
