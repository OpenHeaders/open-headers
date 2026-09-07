/**
 * WebSocket session executor — host-neutral orchestration of one live
 * session: resolve `{{ref}}` templates through the SAME 4-scope
 * pipeline HTTP sends ride (url + headers + params at Connect; the
 * compose text per Send through the retained resolver — or through a
 * host-injected {@link ExecuteWsSessionOptions.resolution} closure on
 * surfaces whose scopes live outside the module mirrors), hand the
 * socket to the injected {@link WsTransport}, feed the flush-batched
 * `wsStreamEvent` emitter, and settle with an
 * {@link ExecutedWsSnapshot} when the session ends.
 *
 * Failure discipline: everything that can go wrong before the wire —
 * an empty or non-ws(s) URL, unresolved variables — returns a
 * STRUCTURED failed-outcome snapshot naming the gap, never a throw.
 * On the wire, only a session that never opened settles `failed` (or
 * `aborted` on a user stop); once open, the close record (or its
 * honest `null`) is the story.
 *
 * The sendId spine is the HTTP executor's: the caller-minted id
 * registers a Stop hook on the shared active-send registry
 * (`abortRequestSend` = Stop-abort, materializes what arrived) and
 * keys the active-session registry the `sendWsMessage` /
 * `closeWsSession` riders reach — Disconnect is the clean close 1000.
 *
 * Capture law with the ratified rolling retention: payloads verbatim
 * (text/binary tagged), BOTH directions in call order, close code +
 * reason verbatim (`null` when no Close frame arrived — the
 * platform's 1006 marker records that absence, never a wire fact);
 * the session stays open however chatty the server is, the capture
 * keeps the most RECENT messages under the byte/count caps, and
 * `droppedMessages` counts what rolled off — honest, never silent.
 *
 * Session resilience (the MQTT executor's reconnect plane, lifted):
 * once a session OPENED, a connection that drops without the client
 * asking — severed socket, server close, the liveness deadline — logs
 * a `lost` fact and, when the entity asks, the driver redials on the
 * reconnect period until a handshake settles again (`reconnected`),
 * the attempt cap is spent (`reconnectExhausted` on the snapshot), or
 * the user ends the session. The wait is the period, or doubles per
 * failed attempt under backoff (`reconnect-policy.ts`, the one law).
 * The facts ride `lifecycle` with the message index they happened at,
 * so the timeline interleaves them at their true positions while the
 * message capture stays positional. A first connect that fails never
 * retries; a Socket.IO server DISCONNECT packet is the one drop that
 * never redials (the official client's rule — the server said goodbye
 * on purpose). Liveness: `idleTimeoutMs` closes a connection no frame
 * reached in time; the socketio flavor derives the deadline from the
 * handshake's ping cadence when the entity names none. Heartbeat: the
 * raw flavor writes `heartbeatMessage` on its interval through the
 * same captured send path — neither WebSocket client can send a
 * control PING, so an LB keepalive is an app frame everywhere.
 *
 * GraphQL subscriptions (the GraphQL client's Phase H): a session
 * carrying a `graphql` plan mounts the `graphql-transport-ws` client
 * above the same seam — the envelope's texts resolve with the other
 * Connect-time templates, `connection_init` leaves on open with the
 * session credential's minted headers as its payload, the ack
 * subscribes, pings pong, and the server's `complete` / `error` (or
 * the Disconnect rider's Stop, after the client's own `complete`)
 * ends the session on the clean close. The derived request never asks
 * for a reconnect, so the plane's resilience never redials one.
 */

