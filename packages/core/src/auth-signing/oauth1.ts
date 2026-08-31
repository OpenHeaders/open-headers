/**
 * OAuth 1.0a request signing per RFC 5849.
 *
 * Pure WebCrypto like the SigV4 signer, on both runtimes: the HMAC
 * family (SHA-1 per the RFC; SHA-256/512 the living de-facto dialect
 * enterprise servers now mandate), the RSA family (§3.4.3
 * RSASSA-PKCS1-v1_5 over the consumer's PEM private key — SHA-256/512
 * the same extension pattern), and PLAINTEXT, which needs no crypto at
 * all. The signer takes the FINAL wire shape — method, URL with query
 * already appended, and the urlencoded body fields when the body is
 * form-encoded (§3.4.1.3.1 folds them into the signature base string)
 * — and returns the protocol parameters as either an `Authorization:
 * OAuth …` header (§3.5.1) or query pairs to append (§3.5.2), per the
 * config's `paramsLocation`. Non-form bodies can opt into the Request
 * Body Hash extension: `oauth_body_hash` — the raw body digested with
 * the signature method's hash — joins the signed protocol params
 * (PLAINTEXT has no digest and signs without).
 *
 * Callers sign at EXECUTE time, after pre-request scripts have mutated
 * the request — a signature computed any earlier is invalidated by the
 * first script mutation. Randomness (`nonce`) and the clock
 * (`timestampSec`) are injected so tests can pin the RFC's vectors,
 * mirroring the SigV4 signer's injected `now`.
 */

import { encodeBase64Bytes } from '../utils/base64';
import { pemToPkcs8 } from './pem';

export type OAuth1SignatureMethod =
  | 'HMAC-SHA1'
  | 'HMAC-SHA256'
  | 'HMAC-SHA512'
  | 'RSA-SHA1'
  | 'RSA-SHA256'
  | 'RSA-SHA512'
  | 'PLAINTEXT';

export interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  /** Access token — absent for one-legged calls (WooCommerce-style). */
  token?: string;
  tokenSecret?: string;
  signatureMethod: OAuth1SignatureMethod;
  /** RSA family only — the consumer's PEM private key, the signing key
   *  ALONE per §3.4.3 (consumer/token secrets do not participate). */
  privateKey?: string;
  /** Opt into the Request Body Hash extension for non-form bodies —
   *  see the module doc. */
  includeBodyHash?: boolean;
  /** Where the `oauth_*` protocol params ride on the wire. */
  paramsLocation: 'header' | 'query';
  /** Protection realm, echoed verbatim in the Authorization header
   *  (header mode only); never part of the signature (§3.4.1.3.1). */
  realm?: string;
}

export interface OAuth1SignInput {
  method: string;
  /** Final wire URL — query string already appended. */
  url: string;
  /** Decoded urlencoded body fields, when (and only when) the wire body
   *  is `application/x-www-form-urlencoded` — they join the signature
   *  base string per §3.4.1.3.1. */
  bodyParams?: ReadonlyArray<{ name: string; value: string }>;
  /** The raw wire body text, when the body is NOT form-encoded — the
   *  Request Body Hash extension's input; ignored unless the config
   *  opts in. */
  rawBody?: string;
  /** Unix seconds — injected so tests can pin vectors. */
  timestampSec: number;
  /** Client nonce — caller-supplied randomness. */
  nonce: string;
}

/** Either `headers` or `queryParams` is populated, never both — the
 *  caller applies whichever without narrowing on the config. */
export interface OAuth1SignResult {
  headers: Array<{ key: string; value: string }>;
  /** Pairs to append to the URL's query (values NOT yet encoded). */
  queryParams: Array<{ key: string; value: string }>;
}

export async function signOAuth1(credentials: OAuth1Credentials, input: OAuth1SignInput): Promise<OAuth1SignResult> {
  const hash = methodDigest(credentials.signatureMethod);
  const protocolParams: Array<[string, string]> = [
    ['oauth_consumer_key', credentials.consumerKey],
    ['oauth_nonce', input.nonce],
    ['oauth_signature_method', credentials.signatureMethod],
    ['oauth_timestamp', String(input.timestampSec)],
    ['oauth_version', '1.0'],
  ];
  if (credentials.token) protocolParams.push(['oauth_token', credentials.token]);
  // Request Body Hash extension — the raw body digested with the
  // signature method's hash joins the SIGNED protocol params.
  // PLAINTEXT has no digest, so it signs without one.
  if (credentials.includeBodyHash === true && input.rawBody !== undefined && hash !== null) {
    protocolParams.push(['oauth_body_hash', await digestBase64(hash, input.rawBody)]);
  }

  const signature = await computeSignature(credentials, input, protocolParams, hash);
  const allParams: Array<[string, string]> = [...protocolParams, ['oauth_signature', signature]];

  if (credentials.paramsLocation === 'query') {
    return { headers: [], queryParams: allParams.map(([key, value]) => ({ key, value })) };
  }

  // §3.5.1 — realm rides first as an HTTP quoted-string (not
  // percent-encoded); protocol params are percent-encoded and quoted.
  const parts: string[] = [];
  if (credentials.realm !== undefined) parts.push(`realm="${quoteHttp(credentials.realm)}"`);
  for (const [key, value] of allParams) parts.push(`${encodeRfc3986(key)}="${encodeRfc3986(value)}"`);
  return { headers: [{ key: 'Authorization', value: `OAuth ${parts.join(', ')}` }], queryParams: [] };
}

