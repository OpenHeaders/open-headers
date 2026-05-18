/**
 * HTTP-header docs — Client Hints.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const CLIENT_HINTS_HEADERS: HeaderInfoEntries = [
  [
    'sec-ch-ua',
    {
      display: 'Sec-CH-UA',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Client Hint: the browser’s brand list.',
      body: ['Replaces the freeform `User-Agent` for the parts servers should actually depend on.'],
    },
  ],
  [
    'sec-ch-ua-mobile',
    {
      display: 'Sec-CH-UA-Mobile',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Client Hint: `?1` on mobile, `?0` on desktop.',
    },
  ],
  [
    'sec-ch-ua-platform',
    {
      display: 'Sec-CH-UA-Platform',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Client Hint: the user’s OS (`"Windows"`, `"macOS"`, `"Linux"`, etc.).',
    },
  ],
  [
    'user-agent',
    {
      display: 'User-Agent',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Legacy freeform string identifying the browser, OS, and engine.',
      body: [
        'Still sent by every request. The structured replacement is the `Sec-CH-UA-*` family — prefer those when servers care about browser identity.',
      ],
    },
  ],
  [
    'accept-ch',
    {
      display: 'Accept-CH',
      direction: 'response',
      category: 'Client Hints',
      summary: 'Lists which Client Hint headers the server wants on subsequent requests.',
      body: ['Browsers only send hints the server has opted into here (except for the low-entropy defaults).'],
    },
  ],
  [
    'critical-ch',
    {
      display: 'Critical-CH',
      direction: 'response',
      category: 'Client Hints',
      summary: 'Subset of `Accept-CH` the server considers critical — browsers will restart the request to include them.',
      body: ['Use sparingly: every Critical-CH miss costs a round-trip.'],
    },
  ],
  [
    'save-data',
    {
      display: 'Save-Data',
      direction: 'request',
      category: 'Client Hints',
      summary: '`on` when the user enabled a data-saver mode in their browser/OS.',
      body: ['Use it to serve lower-bandwidth assets (lower image quality, defer below-the-fold work, etc.).'],
    },
  ],
  [
    'device-memory',
    {
      display: 'Device-Memory',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Approximate device RAM in GiB, rounded to a small set of values (`0.25`, `0.5`, `1`, `2`, `4`, `8`).',
    },
  ],
  [
    'downlink',
    {
      display: 'Downlink',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Estimated downstream bandwidth in Mbps, rounded.',
    },
  ],
  [
    'ect',
    {
      display: 'ECT',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Effective Connection Type — `slow-2g`, `2g`, `3g`, or `4g`.',
    },
  ],
  [
    'rtt',
    {
      display: 'RTT',
      direction: 'request',
      category: 'Client Hints',
      summary: 'Estimated round-trip time in milliseconds, rounded.',
    },
  ],
];
