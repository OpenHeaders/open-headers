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
      summary: 'Hop-by-hop connection controls (`keep-alive`, `close`, `upgrade`).',
      body: ['Stripped by proxies between hops. In HTTP/2+ this header is forbidden — connection management is built into the protocol.'],
    },
  ],
  [
    'keep-alive',
    {
      display: 'Keep-Alive',
      direction: 'both',
      category: 'Connection',
      summary: 'Connection-pool hints — typically `timeout=N, max=N`.',
      body: ['Only meaningful with `Connection: keep-alive` on HTTP/1.1. Ignored in HTTP/2+.'],
    },
  ],
  [
    'upgrade',
    {
      display: 'Upgrade',
      direction: 'both',
      category: 'Connection',
      summary: 'Asks to switch protocols on the same connection (WebSocket, HTTP/2 cleartext).',
      body: ['Used together with `Connection: upgrade`. WebSocket: `Upgrade: websocket`.'],
    },
  ],
  [
    'te',
    {
      display: 'TE',
      direction: 'request',
      category: 'Connection',
      summary: 'Transfer encodings the client will accept (`trailers`, `gzip`, …).',
      body: ['Most modern clients only send `TE: trailers` to opt into trailing headers.'],
    },
  ],
  [
    'expect',
    {
      display: 'Expect',
      direction: 'request',
      category: 'Connection',
      summary: 'Server-side preconditions the client expects to hold (`100-continue`).',
      body: ['`Expect: 100-continue` lets the client send the body only after the server signals `100 Continue`.'],
    },
  ],
  [
    'alt-svc',
    {
      display: 'Alt-Svc',
      direction: 'response',
      category: 'Connection',
      summary: 'Advertises alternative ways to reach the same origin (e.g. HTTP/3 over QUIC).',
      body: ['Browsers cache the advertisement and may switch to the alternative for subsequent requests.'],
    },
  ],
  [
    'sec-websocket-key',
    {
      display: 'Sec-WebSocket-Key',
      direction: 'request',
      category: 'Connection',
      summary: 'Random base64-encoded nonce sent on the WebSocket handshake.',
      body: ['Server replies with `Sec-WebSocket-Accept` derived from this key + a fixed GUID, proving it understands WebSocket.'],
    },
  ],
  [
    'sec-websocket-accept',
    {
      display: 'Sec-WebSocket-Accept',
      direction: 'response',
      category: 'Connection',
      summary: 'Server proof for the WebSocket handshake — `SHA-1(Sec-WebSocket-Key + GUID)` base64-encoded.',
    },
  ],
  [
    'sec-websocket-version',
    {
      display: 'Sec-WebSocket-Version',
      direction: 'request',
      category: 'Connection',
      summary: 'WebSocket protocol version the client requests. Almost always `13` (RFC 6455).',
    },
  ],
  [
    'sec-websocket-protocol',
    {
      display: 'Sec-WebSocket-Protocol',
      direction: 'both',
      category: 'Connection',
      summary: 'Sub-protocol negotiation for WebSocket — comma-separated list on request, single picked value on response.',
    },
  ],
  [
    'sec-websocket-extensions',
    {
      display: 'Sec-WebSocket-Extensions',
      direction: 'both',
      category: 'Connection',
      summary: 'Negotiated WebSocket extensions (compression, etc.) — most commonly `permessage-deflate`.',
    },
  ],
];
