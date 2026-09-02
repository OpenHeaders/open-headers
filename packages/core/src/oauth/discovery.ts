/**
 * Authorization-server discovery (RFC 8414 + OpenID Connect Discovery
 * 1.0) — the pure half: where an issuer's metadata document lives, what
 * the document says, and what of it lands on an `OAuth2Auth` config.
 *
 *   • {@link planDiscovery} turns the user's input — an issuer
 *     identifier, or a pasted well-known URL — into the issuer the
 *     document must name and the candidate URLs to read, in order: the
 *     OpenID form (`/.well-known/openid-configuration` appended to the
 *     issuer, Discovery §4), the RFC 8414 form (`/.well-known/
 *     oauth-authorization-server` inserted between host and path, §3.1),
 *     and — for a path-bearing issuer — the OpenID suffix inserted the
 *     RFC 8414 way (§5 records both layouts in the wild).
 *   • {@link parseAuthorizationServerMetadata} reads the document and
 *     enforces the issuer match (RFC 8414 §3.3 / Discovery §4.3): the
 *     document's `issuer` must be the identifier the URL was derived
 *     from, compared as normalized URLs.
 *   • {@link applyDiscoveredMetadata} fills ONLY the endpoints the
 *     document carries (authorization, token, device authorization) and
 *     records the issuer; an absent endpoint leaves the config's row
 *     alone. Nothing else on the config moves.
 *   • {@link discoveryFacts} derives what the document SAYS about the
 *     user's picks — the client authentication, the grant, PKCE, the
 *     DPoP and assertion algorithms, the supported scopes, the issuer
 *     as an audience — from the lists the document states. A fact is
 *     surfaced, never applied: an unlisted pick is the user's to change.
 *
 * The GET itself is the hosts' (`oracle/live/request-exec/oauth-discovery`).
 */

import type { OAuth2Auth } from '../types/request';
import { JWT_BEARER_GRANT_TYPE, usesClientAssertion } from './assertion';
import { DEVICE_CODE_GRANT_TYPE } from './device';
import { DPOP_DEFAULT_ALGORITHM, usesDpop } from './dpop';

export const OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration';
export const OAUTH_AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';

/** The issuer a document must name and the URLs to read for it, in order. */
export interface OAuth2DiscoveryPlan {
  issuer: string;
  candidates: string[];
}

/**
 * The metadata fields this client reads (RFC 8414 §2, RFC 8628 §4,
 * RFC 9449 §5.1). Everything optional but the issuer; a list is
 * present only when the document states it.
 */
export interface OAuth2ServerMetadata {
  issuer: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  deviceAuthorizationEndpoint?: string;
  revocationEndpoint?: string;
  jwksUri?: string;
  scopesSupported?: string[];
  grantTypesSupported?: string[];
  tokenEndpointAuthMethodsSupported?: string[];
  tokenEndpointAuthSigningAlgValuesSupported?: string[];
  codeChallengeMethodsSupported?: string[];
  dpopSigningAlgValuesSupported?: string[];
}

export type OAuth2DiscoveredField = 'authorizationEndpoint' | 'tokenEndpoint' | 'deviceAuthorizationEndpoint';

export interface OAuth2DiscoveryFill {
  config: OAuth2Auth;
  /** The endpoint rows the document wrote, in row order. */
  filled: OAuth2DiscoveredField[];
}

/**
 * What the document says about one of the user's picks. `listed` is
 * whether the pick appears in the stated list; `supported` is that
 * list, for the copy.
 */
export type OAuth2DiscoveryFact =
  | { kind: 'client-authentication'; method: string; supported: string[]; listed: boolean }
  | { kind: 'grant-type'; grantType: string; supported: string[]; listed: boolean }
  | { kind: 'pkce'; supported: string[]; listed: boolean }
  | { kind: 'dpop-algorithm'; algorithm: string; supported: string[]; listed: boolean }
  | { kind: 'assertion-algorithm'; algorithm: string; supported: string[]; listed: boolean }
  | { kind: 'audience'; issuer: string }
  | { kind: 'scopes'; supported: string[] };

