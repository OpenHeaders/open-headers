/**
 * `(i)` info-popover content for the WebSocket editor's Settings-tab
 * knobs and group headers — the request Settings tab's
 * `SettingsRowInfo` idiom brought to the session: kicker (the group),
 * title (the row's own label), the shared example card with the
 * popover's slice lit, then the knob's copy.
 *
 * Every popover leads with the SAME canonical example session — one
 * CONNECT and what it negotiates — and lights its own token, so
 * reading across the rows builds one coherent picture of a single
 * session seen knob by knob; the group headers light their whole
 * sub-slice, partitioning the card the rows itemize. The card follows
 * the flavor: a raw session offers a subprotocol and sends its own
 * heartbeat; a Socket.IO session mounts a handshake path, joins a
 * namespace, speaks a protocol revision and waits on acks — engine.io
 * answers the pings, so no heartbeat row. The dial leg is the card's
 * one variant slot (the shared `DIAL_LEG_TEXT` vocabulary).
 *
 * The rows of the shared blocks (dial, session resilience, TLS &
 * trust) compose the blocks' own copy — summary, description,
 * glossary — under this editor's card. Card tokens ride raw (wire
 * vocabulary — the column-card precedent); only the caption is
 * localized.
 */

import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import {
  EXAMPLE_CARD_POPOVER_WIDTH,
  ExampleCard,
  type ExampleCardLine,
  type InfoPopoverContent,
} from '@openheaders/ui/shared/info-popover';
import { DIAL_LEG_TEXT, type DialInfoKey, dialRowInfo, isDialInfoKey } from '../shared/dial/dial-row-info';
import {
  isResilienceInfoKey,
  type ResilienceInfoKey,
  resilienceRowInfo,
} from '../shared/resilience/resilience-row-info';
import { isTlsTrustInfoKey, type TlsTrustInfoKey, tlsTrustRowInfo } from '../shared/tls-trust/tls-trust-row-info';
import { WS_GROUP_LABEL_KEY, type WsSettingsGroupKey } from './settings-groups';

/** The session flavor the card follows. */
export type WsFlavor = 'raw' | 'socketio';

/** The editor's own knobs. */
type WsOwnInfoKey =
  | 'subprotocols'
  | 'unixSocket'
  | 'timeout'
  | 'maxMessageSize'
  | 'followRedirects'
  | 'maxRedirects'
  | 'handshakePath'
  | 'namespace'
  | 'socketioProtocol'
  | 'ackTimeout';

/** One key per knob that opens a popover with the card. */
export type WsInfoKey = WsOwnInfoKey | DialInfoKey | TlsTrustInfoKey | ResilienceInfoKey;

/** The single session every popover illustrates — the raw flavor's
 * text; the Socket.IO flavor swaps the URL to the namespace it joins. */
const EX = {
  url: 'wss://api.openheaders.com/v1/stream',
  proto: 'proto: graphql-transport-ws',
  path: 'path: /socket.io/',
  ns: 'ns: /admin',
  protocol: 'v5',
  ack: 'ack ≤ 5 s',
  dial: 'direct',
  dialTimeout: 'dial ≤ 30 s',
  msgCap: 'msg ≤ 2 MB',
  chain: '302 → 101',
  hops: '3 hops',
  deflate: 'deflate: offered',
  transport: 'transport: websocket',
  tlsWindow: 'TLS 1.2–1.3',
  verify: 'verify ✓',
  suite: 'TLS_AES_128_GCM_SHA256',
  cert: 'cert: acme-mtls',
  sni: 'sni: api.openheaders.com',
  reconnect: 'reconnect: every 5 s',
  reconnectLimit: 'retry ≤ 10 · backoff',
  idle: 'idle ≤ 60 s',
  heartbeat: 'heartbeat: ping',
  heartbeatEvery: 'every 30 s',
} as const;

const SOCKETIO_URL = 'wss://api.openheaders.com/admin';

type TokenId = keyof typeof EX;

/** Tokens of the shared example — for the runtime-managed sheet's
 * rows, which map onto slices of the same session. */
export type WsExampleToken = TokenId;

/** Which token of the example each row lights. The TLS window is one
 * token — min and max both light it; the reconnect switch and period
 * share the cadence token, the attempts and backoff the limit token. */
