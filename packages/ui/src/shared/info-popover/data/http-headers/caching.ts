/**
 * HTTP-header docs — Caching.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const CACHING_HEADERS: HeaderInfoEntries = [
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
  [
    'x-cache',
    {
      display: 'X-Cache',
      direction: 'response',
      category: 'Caching',
      summary: 'CDN / reverse-proxy cache outcome — vendor-specific format (Varnish, Fastly, CloudFront).',
      commonValues: [
        { value: 'HIT', desc: 'Served from cache.' },
        { value: 'MISS', desc: 'Not cached; fetched from origin.' },
        { value: 'HIT, HIT', desc: 'Multiple cache tiers all hit (e.g. shield + edge).' },
      ],
    },
  ],
  [
    'x-cache-hits',
    {
      display: 'X-Cache-Hits',
      direction: 'response',
      category: 'Caching',
      summary: 'Cache hit counter per tier — vendor-specific, common on Fastly.',
      body: ['Comma-separated when multiple cache tiers are in play. High counts indicate hot cache lines.'],
    },
  ],
  [
    'warning',
    {
      display: 'Warning',
      direction: 'response',
      category: 'Caching',
      summary: 'Additional caching context (stale, transformation applied, etc.). Deprecated in HTTP/1.1 since RFC 7234 but still emitted.',
    },
  ],
  [
    'surrogate-control',
    {
      display: 'Surrogate-Control',
      direction: 'response',
      category: 'Caching',
      summary: 'Edge Side Includes cache control — directs CDNs while leaving browser caching to `Cache-Control`.',
      body: ['Specific to ESI-aware caches (Fastly, Akamai, Varnish in some configs).'],
    },
  ],
  [
    'surrogate-capability',
    {
      display: 'Surrogate-Capability',
      direction: 'request',
      category: 'Caching',
      summary: 'Edge-to-origin hint: which ESI features the surrogate supports.',
    },
  ],
  [
    'cf-cache-status',
    {
      display: 'CF-Cache-Status',
      direction: 'response',
      category: 'Caching',
      summary: 'Cloudflare cache outcome for this request.',
      commonValues: [
        { value: 'HIT', desc: 'Served from Cloudflare cache.' },
        { value: 'MISS', desc: 'Not in cache; fetched from origin.' },
        { value: 'EXPIRED', desc: 'Was cached but expired; refreshed from origin.' },
        { value: 'BYPASS', desc: 'Cache bypassed (page rules / no-cache header).' },
        { value: 'DYNAMIC', desc: 'Not cacheable by default (cookies, query string, etc.).' },
        { value: 'REVALIDATED', desc: 'Cached and revalidated with origin (304).' },
      ],
    },
  ],
];
