/**
 * HTTP Headers doc group — one section per common header, all powered
 * by a single generic `HttpHeaderSection` component that reads from a
 * small in-module registry. Section ids follow `http-header:<lowercase>`
 * so the Headers tab's `(i)` trigger can deep-link with no separate
 * lookup table.
 */

import { ProfileOutlined } from '@ant-design/icons';
import type React from 'react';
import { DocHeading, DocParagraph } from '../shared';
import type { DocGroup, DocSection } from '../registry';

interface HeaderDoc {
  /** Display name as it appears in headers and in the TOC. */
  display: string;
  /** One-line orientation, shown both under TOC rows and at the top of the section. */
  summary: string;
  /** Body content — paragraphs of plain prose. */
  body: string[];
  /** Optional directive table — for directive-bearing headers like
   *  Cache-Control, Set-Cookie, CSP. Rendered as `key — description` rows. */
  directives?: ReadonlyArray<{ key: string; desc: string }>;
  /** Optional common values shown as a compact list. */
  commonValues?: ReadonlyArray<{ value: string; desc: string }>;
}

const HEADER_DOCS: ReadonlyMap<string, HeaderDoc> = new Map<string, HeaderDoc>([
  // ── CORS ─────────────────────────────────────────────────────
  [
    'access-control-allow-origin',
    {
      display: 'Access-Control-Allow-Origin',
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
      summary: 'Permits the browser to expose the response when the request carried credentials.',
      body: [
        'Must be `true` (lowercase). When set, `Access-Control-Allow-Origin` must NOT be `*` — it has to echo the exact origin.',
      ],
    },
  ],
  [
    'access-control-allow-methods',
    {
      display: 'Access-Control-Allow-Methods',
      summary: 'Lists HTTP methods the server accepts for cross-origin requests.',
      body: [
        'Returned on preflight (`OPTIONS`) responses. The browser caches the answer for `Access-Control-Max-Age` seconds.',
      ],
    },
  ],
  [
    'access-control-allow-headers',
    {
      display: 'Access-Control-Allow-Headers',
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
      summary: 'How long the browser may cache the preflight response, in seconds.',
      body: [
        'Big values cut preflight chatter — a value of 86400 (1 day) is common. Chrome caps at 7200 seconds; Firefox at 86400.',
      ],
    },
  ],
  [
    'access-control-request-method',
    {
      display: 'Access-Control-Request-Method',
      summary: 'Sent on preflight to declare the method the actual request will use.',
      body: ['The server replies with `Access-Control-Allow-Methods` to confirm.'],
    },
  ],
  [
    'access-control-request-headers',
    {
      display: 'Access-Control-Request-Headers',
      summary: 'Sent on preflight to declare the headers the actual request will carry.',
      body: ['Mirrored back via `Access-Control-Allow-Headers` if accepted.'],
    },
  ],
  [
    'origin',
    {
      display: 'Origin',
      summary: 'Identifies the origin that initiated a cross-origin or POST request.',
      body: [
        'Sent automatically by the browser. Cannot be set by JS. Used by servers to decide CORS responses and by CSRF defenses.',
      ],
    },
  ],
  [
    'vary',
    {
      display: 'Vary',
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
      summary: 'Directives that govern how a response is cached and revalidated.',
      body: [
        'Both request and response carry directives. Multiple comma-separated tokens are AND-combined. Behavior is per-directive — the header is not a single mode.',
      ],
      directives: [
        { key: 'no-store', desc: 'Do not cache at all, anywhere.' },
        { key: 'no-cache', desc: 'May cache, but revalidate every time before reuse.' },
        { key: 'public', desc: 'Any cache may store, including shared/CDN.' },
        { key: 'private', desc: 'Only the user’s browser may store.' },
        { key: 'max-age=<seconds>', desc: 'Fresh for N seconds; reuse without contacting origin.' },
        { key: 's-maxage=<seconds>', desc: 'Like max-age but only for shared caches.' },
        { key: 'must-revalidate', desc: 'Once stale, revalidate before serving.' },
        { key: 'immutable', desc: 'Promise the body will not change for max-age.' },
        { key: 'stale-while-revalidate=<seconds>', desc: 'Allow stale reuse while a background revalidation runs.' },
      ],
    },
  ],
  [
    'pragma',
    {
      display: 'Pragma',
      summary: 'Legacy HTTP/1.0 cache control — effectively superseded by Cache-Control.',
      body: [
        '`Pragma: no-cache` is still set by some clients for compatibility. Modern servers should honor `Cache-Control` and ignore `Pragma`.',
      ],
    },
  ],
  [
    'expires',
    {
      display: 'Expires',
      summary: 'Absolute date/time after which the response is considered stale.',
      body: [
        'Superseded by `Cache-Control: max-age`. If both are set, `max-age` wins. Use a date in the past (or `0`) to force re-fetch.',
      ],
    },
  ],
  [
    'etag',
    {
      display: 'ETag',
      summary: 'Opaque identifier for the response body — used to revalidate cached copies.',
      body: [
        'Clients echo it back in `If-None-Match`. If the value still matches, the server replies `304 Not Modified` with no body.',
      ],
    },
  ],
  [
    'if-match',
    {
      display: 'If-Match',
      summary: 'Conditional request: proceed only if the resource’s current ETag matches.',
      body: ['Used by writes to prevent overwriting changes made by someone else (optimistic concurrency).'],
    },
  ],
  [
    'if-none-match',
    {
      display: 'If-None-Match',
      summary: 'Conditional request: proceed only if the resource’s ETag has changed.',
      body: ['Used by reads to skip downloading an unchanged response — the server replies `304 Not Modified`.'],
    },
  ],
  [
    'if-modified-since',
    {
      display: 'If-Modified-Since',
      summary: 'Conditional request: proceed only if the resource changed after the given date.',
      body: ['Less precise than `If-None-Match`/ETag; prefer ETags when available.'],
    },
  ],
  [
    'if-unmodified-since',
    {
      display: 'If-Unmodified-Since',
      summary: 'Conditional request: proceed only if the resource has not been modified since the given date.',
      body: [],
    },
  ],
  [
    'last-modified',
    {
      display: 'Last-Modified',
      summary: 'Date/time the resource was last changed.',
      body: ['Paired with `If-Modified-Since` for revalidation.'],
    },
  ],
  [
    'age',
    {
      display: 'Age',
      summary: 'Seconds the response has been in a shared cache.',
      body: ['Returned by CDNs and proxies; helps clients understand response freshness.'],
    },
  ],

  // ── Security ────────────────────────────────────────────────
  [
    'content-security-policy',
    {
      display: 'Content-Security-Policy',
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
        { key: 'frame-ancestors', desc: 'Who may embed this page in an iframe (replaces `X-Frame-Options`).' },
        { key: 'report-uri / report-to', desc: 'Where to POST violation reports.' },
      ],
    },
  ],
  [
    'content-security-policy-report-only',
    {
      display: 'Content-Security-Policy-Report-Only',
      summary: 'Same syntax as CSP, but violations are reported without being blocked.',
      body: ['Use this to test a policy in production before enforcing it.'],
    },
  ],
  [
    'strict-transport-security',
    {
      display: 'Strict-Transport-Security',
      summary: 'Forces the browser to use HTTPS for this host for a given duration.',
      body: [
        'Set `max-age` to at least 6 months in production. Add `includeSubDomains` to cover every host under the domain.',
        '`preload` lets you submit the domain to the browser-baked HSTS preload list (one-way decision — hard to roll back).',
      ],
      directives: [
        { key: 'max-age=<seconds>', desc: 'How long the browser remembers HTTPS-only.' },
        { key: 'includeSubDomains', desc: 'Apply to every subdomain.' },
        { key: 'preload', desc: 'Eligibility for the browser preload list.' },
      ],
    },
  ],
  [
    'x-content-type-options',
    {
      display: 'X-Content-Type-Options',
      summary: 'Disables MIME sniffing.',
      body: ['Only one valid value: `nosniff`. Recommended on every response — prevents `text/plain` JS from being executed.'],
    },
  ],
  [
    'x-frame-options',
    {
      display: 'X-Frame-Options',
      summary: 'Controls whether the page may be embedded in an iframe.',
      body: [
        'Largely superseded by `Content-Security-Policy: frame-ancestors`. Keep both during the transition for older browser coverage.',
      ],
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
      summary: 'Legacy XSS filter toggle — obsolete in modern browsers.',
      body: ['Recommended value is `0` to disable the filter (it caused more harm than it prevented). Use CSP instead.'],
    },
  ],
  [
    'referrer-policy',
    {
      display: 'Referrer-Policy',
      summary: 'Controls how much of the URL is sent in `Referer` on outgoing navigations and requests.',
      body: ['Sent as response header by the destination, or set per page via `<meta>` / per request via `referrerpolicy` attribute.'],
      commonValues: [
        { value: 'no-referrer', desc: 'Never send a referer.' },
        { value: 'origin', desc: 'Send only scheme + host.' },
        { value: 'strict-origin-when-cross-origin', desc: 'Default in modern browsers — full URL same-origin, origin only cross-origin, nothing on HTTPS→HTTP downgrade.' },
        { value: 'unsafe-url', desc: 'Always send the full URL. Avoid.' },
      ],
    },
  ],
  [
    'permissions-policy',
    {
      display: 'Permissions-Policy',
      summary: 'Allow-list for browser features (geolocation, camera, USB, payment, etc.).',
      body: ['Each feature is gated to `self`, a list of origins, or `*`. Replaces the older `Feature-Policy` header.'],
    },
  ],
  [
    'cross-origin-opener-policy',
    {
      display: 'Cross-Origin-Opener-Policy',
      summary: 'Isolates the page from cross-origin opener relationships (window.opener).',
      body: ['`same-origin` enables crossOriginIsolated mode — required for SharedArrayBuffer and high-resolution timers.'],
    },
  ],
  [
    'cross-origin-embedder-policy',
    {
      display: 'Cross-Origin-Embedder-Policy',
      summary: 'Requires every loaded subresource to grant cross-origin permission.',
      body: ['Set to `require-corp` for crossOriginIsolated. Pairs with `Cross-Origin-Opener-Policy: same-origin`.'],
    },
  ],
  [
    'cross-origin-resource-policy',
    {
      display: 'Cross-Origin-Resource-Policy',
      summary: 'Prevents the resource from being loaded by foreign origins.',
      body: ['Values: `same-site`, `same-origin`, `cross-origin`. Critical for assets you don’t want hot-linked.'],
    },
  ],

  // ── Cookies ─────────────────────────────────────────────────
  [
    'cookie',
    {
      display: 'Cookie',
      summary: 'Cookies the browser is sending with this request, semicolon-separated.',
      body: ['Set by the browser from its cookie jar. Cannot be set by JS directly on `fetch` — use `credentials: \'include\'`.'],
    },
  ],
  [
    'set-cookie',
    {
      display: 'Set-Cookie',
      summary: 'Server-issued cookie definition.',
      body: [
        'One cookie per `Set-Cookie` header line. Browsers store the latest value per (name, domain, path) tuple.',
        'Production cookies should always carry `Secure`, `HttpOnly`, and an explicit `SameSite` (Lax or Strict).',
      ],
      directives: [
        { key: 'Secure', desc: 'Only sent over HTTPS.' },
        { key: 'HttpOnly', desc: 'Hidden from JavaScript (document.cookie).' },
        { key: 'SameSite=Strict|Lax|None', desc: 'Cross-site send policy. `None` requires `Secure`.' },
        { key: 'Domain=<host>', desc: 'Send to this host and all its subdomains.' },
        { key: 'Path=<path>', desc: 'Send only to URLs starting with this path.' },
        { key: 'Max-Age=<seconds>', desc: 'TTL in seconds (overrides Expires).' },
        { key: 'Expires=<date>', desc: 'Absolute expiry; omitted = session cookie.' },
        { key: 'Partitioned', desc: 'CHIPS — partitioned per top-level site.' },
      ],
    },
  ],

  // ── Content ─────────────────────────────────────────────────
  [
    'content-type',
    {
      display: 'Content-Type',
      summary: 'Media type of the request or response body.',
      body: [
        'Drives how the browser parses the body — wrong values cause silent failures (JSON parsed as HTML, etc.).',
        'For `text/*` types, include `charset=utf-8` unless you have a reason not to.',
      ],
      commonValues: [
        { value: 'application/json', desc: 'JSON body.' },
        { value: 'application/x-www-form-urlencoded', desc: 'URL-encoded form fields.' },
        { value: 'multipart/form-data; boundary=...', desc: 'Multipart form / file uploads.' },
        { value: 'text/html; charset=utf-8', desc: 'HTML document.' },
        { value: 'application/octet-stream', desc: 'Opaque binary.' },
      ],
    },
  ],
  [
    'content-length',
    {
      display: 'Content-Length',
      summary: 'Body size in bytes (decoded).',
      body: ['Mutually exclusive with `Transfer-Encoding: chunked`. Wrong values cause connection desync.'],
    },
  ],
  [
    'content-encoding',
    {
      display: 'Content-Encoding',
      summary: 'Compression applied to the body — the browser decodes before exposing it to JS.',
      body: ['Common: `gzip`, `br` (Brotli), `zstd` (newer). The decoded size is what `response.body` sees.'],
    },
  ],
  [
    'content-disposition',
    {
      display: 'Content-Disposition',
      summary: 'Tells the browser whether the response is inline or a download.',
      body: [
        '`inline` (default) renders in the browser. `attachment; filename="x"` triggers a download with the given default filename.',
      ],
    },
  ],
  [
    'accept',
    {
      display: 'Accept',
      summary: 'Media types the client is willing to receive.',
      body: ['Q-values express preference (`text/html;q=0.9`). Most servers ignore everything but the first type today.'],
    },
  ],
  [
    'accept-encoding',
    {
      display: 'Accept-Encoding',
      summary: 'Compressions the client can decode.',
      body: ['Typical browser value: `gzip, deflate, br, zstd`. Servers pick one and answer with `Content-Encoding`.'],
    },
  ],
  [
    'accept-language',
    {
      display: 'Accept-Language',
      summary: 'Human languages the client prefers.',
      body: ['Server selects a `Content-Language` from this list, often falling back to a default.'],
    },
  ],
  [
    'transfer-encoding',
    {
      display: 'Transfer-Encoding',
      summary: 'Encoding applied for transport only — stripped before the body reaches the application.',
      body: ['Almost always `chunked`. Mutually exclusive with `Content-Length`.'],
    },
  ],

  // ── Auth ────────────────────────────────────────────────────
  [
    'authorization',
    {
      display: 'Authorization',
      summary: 'Credentials authenticating the client to the server.',
      body: [
        'Format: `<scheme> <credentials>`. Common schemes: `Bearer <token>` (OAuth, JWT), `Basic <base64(user:pass)>`, `Digest`.',
      ],
    },
  ],
  [
    'proxy-authorization',
    {
      display: 'Proxy-Authorization',
      summary: 'Credentials for an intervening proxy (not the origin server).',
      body: ['Same syntax as `Authorization`, distinct in scope.'],
    },
  ],
  [
    'www-authenticate',
    {
      display: 'WWW-Authenticate',
      summary: 'Server’s 401 challenge — tells the client which auth scheme to use.',
      body: ['Sent with `401 Unauthorized`. Triggers the browser’s basic-auth dialog when the scheme is `Basic`.'],
    },
  ],
  [
    'proxy-authenticate',
    {
      display: 'Proxy-Authenticate',
      summary: 'Proxy-equivalent of `WWW-Authenticate`, sent with `407 Proxy Authentication Required`.',
      body: [],
    },
  ],

  // ── Tracing / telemetry ────────────────────────────────────
  [
    'server-timing',
    {
      display: 'Server-Timing',
      summary: 'Performance metrics the server attaches to the response.',
      body: ['Surfaces in DevTools and `PerformanceServerTiming` JS API. Format: `<name>;dur=<ms>[;desc="..."]`, comma-separated.'],
    },
  ],
  [
    'traceparent',
    {
      display: 'traceparent',
      summary: 'W3C trace-context: identifies a span in a distributed trace.',
      body: ['Format: `<version>-<trace-id>-<parent-id>-<flags>`. Carried across services so traces can be reassembled.'],
    },
  ],
  [
    'tracestate',
    {
      display: 'tracestate',
      summary: 'Vendor-specific trace-context companion to `traceparent`.',
      body: ['Comma-separated `vendor=value` pairs. Each tracing vendor stores its own state here.'],
    },
  ],
  [
    'x-request-id',
    {
      display: 'X-Request-Id',
      summary: 'Server-assigned identifier for this request — echoed in logs and across services.',
      body: ['Non-standard but ubiquitous. Useful for correlating client behavior with server logs during debugging.'],
    },
  ],

  // ── Sec-Fetch-* ───────────────────────────────────────────
  [
    'sec-fetch-site',
    {
      display: 'Sec-Fetch-Site',
      summary: 'Browser-set: relationship between the request initiator and the target.',
      body: ['Values: `same-origin`, `same-site`, `cross-site`, `none` (direct navigation).'],
    },
  ],
  [
    'sec-fetch-mode',
    {
      display: 'Sec-Fetch-Mode',
      summary: 'Browser-set: the request’s fetch mode.',
      body: ['Values: `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.'],
    },
  ],
  [
    'sec-fetch-dest',
    {
      display: 'Sec-Fetch-Dest',
      summary: 'Browser-set: where the response will be used (document, script, image, etc.).',
      body: ['Lets the server detect surprising fetches — e.g. an HTML response being requested as `Sec-Fetch-Dest: script`.'],
    },
  ],
  [
    'sec-fetch-user',
    {
      display: 'Sec-Fetch-User',
      summary: 'Browser-set: `?1` when the navigation was a direct user activation.',
      body: ['Absent otherwise. Useful for distinguishing user clicks from programmatic navigation.'],
    },
  ],

  // ── Sec-CH-UA-* (Client Hints) ────────────────────────────
  [
    'sec-ch-ua',
    {
      display: 'Sec-CH-UA',
      summary: 'Client Hint: the browser’s brand list.',
      body: ['Replaces the freeform `User-Agent` for the parts servers should actually depend on.'],
    },
  ],
  [
    'sec-ch-ua-mobile',
    {
      display: 'Sec-CH-UA-Mobile',
      summary: 'Client Hint: `?1` on mobile, `?0` on desktop.',
      body: [],
    },
  ],
  [
    'sec-ch-ua-platform',
    {
      display: 'Sec-CH-UA-Platform',
      summary: 'Client Hint: the user’s OS (`"Windows"`, `"macOS"`, `"Linux"`, etc.).',
      body: [],
    },
  ],
]);

