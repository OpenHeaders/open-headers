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
      summaryKey: 'shared.info.header.server.summary',
      bodyKeys: ['shared.info.header.server.body1'],
    },
  ],
  [
    'x-powered-by',
    {
      display: 'X-Powered-By',
      direction: 'response',
      category: 'Server identification',
      summaryKey: 'shared.info.header.xPoweredBy.summary',
      bodyKeys: ['shared.info.header.xPoweredBy.body1'],
    },
  ],
  [
    'date',
    {
      display: 'Date',
      direction: 'response',
      category: 'Server identification',
      summaryKey: 'shared.info.header.date.summary',
      bodyKeys: ['shared.info.header.date.body1'],
    },
  ],
  [
    'x-served-by',
    {
      display: 'X-Served-By',
      direction: 'response',
      category: 'Server identification',
      summaryKey: 'shared.info.header.xServedBy.summary',
      bodyKeys: ['shared.info.header.xServedBy.body1'],
    },
  ],
];
