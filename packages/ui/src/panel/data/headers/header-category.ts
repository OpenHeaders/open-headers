/**
 * Categorize an HTTP header name into a small set of buckets that
 * organize the Headers tab into collapsible groups. The categories
 * mirror the *intent* a debugger has when scanning headers (auth,
 * cors, caching, security, …) rather than the IANA registry's formal
 * classification — pragmatism over taxonomy.
 *
 * The category set is kept in sync with the info-popover registry in
 * `@openheaders/ui/shared/info-popover/data/http-headers` so a header
 * the info popover documents under "Routing" appears in the Headers
 * tab's "Routing" group as well. When you add an entry to that
 * registry, add the corresponding `EXACT` row here.
 *
 * Lookup is case-insensitive (RFC 9110 §5.1). Unknown headers fall
 * into `other`, which keeps the bucket non-empty for most requests
 * but is always rendered last.
 */

export type HeaderCategory =
  | 'routing'
  | 'auth'
  | 'cors'
  | 'caching'
  | 'security'
  | 'cookies'
  | 'content'
  | 'connection'
  | 'client-hints'
  | 'fetch-metadata'
  | 'performance'
  | 'privacy'
  | 'server-id'
  | 'proxy'
  | 'tracing'
  | 'other';

export const HEADER_CATEGORY_ORDER: readonly HeaderCategory[] = [
  'routing',
  'auth',
  'cors',
  'caching',
  'security',
  'cookies',
  'content',
  'connection',
  'client-hints',
  'fetch-metadata',
  'performance',
  'privacy',
  'server-id',
  'proxy',
  'tracing',
  'other',
];

export const HEADER_CATEGORY_LABEL: Record<HeaderCategory, string> = {
  routing: 'Routing',
  auth: 'Authentication',
  cors: 'CORS',
  caching: 'Caching',
  security: 'Security',
  cookies: 'Cookies',
  content: 'Content',
  connection: 'Connection',
  'client-hints': 'Client Hints',
  'fetch-metadata': 'Fetch metadata',
  performance: 'Performance',
  privacy: 'Privacy',
  'server-id': 'Server identification',
  proxy: 'Proxy',
  tracing: 'Tracing & telemetry',
  other: 'Other',
};

const EXACT: ReadonlyMap<string, HeaderCategory> = new Map<string, HeaderCategory>([
  // Routing
  [':authority', 'routing'],
  [':method', 'routing'],
  [':path', 'routing'],
  [':scheme', 'routing'],
  [':status', 'routing'],
  [':protocol', 'routing'],
  ['host', 'routing'],
  ['location', 'routing'],
  ['allow', 'routing'],
  ['referer', 'routing'],
  ['retry-after', 'routing'],
  ['max-forwards', 'routing'],
  ['service-worker', 'routing'],
  ['service-worker-allowed', 'routing'],

  // Auth
  ['authorization', 'auth'],
  ['proxy-authorization', 'auth'],
  ['www-authenticate', 'auth'],
  ['proxy-authenticate', 'auth'],
  ['authentication-info', 'auth'],
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
  ['timing-allow-origin', 'cors'],
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
  ['cf-cache-status', 'caching'],
  ['x-cache', 'caching'],
  ['x-cache-hits', 'caching'],

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
  ['clear-site-data', 'security'],

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
  ['content-md5', 'content'],
  ['accept', 'content'],
  ['accept-encoding', 'content'],
  ['accept-language', 'content'],
  ['accept-ranges', 'content'],
  ['accept-charset', 'content'],
  ['range', 'content'],
  ['if-range', 'content'],
  ['transfer-encoding', 'content'],
  ['trailer', 'content'],

  // Connection
  ['connection', 'connection'],
  ['keep-alive', 'connection'],
  ['upgrade', 'connection'],
  ['te', 'connection'],
  ['expect', 'connection'],
  ['alt-svc', 'connection'],
  ['sec-websocket-key', 'connection'],
  ['sec-websocket-accept', 'connection'],
  ['sec-websocket-version', 'connection'],
  ['sec-websocket-protocol', 'connection'],
  ['sec-websocket-extensions', 'connection'],

  // Client Hints
  ['user-agent', 'client-hints'],
  ['accept-ch', 'client-hints'],
  ['critical-ch', 'client-hints'],
  ['save-data', 'client-hints'],
  ['device-memory', 'client-hints'],
  ['downlink', 'client-hints'],
  ['ect', 'client-hints'],
  ['rtt', 'client-hints'],

  // Privacy
  ['dnt', 'privacy'],
  ['sec-gpc', 'privacy'],

  // Performance
  ['priority', 'performance'],
  ['upgrade-insecure-requests', 'performance'],
  ['early-data', 'performance'],
  ['link', 'performance'],
  ['x-dns-prefetch-control', 'performance'],

  // Server identification
  ['server', 'server-id'],
  ['x-powered-by', 'server-id'],
  ['date', 'server-id'],
  ['x-served-by', 'server-id'],

  // Proxy
  ['via', 'proxy'],
  ['x-forwarded-for', 'proxy'],
  ['x-forwarded-proto', 'proxy'],
  ['x-forwarded-host', 'proxy'],
  ['x-real-ip', 'proxy'],
  ['forwarded', 'proxy'],
  ['true-client-ip', 'proxy'],

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
  ['x-fastly-request-id', 'tracing'],
  ['reporting-endpoints', 'tracing'],
  ['report-to', 'tracing'],
  ['nel', 'tracing'],

  // Security additions
  ['origin-agent-cluster', 'security'],
  ['x-robots-tag', 'security'],
  ['x-ua-compatible', 'security'],

  // Caching additions
  ['surrogate-control', 'caching'],
  ['surrogate-capability', 'caching'],
  ['warning', 'caching'],

  // Fetch metadata additions
  ['sec-purpose', 'fetch-metadata'],
]);

const PREFIX: readonly { prefix: string; cat: HeaderCategory }[] = [
  { prefix: 'sec-fetch-', cat: 'fetch-metadata' },
  { prefix: 'sec-ch-ua', cat: 'client-hints' },
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