const HIGHLIGHT: Record<WsInfoKey, TokenId> = {
  subprotocols: 'proto',
  resolveToAddress: 'dial',
  proxy: 'dial',
  proxyUrl: 'dial',
  proxyCredentials: 'dial',
  unixSocket: 'dial',
  timeout: 'dialTimeout',
  maxMessageSize: 'msgCap',
  followRedirects: 'chain',
  maxRedirects: 'hops',
  handshakePath: 'path',
  namespace: 'ns',
  socketioProtocol: 'protocol',
  ackTimeout: 'ack',
  sslVerification: 'verify',
  clientCertificate: 'cert',
  tlsMin: 'tlsWindow',
  tlsMax: 'tlsWindow',
  tlsCipherSuites: 'suite',
  sni: 'sni',
  autoReconnect: 'reconnect',
  reconnectPeriod: 'reconnect',
  reconnectMaxAttempts: 'reconnectLimit',
  reconnectBackoff: 'reconnectLimit',
  idleTimeout: 'idle',
  heartbeatMessage: 'heartbeat',
  heartbeatInterval: 'heartbeatEvery',
};

/** Rows that swap the dial slot to their own leg. */
const DIAL_VARIANT: Partial<Record<WsInfoKey, string>> = DIAL_LEG_TEXT;

/** Each group's sub-slice of the example — the union of its rows'
 * tokens, so the group popovers partition the card between them. */
const GROUP_TOKENS: Record<WsSettingsGroupKey, readonly TokenId[]> = {
  connection: ['proto', 'dial', 'dialTimeout', 'msgCap', 'chain', 'hops', 'deflate'],
  resilience: ['reconnect', 'reconnectLimit', 'idle', 'heartbeat', 'heartbeatEvery'],
  socketio: ['path', 'ns', 'protocol', 'ack', 'transport'],
  tls: ['tlsWindow', 'verify', 'suite', 'cert', 'sni'],
};

function WsExampleCard({
  lit,
  flavor,
  dialText,
}: {
  lit: ReadonlySet<TokenId>;
  flavor: WsFlavor;
  dialText?: string;
}) {
  const t = useT();
  const tok = (id: TokenId, text: string = EX[id]) => ({ id, text });
  const socketio = flavor === 'socketio';
  const lines: ExampleCardLine<TokenId>[] = [
    {
      opener: 'CONNECT',
      tokens: socketio
        ? [tok('url', SOCKETIO_URL), tok('path'), tok('ns'), tok('protocol'), tok('ack')]
        : [tok('url'), tok('proto')],
    },
    {
      tokens: [
        tok('dial', dialText),
        tok('dialTimeout'),
        tok('msgCap'),
        tok('chain'),
        tok('hops'),
        tok('deflate'),
        ...(socketio ? [tok('transport')] : []),
      ],
    },
    { tokens: [tok('tlsWindow'), tok('verify'), tok('suite'), tok('cert'), tok('sni')] },
    {
      tokens: [
        tok('reconnect'),
        tok('reconnectLimit'),
        tok('idle'),
        ...(socketio ? [] : [tok('heartbeat'), tok('heartbeatEvery')]),
      ],
    },
  ];
  return <ExampleCard caption={t('workbench.editors.websocket.settings.exampleCaption')} lines={lines} lit={lit} />;
}

/** The shared example card with an arbitrary slice lit — the
 * runtime-managed sheet's rows ride this so managed facts and live
 * knobs illustrate the same session. */
export function wsExampleCard(lit: readonly WsExampleToken[], flavor: WsFlavor): React.ReactElement {
  return <WsExampleCard lit={new Set(lit)} flavor={flavor} />;
}

const TITLE_KEY: Record<WsOwnInfoKey, MessageKey> = {
  subprotocols: 'workbench.editors.websocket.settings.subprotocolsLabel',
  unixSocket: 'workbench.editors.websocket.settings.unixSocketLabel',
  timeout: 'workbench.editors.websocket.settings.timeoutLabel',
  maxMessageSize: 'workbench.editors.request.settings.maxMessageSize',
  followRedirects: 'workbench.editors.request.settings.followRedirects',
  maxRedirects: 'workbench.editors.request.settings.maxRedirects',
  handshakePath: 'workbench.editors.websocket.settings.handshakePathLabel',
  namespace: 'workbench.editors.websocket.settings.namespaceLabel',
  socketioProtocol: 'workbench.editors.websocket.settings.socketioProtocolLabel',
  ackTimeout: 'workbench.editors.websocket.settings.ackTimeoutLabel',
};

