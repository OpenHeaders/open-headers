/**
 * AWS Signature Version 4 request signing.
 *
 * Pure WebCrypto (`crypto.subtle` is a global on both runtimes — the
 * MV3 service worker and Node 22+), no platform deps. The signer takes
 * the FINAL wire shape — method, URL with query already appended, the
 * outgoing header list, and the payload hash — and returns ONLY the
 * headers the caller must add (`X-Amz-Date`, `Authorization`, plus
 * `X-Amz-Security-Token` / `X-Amz-Content-Sha256` when applicable).
 * The `Host` header is derived from the URL for the canonical request
 * but never returned: both runtimes' fetch stacks set it themselves,
 * and the browser forbids setting it manually.
 *
 * Callers sign at EXECUTE time, after pre-request scripts have mutated
 * the request — a signature computed any earlier is invalidated by the
 * first script mutation.
 */

export interface AwsSigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** STS temporary-credential session token; signed + sent as
   *  `X-Amz-Security-Token` when present. */
  sessionToken?: string;
  /** Service namespace for the credential scope (`s3`, `execute-api`, …). */
  service: string;
  /** Region for the credential scope (`us-east-1`, …). */
  region: string;
}

export interface AwsSigV4SignInput {
  method: string;
  /** Final wire URL — query string already appended. */
  url: string;
  /** Outgoing headers (used to fold an existing `Content-Type` into the
   *  signed set — servers verify what actually rides the wire). */
  headers: ReadonlyArray<{ key: string; value: string }>;
  /** Lowercase hex SHA-256 of the wire payload, or
   *  {@link AWS_SIGV4_UNSIGNED_PAYLOAD} when the payload bytes are not
   *  knowable ahead of dispatch (multipart bodies — the runtime picks
   *  the boundary). Unsigned payloads are honored by S3 over HTTPS. */
  payloadHash: string;
  /** Signing timestamp — injected so tests can pin the official test
   *  suite's date. */
  now: Date;
}

export const AWS_SIGV4_UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

/** Lowercase hex SHA-256 of a UTF-8 string. Exposed so executors can
 *  compute the payload hash with the same primitive the signer uses. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Sign the request, returning the headers to add. The caller must set
 * them replace-not-append (a stale user-set `Authorization` would
 * combine into garbage on the wire).
 */
export async function signAwsSigV4(
  credentials: AwsSigV4Credentials,
  input: AwsSigV4SignInput,
): Promise<Array<{ key: string; value: string }>> {
  const url = new URL(input.url);
  const amzDate = toAmzDate(input.now);
  const dateStamp = amzDate.slice(0, 8);
  const service = credentials.service.trim();
  const region = credentials.region.trim();

  // ── Headers the signature adds (they must be signed too) ──
  const added: Array<{ key: string; value: string }> = [{ key: 'X-Amz-Date', value: amzDate }];
  if (credentials.sessionToken) {
    added.push({ key: 'X-Amz-Security-Token', value: credentials.sessionToken });
  }
  // S3 requires the payload hash to ride as a header; other services
  // read it from the string-to-sign only.
  if (service === 's3') {
    added.push({ key: 'X-Amz-Content-Sha256', value: input.payloadHash });
  }

  // ── Canonical headers: host + the added set + Content-Type when the
  //    request carries one. Lowercased names, trimmed + space-collapsed
  //    values, sorted by name. ──
  const canonicalHeaderMap = new Map<string, string>();
  canonicalHeaderMap.set('host', url.host);
  for (const h of added) canonicalHeaderMap.set(h.key.toLowerCase(), trimHeaderValue(h.value));
  const contentType = input.headers.find((h) => h.key.toLowerCase() === 'content-type');
  if (contentType) canonicalHeaderMap.set('content-type', trimHeaderValue(contentType.value));

  const signedHeaderNames = [...canonicalHeaderMap.keys()].sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${canonicalHeaderMap.get(name)}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri(url.pathname, service),
    canonicalQuery(url.searchParams),
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');

  // ── Signing key chain: HMAC("AWS4" + secret, date → region → service → "aws4_request") ──
  let key = await hmac(new TextEncoder().encode(`AWS4${credentials.secretAccessKey}`), dateStamp);
  key = await hmac(key, region);
  key = await hmac(key, service);
  key = await hmac(key, 'aws4_request');
  const signature = bytesToHex(await hmac(key, stringToSign));

  added.push({
    key: 'Authorization',
    value: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  });
  return added;
}

// ── Canonicalization ────────────────────────────────────────────────

/**
 * Canonical URI. `URL.pathname` is already once-percent-encoded by the
 * URL parser; per the SigV4 spec every service except S3 signs the path
 * DOUBLE-encoded (each segment URI-encoded again), while S3 signs the
 * once-encoded path verbatim, un-normalized.
 */
function canonicalUri(pathname: string, service: string): string {
  const path = pathname || '/';
  if (service === 's3') return path;
  return path
    .split('/')
    .map((segment) => encodeRfc3986(segment))
    .join('/');
}

/** Canonical query string: RFC 3986-encoded pairs sorted by key, then
 *  by value (repeated keys keep a deterministic order). */
function canonicalQuery(params: URLSearchParams): string {
  const pairs: Array<[string, string]> = [];
  params.forEach((value, key) => {
    pairs.push([encodeRfc3986(key), encodeRfc3986(value)]);
  });
  pairs.sort((a, b) => (a[0] === b[0] ? compareStrings(a[1], b[1]) : compareStrings(a[0], b[0])));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

/** Strict RFC 3986 encoding — `encodeURIComponent` plus the five
 *  characters it leaves bare (`!'()*`). */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Trim + collapse sequential inner whitespace, per the canonical
 *  headers rule. */
function trimHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Byte-order comparison (the spec sorts by code point, not locale). */
function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** `YYYYMMDD'T'HHMMSS'Z'` — ISO 8601 basic format, UTC. */
function toAmzDate(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

// ── Crypto primitives ───────────────────────────────────────────────

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
