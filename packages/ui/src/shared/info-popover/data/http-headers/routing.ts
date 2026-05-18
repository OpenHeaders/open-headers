/**
 * HTTP-header docs — Routing.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const ROUTING_HEADERS: HeaderInfoEntries = [
  [
    ':authority',
    {
      display: ':authority',
      direction: 'request',
      category: 'Routing',
      summary: 'HTTP/2+ pseudo-header — equivalent to `Host` in HTTP/1.1. Identifies the target server.',
      body: ['Pseudo-headers start with `:` and must appear before regular headers. The browser sets them; JavaScript cannot.'],
    },
  ],
  [
    ':method',
    {
      display: ':method',
      direction: 'request',
      category: 'Routing',
      summary: 'HTTP/2+ pseudo-header — the request method (`GET`, `POST`, …).',
    },
  ],
  [
    ':path',
    {
      display: ':path',
      direction: 'request',
      category: 'Routing',
      summary: 'HTTP/2+ pseudo-header — the request path + query string.',
    },
  ],
  [
    ':scheme',
    {
      display: ':scheme',
      direction: 'request',
      category: 'Routing',
      summary: 'HTTP/2+ pseudo-header — `https` or `http`.',
    },
  ],
  [
    ':status',
    {
      display: ':status',
      direction: 'response',
      category: 'Routing',
      summary: 'HTTP/2+ pseudo-header — the numeric response status (e.g. `200`).',
      body: ['Pseudo-headers replace the HTTP/1.1 status line in HTTP/2 and HTTP/3.'],
    },
  ],
  [
    'host',
    {
      display: 'Host',
      direction: 'request',
      category: 'Routing',
      summary: 'HTTP/1.1 target host (and optional port). Replaced by `:authority` in HTTP/2+.',
      body: ['Required on every HTTP/1.1 request. Servers use it to route between virtual hosts on the same IP.'],
    },
  ],
  [
    'location',
    {
      display: 'Location',
      direction: 'response',
      category: 'Routing',
      summary: 'Redirect target — sent with `3xx` responses or as the result of a created resource.',
      body: ['Absolute URLs are universally honored; relative URLs resolve against the request URL.'],
    },
  ],
  [
    'allow',
    {
      display: 'Allow',
      direction: 'response',
      category: 'Routing',
      summary: 'Lists HTTP methods the resource accepts.',
      body: ['Required in a `405 Method Not Allowed` response. Common values: `GET, HEAD, POST, OPTIONS`.'],
    },
  ],
  [
    'referer',
    {
      display: 'Referer',
      direction: 'request',
      category: 'Routing',
      summary: 'URL of the page that initiated this request.',
      body: [
        'Note the historical misspelling — the spec keeps it. Some destinations strip or downgrade `Referer` based on the page’s `Referrer-Policy`.',
      ],
    },
  ],
  [
    'retry-after',
    {
      display: 'Retry-After',
      direction: 'response',
      category: 'Routing',
      summary: 'Tells the client when to retry — seconds (delta) or absolute HTTP-date.',
      body: ['Common on `503 Service Unavailable` and `429 Too Many Requests`. Crawlers honor it.'],
    },
  ],
  [
    'max-forwards',
    {
      display: 'Max-Forwards',
      direction: 'request',
      category: 'Routing',
      summary: 'Limits the number of proxies that may forward a `TRACE` or `OPTIONS` request.',
      body: ['Decremented by each forwarding proxy. Reaches 0 → the proxy responds itself.'],
    },
  ],
  [
    'service-worker',
    {
      display: 'Service-Worker',
      direction: 'request',
      category: 'Routing',
      summary: 'Browser-set `script` when the request is fetching a service worker script file.',
      body: ['Lets servers detect SW registration fetches and respond with the right `Service-Worker-Allowed` header.'],
    },
  ],
  [
    'service-worker-allowed',
    {
      display: 'Service-Worker-Allowed',
      direction: 'response',
      category: 'Routing',
      summary: 'Overrides the path-restriction default for the service worker’s scope.',
      body: ['By default, a worker can only control its directory and below. This header lets you broaden that — e.g. control `/` from a worker at `/sw.js`.'],
    },
  ],
  [
    ':protocol',
    {
      display: ':protocol',
      direction: 'request',
      category: 'Routing',
      summary: 'Pseudo-header for the Extended CONNECT mechanism (RFC 8441) — used by WebSocket-over-HTTP/2 / 3.',
      body: ['Set to `websocket` when the client tunnels a WebSocket through HTTP/2 or HTTP/3.'],
    },
  ],
];