const SUMMARY_KEY: Record<WsOwnInfoKey, MessageKey> = {
  subprotocols: 'workbench.editors.websocket.settings.subprotocolsHelp',
  unixSocket: 'workbench.editors.websocket.settings.unixSocketHelp',
  timeout: 'workbench.editors.websocket.settings.timeoutHelp',
  maxMessageSize: 'workbench.editors.request.settings.maxMessageSizeInfo',
  followRedirects: 'workbench.editors.request.settings.followRedirectsWsInfo',
  maxRedirects: 'workbench.editors.request.settings.maxRedirectsWsInfo',
  handshakePath: 'workbench.editors.websocket.settings.handshakePathHelp',
  namespace: 'workbench.editors.websocket.settings.namespaceHelp',
  socketioProtocol: 'workbench.editors.websocket.settings.socketioProtocolHelp',
  ackTimeout: 'workbench.editors.websocket.settings.ackTimeoutHelp',
};

const GROUP_OF: Record<WsInfoKey, WsSettingsGroupKey> = {
  subprotocols: 'connection',
  resolveToAddress: 'connection',
  proxy: 'connection',
  proxyUrl: 'connection',
  proxyCredentials: 'connection',
  unixSocket: 'connection',
  timeout: 'connection',
  maxMessageSize: 'connection',
  followRedirects: 'connection',
  maxRedirects: 'connection',
  handshakePath: 'socketio',
  namespace: 'socketio',
  socketioProtocol: 'socketio',
  ackTimeout: 'socketio',
  sslVerification: 'tls',
  clientCertificate: 'tls',
  tlsMin: 'tls',
  tlsMax: 'tls',
  tlsCipherSuites: 'tls',
  sni: 'tls',
  autoReconnect: 'resilience',
  reconnectPeriod: 'resilience',
  reconnectMaxAttempts: 'resilience',
  reconnectBackoff: 'resilience',
  idleTimeout: 'resilience',
  heartbeatMessage: 'resilience',
  heartbeatInterval: 'resilience',
};

const GROUP_SUMMARY_KEY: Record<WsSettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.websocket.settings.groupInfo.connection',
  resilience: 'workbench.editors.websocket.settings.groupInfo.resilience',
  socketio: 'workbench.editors.websocket.settings.groupInfo.socketio',
  tls: 'workbench.editors.websocket.settings.groupInfo.tls',
};

/** Popover content for a Settings-tab group header: the group's whole
 * sub-slice of the shared example lit at once. */
export function wsSettingsGroupInfo(t: Translate, group: WsSettingsGroupKey, flavor: WsFlavor): InfoPopoverContent {
  return {
    title: t(WS_GROUP_LABEL_KEY[group]),
    kicker: t('workbench.editors.websocket.tab.settings'),
    diagram: <WsExampleCard lit={new Set(GROUP_TOKENS[group])} flavor={flavor} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
    summary: t(GROUP_SUMMARY_KEY[group]),
  };
}

/** Popover content for one WebSocket knob. */
export function wsSettingsRowInfo(t: Translate, infoKey: WsInfoKey, flavor: WsFlavor): InfoPopoverContent {
  const kicker = t(WS_GROUP_LABEL_KEY[GROUP_OF[infoKey]]);
  const card = {
    diagram: <WsExampleCard lit={new Set([HIGHLIGHT[infoKey]])} flavor={flavor} dialText={DIAL_VARIANT[infoKey]} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
  };
  if (isDialInfoKey(infoKey)) return { ...dialRowInfo(t, infoKey, kicker), ...card };
  if (isTlsTrustInfoKey(infoKey)) return { ...tlsTrustRowInfo(t, infoKey, kicker), ...card };
  if (isResilienceInfoKey(infoKey)) return { ...resilienceRowInfo(t, infoKey, kicker, flavor), ...card };
  return { title: t(TITLE_KEY[infoKey]), kicker, summary: t(SUMMARY_KEY[infoKey]), ...card };
}
