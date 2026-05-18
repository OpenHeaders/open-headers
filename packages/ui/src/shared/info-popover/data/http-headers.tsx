/**
 * Pure-data registry of explanations for common HTTP headers. Powers
 * the `(i)` triggers on the Headers tab via `<InfoTrigger>` — no docs
 * panel involvement, no React in this file.
 *
 * Each entry maps a lowercase header name to its display name, the
 * direction it most commonly appears in, the category it belongs to,
 * a one-sentence summary, optional richer description paragraphs, and
 * optional structured sub-blocks (directives / common values).
 *
 * `getHeaderInfoContent(name)` turns an entry into an `InfoPopoverContent`
 * with the right kicker / sections wired up. The entry shape stays
 * separate from `InfoPopoverContent` so adding fields here doesn't
 * force every existing entry to change.
 */

import type { InfoPopoverContent, InfoPopoverSection } from '../types';

type HeaderDirection = 'request' | 'response' | 'both';
type HeaderCategory =
  | 'CORS'
  | 'Caching'
  | 'Security'
  | 'Cookies'
  | 'Content'
  | 'Auth'
  | 'Tracing'
  | 'Client Hints'
  | 'Fetch metadata';

interface HeaderInfoEntry {
  display: string;
  direction: HeaderDirection;
  category: HeaderCategory;
  summary: string;
  body?: ReadonlyArray<string>;
  directives?: ReadonlyArray<{ key: string; desc: string }>;
  commonValues?: ReadonlyArray<{ value: string; desc: string }>;
}

