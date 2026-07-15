/**
 * HTTP-header docs — Fetch metadata.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const FETCH_METADATA_HEADERS: HeaderInfoEntries = [
  [
    'sec-fetch-site',
    {
      display: 'Sec-Fetch-Site',
      direction: 'request',
      category: 'Fetch metadata',
      summaryKey: 'shared.info.header.secFetchSite.summary',
      bodyKeys: ['shared.info.header.secFetchSite.body1'],
    },
  ],
  [
    'sec-fetch-mode',
    {
      display: 'Sec-Fetch-Mode',
      direction: 'request',
      category: 'Fetch metadata',
      summaryKey: 'shared.info.header.secFetchMode.summary',
      bodyKeys: ['shared.info.header.secFetchMode.body1'],
    },
  ],
  [
    'sec-fetch-dest',
    {
      display: 'Sec-Fetch-Dest',
      direction: 'request',
      category: 'Fetch metadata',
      summaryKey: 'shared.info.header.secFetchDest.summary',
      bodyKeys: ['shared.info.header.secFetchDest.body1'],
    },
  ],
  [
    'sec-fetch-user',
    {
      display: 'Sec-Fetch-User',
      direction: 'request',
      category: 'Fetch metadata',
      summaryKey: 'shared.info.header.secFetchUser.summary',
      bodyKeys: ['shared.info.header.secFetchUser.body1'],
    },
  ],
  [
    'sec-purpose',
    {
      display: 'Sec-Purpose',
      direction: 'request',
      category: 'Fetch metadata',
      summaryKey: 'shared.info.header.secPurpose.summary',
      bodyKeys: ['shared.info.header.secPurpose.body1'],
    },
  ],
];
