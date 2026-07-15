/**
 * HTTP-header docs — Connection.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const CONNECTION_HEADERS: HeaderInfoEntries = [
  [
    'connection',
    {
      display: 'Connection',
      direction: 'both',
      category: 'Connection',
      summaryKey: 'shared.info.header.connection.summary',
      bodyKeys: ['shared.info.header.connection.body1'],
    },
  ],
  [
    'keep-alive',
    {
      display: 'Keep-Alive',
      direction: 'both',
      category: 'Connection',
      summaryKey: 'shared.info.header.keepAlive.summary',
      bodyKeys: ['shared.info.header.keepAlive.body1'],
    },
  ],
  [
    'upgrade',
    {
      display: 'Upgrade',
      direction: 'both',
      category: 'Connection',
      summaryKey: 'shared.info.header.upgrade.summary',
      bodyKeys: ['shared.info.header.upgrade.body1'],
    },
  ],
  [
    'te',
    {
      display: 'TE',
      direction: 'request',
      category: 'Connection',
      summaryKey: 'shared.info.header.te.summary',
      bodyKeys: ['shared.info.header.te.body1'],
    },
  ],
  [
    'expect',
    {
      display: 'Expect',
      direction: 'request',
      category: 'Connection',
      summaryKey: 'shared.info.header.expect.summary',
      bodyKeys: ['shared.info.header.expect.body1'],
    },
  ],
  [
    'alt-svc',
    {
      display: 'Alt-Svc',
      direction: 'response',
      category: 'Connection',
      summaryKey: 'shared.info.header.altSvc.summary',
      bodyKeys: ['shared.info.header.altSvc.body1'],
    },
  ],
  [
    'sec-websocket-key',
    {
      display: 'Sec-WebSocket-Key',
      direction: 'request',
      category: 'Connection',
      summaryKey: 'shared.info.header.secWebsocketKey.summary',
      bodyKeys: ['shared.info.header.secWebsocketKey.body1'],
    },
  ],
  [
    'sec-websocket-accept',
    {
      display: 'Sec-WebSocket-Accept',
      direction: 'response',
      category: 'Connection',
      summaryKey: 'shared.info.header.secWebsocketAccept.summary',
    },
  ],
  [
    'sec-websocket-version',
    {
      display: 'Sec-WebSocket-Version',
      direction: 'request',
      category: 'Connection',
      summaryKey: 'shared.info.header.secWebsocketVersion.summary',
    },
  ],
  [
    'sec-websocket-protocol',
    {
      display: 'Sec-WebSocket-Protocol',
      direction: 'both',
      category: 'Connection',
      summaryKey: 'shared.info.header.secWebsocketProtocol.summary',
    },
  ],
  [
    'sec-websocket-extensions',
    {
      display: 'Sec-WebSocket-Extensions',
      direction: 'both',
      category: 'Connection',
      summaryKey: 'shared.info.header.secWebsocketExtensions.summary',
    },
  ],
];
