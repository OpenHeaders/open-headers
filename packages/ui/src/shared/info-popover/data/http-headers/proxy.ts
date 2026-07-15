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
      summaryKey: 'shared.info.header.via.summary',
      bodyKeys: ['shared.info.header.via.body1'],
    },
  ],
  [
    'x-forwarded-for',
    {
      display: 'X-Forwarded-For',
      direction: 'request',
      category: 'Proxy',
      summaryKey: 'shared.info.header.xForwardedFor.summary',
      bodyKeys: ['shared.info.header.xForwardedFor.body1'],
    },
  ],
  [
    'x-forwarded-proto',
    {
      display: 'X-Forwarded-Proto',
      direction: 'request',
      category: 'Proxy',
      summaryKey: 'shared.info.header.xForwardedProto.summary',
    },
  ],
  [
    'x-forwarded-host',
    {
      display: 'X-Forwarded-Host',
      direction: 'request',
      category: 'Proxy',
      summaryKey: 'shared.info.header.xForwardedHost.summary',
    },
  ],
  [
    'x-real-ip',
    {
      display: 'X-Real-IP',
      direction: 'request',
      category: 'Proxy',
      summaryKey: 'shared.info.header.xRealIp.summary',
    },
  ],
  [
    'forwarded',
    {
      display: 'Forwarded',
      direction: 'request',
      category: 'Proxy',
      summaryKey: 'shared.info.header.forwarded.summary',
      bodyKeys: ['shared.info.header.forwarded.body1'],
    },
  ],
  [
    'true-client-ip',
    {
      display: 'True-Client-IP',
      direction: 'request',
      category: 'Proxy',
      summaryKey: 'shared.info.header.trueClientIp.summary',
    },
  ],
];
