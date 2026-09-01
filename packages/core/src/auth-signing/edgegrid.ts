/**
 * Akamai EdgeGrid request signing (the `EG1-HMAC-SHA256` scheme).
 *
 * Pure WebCrypto like the SigV4 and Hawk signers — one HMAC-SHA256
 * chain and one SHA-256, both available on both runtimes. The signer
 * takes the FINAL wire shape — method, URL with query already
 * appended, the shipping header list, and the wire body text for the
 * POST content hash — and returns the one `Authorization: EG1-HMAC-
 * SHA256 …` header to set.
 *
 * The signature covers the tab-joined data string: method, scheme,
 * host, path + query, the canonicalized headers the config names (in
 * ITS order, unlisted headers never sign), the content hash (POST
 * only — base64 SHA-256 of the body truncated to `maxBodySize` bytes;
 * every other method signs an empty hash), and the header value up to
 * and including the nonce. The signing key is the base64 HMAC of the
 * timestamp keyed by the client secret; the signature is the base64
 * HMAC of the data keyed by that base64 STRING — the reference
 * clients' exact chain.
 *
 * Callers sign at EXECUTE time, after pre-request scripts have mutated
 * the request. The timestamp and nonce are injected so tests can pin
 * the scheme's published vectors, mirroring the Hawk signer.
 */

import { encodeBase64Bytes } from '../utils/base64';

export interface EdgeGridCredentials {
  clientToken: string;
  accessToken: string;
  clientSecret: string;
  /** Header names to fold into the signature, comma-separated, in
   *  signing order — the list an API's documentation names. Absent =
   *  none. */
  headersToSign?: string;
  /** Bytes of a POST body the content hash covers; absent = the
   *  scheme's default {@link EDGEGRID_DEFAULT_MAX_BODY}. */
  maxBodySize?: number;
}

export interface EdgeGridSignInput {
  method: string;
  /** Final wire URL — query string already appended. */
  url: string;
  /** The headers the transport will ship — the config's Headers to
   *  Sign are read from this list by name. */
  headers: ReadonlyArray<{ key: string; value: string }>;
  /** Wire body text for the POST content hash. Omit for bodiless
   *  sends. */
  body?: string;
  /** `yyyyMMddTHH:mm:ss+0000` — see {@link edgeGridTimestamp}. */
  timestamp: string;
  /** Client nonce — caller-supplied randomness (a UUID by convention). */
  nonce: string;
}

/** The scheme's default content-hash window: 128 KiB. */
export const EDGEGRID_DEFAULT_MAX_BODY = 131072;

/** The scheme's timestamp format — `yyyyMMddTHH:mm:ss+0000`, UTC. */
export function edgeGridTimestamp(now: Date): string {
  const two = (n: number): string => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}${two(now.getUTCMonth() + 1)}${two(now.getUTCDate())}` +
    `T${two(now.getUTCHours())}:${two(now.getUTCMinutes())}:${two(now.getUTCSeconds())}+0000`
  );
}

/** The header names a config signs, in its order — the comma list
 *  split, trimmed, blanks dropped. */
export function edgeGridHeadersToSign(headersToSign: string | undefined): string[] {
  return (headersToSign ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

/** Sign the request, returning the headers to add. The caller must set
 *  them replace-not-append (a stale user-set `Authorization` would
 *  combine into garbage on the wire). */
export async function signEdgeGrid(
  credentials: EdgeGridCredentials,
  input: EdgeGridSignInput,
): Promise<Array<{ key: string; value: string }>> {
  const prefix =
    `EG1-HMAC-SHA256 client_token=${credentials.clientToken};access_token=${credentials.accessToken};` +
    `timestamp=${input.timestamp};nonce=${input.nonce};`;
  const dataToSign = await buildEdgeGridDataToSign(credentials, input, prefix);
  const signingKey = await edgeGridSigningKey(credentials.clientSecret, input.timestamp);
  const signature = encodeBase64Bytes(await hmacSha256(new TextEncoder().encode(signingKey), dataToSign));
  return [{ key: 'Authorization', value: `${prefix}signature=${signature}` }];
}

/**
 * The tab-joined data string the signature covers. Exported so tests
 * can pin the scheme's published `expectedDataToSign` strings.
 */
export async function buildEdgeGridDataToSign(
  credentials: Pick<EdgeGridCredentials, 'headersToSign' | 'maxBodySize'>,
  input: Omit<EdgeGridSignInput, 'timestamp' | 'nonce'>,
  authHeaderPrefix: string,
): Promise<string> {
  const url = new URL(input.url);
  return [
    input.method.toUpperCase(),
    url.protocol.replace(/:$/, ''),
    url.host,
    `${url.pathname}${url.search}`,
    canonicalizeHeaders(edgeGridHeadersToSign(credentials.headersToSign), input.headers),
    await contentHash(input.method, input.body, credentials.maxBodySize ?? EDGEGRID_DEFAULT_MAX_BODY),
    authHeaderPrefix,
  ].join('\t');
}

/** base64 HMAC-SHA256 of the timestamp keyed by the client secret —
 *  the per-send signing key. Exported for the published key vector. */
export async function edgeGridSigningKey(clientSecret: string, timestamp: string): Promise<string> {
  return encodeBase64Bytes(await hmacSha256(new TextEncoder().encode(clientSecret), timestamp));
}

// ── Canonicalization ────────────────────────────────────────────────

/** `name:value` per listed header (lowercased name, trimmed +
 *  space-collapsed value), tab-joined, in the LIST's order; a listed
 *  header the request does not carry is skipped. */
function canonicalizeHeaders(names: readonly string[], headers: ReadonlyArray<{ key: string; value: string }>): string {
  const out: string[] = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    const value = headers.find((h) => h.key.toLowerCase() === lower)?.value;
    if (value === undefined || value === '') continue;
    out.push(`${lower}:${value.trim().replace(/\s+/g, ' ')}`);
  }
  return out.join('\t');
}

/** POST only: base64 SHA-256 of the body's first `maxBody` BYTES;
 *  empty for every other method and for an empty body. */
async function contentHash(method: string, body: string | undefined, maxBody: number): Promise<string> {
  if (method.toUpperCase() !== 'POST' || body === undefined || body === '') return '';
  const bytes = new TextEncoder().encode(body);
  const window = bytes.length > maxBody ? bytes.subarray(0, maxBody) : bytes;
  const digest = await crypto.subtle.digest('SHA-256', window as Uint8Array<ArrayBuffer>);
  return encodeBase64Bytes(new Uint8Array(digest));
}

// ── Crypto primitives ───────────────────────────────────────────────

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)));
}
