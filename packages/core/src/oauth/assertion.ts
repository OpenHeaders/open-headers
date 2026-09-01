/**
 * OAuth 2.0 signed assertions (RFC 7523) — the two JWTs an oauth2
 * config can mint from its own key material:
 *
 *   • the CLIENT assertion (§2.2 / OIDC Core §9 `private_key_jwt` and
 *     `client_secret_jwt`): proves the client at every token POST in
 *     place of `client_secret` — claims `iss` = `sub` = the client id,
 *     `aud` the token endpoint (or the configured audience), `iat` /
 *     `nbf` now, `exp` = now + the lifetime, a per-POST `jti`;
 *   • the GRANT assertion (§2.1, the `jwt-bearer` flow): IS the
 *     authorization — `iss` / `sub` / `aud` from the fields, `iat` /
 *     `exp` from the clock, `scope` composed from the scopes, `jti`,
 *     then the Additional-claims JSON winning over all of them (the
 *     ASAP precedence: Google carries `scope` as a claim, Adobe / Box
 *     carry vendor claims).
 *
 * Both sign through the JWT Bearer machinery (`auth-signing/jwt`) —
 * the twelve families, the PEM / DER / data-URI key forms, `kid` +
 * the user's extra protected headers (Azure's `x5t#S256`) — and take
 * the clock and the nonce injected so tests pin the composition; the
 * `mint*` wrappers stamp the platform clock + a UUID for the hosts.
 */

import { isAsapAlgorithm, parseAsapPrivateKey } from '../auth-signing/asap';
import { isJwtAlgorithm, type JwtAlgorithm, signJwtBearer } from '../auth-signing/jwt';
import type { OAuth2Auth } from '../types/request';

/** The `client_assertion_type` every assertion-authenticated POST carries. */
export const CLIENT_ASSERTION_TYPE_JWT_BEARER = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
/** The `grant_type` of the JWT bearer grant. */
export const JWT_BEARER_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

/** `exp − iat` when the config leaves the lifetime blank — Azure
 *  recommends 5–10 minutes; FAPI 2.0 caps nothing; Google's ceiling
 *  is an hour. */
export const ASSERTION_DEFAULT_LIFETIME_SECONDS = 300;
export const ASSERTION_MAX_LIFETIME_SECONDS = 3600;

export const CLIENT_SECRET_JWT_ALGORITHMS = ['HS256', 'HS384', 'HS512'] as const satisfies readonly JwtAlgorithm[];

export interface AssertionSignInput {
  /** Unix seconds — injected so tests can pin the stamped claims. */
  timestampSec: number;
  /** The per-assertion `jti` nonce (a UUID by convention). */
  jti: string;
}

/** Does this config authenticate its token POSTs with a signed assertion? */
export function usesClientAssertion(config: OAuth2Auth): boolean {
  return config.clientAuthentication === 'private-key-jwt' || config.clientAuthentication === 'client-secret-jwt';
}

/** The `aud` both assertions carry — the configured audience, else the
 *  token endpoint (OIDC Core §9's default). */
export function assertionAudienceOf(config: OAuth2Auth): string {
  const audience = config.assertionAudience?.trim();
  return audience ? audience : config.tokenEndpoint.trim();
}

/** The claims of the client assertion, in RFC 7523 §3's shape. */
export function buildClientAssertionClaims(config: OAuth2Auth, input: AssertionSignInput): Record<string, unknown> {
  const clientId = config.clientId.trim();
  return {
    iss: clientId,
    sub: clientId,
    aud: assertionAudienceOf(config),
    iat: input.timestampSec,
    nbf: input.timestampSec,
    exp: input.timestampSec + lifetimeOf(config),
    jti: input.jti,
  };
}

/** The claims of the `jwt-bearer` grant assertion, fields → clock →
 *  scope → jti → the Additional-claims JSON winning. */
export function buildGrantAssertionClaims(config: OAuth2Auth, input: AssertionSignInput): Record<string, unknown> {
  const issuer = config.assertionIssuer?.trim() ?? '';
  if (issuer === '') throw new Error('jwt-bearer grant requires an assertion issuer');
  const subject = config.assertionSubject?.trim();
  const extra = parseJsonObject(config.assertionClaims, 'Additional claims');
  return {
    iss: issuer,
    ...(subject ? { sub: subject } : {}),
    aud: assertionAudienceOf(config),
    iat: input.timestampSec,
    exp: input.timestampSec + lifetimeOf(config),
    ...(config.scopes.length > 0 ? { scope: config.scopes.join(' ') } : {}),
    jti: input.jti,
    ...extra,
  };
}

