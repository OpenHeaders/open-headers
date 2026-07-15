/**
 * HTTP-header docs — Routing.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const ROUTING_HEADERS: HeaderInfoEntries = [
  [
    ':authority',
    {
      display: ':authority',
      direction: 'request',
      category: 'Routing',
      summaryKey: 'shared.info.header.authority.summary',
      bodyKeys: ['shared.info.header.authority.body1'],
    },
  ],
  [
    ':method',
    {
      display: ':method',
      direction: 'request',
      category: 'Routing',
      summaryKey: 'shared.info.header.method.summary',
    },
  ],
  [
    ':path',
    {
      display: ':path',
      direction: 'request',
      category: 'Routing',
      summaryKey: 'shared.info.header.path.summary',
    },
  ],
  [
    ':scheme',
    {
      display: ':scheme',
      direction: 'request',
      category: 'Routing',
      summaryKey: 'shared.info.header.scheme.summary',
    },
  ],
  [
    ':status',
    {
      display: ':status',
      direction: 'response',
      category: 'Routing',
      summaryKey: 'shared.info.header.status.summary',
      bodyKeys: ['shared.info.header.status.body1'],
    },
  ],
  [
    'host',
    {
      display: 'Host',
      direction: 'request',
      category: 'Routing',
      summaryKey: 'shared.info.header.host.summary',
      bodyKeys: ['shared.info.header.host.body1'],
    },
  ],
  [
    'location',
    {
      display: 'Location',
      direction: 'response',
      category: 'Routing',
      summaryKey: 'shared.info.header.location.summary',
      bodyKeys: ['shared.info.header.location.body1'],
    },
  ],
  [
    'allow',
    {
      display: 'Allow',
      direction: 'response',
      category: 'Routing',
      summaryKey: 'shared.info.header.allow.summary',
      bodyKeys: ['shared.info.header.allow.body1'],
    },
  ],
  [
    'referer',
    {
      display: 'Referer',
      direction: 'request',
      category: 'Routing',
      summaryKey: 'shared.info.header.referer.summary',
      bodyKeys: ['shared.info.header.referer.body1'],
    },
  ],
  [
    'retry-after',
    {
      display: 'Retry-After',
      direction: 'response',
      category: 'Routing',
      summaryKey: 'shared.info.header.retryAfter.summary',
      bodyKeys: ['shared.info.header.retryAfter.body1'],
    },
  ],
  [
    'max-forwards',
    {
      display: 'Max-Forwards',
      direction: 'request',
      category: 'Routing',
      summaryKey: 'shared.info.header.maxForwards.summary',
      bodyKeys: ['shared.info.header.maxForwards.body1'],
    },
  ],
  [
    'service-worker',
    {
      display: 'Service-Worker',
      direction: 'request',
      category: 'Routing',
      summaryKey: 'shared.info.header.serviceWorker.summary',
      bodyKeys: ['shared.info.header.serviceWorker.body1'],
    },
  ],
  [
    'service-worker-allowed',
    {
      display: 'Service-Worker-Allowed',
      direction: 'response',
      category: 'Routing',
      summaryKey: 'shared.info.header.serviceWorkerAllowed.summary',
      bodyKeys: ['shared.info.header.serviceWorkerAllowed.body1'],
    },
  ],
  [
    ':protocol',
    {
      display: ':protocol',
      direction: 'request',
      category: 'Routing',
      summaryKey: 'shared.info.header.protocol.summary',
      bodyKeys: ['shared.info.header.protocol.body1'],
    },
  ],
];