/**
 * Signature base string per §3.4.1: uppercase method, base string URI
 * (lowercase scheme + host, default port elided, path only), and the
 * normalized parameter set — decoded query pairs + urlencoded body
 * fields + the `oauth_*` protocol params (never `oauth_signature` or
 * `realm`), each name/value percent-encoded, sorted by encoded name
 * then encoded value, all three parts joined with `&` after encoding.
 * Exported so tests can pin the RFC's §3.4.1.1 vector byte-exact.
 */
export function buildOAuth1SignatureBaseString(
  method: string,
  url: string,
  oauthParams: ReadonlyArray<[string, string]>,
  bodyParams: ReadonlyArray<{ name: string; value: string }>,
): string {
  const parsed = new URL(url);
  // `URL` lowercases scheme + host and elides the default port already;
  // `pathname` is never empty for http(s) URLs.
  const baseUri = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;

  const pairs: Array<[string, string]> = [];
  parsed.searchParams.forEach((value, key) => {
    pairs.push([encodeRfc3986(key), encodeRfc3986(value)]);
  });
  for (const p of bodyParams) pairs.push([encodeRfc3986(p.name), encodeRfc3986(p.value)]);
  for (const [key, value] of oauthParams) pairs.push([encodeRfc3986(key), encodeRfc3986(value)]);
  pairs.sort((a, b) => (a[0] === b[0] ? compareStrings(a[1], b[1]) : compareStrings(a[0], b[0])));
  const normalized = pairs.map(([k, v]) => `${k}=${v}`).join('&');

  return [method.toUpperCase(), encodeRfc3986(baseUri), encodeRfc3986(normalized)].join('&');
}

/** Strict RFC 3986 encoding (§3.6) — `encodeURIComponent` plus the five
 *  characters it leaves bare (`!'()*`). */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Byte-order comparison (the spec sorts by code point, not locale). */
function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Escape a value for an HTTP quoted-string. */
function quoteHttp(value: string): string {
  return value.replace(/([\\"])/g, '\\$1');
}

/** The signature method's digest — `null` for PLAINTEXT (no crypto). */
function methodDigest(method: OAuth1SignatureMethod): 'SHA-1' | 'SHA-256' | 'SHA-512' | null {
  if (method === 'PLAINTEXT') return null;
  if (method.endsWith('SHA256')) return 'SHA-256';
  if (method.endsWith('SHA512')) return 'SHA-512';
  return 'SHA-1';
}

async function computeSignature(
  credentials: OAuth1Credentials,
  input: OAuth1SignInput,
  protocolParams: ReadonlyArray<[string, string]>,
  hash: 'SHA-1' | 'SHA-256' | 'SHA-512' | null,
): Promise<string> {
  // §3.4.2 / §3.4.4 — the shared secret string. PLAINTEXT sends it
  // verbatim as the signature; the HMAC family keys the MAC with it.
  // The RSA family (§3.4.3) signs with the private key ALONE.
  const signingKey = `${encodeRfc3986(credentials.consumerSecret)}&${encodeRfc3986(credentials.tokenSecret ?? '')}`;
  if (hash === null) return signingKey;
  const baseString = buildOAuth1SignatureBaseString(input.method, input.url, protocolParams, input.bodyParams ?? []);
  if (credentials.signatureMethod.startsWith('RSA')) {
    return rsaSignBase64(credentials.privateKey ?? '', hash, baseString);
  }
  return hmacBase64(signingKey, hash, baseString);
}

async function hmacBase64(key: string, hash: 'SHA-1' | 'SHA-256' | 'SHA-512', data: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return encodeBase64Bytes(new Uint8Array(signature));
}

async function rsaSignBase64(privateKey: string, hash: 'SHA-1' | 'SHA-256' | 'SHA-512', data: string): Promise<string> {
  const der = pemToPkcs8(privateKey, null);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der as Uint8Array<ArrayBuffer>,
    { name: 'RSASSA-PKCS1-v1_5', hash },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  return encodeBase64Bytes(new Uint8Array(signature));
}

async function digestBase64(hash: 'SHA-1' | 'SHA-256' | 'SHA-512', text: string): Promise<string> {
  const digest = await crypto.subtle.digest(hash, new TextEncoder().encode(text));
  return encodeBase64Bytes(new Uint8Array(digest));
}
