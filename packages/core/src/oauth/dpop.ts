/**
 * OAuth 2.0 Demonstrating Proof of Possession (RFC 9449) — the pure
 * rules of sender-constrained tokens:
 *
 *   • the KEY a credential binds its tokens to (§4.1's `jwk`): an
 *     asymmetric pair the host generates at the exchange and persists
 *     beside the token bundle — never in the request config, never
 *     exported. `jkt` is the RFC 7638 thumbprint the provider binds
 *     (§6 `cnf.jkt`) and the resource checks;
 *   • the PROOF JWT (§4.2) every token POST and every resource request
 *     carries in the `DPoP` header — `typ: dpop+jwt`, the public key
 *     in the header, claims `jti` / `htm` / `htu` (the URL without its
 *     query and fragment) / `iat`, `ath` (the token's SHA-256) on a
 *     resource request, `nonce` when the server issued one;
 *   • the NONCE challenge (§8 / §9): the authorization server answers
 *     400 `use_dpop_nonce`, the resource 401 `WWW-Authenticate: DPoP
 *     error="use_dpop_nonce"`, both with a `DPoP-Nonce` header the
 *     client repeats in a fresh proof — once.
 *
 * The wire and the clock stay on the hosts (`live/request-exec/
 * oauth-*.ts` and the transports); everything here is a function over
 * its arguments. Signing rides the JWT Bearer signer over WebCrypto
 * (global on every host), which is also what generates the pair.
 */

import { isJwtAlgorithm, type JwtAlgorithm, jwtAlgorithmParts, signJwtBearer } from '../auth-signing/jwt';
import type { OAuth2Auth } from '../types/request';
import { encodeBase64Bytes } from '../utils/base64';

/** The `token_type` a DPoP-bound token is issued with — and the
 *  Authorization scheme it MUST be sent under (§7.1). */
export const DPOP_TOKEN_TYPE = 'DPoP';
/** The proof JWT's `typ` header (§4.2). */
export const DPOP_PROOF_TYP = 'dpop+jwt';
/** The header the proof rides on every request (§4.1). */
export const DPOP_HEADER = 'DPoP';
/** The header a server issues its nonce on (§8, §9). */
export const DPOP_NONCE_HEADER = 'DPoP-Nonce';
/** The error both servers answer a missing / stale nonce with. */
export const DPOP_NONCE_ERROR = 'use_dpop_nonce';
/** The family every DPoP deployment supports (§4.2's example). */
export const DPOP_DEFAULT_ALGORITHM: JwtAlgorithm = 'ES256';

/** The public half as the proof header carries it — the RFC 7638
 *  members only, no `alg` / `use` / `key_ops`. */
export type OAuth2DpopPublicJwk =
  | { kty: 'EC'; crv: string; x: string; y: string }
  | { kty: 'RSA'; n: string; e: string };

/**
 * The bound key pair, persisted beside the token bundle: the private
 * half as base64 PKCS#8 DER (the form the JWT signer imports), the
 * public half as the JWK the proof header carries, the thumbprint the
 * provider bound the token to.
 */
export interface OAuth2DpopKey {
  algorithm: JwtAlgorithm;
  privateKeyPkcs8: string;
  publicJwk: OAuth2DpopPublicJwk;
  jkt: string;
}

/**
 * What a send needs to prove possession — the bound key and the token
 * whose hash the proof carries. Plain data on the transport seam: the
 * transports mint the proof per hop (the node redirect loop) or per
 * attempt (the browser fetch), never the resolver.
 */
export interface OAuth2DpopProofMaterial {
  key: OAuth2DpopKey;
  accessToken: string;
}

/** The key a stored bundle is BOUND to — present only when the
 *  provider issued the token as `DPoP` (§5: a provider that does not
 *  support DPoP answers a plain bearer token, which sends as one). */
export function boundDpopKeyOf(bundle: { tokenType: string; dpop?: OAuth2DpopKey }): OAuth2DpopKey | undefined {
  return bundle.dpop !== undefined && bundle.tokenType.toLowerCase() === 'dpop' ? bundle.dpop : undefined;
}

/** Does this config bind its tokens with DPoP? */
export function usesDpop(config: OAuth2Auth): boolean {
  return config.tokenBinding === 'dpop';
}

/** The proof's JWS family — the config's pick, else ES256; an HS
 *  family or an unknown value is refused (a proof is asymmetric by
 *  definition, §4.2). */
export function dpopAlgorithmOf(config: OAuth2Auth): JwtAlgorithm {
  const raw = config.dpopAlgorithm?.trim() ?? '';
  if (raw === '') return DPOP_DEFAULT_ALGORITHM;
  if (!isJwtAlgorithm(raw)) throw new Error(`Unsupported DPoP algorithm "${raw}"`);
  if (raw.startsWith('HS')) throw new Error(`DPoP proofs sign with an asymmetric family (RS / PS / ES), got ${raw}`);
  return raw;
}

