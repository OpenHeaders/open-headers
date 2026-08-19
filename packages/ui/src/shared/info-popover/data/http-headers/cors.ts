/**
 * HTTP-header docs — CORS.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const CORS_HEADERS: HeaderInfoEntries = [
  [
    'access-control-allow-origin',
    {
      display: 'Access-Control-Allow-Origin',
      direction: 'response',
      category: 'CORS',
      summaryKey: 'shared.info.header.accessControlAllowOrigin.summary',
      bodyKeys: [
        'shared.info.header.accessControlAllowOrigin.body1',
        'shared.info.header.accessControlAllowOrigin.body2',
      ],
      commonValues: [
        { value: '*', descKey: 'shared.info.header.accessControlAllowOrigin.value.wildcard' },
        {
          value: 'https://app.openheaders.com',
          descKey: 'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo',
        },
      ],
    },
  ],
  [
    'access-control-allow-credentials',
    {
      display: 'Access-Control-Allow-Credentials',
      direction: 'response',
      category: 'CORS',
      summaryKey: 'shared.info.header.accessControlAllowCredentials.summary',
      bodyKeys: ['shared.info.header.accessControlAllowCredentials.body1'],
    },
  ],
  [
    'access-control-allow-methods',
    {
      display: 'Access-Control-Allow-Methods',
      direction: 'response',
      category: 'CORS',
      summaryKey: 'shared.info.header.accessControlAllowMethods.summary',
      bodyKeys: ['shared.info.header.accessControlAllowMethods.body1'],
    },
  ],
  [
    'access-control-allow-headers',
    {
      display: 'Access-Control-Allow-Headers',
      direction: 'response',
      category: 'CORS',
      summaryKey: 'shared.info.header.accessControlAllowHeaders.summary',
      bodyKeys: ['shared.info.header.accessControlAllowHeaders.body1'],
    },
  ],
  [
    'access-control-expose-headers',
    {
      display: 'Access-Control-Expose-Headers',
      direction: 'response',
      category: 'CORS',
      summaryKey: 'shared.info.header.accessControlExposeHeaders.summary',
      bodyKeys: ['shared.info.header.accessControlExposeHeaders.body1'],
    },
  ],
  [
    'access-control-max-age',
    {
      display: 'Access-Control-Max-Age',
      direction: 'response',
      category: 'CORS',
      summaryKey: 'shared.info.header.accessControlMaxAge.summary',
      bodyKeys: ['shared.info.header.accessControlMaxAge.body1'],
    },
  ],
  [
    'access-control-request-method',
    {
      display: 'Access-Control-Request-Method',
      direction: 'request',
      category: 'CORS',
      summaryKey: 'shared.info.header.accessControlRequestMethod.summary',
      bodyKeys: ['shared.info.header.accessControlRequestMethod.body1'],
    },
  ],
  [
    'access-control-request-headers',
    {
      display: 'Access-Control-Request-Headers',
      direction: 'request',
      category: 'CORS',
      summaryKey: 'shared.info.header.accessControlRequestHeaders.summary',
      bodyKeys: ['shared.info.header.accessControlRequestHeaders.body1'],
    },
  ],
  [
    'origin',
    {
      display: 'Origin',
      direction: 'request',
      category: 'CORS',
      summaryKey: 'shared.info.header.origin.summary',
      bodyKeys: ['shared.info.header.origin.body1'],
    },
  ],
  [
    'vary',
    {
      display: 'Vary',
      direction: 'response',
      category: 'CORS',
      summaryKey: 'shared.info.header.vary.summary',
      bodyKeys: ['shared.info.header.vary.body1'],
    },
  ],
  [
    'timing-allow-origin',
    {
      display: 'Timing-Allow-Origin',
      direction: 'response',
      category: 'CORS',
      summaryKey: 'shared.info.header.timingAllowOrigin.summary',
      bodyKeys: ['shared.info.header.timingAllowOrigin.body1'],
    },
  ],
];
