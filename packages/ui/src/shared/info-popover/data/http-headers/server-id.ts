/**
 * HTTP-header docs — Server identification.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const SERVER_IDENTIFICATION_HEADERS: HeaderInfoEntries = [
  [
    'server',
    {
      display: 'Server',
      direction: 'response',
      category: 'Server identification',
      summary: 'Software identification of the origin server (e.g. `nginx/1.27`, `cloudflare`).',
      body: ['Often stripped or set to a fixed value in production for opsec.'],
    },
  ],
  [
    'x-powered-by',
    {
      display: 'X-Powered-By',
      direction: 'response',
      category: 'Server identification',
      summary: 'Non-standard header identifying the framework / runtime behind the response.',
      body: ['Commonly emitted by Express, PHP, ASP.NET, etc. Often suppressed in production.'],
    },
  ],
  [
    'date',
    {
      display: 'Date',
      direction: 'response',
      category: 'Server identification',
      summary: 'Origin server timestamp when the message was generated.',
      body: ['Used by caches to compute response age. Format: IMF-fixdate (`Mon, 18 May 2026 15:05:25 GMT`).'],
    },
  ],
  [
    'x-served-by',
    {
      display: 'X-Served-By',
      direction: 'response',
      category: 'Server identification',
      summary: 'Identifies which CDN edge / cache node served the response.',
      body: ['Comma-separated when multiple tiers handled the request (shield → edge). Format varies by vendor (Fastly POPs, AWS CloudFront edges, etc.).'],
    },
  ],
];
