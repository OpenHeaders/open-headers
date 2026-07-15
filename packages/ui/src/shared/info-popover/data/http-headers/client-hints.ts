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
      summaryKey: 'shared.info.header.secChUa.summary',
      bodyKeys: ['shared.info.header.secChUa.body1'],
    },
  ],
  [
    'sec-ch-ua-mobile',
    {
      display: 'Sec-CH-UA-Mobile',
      direction: 'request',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.secChUaMobile.summary',
    },
  ],
  [
    'sec-ch-ua-platform',
    {
      display: 'Sec-CH-UA-Platform',
      direction: 'request',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.secChUaPlatform.summary',
    },
  ],
  [
    'user-agent',
    {
      display: 'User-Agent',
      direction: 'request',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.userAgent.summary',
      bodyKeys: ['shared.info.header.userAgent.body1'],
    },
  ],
  [
    'accept-ch',
    {
      display: 'Accept-CH',
      direction: 'response',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.acceptCh.summary',
      bodyKeys: ['shared.info.header.acceptCh.body1'],
    },
  ],
  [
    'critical-ch',
    {
      display: 'Critical-CH',
      direction: 'response',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.criticalCh.summary',
      bodyKeys: ['shared.info.header.criticalCh.body1'],
    },
  ],
  [
    'save-data',
    {
      display: 'Save-Data',
      direction: 'request',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.saveData.summary',
      bodyKeys: ['shared.info.header.saveData.body1'],
    },
  ],
  [
    'device-memory',
    {
      display: 'Device-Memory',
      direction: 'request',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.deviceMemory.summary',
    },
  ],
  [
    'downlink',
    {
      display: 'Downlink',
      direction: 'request',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.downlink.summary',
    },
  ],
  [
    'ect',
    {
      display: 'ECT',
      direction: 'request',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.ect.summary',
    },
  ],
  [
    'rtt',
    {
      display: 'RTT',
      direction: 'request',
      category: 'Client Hints',
      summaryKey: 'shared.info.header.rtt.summary',
    },
  ],
];