import type { AuthCarrier } from '@openheaders/core/auth-inheritance';
import type { WsSendBinaryWire, WsSendSocketIoWire, WsStreamEventWire } from '@openheaders/core/bridge';
import { type GraphqlWsSubscriptionPlan, graphqlWsSubscribePayload } from '@openheaders/core/graphql';
import type { WsOutboundMessageSnapshot, WsScriptKind } from '@openheaders/core/scripts';
import type { SettingsCarrier } from '@openheaders/core/settings-inheritance';
import {
  encodeEventPacket,
  isValidNamespace,
  resolveSocketIoTarget,
  SOCKET_IO_DEFAULT_PROTOCOL,
  type SocketIoDialTarget,
} from '@openheaders/core/socketio';
import type {
  ExecutedProxyRoute,
  ExecutedWsAckTimeout,
  ExecutedWsClose,
  ExecutedWsLifecycle,
  ExecutedWsLost,
  ExecutedWsMessage,
  ExecutedWsReconnected,
  ExecutedWsReconnecting,
  ExecutedWsScriptMark,
  ExecutedWsSnapshot,
  TrustCertificateErrorHint,
  Vault,
  WebSocketRequest,
} from '@openheaders/core/types';
import { appendQueryParams, decodeBase64Bytes, decodeBinaryText, encodeBase64Bytes } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { peekActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { sessionDialPolicy } from '../dial-policy';
import { DEFAULT_HEARTBEAT_INTERVAL_MS, DEFAULT_RECONNECT_PERIOD_MS, reconnectDelayMs } from '../reconnect-policy';
import { collectionUidForRequest, resolveRequestSettings, resolveSessionAuth } from '../request-exec/ancestor-chain';
import type { OAuthRefreshFn } from '../request-exec/oauth2-bundle';
import { buildResolver } from '../request-exec/resolver-scope';
import { collectSlotChain, composeSlotChain, type SlotChainCarrier } from '../request-exec/script-chain';
import { parseUrlParams, type SessionScriptHost } from '../request-exec/script-hooks';
import { registerActiveSend } from '../request-exec/send-stream';
import { hasSessionScriptChains } from '../request-exec/session-script-plane';
import { mintSessionCredential, resolveSessionCredential } from '../session-credential';
import { sessionTlsPolicy } from '../tls-policy';
import { getTrustAnchorsForSend } from '../trust-anchors';
import { createGraphqlWsSessionController } from './graphql-ws-session';
import { createWsScriptPlane, type WsScriptChains } from './script-plane';
import { createWsStreamEmitter, registerActiveWsSession, type WsSendResult } from './session-plane';
import { createSocketIoSessionController } from './socketio-session';
import type { WsSessionWriter, WsTransport, WsTransportError, WsTransportHeader } from './transport';

/** Rolling-retention caps on the captured payload bytes / message
 *  count — the always-on host never buffers unbounded, and unlike the
 *  gRPC byte cap the session is NOT aborted past them: the oldest
 *  messages roll off and `droppedMessages` records the truncation. */
const MAX_CAPTURE_BYTES = 2 * 1024 * 1024;
const MAX_CAPTURE_MESSAGES = 10_000;

/** Handshake fields the platform socket owns — user rows carrying
 *  them are dropped rather than colliding with the upgrade ceremony
 *  (subprotocols ride the entity's own field, never a raw header). */
const RESERVED_HEADER_KEYS = new Set(['host', 'upgrade', 'connection']);

/** The platform's "no Close frame" marker — never sent on the wire by
 *  spec, so its arrival records the ABSENCE of a close handshake. */
const NO_CLOSE_FRAME_CODE = 1006;

/** The clean close Disconnect sends. */
export const WS_DISCONNECT_CODE = 1000;
/** The Close code a message over the request's size cap ends the
 *  session with — RFC 6455 §7.4.1 Message Too Big. The client asked,
 *  so the end is never a `lost` drop and auto-reconnect never redials
 *  it; the peer's Close answer is the record, verbatim. */
export const WS_MESSAGE_TOO_BIG_CODE = 1009;

export interface ExecuteWsSessionOptions {
  /** `null` = the runtime-Active workspace via the module mirrors;
   *  a string pins that workspace's scopes (forwarded sends). */
  workspaceId: string | null;
  /** Tri-state: string pins an env, explicit `null` resolves with no
   *  environment, absent defers to the scope's active pointer. */
  environmentId: string | null | undefined;
  /** Host wire capability. */
  transport: WsTransport;
  /** Caller-minted id — Stop hook on the shared active-send registry
   *  + the rider registry key. REQUIRED: a session is interactive by
   *  nature, there is no fire-and-forget leg. */
  sendId: string;
  /** Live-frame sink (`wsStreamEvent` broadcasts). */
  emitStreamEvent?: (event: WsStreamEventWire) => void;
  /**
   * Host-injected template resolution — for surfaces whose variable
   * scopes live OUTSIDE the oracle module mirrors (the extension
   * workbench page executes in-page against the renderer mirrors, so
   * the oracle entity stores are empty there). When present the
   * executor builds NO resolver of its own: this function resolves
   * every Connect-time template (url / headers / params) AND each
   * per-send rider message, adding every unresolved reference name to
   * the caller's set. `workspaceId` / `environmentId` are then the
   * injector's concern — the closure carries its own scope context.
   */
  resolution?: (template: string, unresolved: Set<string>) => string;
  /** Host-injected ancestor auth chain (outer → inner) — for page
   *  realms whose oracle mirrors are empty (the `resolution` twin);
   *  absent = the executor walks the tree index. */
  authChain?: readonly AuthCarrier[];
  /** Host-injected ancestor settings carriers (outer → inner) — for
   *  page realms whose oracle mirrors are empty (the `authChain` twin);
   *  absent = the executor walks the tree index. */
  settingsChain?: readonly SettingsCarrier[];
  /** The backoff jitter draw, [0, 1) — `Math.random` unless a test
   *  pins the wait. */
  reconnectJitter?: () => number;
  /** Host hook renewing an expired OAuth 2.0 token before a dial
   *  attaches it; absent = the stored bundle attaches as it is (the
   *  page realm's posture — its background scheduler keeps it fresh). */
  refreshOAuth?: OAuthRefreshFn;
  /** Host script capability — the session's hooks (Before connect /
   *  Before send / On message / After close) run through it; absent =
   *  the session runs scriptless and records no script outcome. */
  scriptHost?: SessionScriptHost;
  /** Host-injected ancestor script carriers (outer → inner) — for page
   *  realms whose oracle mirrors are empty (the `authChain` twin);
   *  absent = the executor walks the tree index per slot kind. */
  scriptChain?: readonly SlotChainCarrier[];
  /**
   * Mount the `graphql-transport-ws` client above the session — the
   * GraphQL request's subscription plan (`compileGraphqlSubscription`),
   * its envelope texts resolved here with the other Connect-time
   * templates. Absent = a plain session.
   */
  graphql?: GraphqlWsSubscriptionPlan;
}

/** The four hooks' chains for the request — the ancestor levels'
 *  slots (injected, or off the tree index) onto the request's own. */
function wsScriptChains(request: WebSocketRequest, options: ExecuteWsSessionOptions): WsScriptChains {
  const compose = (kind: WsScriptKind) =>
    options.scriptChain !== undefined
      ? composeSlotChain(options.scriptChain, request, kind)
      : collectSlotChain(request, options.workspaceId, kind);
  return {
    'ws-before-connect': compose('ws-before-connect'),
    'ws-before-send': compose('ws-before-send'),
    'ws-on-message': compose('ws-on-message'),
    'ws-after-close': compose('ws-after-close'),
  };
}

export async function executeWsSession(
  request: WebSocketRequest,
  options: ExecuteWsSessionOptions,
): Promise<ExecutedWsSnapshot> {
  // ── Variable resolution (the HTTP sends' exact pipeline) ──
  // An injected resolution short-circuits the oracle-side resolver
  // entirely — the host's closure carries its own scope context (and
  // no vault: the client-certificate ref then passes through bare).
  const oracleResolution = options.resolution === undefined ? await buildOracleResolution(request, options) : null;
  const resolveWith = options.resolution ?? oracleResolution?.resolve;
  if (resolveWith === undefined) return errorWsSnapshot('No template resolution available for this session.');
  // The workspace trust list rides every dial — the pin the scope
  // resolved against, else the runtime-Active one.
  const trustedRootsPem = getTrustAnchorsForSend(options.workspaceId ?? peekActiveWorkspaceId())?.pems;

  const unresolved = new Set<string>();
  const resolveStr = (s: string): string => resolveWith(s, unresolved);
  // The settings knobs cascade over the ancestor chain — the request's
  // own defined knob wins, an absent one reads the nearest ancestor
  // that sets it (THE core rule; the injected chain serves page realms
  // whose oracle mirrors are empty). Every knob below reads the
  // EFFECTIVE value; the ancestor-supplied ones stamp the snapshot.
  const { settings, attribution: inheritedSettings } = resolveRequestSettings(
    'websocket',
    request,
    options.workspaceId,
    options.settingsChain,
  );
  const tlsPolicy = sessionTlsPolicy({
    request: settings,
    trustedRootsPem,
    vault: oracleResolution?.vault,
    resolve: resolveStr,
  });
  const dialPolicy = sessionDialPolicy(settings, oracleResolution?.vault);

  let url = resolveStr(request.url).trim();
  // Session credential — the request's own subset config, or Inherit
  // resolved over the ancestor pool chain (THE core rule; the injected
  // chain serves page realms whose oracle mirrors are empty). A
  // resolved type outside the WebSocket mask fails the Connect by
  // NAME — never a silent none. Fields resolve with the other
  // Connect-time templates; an empty resolved credential reads as
  // none (partial configs stay saveable — the HTTP auth block's
  // posture). An explicit user row carrying the credential's header
  // takes precedence (the gRPC auth block's law), so one value rides
  // the wire either way.
  const sessionAuth = resolveSessionAuth(
    'websocket',
    { uid: request.uid, path: request.path, url, auth: request.auth },
    options.workspaceId,
    options.authChain,
  );
  const authAttribution = sessionAuth.attribution;
  // Every settle path stamps the resolve-time attributions — the auth
  // the session applied and the settings an ancestor supplied.
  const withAttribution = (snapshot: ExecutedWsSnapshot): ExecutedWsSnapshot => ({
    ...snapshot,
    ...(authAttribution !== undefined ? { auth: authAttribution } : {}),
    ...(inheritedSettings !== undefined ? { inheritedSettings } : {}),
  });
  if (sessionAuth.refusal !== null) return withAttribution(errorWsSnapshot(sessionAuth.refusal));
  // The credential resolves HERE with the other Connect-time templates
  // (an unresolved reference gates the session below) and MINTS at
  // each dial: a static pair is itself, an OAuth 2.0 token is the
  // store's current bundle, a JWT stamps the dial's clock, an AWS
  // signature covers the dial URL — so an auto-reconnect never redials
  // on a stale credential.
  const credential = resolveSessionCredential(sessionAuth.auth, resolveStr);
  const headers: WsTransportHeader[] = [];
  for (const row of request.headers) {
    if (row.enabled === false || !row.key.trim()) continue;
    const key = resolveStr(row.key);
    if (key.toLowerCase().startsWith('sec-websocket-') || RESERVED_HEADER_KEYS.has(key.toLowerCase())) continue;
    headers.push({ key, value: resolveStr(row.value) });
  }
  // Socket.IO flavor: the namespace, handshake path and protocol
  // revision resolve with the other target fields; the framing
  // controller CONNECTs the namespace once the engine.io open packet
  // arrives. engine.io negotiates no subprotocol — a stored offer is a
  // raw-flavor knob the socketio flavor never puts on the wire.
  const socketioFlavor = request.flavor === 'socketio';
  const socketioSettings = {
    namespace: socketioFlavor ? resolveStr(request.namespace ?? '') : '',
    handshakePath: socketioFlavor ? resolveStr(settings.handshakePath ?? '') : '',
    protocol: settings.socketioProtocol ?? SOCKET_IO_DEFAULT_PROTOCOL,
  };
  const subprotocols = socketioFlavor ? [] : request.subprotocols;
  // The handshake request headers as this executor composed them —
  // the user rows and the credential minted at the dial, plus the
  // subprotocol offer the transport writes from its own field; the
  // platform socket adds its own on top. Stamped on the open frame
  // and the snapshot so the timeline's Connected row reads what left;
  // restamped by every dial (a reconnect re-mints the credential).
  const subprotocolOffer =
    subprotocols.length > 0 ? [{ key: 'Sec-WebSocket-Protocol', value: subprotocols.join(', ') }] : [];
  let requestHeaders = [...headers, ...subprotocolOffer];
  const params = request.params
    .filter((p) => p.enabled !== false && p.key.trim() !== '')
    .map((p) => ({ ...p, key: resolveStr(p.key), value: resolveStr(p.value) }));
  // The heartbeat frame is a raw-flavor knob (engine.io answers its
  // own pings); resolved with the other Connect-time templates.
  const heartbeatMessage =
    !socketioFlavor && settings.heartbeatMessage !== undefined ? resolveStr(settings.heartbeatMessage) : '';
  // The subscription envelope resolves with the other Connect-time
  // templates — the document and the variables text (an unresolved
  // reference gates the session below, the HTTP send's law).
  const graphqlPlan =
    options.graphql !== undefined
      ? {
          query: resolveStr(options.graphql.query),
          ...(options.graphql.variables !== undefined ? { variables: resolveStr(options.graphql.variables) } : {}),
          ...(options.graphql.operationName !== undefined ? { operationName: options.graphql.operationName } : {}),
        }
      : null;
  let namespace = '/';
  if (unresolved.size > 0) {
    return withAttribution(
      errorWsSnapshot(
        `Request has unresolved variables (${[...unresolved].join(', ')}). Define them in vault, environment, collection, or workspace before connecting.`,
      ),
    );
  }
  if (url === '') return withAttribution(errorWsSnapshot('URL is empty'));
  if (!/^wss?:\/\//i.test(url)) {
    return withAttribution(errorWsSnapshot('The URL must start with ws:// or wss://.'));
  }
  if (params.length > 0) url = appendQueryParams(url, params);
  if (socketioFlavor) {
    // The engine.io dial: the handshake path mounts (default
    // /socket.io/), the URL path names the namespace unless the
    // setting overrides it, EIO + transport join after any user params.
    let target: SocketIoDialTarget;
    try {
      target = resolveSocketIoTarget(url, socketioSettings);
    } catch {
      return withAttribution(errorWsSnapshot('The URL is not valid.'));
    }
    if (!isValidNamespace(target.namespace)) {
      return withAttribution(errorWsSnapshot('The Socket.IO namespace must not contain a comma.'));
    }
    url = target.url;
    namespace = target.namespace;
  }
  /** The URL the last dial went to — the base URL with the credential
   *  the dial minted onto it; what the open frame and snapshot carry. */
  let dialUrl = url;
  const tokenWorkspaceId = options.workspaceId ?? undefined;
  const autoReconnect = settings.autoReconnect === true;
  const reconnectPeriodMs = settings.reconnectPeriodMs ?? DEFAULT_RECONNECT_PERIOD_MS;
  const reconnectMaxAttempts = settings.reconnectMaxAttempts;
  const reconnectBackoff = settings.reconnectBackoff !== false;
  const reconnectJitter = options.reconnectJitter ?? Math.random;
  const idleTimeoutMs = settings.idleTimeoutMs;
  const heartbeatIntervalMs = settings.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const maxMessageBytes = settings.maxMessageBytes;
  // ── Script hooks — mounted only where a host runs scripts AND some
  // level carries one; a scriptless session never touches the plane.
  const scriptChains = options.scriptHost !== undefined ? wsScriptChains(request, options) : null;
  const scriptHost = scriptChains !== null && hasSessionScriptChains(scriptChains) ? options.scriptHost : undefined;

  // ── The live session on the sendId spine ──
  return new Promise<ExecutedWsSnapshot>((resolveRaw) => {
    const resolve = (snapshot: ExecutedWsSnapshot): void => resolveRaw(withAttribution(snapshot));
    const emitter =
      options.emitStreamEvent !== undefined ? createWsStreamEmitter(options.sendId, options.emitStreamEvent) : null;
    let stopped = false;
    /** The session opened at least once — the outcome is `connected`
     *  however the (last) connection later ended. */
    let opened = false;
    let protocol = '';
    let extensions = '';
    let proxyRoute: ExecutedProxyRoute | undefined;
    let close: ExecutedWsClose | null = null;
    let reconnectExhausted: ExecutedWsSnapshot['reconnectExhausted'];
    let settled = false;
    const messages: ExecutedWsMessage[] = [];
    const lifecycle: ExecutedWsLifecycle[] = [];
    let capturedBytes = 0;
    let droppedMessages = 0;
    const startedAt = performance.now();

    // ── Reconnect plane ──
    // 0 while the first connection is up; the attempt number once a
    // dropped connection put auto-reconnect in charge. The wait timer
    // is armed between attempts; Stop / Disconnect clear it and settle
    // — nothing is on the wire then, so the end reads Stopped.
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    /** Fire the armed attempt ahead of its wait — set while the timer
     *  is armed, the `reconnectWsSessionNow` rider's hook. */
    let fireReconnectNow: (() => void) | null = null;

    // ── Per-connection state — reset on every (re)dial ──
    /** THIS connection's handshake settled. */
    let attemptOpened = false;
    /** The client asked for this connection's close (Disconnect). */
    let closeRequested = false;
    /** The liveness deadline closed this connection. */
    let idleTripped = false;
    /** The Socket.IO server ended the namespace on purpose. */
    let serverGoodbye = false;
    let writer: WsSessionWriter | null = null;
    /** One abort per connection — the Stop hook aborts the current
     *  one; a redial mints a fresh signal. */
    let connectionController = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    /** The liveness deadline in force on this connection: the entity's
     *  knob, else the socket.io handshake's cadence, else none. */
    let idleDeadlineMs: number | undefined = idleTimeoutMs;

    const record = (message: ExecutedWsMessage, byteLength: number): void => {
      messages.push(message);
      capturedBytes += byteLength;
      while (messages.length > 0 && (capturedBytes > MAX_CAPTURE_BYTES || messages.length > MAX_CAPTURE_MESSAGES)) {
        const rolled = messages.shift();
        if (rolled === undefined) break;
        capturedBytes -= byteLengthOfBase64(rolled.dataBase64);
        droppedMessages += 1;
      }
    };
    /** One session fact at the capture's current index — the
     *  count of every message captured before it, rolled-off ones
     *  included, so live and materialized positions agree. */
    const recordLifecycle = (
      fact:
        | ExecutedWsLost
        | ExecutedWsReconnecting
        | ExecutedWsReconnected
        | ExecutedWsAckTimeout
        | ExecutedWsScriptMark,
    ): void => {
      const item: ExecutedWsLifecycle = { ...fact, atIndex: messages.length + droppedMessages };
      lifecycle.push(item);
      emitter?.lifecycle(item);
    };
    // The script plane — every hook's mark lands on the timeline at
    // the capture's current index like any other session fact.
    const scripts =
      scriptHost !== undefined && scriptChains !== null
        ? createWsScriptPlane({
            sessionId: options.sendId,
            host: scriptHost,
            chains: scriptChains,
            recordMark: recordLifecycle,
          })
        : null;

    const clearIdleTimer = (): void => {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = null;
    };
    /** (Re)arm the liveness deadline — on open and on every inbound
     *  frame; a deadline that runs out tears the connection down as
     *  lost (the abort settles through `onEnd` with no error). */
    const armIdleTimer = (): void => {
      clearIdleTimer();
      if (idleDeadlineMs === undefined || !attemptOpened) return;
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (settled || !attemptOpened) return;
        idleTripped = true;
        connectionController.abort();
      }, idleDeadlineMs);
    };
    const clearConnectionTimers = (): void => {
      clearIdleTimer();
      if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    };
    const clearReconnectTimer = (): void => {
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      fireReconnectNow = null;
    };
    const resetConnectionState = (): void => {
      clearConnectionTimers();
      attemptOpened = false;
      closeRequested = false;
      idleTripped = false;
      serverGoodbye = false;
      writer = null;
      close = null;
      connectionController = new AbortController();
      idleDeadlineMs = idleTimeoutMs;
      socketioSession?.resetConnection();
    };

    const unregisterSend = registerActiveSend(options.sendId, () => {
      stopped = true;
      connectionController.abort();
      // Between attempts nothing is dialing — the abort has no socket
      // to settle through, so settle here.
      if (reconnectTimer !== null) {
        clearReconnectTimer();
        settle();
      }
    });
    let unregisterSession: (() => void) | null = null;

    const settle = (errorMessage?: string, hint?: TrustCertificateErrorHint): void => {
      if (settled) return;
      settled = true;
      clearConnectionTimers();
      clearReconnectTimer();
      socketioSession?.resetConnection();
      unregisterSend();
      unregisterSession?.();
      const durationMs = Math.round(performance.now() - startedAt);
      // The record settles once the After close hook has run (a session
      // that opened) and every queued hook landed its mark — the end
      // frame and the snapshot's `scripts` record follow them.
      const finish = (): void => {
        emitter?.end();
        const scriptsRecord = scripts?.summary();
        scripts?.end();
        const withScripts = (snapshot: ExecutedWsSnapshot): ExecutedWsSnapshot =>
          scriptsRecord !== undefined ? { ...snapshot, scripts: scriptsRecord } : snapshot;
        if (!opened) {
          // A user Stop-abort before the handshake completed settles as
          // the ABORTED outcome, not a failure.
          // The dial's facts ride the failure too — the timeline's error
          // row names the peer and the handshake it attempted.
          resolve(
            withScripts({
              ...errorWsSnapshot(errorMessage ?? 'The session ended before it opened.', hint),
              url: dialUrl,
              requestHeaders,
              ...(stopped ? { outcome: { kind: 'aborted' as const } } : {}),
              ...(lifecycle.length > 0 ? { lifecycle } : {}),
              durationMs,
            }),
          );
          return;
        }
        resolve(
          withScripts({
            outcome: { kind: 'connected' },
            url: dialUrl,
            requestHeaders,
            protocol,
            extensions,
            messages,
            droppedMessages,
            close,
            ...(lifecycle.length > 0 ? { lifecycle } : {}),
            ...(reconnectExhausted !== undefined ? { reconnectExhausted } : {}),
            ...(stopped ? { stopped: true } : {}),
            durationMs,
            ...(proxyRoute !== undefined ? { proxyRoute } : {}),
          }),
        );
      };
      if (scripts === null || !opened) {
        finish();
        return;
      }
      void scripts
        .afterClose({
          code: close?.code ?? null,
          reason: close?.reason ?? '',
          wasClean: close?.wasClean ?? false,
          stopped,
          messages: messages.length + droppedMessages,
          droppedMessages,
          durationMs,
        })
        .then(finish, finish);
    };

    // One write path for riders AND protocol frames — every ↑ frame is
    // captured and broadcast verbatim, socket.io control answers
    // (CONNECT, pong) and the heartbeat included.
    const sendText = (text: string): void => {
      if (writer === null || settled || !attemptOpened) return;
      writer.send(text);
      const data = new TextEncoder().encode(text);
      const dataBase64 = encodeBase64Bytes(data);
      record({ direction: 'up', dataBase64, binary: false }, data.byteLength);
      emitter?.message({ direction: 'up', dataBase64, binary: false, atMs: Date.now() });
    };
    // The binary twin — one frame of decoded bytes; a transport without
    // the optional writer cannot carry it and says so on the rider.
    const sendBinary = (data: Uint8Array): { success: boolean; error?: string } => {
      if (writer === null || settled || !attemptOpened) return { success: false, error: 'The session is not open.' };
      if (writer.sendBinary === undefined) {
        return { success: false, error: 'This host cannot send binary frames.' };
      }
      writer.sendBinary(data);
      const dataBase64 = encodeBase64Bytes(data);
      record({ direction: 'up', dataBase64, binary: true }, data.byteLength);
      emitter?.message({ direction: 'up', dataBase64, binary: true, atMs: Date.now() });
      return { success: true };
    };
    const startHeartbeat = (): void => {
      if (heartbeatMessage === '') return;
      heartbeatTimer = setInterval(() => sendText(heartbeatMessage), heartbeatIntervalMs);
    };
    // The socketio flavor ALSO lands a bearer-shaped token (bearer,
    // OAuth 2.0, JWT) as the CONNECT packet's auth payload — in-band
    // framing, so it works on hosts whose platform socket cannot carry
    // the header; read at each connection's CONNECT from the dial's
    // mint.
    let connectBearerToken: string | undefined;
    const connectAuthJson = (): string | undefined =>
      connectBearerToken !== undefined ? JSON.stringify({ token: connectBearerToken }) : undefined;
    const socketioSession = socketioFlavor
      ? createSocketIoSessionController(
          namespace,
          sendText,
          {
            protocol: socketioSettings.protocol,
            connectAuthJson,
            ...(settings.ackTimeoutMs !== undefined ? { ackTimeoutMs: settings.ackTimeoutMs } : {}),
          },
          {
            onHandshake: ({ pingIntervalMs, pingTimeoutMs }) => {
              // The official client's liveness rule on either
              // revision: a ping (the server's on v5, the client's
              // pong on v4) is due every pingInterval and may run
              // pingTimeout late.
              if (idleTimeoutMs !== undefined || pingIntervalMs === undefined || pingTimeoutMs === undefined) return;
              idleDeadlineMs = pingIntervalMs + pingTimeoutMs;
              armIdleTimer();
            },
            onServerDisconnect: () => {
              serverGoodbye = true;
            },
            onAckTimeout: (ackId, timeoutMs) => {
              if (settled) return;
              recordLifecycle({ kind: 'ackTimeout', ackId, timeoutMs });
            },
          },
        )
      : null;
    // The subscription controller writes its protocol frames through
    // the same captured path; its `connection_init` payload is the
    // session credential's minted headers (read at each dial's mint),
    // and its end is the clean close the Disconnect rider sends.
    let connectCredentialHeaders: WsTransportHeader[] = [];
    const closeCleanly = (): void => {
      if (settled || closeRequested) return;
      closeRequested = true;
      writer?.close(WS_DISCONNECT_CODE, '');
    };
    const graphqlSession =
      graphqlPlan !== null
        ? createGraphqlWsSessionController(sendText, closeCleanly, {
            subscribe: graphqlWsSubscribePayload(graphqlPlan.query, graphqlPlan.variables, graphqlPlan.operationName),
            connectionParams: () =>
              connectCredentialHeaders.length > 0
                ? Object.fromEntries(connectCredentialHeaders.map((h) => [h.key.toLowerCase(), h.value]))
                : undefined,
          })
        : null;

    /** Arm the wait before the next attempt; `error` is the attempt
     *  just failed, carried onto the next attempt's row. A spent
     *  attempt cap ends the loop instead — the session settles with
     *  the attempts dialed and that last failure. */
    const scheduleReconnect = (attempt: number, error?: string): void => {
      if (reconnectMaxAttempts !== undefined && attempt > reconnectMaxAttempts) {
        reconnectExhausted = { attempts: attempt - 1, ...(error !== undefined ? { error } : {}) };
        settle();
        return;
      }
      reconnectAttempt = attempt;
      const delayMs = reconnectDelayMs(reconnectPeriodMs, attempt, reconnectBackoff, reconnectJitter());
      const armedAt = Date.now();
      // The wait ran out, or the user cut it short: the same attempt
      // dials either way — the row states the wait actually sat
      // through, and the cap is only consulted when a NEXT attempt is
      // armed.
      const fire = (forced: boolean): void => {
        clearReconnectTimer();
        if (settled) return;
        recordLifecycle({
          kind: 'reconnecting',
          attempt,
          delayMs: forced ? Math.max(0, Date.now() - armedAt) : delayMs,
          ...(error !== undefined ? { error } : {}),
          ...(forced ? { forced: true } : {}),
        });
        dial();
      };
      reconnectTimer = setTimeout(() => fire(false), delayMs);
      fireReconnectNow = () => fire(true);
    };

    /** The connection ended — decide between the reconnect loop and
     *  the settle. */
    const onStreamEnd = (error?: WsTransportError): void => {
      if (settled) return;
      const wasOpen = attemptOpened;
      const dialingAgain = reconnectAttempt > 0;
      if (stopped) {
        settle(error?.message, error?.hint);
        return;
      }
      if (wasOpen && !closeRequested && !serverGoodbye && (autoReconnect || idleTripped)) {
        // The connection dropped under an open session without the
        // client asking — its end is a fact row; then the loop starts
        // when the entity asks, else the liveness cut is the story.
        recordLifecycle({ kind: 'lost', close, ...(idleTripped ? { idle: true } : {}) });
        if (!autoReconnect) {
          settle();
          return;
        }
        resetConnectionState();
        scheduleReconnect(1);
        return;
      }
      if (dialingAgain && !wasOpen) {
        // A reconnect attempt failed before it opened — the classified
        // dial failure rides the next attempt's row; the loop goes on
        // until the server is back or the user ends the session.
        resetConnectionState();
        scheduleReconnect(reconnectAttempt + 1, error?.message ?? 'The connection closed before the session opened.');
        return;
      }
      settle(error?.message, error?.hint);
    };

    /** One dial: mint the credential for THIS attempt, then hand the
     *  wire shape to the transport. A signer's refusal settles the
     *  session with the error, nothing on the wire; a Stop or
     *  Disconnect that lands while the mint is in flight settles
     *  Stopped (no socket exists to abort). */
    const dial = (): void => {
      void (async () => {
        let dialHeaders: WsTransportHeader[] = headers;
        let wireUrl = url;
        let dialSubprotocols: readonly string[] = subprotocols;
        if (scripts !== null) {
          // Before connect sees the dial as composed — the user's rows
          // and params, no credential yet — and runs at EVERY dial, so a
          // reconnect attempt re-runs it on the re-minted credential's
          // turn. Lenient: a failed level leaves its input as it was.
          const connect = await scripts.beforeConnect({
            url,
            headers: headers.map((h) => ({ key: h.key, value: h.value })),
            params: parseUrlParams(url),
            subprotocols: [...subprotocols],
            attempt: reconnectAttempt,
          });
          if (settled) return;
          if (stopped) {
            settle();
            return;
          }
          wireUrl = connect.url;
          dialHeaders = connect.headers;
          dialSubprotocols = connect.subprotocols;
        }
        if (credential !== null) {
          let minted: Awaited<ReturnType<typeof mintSessionCredential>>;
          try {
            minted = await mintSessionCredential(credential, {
              url: wireUrl,
              headers: dialHeaders,
              ...(tokenWorkspaceId !== undefined ? { workspaceId: tokenWorkspaceId } : {}),
              ...(options.refreshOAuth !== undefined ? { refreshOAuth: options.refreshOAuth } : {}),
              now: new Date(),
            });
          } catch (err) {
            settle(err instanceof Error ? err.message : String(err));
            return;
          }
          if (settled) return;
          if (stopped) {
            settle();
            return;
          }
          // An explicit user row carrying the credential's header takes
          // precedence (the gRPC auth block's law), so one value rides
          // the wire either way.
          const userRows = dialHeaders;
          const rows = minted.headers.filter(
            (h) => !userRows.some((row) => row.key.toLowerCase() === h.key.toLowerCase()),
          );
          dialHeaders = [...userRows, ...rows];
          wireUrl = minted.url ?? (minted.query.length > 0 ? appendQueryParams(wireUrl, minted.query) : wireUrl);
          connectBearerToken = minted.bearerToken;
          connectCredentialHeaders = rows;
        }
        const offer =
          dialSubprotocols.length > 0 ? [{ key: 'Sec-WebSocket-Protocol', value: dialSubprotocols.join(', ') }] : [];
        requestHeaders = [...dialHeaders, ...offer];
        dialUrl = wireUrl;
        writer = options.transport.connect(
          {
            url: wireUrl,
            headers: dialHeaders,
            subprotocols: dialSubprotocols,
            ...tlsPolicy,
            ...dialPolicy,
            ...(settings.unixSocketPath !== undefined ? { unixSocketPath: settings.unixSocketPath } : {}),
            ...(settings.timeoutMs !== undefined ? { timeoutMs: settings.timeoutMs } : {}),
            ...(settings.followRedirects === true ? { followRedirects: true } : {}),
            ...(settings.maxRedirects !== undefined ? { maxRedirects: settings.maxRedirects } : {}),
          },
          {
            onOpen: (selectedProtocol, negotiatedExtensions, route) => {
              attemptOpened = true;
              protocol = selectedProtocol;
              extensions = negotiatedExtensions;
              // Route wire truth: the transport reports which plane decided
              // (the request's own proxy setting, or the host's system
              // plane) and what it decided — recorded verbatim.
              if (route !== undefined) proxyRoute = route;
              if (reconnectAttempt > 0) {
                // A reconnect attempt's handshake settled — the new
                // connection's facts are its row.
                recordLifecycle({
                  kind: 'reconnected',
                  attempt: reconnectAttempt,
                  protocol: selectedProtocol,
                  extensions: negotiatedExtensions,
                });
              } else {
                opened = true;
                emitter?.open(selectedProtocol, negotiatedExtensions, proxyRoute, { url: dialUrl, requestHeaders });
              }
              armIdleTimer();
              startHeartbeat();
              graphqlSession?.start();
            },
            onMessage: ({ data, binary }) => {
              if (maxMessageBytes !== undefined && data.byteLength > maxMessageBytes) {
                // The request's cap, one law on every host: the message
                // is never captured and the session ends on the
                // Message Too Big close naming both sizes.
                closeRequested = true;
                writer?.close(
                  WS_MESSAGE_TOO_BIG_CODE,
                  `Message of ${data.byteLength} bytes exceeds the ${maxMessageBytes} byte limit`,
                );
                return;
              }
              const dataBase64 = encodeBase64Bytes(data);
              record({ direction: 'down', dataBase64, binary }, data.byteLength);
              emitter?.message({ direction: 'down', dataBase64, binary, atMs: Date.now() });
              armIdleTimer();
              const text = binary ? null : new TextDecoder().decode(data);
              // The socket.io controller answers protocol obligations off
              // the same feed the capture records — text frames only
              // (binary attachments carry no engine.io grammar).
              if (socketioSession !== null && text !== null) socketioSession.handleFrame(text);
              if (graphqlSession !== null && text !== null) graphqlSession.handleFrame(text);
              // On message runs AFTER the capture, off the same frame,
              // queued behind the session's earlier hooks — the capture
              // never waits for it.
              scripts?.onMessage({
                direction: 'down',
                text,
                dataBase64,
                binary,
                index: messages.length + droppedMessages - 1,
              });
            },
            onClose: (event) => {
              close =
                event.code === NO_CLOSE_FRAME_CODE
                  ? null
                  : { code: event.code, reason: event.reason, wasClean: event.wasClean };
            },
            onEnd: onStreamEnd,
          },
          connectionController.signal,
        );
      })();
    };

    dial();

    unregisterSession = registerActiveWsSession(options.sendId, {
      send: async (
        messageText,
        socketio?: WsSendSocketIoWire,
        binary?: WsSendBinaryWire,
        origin = 'rider',
      ): Promise<WsSendResult> => {
        if (settled || !attemptOpened) return { success: false, error: 'The session is not open.' };
        if (binary !== undefined && socketio !== undefined) {
          return { success: false, error: 'A Socket.IO event cannot be a binary frame.' };
        }
        if (socketio !== undefined && socketioSession === null) {
          return { success: false, error: 'This session is not a Socket.IO session.' };
        }
        const sendUnresolved = new Set<string>();
        const resolved = resolveWith(messageText, sendUnresolved);
        const eventName = socketio !== undefined ? resolveWith(socketio.eventName, sendUnresolved) : undefined;
        if (sendUnresolved.size > 0) {
          return {
            success: false,
            error: `Message has unresolved variables (${[...sendUnresolved].join(', ')}).`,
          };
        }
        // The message as the hook sees it: a binary compose decodes
        // first (the rider's spelling gates the send) and rides as
        // base64 — one spelling for the script to read or replace.
        let text = resolved;
        if (binary !== undefined) {
          const bytes = decodeBinaryText(resolved, binary.encoding);
          if (bytes === null) {
            return {
              success: false,
              error:
                binary.encoding === 'base64' ? 'The message is not valid Base64.' : 'The message is not valid hex.',
            };
          }
          text = encodeBase64Bytes(bytes);
        }
        let message: WsOutboundMessageSnapshot = {
          direction: 'up',
          text,
          binary: binary !== undefined,
          ...(socketio !== undefined && eventName !== undefined ? { eventName, expectAck: socketio.expectAck } : {}),
          index: messages.length + droppedMessages,
        };
        // Before send — the rider's message only: a script's own send
        // is already a hook's product and never re-enters the hook.
        if (scripts !== null && origin === 'rider') {
          const outcome = await scripts.beforeSend(message);
          if (outcome.kind === 'dropped') {
            return { success: false, error: `Dropped by the Before send script at ${outcome.by}.` };
          }
          message = outcome.message;
          if (settled || !attemptOpened) return { success: false, error: 'The session is not open.' };
        }
        if (message.binary) {
          const bytes = decodeBase64Bytes(message.text);
          if (bytes === null) return { success: false, error: 'The message is not valid Base64.' };
          return sendBinary(bytes);
        }
        if (message.eventName !== undefined && socketioSession !== null) {
          const ackId = message.expectAck === true ? socketioSession.nextAckId() : null;
          const encoded = encodeEventPacket(namespace, ackId, message.eventName, message.text);
          if (!encoded.ok) return { success: false, error: encoded.error };
          sendText(encoded.frame);
          if (ackId !== null) socketioSession.armAck(ackId);
          return { success: true };
        }
        sendText(message.text);
        return { success: true };
      },
      close: () => {
        if (settled) return;
        if (reconnectAttempt > 0 && !attemptOpened) {
          // Disconnect while auto-reconnect is between attempts or
          // mid-redial: no connection is up to close cleanly, so the
          // loop ends and the session settles Stopped — the last
          // connection's close record stays the honest end.
          stopped = true;
          if (reconnectTimer !== null) {
            clearReconnectTimer();
            settle();
          } else {
            connectionController.abort();
          }
          return;
        }
        // A subscription's Disconnect is its Stop: the client's own
        // `complete` leaves first, then the clean close.
        graphqlSession?.stop();
        closeCleanly();
      },
      reconnectNow: () => {
        if (settled || fireReconnectNow === null) return false;
        fireReconnectNow();
        return true;
      },
    });
  });
}

