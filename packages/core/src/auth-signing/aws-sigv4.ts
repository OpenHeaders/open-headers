/**
 * AWS Signature Version 4 request signing.
 *
 * Pure WebCrypto (`crypto.subtle` is a global on both runtimes — the
 * MV3 service worker and Node 22+), no platform deps. The signer takes
 * the FINAL wire shape — method, URL with query already appended, the
 * outgoing header list, and the payload hash — and returns what the
 * caller must apply: in header mode the headers to add (`X-Amz-Date`,
 * `Authorization`, plus `X-Amz-Security-Token` /
 * `X-Amz-Content-Sha256` when applicable) and the URL untouched; in
 * query mode no headers and the URL with the `X-Amz-*` parameters
 * appended, `X-Amz-Signature` last. The `Host` header is derived from
 * the URL for the canonical request but never returned: both
 * runtimes' fetch stacks set it themselves, and the browser forbids
 * setting it manually.
 *
 * The credential scope's service and region may be left blank: an AWS
 * endpoint names both in its hostname ({@link deriveAwsScope}) and the
 * region falls back to `us-east-1` — the SDKs' rule. A blank service
 * on a non-AWS host has no honest default and the signer throws.
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
  /** Service namespace for the credential scope (`s3`, `execute-api`, …).
   *  Blank = derived from an AWS hostname. */
  service: string;
  /** Region for the credential scope (`us-east-1`, …). Blank = derived
   *  from an AWS hostname, else `us-east-1`. */
  region: string;
  /** Where the signature lands — the `Authorization` header (absent =
   *  the default) or the URL's query string (`X-Amz-*` parameters). */
  addTo?: 'header' | 'query';
}