const HTTP_HEADER_DOC_PREFIX = 'http-header:';

export function getHeaderDocSectionId(headerName: string): string {
  return `${HTTP_HEADER_DOC_PREFIX}${headerName.toLowerCase()}`;
}

export function hasHeaderDoc(headerName: string): boolean {
  return HEADER_DOCS.has(headerName.toLowerCase());
}

const HttpHeaderSection: React.FC<{ name: string }> = ({ name }) => {
  const doc = HEADER_DOCS.get(name.toLowerCase());
  if (!doc) {
    return (
      <div>
        <DocHeading>{name}</DocHeading>
        <DocParagraph>No documentation available for this header yet.</DocParagraph>
      </div>
    );
  }
  return (
    <div>
      <DocHeading>{doc.display}</DocHeading>
      <DocParagraph>{doc.summary}</DocParagraph>
      {doc.body.map((p) => (
        <DocParagraph key={p.slice(0, 40)}>{p}</DocParagraph>
      ))}
      {doc.directives && doc.directives.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <DocParagraph>
            <strong>Directives</strong>
          </DocParagraph>
          {doc.directives.map((d) => (
            <DocParagraph key={d.key}>
              <code>{d.key}</code> &mdash; {d.desc}
            </DocParagraph>
          ))}
        </div>
      )}
      {doc.commonValues && doc.commonValues.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <DocParagraph>
            <strong>Common values</strong>
          </DocParagraph>
          {doc.commonValues.map((v) => (
            <DocParagraph key={v.value}>
              <code>{v.value}</code> &mdash; {v.desc}
            </DocParagraph>
          ))}
        </div>
      )}
    </div>
  );
};

/** Build the doc group from the registry. One section per known header. */
export function buildHttpHeadersGroup(): DocGroup {
  const sections: DocSection[] = Array.from(HEADER_DOCS.entries()).map(([key, doc]) => ({
    id: getHeaderDocSectionId(key),
    title: doc.display,
    summary: doc.summary,
    group: 'http-headers',
    icon: <ProfileOutlined />,
    Component: () => <HttpHeaderSection name={key} />,
  }));
  return { id: 'http-headers', label: 'HTTP Headers', sections };
}

/** Memoized singleton so the section list is referentially stable across renders. */
export const HTTP_HEADERS_GROUP: DocGroup = buildHttpHeadersGroup();
