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
      summary: 'Do Not Track — `1` if the user opted out of tracking. Largely deprecated.',
      body: ['Most major sites ignore it; the W3C dropped the spec in 2019. Compliance is voluntary.'],
    },
  ],
  [
    'sec-gpc',
    {
      display: 'Sec-GPC',
      direction: 'request',
      category: 'Privacy',
      summary: 'Global Privacy Control — `1` signals the user wants their data not sold or shared.',
      body: ['Legally binding under CCPA in California; honored by some privacy-focused browsers (Brave, Firefox, DuckDuckGo).'],
    },
  ],
];
