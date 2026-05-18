/**
 * HTTP-header docs — Cookies.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const COOKIES_HEADERS: HeaderInfoEntries = [
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
];
