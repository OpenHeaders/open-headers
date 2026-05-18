/**
 * Categorize an HTTP header name into a small set of buckets that
 * organize the Headers tab into collapsible groups. The categories are
 * chosen to mirror the *intent* a debugger has when scanning headers
 * (auth, cors, caching, security, …) rather than the IANA registry's
 * formal classification — pragmatism over taxonomy.
 *
 * Lookup is case-insensitive (RFC 9110 §5.1). Unknown headers fall
 * into `other`, which keeps the bucket non-empty for most requests
 * but is always rendered last.
 */

export type HeaderCategory =
  | 'auth'
  | 'cors'
  | 'caching'
  | 'security'
  | 'content'
  | 'cookies'
  | 'tracing'
  | 'other';

export const HEADER_CATEGORY_ORDER: readonly HeaderCategory[] = [
  'auth',
  'cors',
  'caching',
  'security',
  'cookies',
  'content',
  'tracing',
  'other',
];

export const HEADER_CATEGORY_LABEL: Record<HeaderCategory, string> = {
  auth: 'Authentication',
  cors: 'CORS',
  caching: 'Caching',
  security: 'Security',
  cookies: 'Cookies',
  content: 'Content',
  tracing: 'Tracing & telemetry',
  other: 'Other',
};

const EXACT: ReadonlyMap<string, HeaderCategory> = new Map<string, HeaderCategory>([
  // Auth
  ['authorization', 'auth'],
  ['proxy-authorization', 'auth'],
  ['www-authenticate', 'auth'],
  ['proxy-authenticate', 'auth'],
  ['x-api-key', 'auth'],
  ['x-auth-token', 'auth'],
  ['x-csrf-token', 'auth'],
  ['x-xsrf-token', 'auth'],

  // CORS
  ['origin', 'cors'],
  ['access-control-allow-origin', 'cors'],
  ['access-control-allow-credentials', 'cors'],
  ['access-control-allow-headers', 'cors'],
  ['access-control-allow-methods', 'cors'],
  ['access-control-expose-headers', 'cors'],
  ['access-control-max-age', 'cors'],
  ['access-control-request-method', 'cors'],
  ['access-control-request-headers', 'cors'],
  ['vary', 'cors'],

  // Caching
  ['cache-control', 'caching'],
  ['pragma', 'caching'],
  ['expires', 'caching'],
  ['etag', 'caching'],
  ['if-match', 'caching'],
  ['if-none-match', 'caching'],
  ['if-modified-since', 'caching'],
  ['if-unmodified-since', 'caching'],
  ['last-modified', 'caching'],
  ['age', 'caching'],

  // Security
  ['content-security-policy', 'security'],
  ['content-security-policy-report-only', 'security'],
  ['strict-transport-security', 'security'],
  ['x-content-type-options', 'security'],
  ['x-frame-options', 'security'],
  ['x-xss-protection', 'security'],
  ['referrer-policy', 'security'],
  ['permissions-policy', 'security'],
  ['cross-origin-opener-policy', 'security'],
  ['cross-origin-embedder-policy', 'security'],
  ['cross-origin-resource-policy', 'security'],
  ['expect-ct', 'security'],
  ['x-permitted-cross-domain-policies', 'security'],

  // Cookies
  ['cookie', 'cookies'],
  ['set-cookie', 'cookies'],

  // Content
  ['content-type', 'content'],
  ['content-length', 'content'],
  ['content-encoding', 'content'],
  ['content-language', 'content'],
  ['content-disposition', 'content'],
  ['content-location', 'content'],
  ['content-range', 'content'],
  ['accept', 'content'],
  ['accept-encoding', 'content'],
  ['accept-language', 'content'],
  ['accept-ranges', 'content'],
  ['transfer-encoding', 'content'],

  // Tracing & telemetry
  ['server-timing', 'tracing'],
  ['traceparent', 'tracing'],
  ['tracestate', 'tracing'],
  ['baggage', 'tracing'],
  ['x-request-id', 'tracing'],
  ['x-correlation-id', 'tracing'],
  ['x-trace-id', 'tracing'],
  ['x-amz-request-id', 'tracing'],
  ['x-amz-id-2', 'tracing'],
  ['x-cloud-trace-context', 'tracing'],
  ['cf-ray', 'tracing'],
  ['cf-request-id', 'tracing'],
  ['x-vercel-id', 'tracing'],
  ['x-render-id', 'tracing'],
]);

const PREFIX: readonly { prefix: string; cat: HeaderCategory }[] = [
  { prefix: 'sec-fetch-', cat: 'security' },
  { prefix: 'sec-ch-ua', cat: 'security' },
  { prefix: 'access-control-', cat: 'cors' },
  { prefix: 'x-amz-cf-', cat: 'tracing' },
];

export function categorizeHeader(name: string): HeaderCategory {
  const lower = name.toLowerCase();
  const exact = EXACT.get(lower);
  if (exact) return exact;
  for (const { prefix, cat } of PREFIX) {
    if (lower.startsWith(prefix)) return cat;
  }
  return 'other';
}
