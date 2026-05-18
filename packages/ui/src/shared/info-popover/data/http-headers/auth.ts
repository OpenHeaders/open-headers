/**
 * HTTP-header docs — Auth.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const AUTH_HEADERS: HeaderInfoEntries = [
  [
    'authorization',
    {
      display: 'Authorization',
      direction: 'request',
      category: 'Auth',
      summary: 'Credentials authenticating the client to the server.',
      body: ['Format: `<scheme> <credentials>`. Common schemes: `Bearer <token>` (OAuth, JWT), `Basic <base64(user:pass)>`, `Digest`.'],
    },
  ],
  [
    'proxy-authorization',
    {
      display: 'Proxy-Authorization',
      direction: 'request',
      category: 'Auth',
      summary: 'Credentials for an intervening proxy (not the origin server).',
      body: ['Same syntax as `Authorization`, distinct in scope.'],
    },
  ],
  [
    'www-authenticate',
    {
      display: 'WWW-Authenticate',
      direction: 'response',
      category: 'Auth',
      summary: 'Server’s 401 challenge — tells the client which auth scheme to use.',
      body: ['Sent with `401 Unauthorized`. Triggers the browser’s basic-auth dialog when the scheme is `Basic`.'],
    },
  ],
  [
    'proxy-authenticate',
    {
      display: 'Proxy-Authenticate',
      direction: 'response',
      category: 'Auth',
      summary: 'Proxy-equivalent of `WWW-Authenticate`, sent with `407 Proxy Authentication Required`.',
    },
  ],
  [
    'authentication-info',
    {
      display: 'Authentication-Info',
      direction: 'response',
      category: 'Auth',
      summary: 'Completes mutual authentication on success — Digest auth uses it to confirm the server too.',
    },
  ],
];
