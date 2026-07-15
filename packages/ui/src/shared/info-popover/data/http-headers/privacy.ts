/**
 * HTTP-header docs — Privacy.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const PRIVACY_HEADERS: HeaderInfoEntries = [
  [
    'dnt',
    {
      display: 'DNT',
      direction: 'request',
      category: 'Privacy',
      summaryKey: 'shared.info.header.dnt.summary',
      bodyKeys: ['shared.info.header.dnt.body1'],
    },
  ],
  [
    'sec-gpc',
    {
      display: 'Sec-GPC',
      direction: 'request',
      category: 'Privacy',
      summaryKey: 'shared.info.header.secGpc.summary',
      bodyKeys: ['shared.info.header.secGpc.body1'],
    },
  ],
];
