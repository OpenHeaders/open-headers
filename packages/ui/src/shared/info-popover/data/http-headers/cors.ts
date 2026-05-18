/**
 * HTTP-header docs — CORS.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const CORS_HEADERS: HeaderInfoEntries = [
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
  [
    'timing-allow-origin',
    {
      display: 'Timing-Allow-Origin',
      direction: 'response',
      category: 'CORS',
      summary: 'Lets foreign origins read detailed timing metrics (`PerformanceResourceTiming`) for this resource.',
      body: ['Without this header, cross-origin resources only expose coarse-grained timings.'],
    },
  ],
];
