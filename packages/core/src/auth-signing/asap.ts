/**
 * ASAP (Atlassian Service Authentication Protocol) — a JWT dialect
 * minted per send: a compact JWS with `kid` in the header and the
 * `iss` / `aud` / `sub` / `iat` / `exp` / `jti` claims, delivered as
 * `Authorization: Bearer`. The signer composes the claims from the
 * config and delegates the signing to the JWT Bearer machinery
 * (`jwt.ts`) — every asymmetric family, the PEM parser, `typ` + `kid`
 * in the header. The spec forbids symmetric algorithms, so the HS
 * family is not offered.
 *
 * Claim precedence mirrors the reference clients: the fields fill
 * `iss`, `sub` (blank = the issuer — the receiver's own default),
 * `aud`; the clock stamps `iat` and `exp` = `iat` + the expiry (the
 * scheme's default of one hour, its hard ceiling); `jti` is the
 * caller-minted per-send nonce the spec makes mandatory; then the
 * Additional claims JSON overrides any of them.
 *
 * The private key is PEM (the JWT rules) or Atlassian's key-tool form,
 * `data:application/pkcs8;kid=<kid>;base64,<der>` — whose embedded kid
 * must match the Key ID, the reference's check.
 */

import { type JwtAlgorithm, signJwtBearer } from './jwt';

export const ASAP_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
] as const satisfies readonly JwtAlgorithm[];

export type AsapAlgorithm = (typeof ASAP_ALGORITHMS)[number];

export function isAsapAlgorithm(value: string | undefined): value is AsapAlgorithm {
  return value !== undefined && (ASAP_ALGORITHMS as readonly string[]).includes(value);
}

/** The scheme's default token lifetime — also its hard ceiling. */
export const ASAP_DEFAULT_EXPIRY_SECONDS = 3600;

export interface AsapCredentials {
  algorithm: AsapAlgorithm;
  /** The registered service identifier — the `iss` claim. */
  issuer: string;
  /** The `aud` claim — one string; an array rides through `claims`. */
  audience: string;
  /** The `kid` header — `<issuer>/<key-name>` by the scheme's layout. */
  keyId: string;
  /** PEM, bare base64 DER, or the `data:application/pkcs8;kid=…` form. */
  privateKey: string;
  /** The `sub` claim; blank = the issuer. */
  subject?: string;
  /** Additional claims JSON — wins over every composed claim. */
  claims?: string;
  /** `exp` − `iat`; absent = {@link ASAP_DEFAULT_EXPIRY_SECONDS}. */
  expiresInSeconds?: number;
}

export interface AsapSignInput {
  /** Unix seconds — injected so tests can pin the stamped claims. */
  timestampSec: number;
  /** The per-send `jti` nonce — caller-minted (a UUID by convention). */
  jti: string;
}

const DATA_URI = /^data:application\/pkcs8;kid=([\w.\-+/]+);base64,([A-Za-z0-9+/=]+)$/;

/**
 * The private key as the PEM parser takes it. Atlassian's key-tool
 * `data:` form unwraps to its bare PKCS#8 base64 after the embedded
 * kid is checked against the Key ID; anything else passes through
 * (surrounding quotes and URI-encoding shed, as the reference does).
 */
export function parseAsapPrivateKey(privateKey: string, keyId: string): string {
  let key = privateKey.trim().replace(/^"(.*)"$/s, '$1');
  try {
    key = decodeURIComponent(key);
  } catch {
    // Not URI-encoded — a raw PEM with a stray `%` stays as typed.
  }
  if (!key.startsWith('data:')) return key;
  const match = DATA_URI.exec(key.replace(/\s+/g, ''));
  if (!match) throw new Error('The private key data URI is malformed');
  if (match[1] !== keyId) {
    throw new Error(`The key id "${match[1]}" inside the private key data URI does not match the Key ID`);
  }
  return match[2] ?? '';
}

/** The claims the token carries, in the scheme's precedence. Exported
 *  so tests can pin the composition at a fixed clock. */
export function buildAsapClaims(credentials: AsapCredentials, input: AsapSignInput): Record<string, unknown> {
  const extra = credentials.claims?.trim() ? parseClaims(credentials.claims) : {};
  const issuer = credentials.issuer.trim();
  const subject = credentials.subject?.trim() || issuer;
  return {
    iss: issuer,
    sub: subject,
    aud: credentials.audience.trim(),
    iat: input.timestampSec,
    exp: input.timestampSec + (credentials.expiresInSeconds ?? ASAP_DEFAULT_EXPIRY_SECONDS),
    jti: input.jti,
    ...extra,
  };
}

function parseClaims(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Additional claims is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Additional claims must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

/** Mint and sign the token, returning the one `Authorization: Bearer …`
 *  header to set replace-not-append. */
export async function signAsap(
  credentials: AsapCredentials,
  input: AsapSignInput,
): Promise<Array<{ key: string; value: string }>> {
  const keyId = credentials.keyId.trim();
  if (keyId === '') throw new Error('A Key ID is required');
  const signed = await signJwtBearer(
    {
      algorithm: credentials.algorithm,
      secret: '',
      privateKey: parseAsapPrivateKey(credentials.privateKey, keyId),
      payload: JSON.stringify(buildAsapClaims(credentials, input)),
      headers: JSON.stringify({ kid: keyId }),
      addTo: 'header',
    },
    { timestampSec: input.timestampSec },
  );
  return signed.headers;
}
