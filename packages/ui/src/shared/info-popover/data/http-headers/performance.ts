/**
 * HTTP-header docs — Performance.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const PERFORMANCE_HEADERS: HeaderInfoEntries = [
  [
    'priority',
    {
      display: 'Priority',
      direction: 'both',
      category: 'Performance',
      summaryKey: 'shared.info.header.priority.summary',
      bodyKeys: ['shared.info.header.priority.body1'],
    },
  ],
  [
    'upgrade-insecure-requests',
    {
      display: 'Upgrade-Insecure-Requests',
      direction: 'request',
      category: 'Performance',
      summaryKey: 'shared.info.header.upgradeInsecureRequests.summary',
      bodyKeys: ['shared.info.header.upgradeInsecureRequests.body1'],
    },
  ],
  [
    'early-data',
    {
      display: 'Early-Data',
      direction: 'request',
      category: 'Performance',
      summaryKey: 'shared.info.header.earlyData.summary',
      bodyKeys: ['shared.info.header.earlyData.body1'],
    },
  ],
  [
    'link',
    {
      display: 'Link',
      direction: 'response',
      category: 'Performance',
      summaryKey: 'shared.info.header.link.summary',
      bodyKeys: ['shared.info.header.link.body1'],
      commonValues: [
        {
          value: '<style.css>; rel=preload; as=style',
          descKey: 'shared.info.header.link.value.styleCssRelPreloadAsStyle',
        },
        {
          value: '<https://cdn.example.com>; rel=preconnect',
          descKey: 'shared.info.header.link.value.httpsCdnExampleComRelPreconnect',
        },
      ],
    },
  ],
  [
    'x-dns-prefetch-control',
    {
      display: 'X-DNS-Prefetch-Control',
      direction: 'response',
      category: 'Performance',
      summaryKey: 'shared.info.header.xDnsPrefetchControl.summary',
    },
  ],
];