/** Sign the client assertion for a token POST under the config's
 *  method — the private key for `private-key-jwt`, `clientSecret` as
 *  the HMAC key for `client-secret-jwt`. */
export async function signClientAssertion(config: OAuth2Auth, input: AssertionSignInput): Promise<string> {
  if (!usesClientAssertion(config)) {
    throw new Error(`client assertion requires an assertion client authentication, got ${config.clientAuthentication}`);
  }
  return signAssertion(
    config,
    buildClientAssertionClaims(config, input),
    config.clientAuthentication === 'client-secret-jwt',
  );
}

/** Sign the `jwt-bearer` grant assertion — the private key, or the
 *  client secret when the algorithm is an HS family. */
export async function signGrantAssertion(config: OAuth2Auth, input: AssertionSignInput): Promise<string> {
  const algorithm = config.assertionAlgorithm?.trim() ?? '';
  return signAssertion(config, buildGrantAssertionClaims(config, input), algorithm.startsWith('HS'));
}

/**
 * The hosts' entry: the client assertion for the config's next token
 * POST stamped with the platform clock and a fresh UUID, or `undefined`
 * when the config authenticates with the secret (body / Basic) so the
 * builders fall through to their secret paths.
 */
export async function mintClientAssertion(config: OAuth2Auth): Promise<string | undefined> {
  if (!usesClientAssertion(config)) return undefined;
  return signClientAssertion(config, nowInput());
}

/** The grant assertion for a `jwt-bearer` token POST, stamped now. */
export async function mintGrantAssertion(config: OAuth2Auth): Promise<string> {
  return signGrantAssertion(config, nowInput());
}

function nowInput(): AssertionSignInput {
  return { timestampSec: Math.floor(Date.now() / 1000), jti: crypto.randomUUID() };
}

function lifetimeOf(config: OAuth2Auth): number {
  const lifetime = config.assertionLifetimeSeconds;
  return lifetime !== undefined && Number.isFinite(lifetime) && lifetime > 0
    ? lifetime
    : ASSERTION_DEFAULT_LIFETIME_SECONDS;
}

async function signAssertion(config: OAuth2Auth, claims: Record<string, unknown>, symmetric: boolean): Promise<string> {
  const algorithm = resolveAlgorithm(config, symmetric);
  const keyId = config.assertionKeyId?.trim() ?? '';
  const userHeaders = parseJsonObject(config.assertionHeaders, 'Assertion headers');
  const headers = { ...(keyId ? { kid: keyId } : {}), ...userHeaders };
  let privateKey = '';
  if (!symmetric) {
    privateKey = config.assertionPrivateKey?.trim() ?? '';
    if (privateKey === '') throw new Error('The assertion private key is required');
    privateKey = parseAsapPrivateKey(privateKey, keyId);
  } else if (!config.clientSecret) {
    throw new Error('client-secret-jwt requires clientSecret');
  }
  const signed = await signJwtBearer(
    {
      algorithm,
      secret: symmetric ? (config.clientSecret ?? '') : '',
      privateKey,
      payload: JSON.stringify(claims),
      headers: Object.keys(headers).length > 0 ? JSON.stringify(headers) : undefined,
      headerPrefix: '',
      addTo: 'header',
    },
    { timestampSec: claims.iat as number },
  );
  return signed.headers[0]?.value ?? '';
}

function resolveAlgorithm(config: OAuth2Auth, symmetric: boolean): JwtAlgorithm {
  const raw = config.assertionAlgorithm?.trim() ?? '';
  if (raw === '') return symmetric ? 'HS256' : 'RS256';
  if (!isJwtAlgorithm(raw)) throw new Error(`Unsupported assertion algorithm "${raw}"`);
  if (symmetric && !raw.startsWith('HS')) {
    throw new Error(`client-secret-jwt signs with an HMAC family (HS256 / HS384 / HS512), got ${raw}`);
  }
  if (!symmetric && !isAsapAlgorithm(raw)) {
    throw new Error(`private-key-jwt signs with an asymmetric family (RS / PS / ES), got ${raw}`);
  }
  return raw;
}

function parseJsonObject(text: string | undefined, what: string): Record<string, unknown> {
  const trimmed = text?.trim() ?? '';
  if (trimmed === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`${what} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${what} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}