/** The oracle-side resolution closure — the module-mirror resolver the
 *  node hosts ride (the HTTP sends' exact pipeline) — plus the vault
 *  the scope carries for the client-certificate ref. Hosts whose
 *  scopes live elsewhere inject `options.resolution` instead. */
async function buildOracleResolution(
  request: WebSocketRequest,
  options: ExecuteWsSessionOptions,
): Promise<{ resolve: (template: string, unresolved: Set<string>) => string; vault: Vault }> {
  const { resolver, context: scope } = await buildResolver(options.workspaceId ?? undefined);
  const context = {
    collectionId: collectionUidForRequest(request, scope.workspaceId),
    environmentId: options.environmentId,
  };
  const resolve = (template: string, unresolved: Set<string>): string => {
    const result = resolveTemplate(
      template,
      (name) => resolver.resolve(name, context),
      (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
    );
    for (const v of result.variables) {
      if (!v.resolved) unresolved.add(v.name);
    }
    return result.result;
  };
  return { resolve, vault: scope.vault };
}

/** Decoded byte length of a base64 payload without re-decoding it. */
function byteLengthOfBase64(base64: string): number {
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return (base64.length / 4) * 3 - padding;
}

export function errorWsSnapshot(message: string, hint?: TrustCertificateErrorHint): ExecutedWsSnapshot {
  return {
    outcome: { kind: 'failed', error: message, ...(hint !== undefined ? { hint } : {}) },
    protocol: '',
    extensions: '',
    messages: [],
    droppedMessages: 0,
    close: null,
    durationMs: 0,
  };
}
