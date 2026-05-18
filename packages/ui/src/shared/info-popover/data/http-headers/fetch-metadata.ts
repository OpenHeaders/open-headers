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
      summary: 'Browser-set: relationship between the request initiator and the target.',
      body: ['Values: `same-origin`, `same-site`, `cross-site`, `none` (direct navigation).'],
    },
  ],
  [
    'sec-fetch-mode',
    {
      display: 'Sec-Fetch-Mode',
      direction: 'request',
      category: 'Fetch metadata',
      summary: 'Browser-set: the request’s fetch mode.',
      body: ['Values: `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.'],
    },
  ],
  [
    'sec-fetch-dest',
    {
      display: 'Sec-Fetch-Dest',
      direction: 'request',
      category: 'Fetch metadata',
      summary: 'Browser-set: where the response will be used (document, script, image, etc.).',
      body: ['Lets the server detect surprising fetches — e.g. an HTML response being requested as `Sec-Fetch-Dest: script`.'],
    },
  ],
  [
    'sec-fetch-user',
    {
      display: 'Sec-Fetch-User',
      direction: 'request',
      category: 'Fetch metadata',
      summary: 'Browser-set: `?1` when the navigation was a direct user activation.',
      body: ['Absent otherwise. Useful for distinguishing user clicks from programmatic navigation.'],
    },
  ],
  [
    'sec-purpose',
    {
      display: 'Sec-Purpose',
      direction: 'request',
      category: 'Fetch metadata',
      summary: 'Browser-set when the request is speculative — e.g. `prefetch`, `prerender`.',
      body: ['Lets the server skip side effects (analytics, write logs) for fetches the user hasn’t actually requested yet.'],
    },
  ],
];
