/**
 * HTTP-header docs — Proxy.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const PROXY_HEADERS: HeaderInfoEntries = [
  [
    'via',
    {
      display: 'Via',
      direction: 'both',
      category: 'Proxy',
      summary: 'Lists proxies / gateways the message passed through.',
      body: ['Each proxy appends its identifier so the chain can be reconstructed for debugging.'],
    },
  ],
  [
    'x-forwarded-for',
    {
      display: 'X-Forwarded-For',
      direction: 'request',
      category: 'Proxy',
      summary: 'Non-standard but ubiquitous: comma-separated chain of client IPs through proxies.',
      body: ['Leftmost entry is the original client. RFC 7239’s `Forwarded` header is the standardized alternative.'],
    },
  ],
  [
    'x-forwarded-proto',
    {
      display: 'X-Forwarded-Proto',
      direction: 'request',
      category: 'Proxy',
      summary: 'Original scheme (`http` or `https`) the client used to reach the first proxy.',
    },
  ],
  [
    'x-forwarded-host',
    {
      display: 'X-Forwarded-Host',
      direction: 'request',
      category: 'Proxy',
      summary: 'Original `Host` header the client sent before the proxy rewrote it.',
    },
  ],
  [
    'x-real-ip',
    {
      display: 'X-Real-IP',
      direction: 'request',
      category: 'Proxy',
      summary: 'Original client IP as seen by the first proxy. Single value, not a chain.',
    },
  ],
  [
    'forwarded',
    {
      display: 'Forwarded',
      direction: 'request',
      category: 'Proxy',
      summary: 'RFC 7239 standardized proxy chain — replaces the `X-Forwarded-*` family.',
      body: ['Format: `for=client; proto=https; by=proxy; host=original-host`. Multiple proxies separated by commas.'],
    },
  ],
  [
    'true-client-ip',
    {
      display: 'True-Client-IP',
      direction: 'request',
      category: 'Proxy',
      summary: 'Original client IP forwarded by Akamai / Cloudflare Enterprise — single value, not a chain.',
    },
  ],
];