const HEADER_INFO: ReadonlyMap<string, HeaderInfoEntry> = new Map<string, HeaderInfoEntry>([
  // ── CORS ─────────────────────────────────────────────────────
  [
    'access-control-allow-origin',
    {
      display: 'Access-Control-Allow-Origin',
      direction: 'response',
      category: 'CORS',
      summary: 'Tells the browser which origins are allowed to read this response.',
      body: [
        'Set on the response by the server. The browser compares it to the request’s `Origin` header and blocks JavaScript from reading the body if they don’t match.',
        '`*` accepts any origin but is incompatible with credentials — if the request carries cookies or auth, the response must echo the exact requesting origin instead.',
      ],
      commonValues: [
        { value: '*', desc: 'Any origin can read (no credentials).' },
        { value: 'https://app.openheaders.io', desc: 'Only the named origin can read.' },
      ],
    },
  ],
  [
    'access-control-allow-credentials',
    {
      display: 'Access-Control-Allow-Credentials',
      direction: 'response',
      category: 'CORS',
      summary: 'Permits the browser to expose the response when the request carried credentials.',
      body: ['Must be `true` (lowercase). When set, `Access-Control-Allow-Origin` must NOT be `*` — it has to echo the exact origin.'],
    },
  ],
  [
    'access-control-allow-methods',
    {
      display: 'Access-Control-Allow-Methods',
      direction: 'response',
      category: 'CORS',
      summary: 'Lists HTTP methods the server accepts for cross-origin requests.',
      body: ['Returned on preflight (`OPTIONS`) responses. The browser caches the answer for `Access-Control-Max-Age` seconds.'],
    },
  ],
  [
    'access-control-allow-headers',
    {
      display: 'Access-Control-Allow-Headers',
      direction: 'response',
      category: 'CORS',
      summary: 'Lists request headers the server accepts on cross-origin requests.',
      body: [
        'Required when the browser preflights non-simple headers (anything beyond `Accept`, `Accept-Language`, `Content-Language`, simple `Content-Type` values).',
      ],
    },
  ],
  [
    'access-control-expose-headers',
    {
      display: 'Access-Control-Expose-Headers',
      direction: 'response',
      category: 'CORS',
      summary: 'Lists response headers JavaScript is allowed to read.',
      body: [
        'By default JS only sees CORS-safelisted response headers (`Cache-Control`, `Content-Language`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`). Any other header has to be named here for `response.headers.get(...)` to return it.',
      ],
    },
  ],
  [
    'access-control-max-age',
    {
      display: 'Access-Control-Max-Age',
      direction: 'response',
      category: 'CORS',
      summary: 'How long the browser may cache the preflight response, in seconds.',
      body: ['Big values cut preflight chatter — a value of 86400 (1 day) is common. Chrome caps at 7200 seconds; Firefox at 86400.'],
    },
  ],
  [
    'access-control-request-method',
    {
      display: 'Access-Control-Request-Method',
      direction: 'request',
      category: 'CORS',
      summary: 'Sent on preflight to declare the method the actual request will use.',
      body: ['The server replies with `Access-Control-Allow-Methods` to confirm.'],
    },
  ],
  [
    'access-control-request-headers',
    {
      display: 'Access-Control-Request-Headers',
      direction: 'request',
      category: 'CORS',
      summary: 'Sent on preflight to declare the headers the actual request will carry.',
      body: ['Mirrored back via `Access-Control-Allow-Headers` if accepted.'],
    },
  ],
  [
    'origin',
    {
      display: 'Origin',
      direction: 'request',
      category: 'CORS',
      summary: 'Identifies the origin that initiated a cross-origin or POST request.',
      body: ['Sent automatically by the browser. Cannot be set by JS. Used by servers to decide CORS responses and by CSRF defenses.'],
    },
  ],
  [
    'vary',
    {
      display: 'Vary',
      direction: 'response',
      category: 'CORS',
      summary: 'Tells caches which request headers affect the response, so they vary the cache key.',
      body: [
        'Critical for CORS: include `Vary: Origin` whenever `Access-Control-Allow-Origin` is computed from the request’s origin, otherwise a cache will serve one origin’s response to another.',
      ],
    },
  ],

  // ── Caching ─────────────────────────────────────────────────
  [
    'cache-control',
    {
      display: 'Cache-Control',
      direction: 'both',
      category: 'Caching',
      summary: 'Directives that govern how a response is cached and revalidated.',
      body: [
        'Both request and response carry directives. Multiple comma-separated tokens are AND-combined. Behavior is per-directive — the header is not a single mode.',
      ],
      directives: [
        { key: 'no-store', desc: 'Do not cache at all, anywhere.' },
        { key: 'no-cache', desc: 'May cache, but revalidate every time before reuse.' },
        { key: 'public', desc: 'Any cache may store, including shared/CDN.' },
        { key: 'private', desc: 'Only the user’s browser may store.' },
        { key: 'max-age=N', desc: 'Fresh for N seconds; reuse without contacting origin.' },
        { key: 's-maxage=N', desc: 'Like max-age but only for shared caches.' },
        { key: 'must-revalidate', desc: 'Once stale, revalidate before serving.' },
        { key: 'immutable', desc: 'Promise the body will not change for max-age.' },
        { key: 'stale-while-revalidate=N', desc: 'Allow stale reuse while a background revalidation runs.' },
      ],
    },
  ],
  [
    'pragma',
    {
      display: 'Pragma',
      direction: 'both',
      category: 'Caching',
      summary: 'Legacy HTTP/1.0 cache control — effectively superseded by Cache-Control.',
      body: ['`Pragma: no-cache` is still set by some clients for compatibility. Modern servers should honor `Cache-Control` and ignore `Pragma`.'],
    },
  ],
  [
    'expires',
    {
      display: 'Expires',
      direction: 'response',
      category: 'Caching',
      summary: 'Absolute date/time after which the response is considered stale.',
      body: ['Superseded by `Cache-Control: max-age`. If both are set, `max-age` wins. Use a date in the past (or `0`) to force re-fetch.'],
    },
  ],
  [
    'etag',
    {
      display: 'ETag',
      direction: 'response',
      category: 'Caching',
      summary: 'Opaque identifier for the response body — used to revalidate cached copies.',
      body: ['Clients echo it back in `If-None-Match`. If the value still matches, the server replies `304 Not Modified` with no body.'],
    },
  ],
  [
    'if-match',
    {
      display: 'If-Match',
      direction: 'request',
      category: 'Caching',
      summary: 'Conditional request: proceed only if the resource’s current ETag matches.',
      body: ['Used by writes to prevent overwriting changes made by someone else (optimistic concurrency).'],
    },
  ],
  [
    'if-none-match',
    {
      display: 'If-None-Match',
      direction: 'request',
      category: 'Caching',
      summary: 'Conditional request: proceed only if the resource’s ETag has changed.',
      body: ['Used by reads to skip downloading an unchanged response — the server replies `304 Not Modified`.'],
    },
  ],
  [
    'if-modified-since',
    {
      display: 'If-Modified-Since',
      direction: 'request',
      category: 'Caching',
      summary: 'Conditional request: proceed only if the resource changed after the given date.',
      body: ['Less precise than `If-None-Match`/ETag; prefer ETags when available.'],
    },
  ],
  [
    'if-unmodified-since',
    {
      display: 'If-Unmodified-Since',
      direction: 'request',
      category: 'Caching',
      summary: 'Conditional request: proceed only if the resource has not been modified since the given date.',
    },
  ],
  [
    'last-modified',
    {
      display: 'Last-Modified',
      direction: 'response',
      category: 'Caching',
      summary: 'Date/time the resource was last changed.',
      body: ['Paired with `If-Modified-Since` for revalidation.'],
    },
  ],
  [
    'age',
    {
      display: 'Age',
      direction: 'response',
      category: 'Caching',
      summary: 'Seconds the response has been in a shared cache.',
      body: ['Returned by CDNs and proxies; helps clients understand response freshness.'],
    },
  ],

  // ── Security ────────────────────────────────────────────────
  [
    'content-security-policy',
    {
      display: 'Content-Security-Policy',
      direction: 'response',
      category: 'Security',
      summary: 'Whitelist of sources from which the page may load resources or execute code.',
      body: [
        'Directives are space-separated, semi-colon between directives. Most apps need at minimum `default-src`, `script-src`, `style-src`, and `connect-src`.',
        'Use `Content-Security-Policy-Report-Only` to observe violations before enforcing.',
      ],
      directives: [
        { key: 'default-src', desc: 'Fallback for any -src not explicitly set.' },
        { key: 'script-src', desc: 'Allowed sources for `<script>` and inline JS.' },
        { key: 'style-src', desc: 'Allowed sources for stylesheets and inline CSS.' },
        { key: 'img-src', desc: 'Allowed image sources.' },
        { key: 'connect-src', desc: 'Allowed fetch/XHR/WebSocket targets.' },
        { key: 'frame-ancestors', desc: 'Who may embed this page in an iframe (replaces X-Frame-Options).' },
        { key: 'report-uri / report-to', desc: 'Where to POST violation reports.' },
      ],
    },
  ],
  [
    'content-security-policy-report-only',
    {
      display: 'Content-Security-Policy-Report-Only',
      direction: 'response',
      category: 'Security',
      summary: 'Same syntax as CSP, but violations are reported without being blocked.',
      body: ['Use this to test a policy in production before enforcing it.'],
    },
  ],
  [
    'strict-transport-security',
    {
      display: 'Strict-Transport-Security',
      direction: 'response',
      category: 'Security',
      summary: 'Forces the browser to use HTTPS for this host for a given duration.',
      body: [
        'Set `max-age` to at least 6 months in production. Add `includeSubDomains` to cover every host under the domain.',
        '`preload` lets you submit the domain to the browser-baked HSTS preload list (one-way decision — hard to roll back).',
      ],
      directives: [
        { key: 'max-age=N', desc: 'How long the browser remembers HTTPS-only.' },
        { key: 'includeSubDomains', desc: 'Apply to every subdomain.' },
        { key: 'preload', desc: 'Eligibility for the browser preload list.' },
      ],
    },
  ],
  [
    'x-content-type-options',
    {
      display: 'X-Content-Type-Options',
      direction: 'response',
      category: 'Security',
      summary: 'Disables MIME sniffing.',
      body: ['Only one valid value: `nosniff`. Recommended on every response — prevents `text/plain` JS from being executed.'],
    },
  ],
  [
    'x-frame-options',
    {
      display: 'X-Frame-Options',
      direction: 'response',
      category: 'Security',
      summary: 'Controls whether the page may be embedded in an iframe.',
      body: ['Largely superseded by `Content-Security-Policy: frame-ancestors`. Keep both during the transition for older browser coverage.'],
      commonValues: [
        { value: 'DENY', desc: 'Never embeddable.' },
        { value: 'SAMEORIGIN', desc: 'Embeddable only by same-origin pages.' },
      ],
    },
  ],
  [
    'x-xss-protection',
    {
      display: 'X-XSS-Protection',
      direction: 'response',
      category: 'Security',
      summary: 'Legacy XSS filter toggle — obsolete in modern browsers.',
      body: ['Recommended value is `0` to disable the filter (it caused more harm than it prevented). Use CSP instead.'],
    },
  ],
  [
    'referrer-policy',
    {
      display: 'Referrer-Policy',
      direction: 'response',
      category: 'Security',
      summary: 'Controls how much of the URL is sent in `Referer` on outgoing navigations and requests.',
      body: ['Sent as response header by the destination, or set per page via `<meta>` / per request via `referrerpolicy` attribute.'],
      commonValues: [
        { value: 'no-referrer', desc: 'Never send a referer.' },
        { value: 'origin', desc: 'Send only scheme + host.' },
        { value: 'strict-origin-when-cross-origin', desc: 'Default — full URL same-origin, origin only cross-origin, nothing on HTTPS→HTTP downgrade.' },
        { value: 'unsafe-url', desc: 'Always send the full URL. Avoid.' },
      ],
    },
  ],
  [
    'permissions-policy',
    {
      display: 'Permissions-Policy',
      direction: 'response',
      category: 'Security',
      summary: 'Allow-list for browser features (geolocation, camera, USB, payment, etc.).',
      body: ['Each feature is gated to `self`, a list of origins, or `*`. Replaces the older `Feature-Policy` header.'],
    },
  ],
  [
    'cross-origin-opener-policy',
    {
      display: 'Cross-Origin-Opener-Policy',
      direction: 'response',
      category: 'Security',
      summary: 'Isolates the page from cross-origin opener relationships (window.opener).',
      body: ['`same-origin` enables crossOriginIsolated mode — required for SharedArrayBuffer and high-resolution timers.'],
    },
  ],
  [
    'cross-origin-embedder-policy',
    {
      display: 'Cross-Origin-Embedder-Policy',
      direction: 'response',
      category: 'Security',
      summary: 'Requires every loaded subresource to grant cross-origin permission.',
      body: ['Set to `require-corp` for crossOriginIsolated. Pairs with `Cross-Origin-Opener-Policy: same-origin`.'],
    },
  ],
  [
    'cross-origin-resource-policy',
    {
      display: 'Cross-Origin-Resource-Policy',
      direction: 'response',
      category: 'Security',
      summary: 'Prevents the resource from being loaded by foreign origins.',
      body: ['Values: `same-site`, `same-origin`, `cross-origin`. Critical for assets you don’t want hot-linked.'],
    },
  ],

  // ── Cookies ─────────────────────────────────────────────────
  [
    'cookie',
    {
      display: 'Cookie',
      direction: 'request',
      category: 'Cookies',
      summary: 'Cookies the browser is sending with this request, semicolon-separated.',
      body: ['Set by the browser from its cookie jar. Cannot be set by JS directly on `fetch` — use `credentials: \'include\'`.'],
    },
  ],
  [
    'set-cookie',
    {
      display: 'Set-Cookie',
      direction: 'response',
      category: 'Cookies',
      summary: 'Server-issued cookie definition.',
      body: [
        'One cookie per `Set-Cookie` header line. Browsers store the latest value per (name, domain, path) tuple.',
        'Production cookies should always carry `Secure`, `HttpOnly`, and an explicit `SameSite` (Lax or Strict).',
      ],
      directives: [
        { key: 'Secure', desc: 'Only sent over HTTPS.' },
        { key: 'HttpOnly', desc: 'Hidden from JavaScript (document.cookie).' },
        { key: 'SameSite=Strict|Lax|None', desc: 'Cross-site send policy. `None` requires `Secure`.' },
        { key: 'Domain=host', desc: 'Send to this host and all its subdomains.' },
        { key: 'Path=/path', desc: 'Send only to URLs starting with this path.' },
        { key: 'Max-Age=N', desc: 'TTL in seconds (overrides Expires).' },
        { key: 'Expires=date', desc: 'Absolute expiry; omitted = session cookie.' },
        { key: 'Partitioned', desc: 'CHIPS — partitioned per top-level site.' },
      ],
    },
  ],

  // ── Content ─────────────────────────────────────────────────
  [
    'content-type',
    {
      display: 'Content-Type',
      direction: 'both',
      category: 'Content',
      summary: 'Media type of the request or response body.',
      body: [
        'Drives how the browser parses the body — wrong values cause silent failures (JSON parsed as HTML, etc.).',
        'For `text/*` types, include `charset=utf-8` unless you have a reason not to.',
      ],
      commonValues: [
        { value: 'application/json', desc: 'JSON body.' },
        { value: 'application/x-www-form-urlencoded', desc: 'URL-encoded form fields.' },
        { value: 'multipart/form-data', desc: 'Multipart form / file uploads.' },
        { value: 'text/html; charset=utf-8', desc: 'HTML document.' },
        { value: 'application/octet-stream', desc: 'Opaque binary.' },
      ],
    },
  ],
  [
    'content-length',
    {
      display: 'Content-Length',
      direction: 'both',
      category: 'Content',
      summary: 'Body size in bytes (decoded).',
      body: ['Mutually exclusive with `Transfer-Encoding: chunked`. Wrong values cause connection desync.'],
    },
  ],
  [
    'content-encoding',
    {
      display: 'Content-Encoding',
      direction: 'response',
      category: 'Content',
      summary: 'Compression applied to the body — the browser decodes before exposing it to JS.',
      body: ['Common: `gzip`, `br` (Brotli), `zstd` (newer). The decoded size is what `response.body` sees.'],
    },
  ],
  [
    'content-disposition',
    {
      display: 'Content-Disposition',
      direction: 'response',
      category: 'Content',
      summary: 'Tells the browser whether the response is inline or a download.',
      body: ['`inline` (default) renders in the browser. `attachment; filename="x"` triggers a download with the given default filename.'],
    },
  ],
  [
    'accept',
    {
      display: 'Accept',
      direction: 'request',
      category: 'Content',
      summary: 'Media types the client is willing to receive.',
      body: ['Q-values express preference (`text/html;q=0.9`). Most servers ignore everything but the first type today.'],
    },
  ],
  [
    'accept-encoding',
    {
      display: 'Accept-Encoding',
      direction: 'request',
      category: 'Content',
      summary: 'Compressions the client can decode.',
      body: ['Typical browser value: `gzip, deflate, br, zstd`. Servers pick one and answer with `Content-Encoding`.'],
    },
  ],
  [
    'accept-language',
    {
      display: 'Accept-Language',
      direction: 'request',
      category: 'Content',
      summary: 'Human languages the client prefers.',
      body: ['Server selects a `Content-Language` from this list, often falling back to a default.'],
    },
  ],
  [
    'transfer-encoding',
    {
      display: 'Transfer-Encoding',
      direction: 'both',
      category: 'Content',
      summary: 'Encoding applied for transport only — stripped before the body reaches the application.',
      body: ['Almost always `chunked`. Mutually exclusive with `Content-Length`.'],
    },
  ],

  // ── Auth ────────────────────────────────────────────────────
  [
    'authorization',
    {
      display: 'Authorization',
      direction: 'request',
      category: 'Auth',
      summary: 'Credentials authenticating the client to the server.',
      body: ['Format: `<scheme> <credentials>`. Common schemes: `Bearer <token>` (OAuth, JWT), `Basic <base64(user:pass)>`, `Digest`.'],
    },
  ],
  [
    'proxy-authorization',
    {
      display: 'Proxy-Authorization',
      direction: 'request',
      category: 'Auth',
      summary: 'Credentials for an intervening proxy (not the origin server).',
      body: ['Same syntax as `Authorization`, distinct in scope.'],
    },
  ],
  [
    'www-authenticate',
    {
      display: 'WWW-Authenticate',
      direction: 'response',
      category: 'Auth',
      summary: 'Server’s 401 challenge — tells the client which auth scheme to use.',
      body: ['Sent with `401 Unauthorized`. Triggers the browser’s basic-auth dialog when the scheme is `Basic`.'],
    },
  ],
  [
    'proxy-authenticate',
    {
      display: 'Proxy-Authenticate',
      direction: 'response',
      category: 'Auth',
      summary: 'Proxy-equivalent of `WWW-Authenticate`, sent with `407 Proxy Authentication Required`.',
    },
  ],

  // ── Tracing / telemetry ────────────────────────────────────
  [
    'server-timing',
    {
      display: 'Server-Timing',
      direction: 'response',
      category: 'Tracing',
      summary: 'Performance metrics the server attaches to the response.',
      body: ['Surfaces in DevTools and `PerformanceServerTiming` JS API. Format: `<name>;dur=<ms>[;desc="..."]`, comma-separated.'],
    },
  ],
  [
    'traceparent',
    {
      display: 'traceparent',
      direction: 'both',
      category: 'Tracing',
      summary: 'W3C trace-context: identifies a span in a distributed trace.',
      body: ['Format: `<version>-<trace-id>-<parent-id>-<flags>`. Carried across services so traces can be reassembled.'],
    },
  ],
  [
    'tracestate',
    {
      display: 'tracestate',
      direction: 'both',
      category: 'Tracing',
      summary: 'Vendor-specific trace-context companion to `traceparent`.',
      body: ['Comma-separated `vendor=value` pairs. Each tracing vendor stores its own state here.'],
    },
  ],
  [
    'x-request-id',
    {
      display: 'X-Request-Id',
      direction: 'both',
      category: 'Tracing',
      summary: 'Server-assigned identifier for this request — echoed in logs and across services.',
      body: ['Non-standard but ubiquitous. Useful for correlating client behavior with server logs during debugging.'],
    },
  ],

  // ── Fetch metadata (Sec-Fetch-*) ────────────────────────
  [
    'sec-fetch-site',
    {
      display: 'Sec-Fetch-Site',
      direction: 'request',
      category: 'Fetch metadata',
      summary: 'Browser-set: relationship between the request initiator and the target.',
      body: ['Values: `same-origin`, `same-site`, `cross-site`, `none` (direct navigation).'],
    },
  ],
  [
    'sec-fetch-mode',
    {
      display: 'Sec-Fetch-Mode',
      direction: 'request',
      category: 'Fetch metadata',
      summary: 'Browser-set: the request’s fetch mode.',
      body: ['Values: `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.'],
    },
  ],
  [
    'sec-fetch-dest',
    {
      display: 'Sec-Fetch-Dest',
      direction: 'request',
      category: 'Fetch metadata',
      summary: 'Browser-set: where the response will be used (document, script, image, etc.).',
      body: ['Lets the server detect surprising fetches — e.g. an HTML response being requested as `Sec-Fetch-Dest: script`.'],
    },
  ],
  [
    'sec-fetch-user',
    {
      display: 'Sec-Fetch-User',
      direction: 'request',
      category: 'Fetch metadata',
      summary: 'Browser-set: `?1` when the navigation was a direct user activation.',
      body: ['Absent otherwise. Useful for distinguishing user clicks from programmatic navigation.'],
    },
  ],

  // ── Client Hints (Sec-CH-UA-*) ──────────────────────────
  [
    'sec-ch-ua',
    {
      display: 'Sec-CH-UA',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Client Hint: the browser’s brand list.',
      body: ['Replaces the freeform `User-Agent` for the parts servers should actually depend on.'],
    },
  ],
  [
    'sec-ch-ua-mobile',
    {
      display: 'Sec-CH-UA-Mobile',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Client Hint: `?1` on mobile, `?0` on desktop.',
    },
  ],
  [
    'sec-ch-ua-platform',
    {
      display: 'Sec-CH-UA-Platform',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Client Hint: the user’s OS (`"Windows"`, `"macOS"`, `"Linux"`, etc.).',
    },
  ],
]);