/**
 * Where to look for `input`'s metadata. An issuer identifier is a URL
 * with no query or fragment (RFC 8414 §2); a pasted well-known URL in
 * either layout is accepted and read first, its issuer derived by
 * removing the well-known segment. Throws on anything that is not an
 * http(s) URL.
 */
export function planDiscovery(input: string): OAuth2DiscoveryPlan {
  const url = parseHttpUrl(input.trim());
  if (url.search !== '' || url.hash !== '') {
    throw new Error('an issuer identifier carries no query string or fragment');
  }
  const path = trimSlash(url.pathname);
  const pasted = wellKnownSplit(path);
  const issuerPath = pasted?.issuerPath ?? path;
  const issuer = `${url.origin}${issuerPath}`;
  const candidates = [
    `${url.origin}${issuerPath}${OPENID_CONFIGURATION_PATH}`,
    `${url.origin}${OAUTH_AUTHORIZATION_SERVER_PATH}${issuerPath}`,
  ];
  if (issuerPath !== '') candidates.push(`${url.origin}${OPENID_CONFIGURATION_PATH}${issuerPath}`);
  if (pasted !== null) candidates.unshift(`${url.origin}${path}`);
  return { issuer, candidates: [...new Set(candidates)] };
}

/**
 * Fold the metadata JSON into {@link OAuth2ServerMetadata}. The
 * document must name `issuer`, and it must be the identifier the
 * document was looked up under (compared as normalized URLs, so a bare
 * origin equals the same origin with its root slash).
 */
export function parseAuthorizationServerMetadata(json: Record<string, unknown>, issuer: string): OAuth2ServerMetadata {
  const named = asString(json.issuer);
  if (named === undefined) throw new Error('the metadata document names no issuer');
  if (!sameIssuer(named, issuer)) {
    throw new Error(`the metadata document names issuer "${named}", expected "${issuer}"`);
  }
  return {
    issuer: named,
    authorizationEndpoint: asString(json.authorization_endpoint),
    tokenEndpoint: asString(json.token_endpoint),
    deviceAuthorizationEndpoint: asString(json.device_authorization_endpoint),
    revocationEndpoint: asString(json.revocation_endpoint),
    jwksUri: asString(json.jwks_uri),
    scopesSupported: asStringList(json.scopes_supported),
    grantTypesSupported: asStringList(json.grant_types_supported),
    tokenEndpointAuthMethodsSupported: asStringList(json.token_endpoint_auth_methods_supported),
    tokenEndpointAuthSigningAlgValuesSupported: asStringList(json.token_endpoint_auth_signing_alg_values_supported),
    codeChallengeMethodsSupported: asStringList(json.code_challenge_methods_supported),
    dpopSigningAlgValuesSupported: asStringList(json.dpop_signing_alg_values_supported),
  };
}

/** Write the endpoints the document carries onto the config and record the issuer. */
export function applyDiscoveredMetadata(config: OAuth2Auth, metadata: OAuth2ServerMetadata): OAuth2DiscoveryFill {
  const next: OAuth2Auth = { ...config, issuer: metadata.issuer };
  const filled: OAuth2DiscoveredField[] = [];
  if (metadata.authorizationEndpoint !== undefined) {
    next.authorizationEndpoint = metadata.authorizationEndpoint;
    filled.push('authorizationEndpoint');
  }
  if (metadata.deviceAuthorizationEndpoint !== undefined) {
    next.deviceAuthorizationEndpoint = metadata.deviceAuthorizationEndpoint;
    filled.push('deviceAuthorizationEndpoint');
  }
  if (metadata.tokenEndpoint !== undefined) {
    next.tokenEndpoint = metadata.tokenEndpoint;
    filled.push('tokenEndpoint');
  }
  return { config: next, filled };
}

/** The wire name of the config's client authentication (RFC 7591 §2),
 *  or `none` for a public client sending its id alone. */
export function clientAuthenticationMethodOf(config: OAuth2Auth): string {
  switch (config.clientAuthentication) {
    case 'private-key-jwt':
      return 'private_key_jwt';
    case 'client-secret-jwt':
      return 'client_secret_jwt';
    case 'basic-header':
      return config.clientSecret ? 'client_secret_basic' : 'none';
    default:
      return config.clientSecret ? 'client_secret_post' : 'none';
  }
}

