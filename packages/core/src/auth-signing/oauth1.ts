/**
 * OAuth 1.0a request signing per RFC 5849.
 *
 * Pure WebCrypto like the SigV4 signer (`HMAC` + `SHA-1` are available
 * on both runtimes); PLAINTEXT needs no crypto at all. The signer takes
 * the FINAL wire shape — method, URL with query already appended, and
 * the urlencoded body fields when the body is form-encoded (§3.4.1.3.1
 * folds them into the signature base string; other body types
 * contribute nothing — the `oauth_body_hash` extension is not
 * implemented) — and returns the protocol parameters as either an
 * `Authorization: OAuth …` header (§3.5.1) or query pairs to append
 * (§3.5.2), per the config's `paramsLocation`.
 *
 * Callers sign at EXECUTE time, after pre-request scripts have mutated
 * the request — a signature computed any earlier is invalidated by the
 * first script mutation. Randomness (`nonce`) and the clock
 * (`timestampSec`) are injected so tests can pin the RFC's vectors,
 * mirroring the SigV4 signer's injected `now`.
 */

import { encodeBase64Bytes } from '../utils/base64';

export type OAuth1SignatureMethod = 'HMAC-SHA1' | 'PLAINTEXT';

export interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  /** Access token — absent for one-legged calls (WooCommerce-style). */
  token?: string;
  tokenSecret?: string;
  signatureMethod: OAuth1SignatureMethod;
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
  const protocolParams: Array<[string, string]> = [
    ['oauth_consumer_key', credentials.consumerKey],
    ['oauth_nonce', input.nonce],
    ['oauth_signature_method', credentials.signatureMethod],
    ['oauth_timestamp', String(input.timestampSec)],
    ['oauth_version', '1.0'],
  ];
  if (credentials.token) protocolParams.push(['oauth_token', credentials.token]);

  // §3.4.2 / §3.4.4 — the shared secret string. PLAINTEXT sends it
  // verbatim as the signature; HMAC-SHA1 keys the MAC with it.
  const signingKey = `${encodeRfc3986(credentials.consumerSecret)}&${encodeRfc3986(credentials.tokenSecret ?? '')}`;

  const signature =
    credentials.signatureMethod === 'PLAINTEXT'
      ? signingKey
      : await hmacSha1Base64(
          signingKey,
          buildOAuth1SignatureBaseString(input.method, input.url, protocolParams, input.bodyParams ?? []),
        );

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

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return encodeBase64Bytes(new Uint8Array(signature));
}