const DIRECTION_LABEL: Record<HeaderDirection, string> = {
  request: 'Request header',
  response: 'Response header',
  both: 'Request / Response header',
};

/** True when we have a documented explanation for this header name. */
export function hasHeaderInfo(name: string): boolean {
  return HEADER_INFO.has(name.toLowerCase());
}

/** Look up the entry; useful when callers want the raw fields. */
export function getHeaderInfo(name: string): HeaderInfoEntry | null {
  return HEADER_INFO.get(name.toLowerCase()) ?? null;
}

/**
 * Map a known header to a fully-formed `InfoPopoverContent`. Returns
 * `null` when the header isn't in the registry — callers should gate
 * their `<InfoTrigger>` render on `hasHeaderInfo` so the popover never
 * mounts for unknown headers.
 */
export function getHeaderInfoContent(name: string): InfoPopoverContent | null {
  const entry = HEADER_INFO.get(name.toLowerCase());
  if (!entry) return null;
  const sections: InfoPopoverSection[] = [];
  if (entry.directives && entry.directives.length > 0) {
    sections.push({
      heading: 'Directives',
      items: entry.directives.map((d) => ({ label: d.key, desc: d.desc })),
    });
  }
  if (entry.commonValues && entry.commonValues.length > 0) {
    sections.push({
      heading: 'Common values',
      items: entry.commonValues.map((v) => ({ label: v.value, desc: v.desc })),
    });
  }
  return {
    title: entry.display,
    kicker: `${DIRECTION_LABEL[entry.direction]} · ${entry.category}`,
    summary: entry.summary,
    description:
      entry.body && entry.body.length > 0
        ? entry.body.map((p, i) => (
            <p key={`${entry.display}-p-${i}`} style={{ margin: i === 0 ? 0 : '4px 0 0' }}>
              {p}
            </p>
          ))
        : undefined,
    sections,
  };
}

/** Count of known headers, exposed for tests + sanity checks. */
export function headerInfoCount(): number {
  return HEADER_INFO.size;
}