/** Generate the pair a credential binds its next token to. */
export async function generateDpopKey(algorithm: JwtAlgorithm): Promise<OAuth2DpopKey> {
  const parts = jwtAlgorithmParts(algorithm);
  if (parts.family === 'HS')
    throw new Error(`DPoP proofs sign with an asymmetric family (RS / PS / ES), got ${algorithm}`);
  const pair = (await crypto.subtle.generateKey(
    parts.curve !== null
      ? { name: 'ECDSA', namedCurve: parts.curve }
      : { name: parts.rsa ?? 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: RSA_F4, hash: parts.hash },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const publicJwk = publicJwkOf(exported);
  return { algorithm, privateKeyPkcs8: encodeBase64Bytes(pkcs8), publicJwk, jkt: await jwkThumbprint(publicJwk) };
}

const RSA_F4 = new Uint8Array([1, 0, 1]);

function publicJwkOf(jwk: JsonWebKey): OAuth2DpopPublicJwk {
  if (jwk.kty === 'EC' && jwk.crv && jwk.x && jwk.y) return { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y };
  if (jwk.kty === 'RSA' && jwk.n && jwk.e) return { kty: 'RSA', n: jwk.n, e: jwk.e };
  throw new Error('The generated DPoP key exported an unexpected JWK');
}

/** RFC 7638 — SHA-256 over the required members in lexicographic
 *  order with no whitespace, base64url. */
export async function jwkThumbprint(jwk: OAuth2DpopPublicJwk): Promise<string> {
  const canonical =
    jwk.kty === 'EC'
      ? `{"crv":${JSON.stringify(jwk.crv)},"kty":"EC","x":${JSON.stringify(jwk.x)},"y":${JSON.stringify(jwk.y)}}`
      : `{"e":${JSON.stringify(jwk.e)},"kty":"RSA","n":${JSON.stringify(jwk.n)}}`;
  return base64Url(await sha256(canonical));
}

/** The `htu` claim — the request URL without its query and fragment (§4.2). */
export function dpopHtu(url: string): string {
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  const end = hash === -1 ? query : query === -1 ? hash : Math.min(hash, query);
  return end === -1 ? url : url.slice(0, end);
}

/** The `ath` claim — base64url(SHA-256(access token)) (§4.2). */
export async function accessTokenHash(accessToken: string): Promise<string> {
  return base64Url(await sha256(accessToken));
}

export interface DpopProofInput {
  method: string;
  url: string;
  /** Set on a resource request (the token rides `Authorization: DPoP`);
   *  absent on a token POST. */
  accessToken?: string;
  /** The server's nonce, when it issued one. */
  nonce?: string;
  /** Unix seconds — injected so tests pin the stamped claim. */
  timestampSec: number;
  /** The per-proof unique id (a UUID by convention). */
  jti: string;
}

/** The proof's claims in §4.2's shape; `ath` is passed in computed
 *  (it is a digest — see {@link accessTokenHash}). */
export function buildDpopProofClaims(input: DpopProofInput, ath: string | undefined): Record<string, unknown> {
  return {
    jti: input.jti,
    htm: input.method.toUpperCase(),
    htu: dpopHtu(input.url),
    iat: input.timestampSec,
    ...(ath !== undefined ? { ath } : {}),
    ...(input.nonce !== undefined ? { nonce: input.nonce } : {}),
  };
}

/** Sign one proof under the bound key. */
export async function signDpopProof(key: OAuth2DpopKey, input: DpopProofInput): Promise<string> {
  const ath = input.accessToken !== undefined ? await accessTokenHash(input.accessToken) : undefined;
  const signed = await signJwtBearer(
    {
      algorithm: key.algorithm,
      secret: '',
      privateKey: key.privateKeyPkcs8,
      payload: JSON.stringify(buildDpopProofClaims(input, ath)),
      headers: JSON.stringify({ typ: DPOP_PROOF_TYP, jwk: key.publicJwk }),
      headerPrefix: '',
      addTo: 'header',
    },
    { timestampSec: input.timestampSec },
  );
  return signed.headers[0]?.value ?? '';
}

/** The hosts' entry: a proof stamped with the platform clock and a fresh UUID. */
export async function mintDpopProof(
  key: OAuth2DpopKey,
  input: Omit<DpopProofInput, 'timestampSec' | 'jti'>,
): Promise<string> {
  return signDpopProof(key, { ...input, timestampSec: Math.floor(Date.now() / 1000), jti: crypto.randomUUID() });
}

/** Did the authorization server ask for a nonce (§8)? 400 with the
 *  JSON error — the client repeats the POST once with the `DPoP-Nonce`
 *  it sent. */
export function isDpopNonceChallengeFromTokenEndpoint(status: number, json: Record<string, unknown> | null): boolean {
  return status === 400 && json !== null && json.error === DPOP_NONCE_ERROR;
}

/** Did the resource ask for a nonce (§9)? 401 with a `DPoP` challenge
 *  naming the error in `WWW-Authenticate`. */
export function isDpopNonceChallengeFromResource(status: number, wwwAuthenticate: string | null | undefined): boolean {
  if (status !== 401 || !wwwAuthenticate) return false;
  return /(^|,)\s*DPoP\b/i.test(wwwAuthenticate) && /error\s*=\s*"use_dpop_nonce"/i.test(wwwAuthenticate);
}

/** The `DPoP-Nonce` a response carried, if any. */
export function dpopNonceOf(headers: ReadonlyArray<{ key: string; value: string }>): string | undefined {
  const header = headers.find((h) => h.key.toLowerCase() === 'dpop-nonce');
  const value = header?.value.trim();
  return value ? value : undefined;
}

async function sha256(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

function base64Url(bytes: Uint8Array): string {
  return encodeBase64Bytes(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