/** The `grant_type` value the config's flow POSTs. */
export function grantTypeOf(config: OAuth2Auth): string {
  switch (config.flow) {
    case 'client-credentials':
      return 'client_credentials';
    case 'password-credentials':
      return 'password';
    case 'device-code':
      return DEVICE_CODE_GRANT_TYPE;
    case 'jwt-bearer':
      return JWT_BEARER_GRANT_TYPE;
    default:
      return 'authorization_code';
  }
}

/**
 * The facts the document states about the config's picks. Each rides a
 * list the document actually carries — an omitted list says nothing
 * here (RFC 8414's defaults for omitted lists are looser than what
 * servers implement, so they are not read as refusals). A public
 * client's `none` is not held against a list that omits it.
 */
export function discoveryFacts(config: OAuth2Auth, metadata: OAuth2ServerMetadata): OAuth2DiscoveryFact[] {
  const facts: OAuth2DiscoveryFact[] = [];
  const method = clientAuthenticationMethodOf(config);
  if (metadata.tokenEndpointAuthMethodsSupported !== undefined && method !== 'none') {
    const supported = metadata.tokenEndpointAuthMethodsSupported;
    facts.push({ kind: 'client-authentication', method, supported, listed: supported.includes(method) });
  }
  if (metadata.grantTypesSupported !== undefined) {
    const grantType = grantTypeOf(config);
    const supported = metadata.grantTypesSupported;
    facts.push({ kind: 'grant-type', grantType, supported, listed: supported.includes(grantType) });
  }
  if (metadata.codeChallengeMethodsSupported !== undefined && config.flow === 'authorization-code-pkce') {
    const supported = metadata.codeChallengeMethodsSupported;
    facts.push({ kind: 'pkce', supported, listed: supported.includes('S256') });
  }
  if (metadata.dpopSigningAlgValuesSupported !== undefined && usesDpop(config)) {
    const algorithm = config.dpopAlgorithm?.trim() || DPOP_DEFAULT_ALGORITHM;
    const supported = metadata.dpopSigningAlgValuesSupported;
    facts.push({ kind: 'dpop-algorithm', algorithm, supported, listed: supported.includes(algorithm) });
  }
  const signing = usesClientAssertion(config) || config.flow === 'jwt-bearer';
  if (metadata.tokenEndpointAuthSigningAlgValuesSupported !== undefined && usesClientAssertion(config)) {
    const algorithm =
      config.assertionAlgorithm?.trim() || (config.clientAuthentication === 'client-secret-jwt' ? 'HS256' : 'RS256');
    const supported = metadata.tokenEndpointAuthSigningAlgValuesSupported;
    facts.push({ kind: 'assertion-algorithm', algorithm, supported, listed: supported.includes(algorithm) });
  }
  if (signing) facts.push({ kind: 'audience', issuer: metadata.issuer });
  if (metadata.scopesSupported !== undefined && metadata.scopesSupported.length > 0) {
    facts.push({ kind: 'scopes', supported: metadata.scopesSupported });
  }
  return facts;
}

/** Any fact whose pick the document does not list. */
export function hasUnlistedPick(facts: readonly OAuth2DiscoveryFact[]): boolean {
  return facts.some((fact) => 'listed' in fact && !fact.listed);
}

function parseHttpUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`"${input}" is not a URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`an issuer identifier is an http(s) URL, got ${url.protocol}`);
  }
  return url;
}

function trimSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Split a pasted well-known path into the issuer's path, in either
 *  layout (the segment appended, or inserted before the path). */
function wellKnownSplit(path: string): { issuerPath: string } | null {
  for (const segment of [OPENID_CONFIGURATION_PATH, OAUTH_AUTHORIZATION_SERVER_PATH]) {
    if (path.endsWith(segment)) return { issuerPath: path.slice(0, -segment.length) };
    if (path.startsWith(`${segment}/`)) return { issuerPath: path.slice(segment.length) };
  }
  return null;
}

function sameIssuer(a: string, b: string): boolean {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function asStringList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((item): item is string => typeof item === 'string');
}
