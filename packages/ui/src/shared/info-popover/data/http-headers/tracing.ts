/**
 * HTTP-header docs — Tracing.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const TRACING_HEADERS: HeaderInfoEntries = [
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
  [
    'x-fastly-request-id',
    {
      display: 'X-Fastly-Request-Id',
      direction: 'response',
      category: 'Tracing',
      summary: 'Fastly request identifier — correlate with Fastly logs / debugging.',
    },
  ],
  [
    'reporting-endpoints',
    {
      display: 'Reporting-Endpoints',
      direction: 'response',
      category: 'Tracing',
      summary: 'Names destinations for browser-generated reports (CSP violations, deprecations, NEL, …).',
      body: [
        'Format: `name="https://reports.example.com", name2="https://..."`. Replaces the older `Report-To` header.',
      ],
    },
  ],
  [
    'report-to',
    {
      display: 'Report-To',
      direction: 'response',
      category: 'Tracing',
      summary: 'Older JSON-based reporting endpoint declaration — superseded by `Reporting-Endpoints`.',
    },
  ],
  [
    'nel',
    {
      display: 'NEL',
      direction: 'response',
      category: 'Tracing',
      summary: 'Network Error Logging policy — JSON config naming an endpoint to receive connection failures and protocol errors.',
      body: ['The endpoint must already be registered via `Reporting-Endpoints` (or the older `Report-To`).'],
    },
  ],
  [
    'cf-ray',
    {
      display: 'CF-Ray',
      direction: 'response',
      category: 'Tracing',
      summary: 'Cloudflare request identifier — used to correlate the request in Cloudflare logs.',
      body: ['Format: `<request-id>-<colo-id>` where colo-id identifies the Cloudflare data center that served the request.'],
    },
  ],
];
