/**
 * HTTP-header docs — Security.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const SECURITY_HEADERS: HeaderInfoEntries = [
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
  [
    'clear-site-data',
    {
      display: 'Clear-Site-Data',
      direction: 'response',
      category: 'Security',
      summary: 'Asks the browser to clear cookies / cache / storage for this origin.',
      body: ['Useful for logout flows.'],
      commonValues: [
        { value: '"cookies"', desc: 'Clear cookies for the origin.' },
        { value: '"cache"', desc: 'Clear HTTP and image caches.' },
        { value: '"storage"', desc: 'Clear localStorage / IndexedDB / Service Worker registrations.' },
        { value: '"*"', desc: 'Clear everything.' },
      ],
    },
  ],
  [
    'origin-agent-cluster',
    {
      display: 'Origin-Agent-Cluster',
      direction: 'response',
      category: 'Security',
      summary: '`?1` asks the browser to give this origin its own agent cluster (process).',
      body: ['Provides better isolation for `SharedArrayBuffer`, performance.measureUserAgentSpecificMemory, etc.'],
    },
  ],
  [
    'x-robots-tag',
    {
      display: 'X-Robots-Tag',
      direction: 'response',
      category: 'Security',
      summary: 'Search-indexing directives for crawlers (`noindex`, `nofollow`, …).',
      body: ['Same semantics as the `<meta name="robots">` tag, but applies to non-HTML responses (PDFs, JSON, images).'],
    },
  ],
  [
    'x-ua-compatible',
    {
      display: 'X-UA-Compatible',
      direction: 'response',
      category: 'Security',
      summary: 'Legacy IE/Edge directive (`IE=edge`) — picks the rendering engine. Obsolete in modern browsers.',
    },
  ],
];
