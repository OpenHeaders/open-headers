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
      summaryKey: 'shared.info.header.authorization.summary',
      bodyKeys: ['shared.info.header.authorization.body1'],
    },
  ],
  [
    'proxy-authorization',
    {
      display: 'Proxy-Authorization',
      direction: 'request',
      category: 'Auth',
      summaryKey: 'shared.info.header.proxyAuthorization.summary',
      bodyKeys: ['shared.info.header.proxyAuthorization.body1'],
    },
  ],
  [
    'www-authenticate',
    {
      display: 'WWW-Authenticate',
      direction: 'response',
      category: 'Auth',
      summaryKey: 'shared.info.header.wwwAuthenticate.summary',
      bodyKeys: ['shared.info.header.wwwAuthenticate.body1'],
    },
  ],
  [
    'proxy-authenticate',
    {
      display: 'Proxy-Authenticate',
      direction: 'response',
      category: 'Auth',
      summaryKey: 'shared.info.header.proxyAuthenticate.summary',
    },
  ],
  [
    'authentication-info',
    {
      display: 'Authentication-Info',
      direction: 'response',
      category: 'Auth',
      summaryKey: 'shared.info.header.authenticationInfo.summary',
    },
  ],
];
