/**
 * Valibot schema for `WebSocketRequest` — the native WebSocket session
 * entity.
 *
 * Own entity kind beside the HTTP `Request` and `GrpcRequest` (never a
 * discriminant on the HTTP request): session-shaped protocols get
 * their own editor and executor plane. One entity covers the whole
 * wire family — the `flavor` field distinguishes a raw WebSocket
 * session from a Socket.IO one (identical session anatomy: connect,
 * bidirectional messages, close; only the handshake and the compose
 * surface differ), so the creation menu's two entries pre-set the
 * flavor instead of minting sibling entity kinds.
 */

import * as v from 'valibot';
import { PathSegmentSchema, RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import {
  ClientCertificateRefSchema,
  HeartbeatMessageSchema,
  MaxRedirectsSchema,
  MaxResponseBytesSchema,
  ProxyCredentialRefSchema,
  ProxyModeSchema,
  ProxyUrlSchema,
  proxyPairChecks,
  ReconnectMaxAttemptsSchema,
  RequestTimeoutMsSchema,
  ResolveToAddressSchema,
  SniServerNameSchema,
  TlsCipherSuitesSchema,
  TlsVersionSchema,
  UnixSocketPathSchema,
} from './request';
import { WsScriptSlotsSchema } from './script-slots';
import { requestAuthSchemaFor, WEBSOCKET_AUTH_TYPES } from './session-auth';

/**
 * Session target: full `ws://` / `wss://` URL. Kept a plain bounded
 * string (templates welcome — `{{host}}` is the expected idiom); the
 * editor's scheme lock keeps the input honest, and reachability is a
 * connect-time question.
 */
export const MAX_WEBSOCKET_URL_LENGTH = 2_048;

export const WebSocketUrlSchema = v.pipe(v.string(), v.maxLength(MAX_WEBSOCKET_URL_LENGTH));

/**
 * Wire-family discriminant. `raw` composes free-form payloads over the
 * plain WebSocket handshake; `socketio` composes event name +
 * arguments over the engine.io handshake (execution lands with its
 * phase — the field exists from birth so creation gestures persist the
 * user's choice).
 */
export const WebSocketFlavorSchema = v.picklist(['raw', 'socketio']);

/**
 * Socket.IO protocol revision the session speaks (socketio flavor
 * only) — the spec's own numbering. `5` (engine.io 4, `EIO=4`) is
 * what Socket.IO 3.x / 4.x servers speak; `4` (engine.io 3, `EIO=3`)
 * is the 1.x / 2.x wire: the client pings, the root namespace is
 * connected by the server, and CONNECT carries no auth payload.
 * Absent = 5.
 */
export const SocketIoProtocolSchema = v.picklist([4, 5]);

/**
 * One handshake header row. Same row anatomy as `RequestHeaderSchema`:
 * `uid` is the stable per-row identity the sync engine's set-modeled
 * paths key by; two rows may share a `key` but never a `uid`. Custom
 * handshake headers are a node-host capability — the browser's
 * WebSocket constructor cannot set them, so the extension surfaces
 * them honestly instead of silently dropping them.
 */
export const WebSocketHeaderPairSchema = v.object({
  uid: UidSchema,
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
});

/**
 * One query-param row appended to the session URL. Mirrors
 * `QueryParamSchema` including the `hasEquals` round-trip marker (see
 * that schema for why `?key` vs `?key=` must survive the URL sync).
 */
export const WebSocketQueryParamSchema = v.object({
  /** See {@link WebSocketHeaderPairSchema.uid}. */
  uid: UidSchema,
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
  /** Marks the `=` separator as present even when `value` is empty. */
  hasEquals: v.optional(v.boolean()),
});

/**
 * Compose-draft mode for the raw flavor: free text, JSON (structured
 * editor + validation), XML, or HTML (language-mode highlighting) —
 * display-side only, the payload travels verbatim as a text frame —
 * or `binary`, where the compose text is the base64 / hex spelling of
 * the bytes a BINARY frame carries (see
 * {@link WebSocketBinaryEncodingSchema}). Absent = `text`.
 */
export const WebSocketMessageFormatSchema = v.picklist(['text', 'json', 'xml', 'html', 'binary']);

/** The text encoding a `binary` compose authors its bytes in. Absent = `base64`. */
export const WebSocketBinaryEncodingSchema = v.picklist(['base64', 'hex']);

/**
 * Session credential — the request's OWN auth, any type the WebSocket
 * mask carries (`WEBSOCKET_AUTH_TYPES`: bearer · basic · api-key in a
 * header or the handshake URL's query · OAuth 2.0 · JWT Bearer · AWS
 * SigV4 as the signed URL), or `inherit`, resolving through the
 * ancestor pool (`@openheaders/core/auth-inheritance`) under the same
 * mask. The executor mints the wire form per DIAL (a reconnect
 * re-mints): a handshake header (a node-host capability like custom
 * header rows — the browser's WebSocket constructor cannot set it, so
 * page-realm sessions name it in the honesty notice instead of
 * silently dropping), a query pair on the dial URL, or the signed URL
 * itself. The `socketio` flavor ALSO lands a bearer-shaped token
 * (bearer, OAuth 2.0, JWT) as the CONNECT packet's auth payload
 * (`{"token": …}`) — in-band framing that works on every host.
 * Absent = `none`.
 */
export const WebSocketAuthSchema = requestAuthSchemaFor(WEBSOCKET_AUTH_TYPES);

/**
 * One Events-tab row (socketio flavor only): an incoming event the
 * timeline surfaces. `uid` is the stable per-row identity the sync
 * engine's set-modeled paths key by. `listen` gates the DISPLAY of
 * incoming EVENT frames carrying `name` — the capture stays verbatim
 * (the capture law); with no listened rows the timeline shows every
 * frame, so the empty tab changes nothing.
 */
export const WebSocketEventRowSchema = v.object({
  uid: UidSchema,
  name: v.string(),
  /** Show incoming events with this name in the timeline. Absent = on. */
  listen: v.optional(v.boolean()),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
});

/**
 * One Saved-messages rail row — a reusable compose template the
 * session can send as stored. Entity rows (never local rail state):
 * they travel with the workspace, git-sync, and multi-window. `uid`
 * is the stable per-row identity the sync engine's set-modeled paths
 * key by. Carries the compose fields alone — the message text, its
 * mode and byte spelling (absent = text / base64), and the socketio
 * event name — nothing a WebSocket frame does not have.
 */
export const WebSocketSavedMessageSchema = v.object({
  uid: UidSchema,
  name: v.string(),
  message: v.string(),
  messageFormat: v.optional(WebSocketMessageFormatSchema),
  binaryEncoding: v.optional(WebSocketBinaryEncodingSchema),
  /** Socket.IO event name (socketio flavor only). */
  eventName: v.optional(v.string()),
});

/**
 * Binding to the AsyncAPI spec that feeds compose aids — ids-only
 * identity (the spec may be deleted later; the editor derives link
 * health at read time). Same posture as `GrpcSpecLinkSchema`: no
 * `sourceHash` because there is no generation-time state to drift
 * from — the census is rebuilt from the spec's live files at consume.
 */
export const WebSocketSpecLinkSchema = v.object({
  specUid: UidSchema,
});

const WebSocketRequestObjectSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  pathSegment: v.optional(PathSegmentSchema),
  name: v.string(),
  /** Free-form Markdown notes (Docs-tab parity with the HTTP request). */
  description: v.optional(v.string()),
  url: WebSocketUrlSchema,
  flavor: WebSocketFlavorSchema,
  /**
   * Socket.IO namespace the session CONNECTs to (socketio flavor
   * only). Absent or empty = the URL's path, the official client's
   * reading (`ws://host/admin` joins `/admin`); a bare authority joins
   * the root `/`. Templates welcome — resolved at Connect with the
   * other target fields.
   */
  namespace: v.optional(v.string()),
  /**
   * Engine.io handshake path the session dials (socketio flavor
   * only) — the server's mount, never the namespace. Absent or empty
   * = the stock `/socket.io/`. Templates welcome.
   */
  handshakePath: v.optional(v.string()),
  /** Socket.IO protocol revision (socketio flavor only) — see
   *  {@link SocketIoProtocolSchema}. Absent = 5. */
  socketioProtocol: v.optional(SocketIoProtocolSchema),
  /**
   * Wait (ms) for the server's ACK after an event sent with the ack
   * opt-in (socketio flavor only) — the official client's `ackTimeout`
   * default. A spent wait records the ack as timed out in the session
   * (a late ACK still captures verbatim). Absent = wait forever. Same
   * bounds as the connect timeout knob.
   */
  ackTimeoutMs: v.optional(RequestTimeoutMsSchema),
  /**
   * `Sec-WebSocket-Protocol` offer list, in preference order. Plain
   * strings — the server picks one during the handshake. Empty = no
   * subprotocol negotiation. Raw flavor only — engine.io negotiates
   * none, so the socketio flavor never offers a stored list.
   */
  subprotocols: v.array(v.pipe(v.string(), v.minLength(1))),
  headers: v.array(WebSocketHeaderPairSchema),
  params: v.array(WebSocketQueryParamSchema),
  /** Session credential injected at Connect. Absent = none. */
  auth: v.optional(WebSocketAuthSchema),
  /**
   * Events-tab rows (socketio flavor only) — the incoming events the
   * timeline surfaces. Absent or empty = no display filter.
   */
  events: v.optional(v.array(WebSocketEventRowSchema)),
  /** Saved-messages rail rows (set-modeled). Absent or empty = none. */
  savedMessages: v.optional(v.array(WebSocketSavedMessageSchema)),
  /**
   * Compose draft for the next outgoing message. Fans out to the
   * message sibling file on disk (the `message.json` precedent); the
   * manifest never carries it. Empty string = nothing composed yet.
   */
  message: v.string(),
  /**
   * Socket.IO compose: the event name the next Send emits (socketio
   * flavor only — `message` then holds the JSON arguments array).
   * Templates welcome, resolved per send.
   */
  eventName: v.optional(v.string()),
  /**
   * Socket.IO compose: opt-in ack — a Send mints an ack id so the
   * server's ACK reply correlates in the timeline. Absent = off.
   */
  ackEnabled: v.optional(v.boolean()),
  /** Raw-flavor compose mode. Absent = `text`. */
  messageFormat: v.optional(WebSocketMessageFormatSchema),
  /** Byte spelling of a `binary` compose. Absent = `base64`. */
  binaryEncoding: v.optional(WebSocketBinaryEncodingSchema),
  specLink: v.optional(WebSocketSpecLinkSchema),
  /**
   * The request's own session scripts — the WebSocket kinds
   * (`@openheaders/core/scripts` — `WS_SCRIPT_KINDS`: before connect,
   * before send, on message, after close), composed after the
   * ancestor levels' slots of the same kind. Each key fans out to its
   * `<kind>.js` sibling beside `websocket.yaml`; the manifest never
   * carries source. Absent key ↔ no script.
   */
  scripts: v.optional(WsScriptSlotsSchema),
  /**
   * Dial this local socket — an absolute Unix domain socket path or a
   * Windows named pipe (`\\.\pipe\…`) — instead of opening a TCP
   * connection, the HTTP request's knob on the session dial. The URL
   * keeps its scheme and host: the host becomes COSMETIC for dialing,
   * while the handshake `Host`, SNI, and certificate verification
   * still use it — a `wss:` session over the socket verifies against
   * the URL's hostname. Honored by node runtimes; browser runtimes
   * cannot dial local sockets and ignore it (the request still syncs
   * it — one schema, all runtimes carry the value). Validated — see
   * {@link UnixSocketPathSchema}.
   */
  unixSocketPath: v.optional(UnixSocketPathSchema),
  /**
   * Resolve the URL's host to this IPv4 / IPv6 address at connect time
   * instead of asking DNS — the HTTP request's knob on the session dial: SNI,
   * the handshake `Host` and certificate verification keep the ORIGINAL hostname;
   * only where the socket goes changes. Node runtimes only.
   * Pattern-validated — see {@link ResolveToAddressSchema}.
   */
  resolveToAddress: v.optional(ResolveToAddressSchema),
  /**
   * Proxy routing mode for the dial — the HTTP request's knob. Absent =
   * INHERIT the executing host's system plane; `'direct'` opts the
   * session out of any ambient proxy; `'url'` routes through `proxyUrl`.
   * The mode / URL pair is tied by the checks on the persisted schema.
   */
  proxyMode: v.optional(ProxyModeSchema),
  /**
   * Route the dial through this proxy instead of connecting directly —
   * an HTTP CONNECT tunnel, or the SOCKS5 dial — so end-to-end TLS still verifies the TARGET.
   * Incompatible with `resolveToAddress` and `unixSocketPath` (the dial fails
   * naming the conflict). Credentials never ride this URL — see
   * `proxyCredentialRef`. Node runtimes only.
   */
  proxyUrl: v.optional(ProxyUrlSchema),
  /**
   * Vault string entry NAME holding the proxy's `user:password` — sent
   * on the proxy leg only, never to the target. Only meaningful
   * alongside `proxyUrl`; a ref that doesn't resolve on this device
   * fails the dial naming this setting. Node runtimes only.
   */
  proxyCredentialRef: v.optional(ProxyCredentialRefSchema),
  /**
   * Wall-clock ceiling (ms) on the connection handshake — the
   * transport's open deadline. An OPEN session has no ceiling. Same
   * bounds as the HTTP request's timeout knob.
   */
  timeoutMs: v.optional(RequestTimeoutMsSchema),
  /**
   * Cap (bytes) on ONE inbound message. A message over the cap closes
   * the session with 1009 (message too big) naming the cap — the
   * client asked, so auto-reconnect never redials it. Absent = the
   * runtime's own ceiling (the node client assembles up to 128 MiB;
   * the browser client has none). Shares the response-size bounds —
   * see {@link MaxResponseBytesSchema}.
   */
  maxMessageBytes: v.optional(MaxResponseBytesSchema),
  /**
   * Follow a 3xx answer to the handshake (an auth gateway bouncing the
   * upgrade) and dial the Location. Absent = OFF — the WebSocket spec's
   * own rule (a redirected upgrade fails), unlike the HTTP request
   * where absent follows. Node runtimes only; browser clients never
   * follow a handshake redirect.
   */
  followRedirects: v.optional(v.boolean()),
  /**
   * Cap on the handshake redirects followed before the connect fails
   * naming the limit. Only meaningful while `followRedirects` is on.
   * Absent = the runtime default (20). Node runtimes only. Bounded —
   * see {@link MaxRedirectsSchema}.
   */
  maxRedirects: v.optional(MaxRedirectsSchema),
  /**
   * Reopen the session after an OPEN connection drops without the
   * client asking (severed socket, server close, liveness deadline) —
   * redial on the reconnect period until it opens again or the user
   * disconnects. Absent = off. A first connect that fails never
   * retries; a Socket.IO server's own DISCONNECT packet is the one
   * drop that never redials (the server said goodbye on purpose).
   */
  autoReconnect: v.optional(v.boolean()),
  /** Wait (ms) between reconnect attempts. Absent = the runtime's 5 s
   *  reference default. Same bounds as the connect timeout knob. */
  reconnectPeriodMs: v.optional(RequestTimeoutMsSchema),
  /** Cap on consecutive reconnect attempts after one drop — a
   *  reconnect that opens resets the count. Absent = unlimited; a
   *  spent cap settles the session as Reconnect gave up. */
  reconnectMaxAttempts: v.optional(ReconnectMaxAttemptsSchema),
  /** Double the wait per failed attempt up to the runtime's 60 s
   *  ceiling with ±20 % jitter. Absent = ON; `false` = the exact
   *  period every time. */
  reconnectBackoff: v.optional(v.boolean()),
  /**
   * Liveness deadline (ms): no frame arriving for this long closes the
   * connection as lost. Absent = off on the raw flavor; the socketio
   * flavor derives it from the server's handshake (`pingInterval +
   * pingTimeout`, the official client's rule) unless this overrides.
   */
  idleTimeoutMs: v.optional(RequestTimeoutMsSchema),
  /**
   * Application-level heartbeat TEXT frame the raw flavor writes every
   * `heartbeatIntervalMs` — neither WebSocket client can send a control
   * PING, so an LB-friendly keepalive is an app frame. Absent = none.
   * Templates welcome. The socketio flavor never needs one (the
   * engine.io ping is answered).
   */
  heartbeatMessage: v.optional(HeartbeatMessageSchema),
  /** Wait (ms) between heartbeat frames. Absent = the runtime's 30 s
   *  reference default. Meaningful only with `heartbeatMessage`. */
  heartbeatIntervalMs: v.optional(RequestTimeoutMsSchema),
  /**
   * Verify the server certificate against the system roots. Absent =
   * verify (the safe default); `false` accepts self-signed `wss:`
   * servers. Node-host capability, like custom handshake headers.
   */
  sslVerification: v.optional(v.boolean()),
  /**
   * Vault `client-certificate` entry NAME presented in the TLS
   * handshake — mutual-TLS servers. The PEM pair never rides the
   * request; the executor resolves the ref at connect (the HTTP
   * request's contract). Node runtimes only.
   */
  clientCertificateRef: v.optional(ClientCertificateRefSchema),
  /** Lowest TLS version the dial may negotiate — the HTTP request's
   *  knob. Absent = the runtime floor (1.2); `1.0` / `1.1` lower it
   *  for legacy servers. Node runtimes only. */
  tlsMinVersion: v.optional(TlsVersionSchema),
  /** Highest TLS version the dial may negotiate. Absent = the runtime
   *  ceiling (1.3). Node runtimes only. */
  tlsMaxVersion: v.optional(TlsVersionSchema),
  /** Cipher suites offered on the dial, OpenSSL colon-list. Absent =
   *  the runtime's defaults. Node runtimes only. */
  tlsCipherSuites: v.optional(TlsCipherSuitesSchema),
  /** SNI server name override for the TLS dial. Absent = the URL's
   *  host. Templates welcome. Node runtimes only. */
  sniServerName: v.optional(SniServerNameSchema),
});

/** The persisted WebSocketRequest shape with the proxy mode / URL tie
 *  — see {@link proxyPairChecks}. */
export const WebSocketRequestSchema = v.pipe(
  WebSocketRequestObjectSchema,
  ...proxyPairChecks<v.InferOutput<typeof WebSocketRequestObjectSchema>>(),
);

/**
 * Content-only shape (no `schemaVersion` / `uid` / `path`) — the
 * pre-fill handoff unit for the create tab, mirroring `RequestSeedSchema`.
 */
export const WebSocketRequestSeedSchema = v.omit(WebSocketRequestObjectSchema, [
  'schemaVersion',
  'uid',
  'path',
  'pathSegment',
]);
