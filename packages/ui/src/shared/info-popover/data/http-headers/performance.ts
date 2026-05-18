/**
 * HTTP-header docs — Performance.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const PERFORMANCE_HEADERS: HeaderInfoEntries = [
  [
    'priority',
    {
      display: 'Priority',
      direction: 'both',
      category: 'Performance',
      summary: 'Tells the server (or the client) how urgent + how incremental this transfer is.',
      body: ['Format: `u=<0-7>` (urgency, lower = higher priority) and optional `, i` (incremental — can be processed as it arrives).'],
    },
  ],
  [
    'upgrade-insecure-requests',
    {
      display: 'Upgrade-Insecure-Requests',
      direction: 'request',
      category: 'Performance',
      summary: 'Browser-set `1` — tells the server the client prefers HTTPS for any embedded resources.',
      body: ['Paired with the CSP `upgrade-insecure-requests` directive on responses.'],
    },
  ],
  [
    'early-data',
    {
      display: 'Early-Data',
      direction: 'request',
      category: 'Performance',
      summary: '`1` — set by clients sending data in TLS 1.3 0-RTT mode.',
      body: ['Servers should reject early-data on non-idempotent methods (POST, etc.) to avoid replay attacks.'],
    },
  ],
  [
    'link',
    {
      display: 'Link',
      direction: 'response',
      category: 'Performance',
      summary: 'Resource hints — preload / prefetch / preconnect / dns-prefetch.',
      body: ['Same semantics as `<link rel="...">` in HTML; useful from non-HTML responses (APIs, redirects).'],
      commonValues: [
        { value: '<style.css>; rel=preload; as=style', desc: 'Preload a stylesheet.' },
        { value: '<https://cdn.example.com>; rel=preconnect', desc: 'Open a connection in advance.' },
      ],
    },
  ],
  [
    'x-dns-prefetch-control',
    {
      display: 'X-DNS-Prefetch-Control',
      direction: 'response',
      category: 'Performance',
      summary: 'Toggles browser DNS prefetching for links on the page (`on` / `off`).',
    },
  ],
];
