/**
 * The auto-generated WebSocket handshake headers per dialing host —
 * what actually leaves with the upgrade request beyond the user's own
 * rows: a node host (desktop app, server) sends undici's handshake,
 * identifying itself with the product token; a browser host hands the
 * handshake to the page's WebSocket API, which adds its own Origin,
 * User-Agent, cache and Accept-* headers. One registry, two readers:
 * the Headers tab's read-only rows and the timeline's Connected row.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { productUserAgent } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';

declare const __APP_VERSION__: string;

export interface WsAutoHeaderDef {
  key: string;
  /** Literal wire value, or absent for a value computed at connect time. */
  value?: string;
  hintKey: MessageKey;
}

const HOST: WsAutoHeaderDef = { key: 'Host', hintKey: 'workbench.editors.websocket.headers.hint.host' };
const CONNECTION: WsAutoHeaderDef = {
  key: 'Connection',
  value: 'Upgrade',
  hintKey: 'workbench.editors.websocket.headers.hint.connection',
};
const UPGRADE: WsAutoHeaderDef = {
  key: 'Upgrade',
  value: 'websocket',
  hintKey: 'workbench.editors.websocket.headers.hint.upgrade',
};
const KEY: WsAutoHeaderDef = { key: 'Sec-WebSocket-Key', hintKey: 'workbench.editors.websocket.headers.hint.key' };
const VERSION: WsAutoHeaderDef = {
  key: 'Sec-WebSocket-Version',
  value: '13',
  hintKey: 'workbench.editors.websocket.headers.hint.version',
};
const EXTENSIONS: WsAutoHeaderDef = {
  key: 'Sec-WebSocket-Extensions',
  value: 'permessage-deflate; client_max_window_bits',
  hintKey: 'workbench.editors.websocket.headers.hint.extensions',
};

/** A node host's opening handshake (undici's WebSocket), in the order
 *  it writes them. */
const NODE_AUTO_HEADERS: readonly WsAutoHeaderDef[] = [
  HOST,
  CONNECTION,
  UPGRADE,
  KEY,
  VERSION,
  EXTENSIONS,
  { key: 'Accept', value: '*/*', hintKey: 'workbench.editors.websocket.headers.hint.node.accept' },
  { key: 'Accept-Language', value: '*', hintKey: 'workbench.editors.websocket.headers.hint.node.acceptLanguage' },
  { key: 'Sec-Fetch-Mode', value: 'websocket', hintKey: 'workbench.editors.websocket.headers.hint.node.secFetchMode' },
  {
    key: 'User-Agent',
    value: productUserAgent(__APP_VERSION__),
    hintKey: 'workbench.editors.websocket.headers.hint.node.userAgent',
  },
  { key: 'Pragma', value: 'no-cache', hintKey: 'workbench.editors.websocket.headers.hint.node.cacheControl' },
  { key: 'Cache-Control', value: 'no-cache', hintKey: 'workbench.editors.websocket.headers.hint.node.cacheControl' },
  {
    key: 'Accept-Encoding',
    value: 'gzip, deflate',
    hintKey: 'workbench.editors.websocket.headers.hint.node.acceptEncoding',
  },
];

/** Chromium's opening handshake for a page-realm WebSocket. */
const BROWSER_AUTO_HEADERS: readonly WsAutoHeaderDef[] = [
  HOST,
  CONNECTION,
  { key: 'Pragma', value: 'no-cache', hintKey: 'workbench.editors.websocket.headers.hint.cacheControl' },
  { key: 'Cache-Control', value: 'no-cache', hintKey: 'workbench.editors.websocket.headers.hint.cacheControl' },
  {
    key: 'User-Agent',
    value: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    hintKey: 'workbench.editors.websocket.headers.hint.userAgent',
  },
  UPGRADE,
  { key: 'Origin', hintKey: 'workbench.editors.websocket.headers.hint.origin' },
  VERSION,
  {
    key: 'Accept-Encoding',
    value: 'gzip, deflate, br',
    hintKey: 'workbench.editors.websocket.headers.hint.acceptEncoding',
  },
  { key: 'Accept-Language', hintKey: 'workbench.editors.websocket.headers.hint.acceptLanguage' },
  KEY,
  EXTENSIONS,
];

/** The dialing host's set, in the order it writes them. */
export function wsAutoHeaderDefs(): readonly WsAutoHeaderDef[] {
  return getCapability('requestRuntime')?.() === 'node' ? NODE_AUTO_HEADERS : BROWSER_AUTO_HEADERS;
}