export interface AwsSigV4SignInput {
  method: string;
  /** Final wire URL — query string already appended. */
  url: string;
  /** The headers the transport will SHIP — every one of them joins the
   *  signed set except {@link UNSIGNED_HEADER_NAMES} (servers verify what
   *  rides, and S3 rejects a request whose `x-amz-*` rows are unsigned).
   *  Callers pass the post-guard list: on the browser host the names
   *  fetch refuses never ride, so they must never be signed. */
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

export interface AwsSigV4Signed {
  /** Headers to set replace-not-append (empty in query mode). */
  headers: Array<{ key: string; value: string }>;
  /** The wire URL — the input URL in header mode, the signed URL in
   *  query mode. */
  url: string;
}

export const AWS_SIGV4_UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

/** Lifetime a query-signed S3 URL carries as `X-Amz-Expires` — the
 *  SDKs' default; the other services ignore the parameter. */
export const AWS_SIGV4_QUERY_EXPIRES_SECONDS = 86400;

/** The region a blank field falls back to when the host names none. */
export const AWS_SIGV4_DEFAULT_REGION = 'us-east-1';

/**
 * Outgoing headers that never join the signed set — the ones proxies
 * and user agents rewrite in flight, plus the `Authorization` row the
 * signature replaces. The same list the AWS SDKs exclude.
 */
const UNSIGNED_HEADER_NAMES: ReadonlySet<string> = new Set([
  'authorization',
  'connection',
  'expect',
  'presigned-expires',
  'range',
  'user-agent',
  'x-amzn-trace-id',
]);

/**
 * The service and region an AWS hostname names —
 * `<service>.<region>.amazonaws.com(.cn)`, with the shapes that break
 * the pattern: the global `s3.amazonaws.com` (us-east-1), the legacy
 * `s3-<region>` labels, the search services whose labels ride
 * reversed (`<domain>.<region>.es.amazonaws.com`), and SES whose
 * endpoint says `email` but whose scope says `ses`. Either part is
 * absent when the host does not name it; a non-AWS host names neither.
 */
export function deriveAwsScope(hostname: string): { service?: string; region?: string } {
  const match = hostname.toLowerCase().match(/([^.]{1,63})\.(?:([^.]{0,63})\.)?amazonaws\.com(?:\.cn)?$/);
  if (!match) return {};
  let [service, region] = [match[1], match[2]] as [string | undefined, string | undefined];
  if (region === 'es' || region === 'aoss') [service, region] = [region, service];
  // `<bucket>.s3.amazonaws.com` matches as service=bucket, region=s3.
  if (region === 's3' || (service === 's3' && !region)) [service, region] = ['s3', AWS_SIGV4_DEFAULT_REGION];
  if (service?.startsWith('s3-')) [service, region] = ['s3', service.slice(3)];
  if (region?.startsWith('s3-')) [service, region] = ['s3', region.slice(3)];
  if (service === 'email') service = 'ses';
  return { ...(service ? { service } : {}), ...(region ? { region } : {}) };
}

/**
 * The credential scope a config signs with for a URL: a set field
 * wins, a blank one derives from the host, a blank region falls back
 * to {@link AWS_SIGV4_DEFAULT_REGION}. `service` is absent when neither
 * the field nor the host names one — the send-time error.
 */
export function resolveAwsScope(
  credentials: Pick<AwsSigV4Credentials, 'service' | 'region'>,
  hostname: string,
): { service?: string; region: string } {
  const derived = deriveAwsScope(hostname);
  const service = credentials.service.trim() || derived.service;
  const region = credentials.region.trim() || derived.region || AWS_SIGV4_DEFAULT_REGION;
  return { ...(service ? { service } : {}), region };
}

/** Lowercase hex SHA-256 of a UTF-8 string. Exposed so executors can
 *  compute the payload hash with the same primitive the signer uses. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Sign the request. Header mode returns the headers to add — the
 * caller must set them replace-not-append (a stale user-set
 * `Authorization` would combine into garbage on the wire). Query mode
 * returns the signed URL and no headers.
 */
export async function signAwsSigV4(
  credentials: AwsSigV4Credentials,
  input: AwsSigV4SignInput,
): Promise<AwsSigV4Signed> {
  const url = new URL(input.url);
  const amzDate = toAmzDate(input.now);
  const dateStamp = amzDate.slice(0, 8);
  const scope = resolveAwsScope(credentials, url.hostname);
  if (!scope.service) {
    throw new Error(`no service name set and the host "${url.hostname}" is not an AWS endpoint`);
  }
  const { service, region } = scope;
  const query = credentials.addTo === 'query';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  // S3 presigned URLs sign an unsigned payload; every other shape
  // signs the wire bytes.
  const payloadHash = query && service === 's3' ? AWS_SIGV4_UNSIGNED_PAYLOAD : input.payloadHash;

  // ── Headers the signature adds (they must be signed too). Query
  //    mode adds none — the same facts ride as X-Amz-* parameters. ──
  const added: Array<{ key: string; value: string }> = [];
  if (!query) {
    added.push({ key: 'X-Amz-Date', value: amzDate });
    if (credentials.sessionToken) added.push({ key: 'X-Amz-Security-Token', value: credentials.sessionToken });
    // S3 requires the payload hash to ride as a header; other services
    // read it from the string-to-sign only.
    if (service === 's3') added.push({ key: 'X-Amz-Content-Sha256', value: payloadHash });
  }

  // ── Canonical headers: every shipping header outside the unsigned
  //    list, then host from the URL and the added set on top (both win
  //    over a same-key user row — the executor replaces those on the
  //    wire). Lowercased names, trimmed + space-collapsed values, sorted
  //    by name. ──
  const canonicalHeaderMap = new Map<string, string>();
  for (const h of input.headers) {
    const name = h.key.toLowerCase();
    if (UNSIGNED_HEADER_NAMES.has(name)) continue;
    canonicalHeaderMap.set(name, trimHeaderValue(h.value));
  }
  canonicalHeaderMap.set('host', url.host);
  for (const h of added) canonicalHeaderMap.set(h.key.toLowerCase(), trimHeaderValue(h.value));

  const signedHeaderNames = [...canonicalHeaderMap.keys()].sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${canonicalHeaderMap.get(name)}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');

  // ── Query mode: the X-Amz-* parameters join the URL BEFORE
  //    canonicalization (all but the signature), appended to the wire
  //    string as-is so the user's own query keeps its byte form. ──
  let wireUrl = input.url;
  if (query) {
    const params: Array<[string, string]> = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${credentials.accessKeyId}/${credentialScope}`],
      ['X-Amz-Date', amzDate],
      ...(service === 's3' ? [['X-Amz-Expires', String(AWS_SIGV4_QUERY_EXPIRES_SECONDS)] as [string, string]] : []),
      ['X-Amz-SignedHeaders', signedHeaders],
      ...(credentials.sessionToken ? [['X-Amz-Security-Token', credentials.sessionToken] as [string, string]] : []),
    ];
    wireUrl = appendQuery(wireUrl, params);
  }

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri(url.pathname, service),
    canonicalQuery(new URL(wireUrl).searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');

  // ── Signing key chain: HMAC("AWS4" + secret, date → region → service → "aws4_request") ──
  let key = await hmac(new TextEncoder().encode(`AWS4${credentials.secretAccessKey}`), dateStamp);
  key = await hmac(key, region);
  key = await hmac(key, service);
  key = await hmac(key, 'aws4_request');
  const signature = bytesToHex(await hmac(key, stringToSign));

  if (query) return { headers: [], url: appendQuery(wireUrl, [['X-Amz-Signature', signature]]) };
  added.push({
    key: 'Authorization',
    value: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  });
  return { headers: added, url: wireUrl };
}

// ── Canonicalization ────────────────────────────────────────────────

/**
 * Canonical URI. `URL.pathname` is already once-percent-encoded and
 * dot-segment-free by the URL parser; per the SigV4 spec every service
 * except S3 signs the path NORMALIZED (repeated slashes collapsed) and
 * DOUBLE-encoded (each segment URI-encoded again), while S3 signs the
 * once-encoded path verbatim, un-normalized.
 */
function canonicalUri(pathname: string, service: string): string {
  const path = pathname || '/';
  if (service === 's3') return path;
  return path
    .replace(/\/{2,}/g, '/')
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

/** Append RFC 3986-encoded pairs to a wire URL without re-serializing
 *  the query it already carries. */
function appendQuery(url: string, pairs: ReadonlyArray<[string, string]>): string {
  const encoded = pairs.map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`).join('&');
  const [base, fragment] = splitFragment(url);
  const joiner = base.includes('?') ? (base.endsWith('?') || base.endsWith('&') ? '' : '&') : '?';
  return `${base}${joiner}${encoded}${fragment}`;
}

function splitFragment(url: string): [string, string] {
  const hash = url.indexOf('#');
  return hash === -1 ? [url, ''] : [url.slice(0, hash), url.slice(hash)];
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
