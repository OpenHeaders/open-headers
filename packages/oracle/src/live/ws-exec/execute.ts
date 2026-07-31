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
 * STRUCTURED error snapshot naming the gap, never a throw. On the
 * wire, only a session that never opened maps onto `error`; once open,
 * the close record (or its honest `null`) is the story.
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
 */

import type { WsSendSocketIoWire, WsStreamEventWire } from '@openheaders/core/bridge';
import { buildEngineIoUrl, encodeEventPacket, isValidNamespace, normalizeNamespace } from '@openheaders/core/socketio';
import type {
  ExecutedProxyRoute,
  ExecutedWsClose,
  ExecutedWsMessage,
  ExecutedWsSnapshot,
  WebSocketRequest,
} from '@openheaders/core/types';
import { appendQueryParams, encodeBase64Bytes } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { getRequestCollections, getRequestCollectionsForWorkspace } from '../../entity/request-store';
import { buildResolver } from '../request-exec/resolver-scope';
import { registerActiveSend } from '../request-exec/send-stream';
import { createWsStreamEmitter, registerActiveWsSession } from './session-plane';
import { createSocketIoSessionController } from './socketio-session';
import type { WsSessionWriter, WsTransport, WsTransportHeader } from './transport';

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
}

export async function executeWsSession(
  request: WebSocketRequest,
  options: ExecuteWsSessionOptions,
): Promise<ExecutedWsSnapshot> {
  // ── Variable resolution (the HTTP sends' exact pipeline) ──
  // An injected resolution short-circuits the oracle-side resolver
  // entirely — the host's closure carries its own scope context.
  const resolveWith = options.resolution ?? (await buildOracleResolution(request, options));

  const unresolved = new Set<string>();
  const resolveStr = (s: string): string => resolveWith(s, unresolved);

  let url = resolveStr(request.url).trim();
  // Session credential (bearer) — resolved with the other Connect-time
  // templates. An empty resolved token reads as none (partial configs
  // stay saveable — the HTTP auth block's posture). An explicit user
  // Authorization row takes precedence over the credential header (the
  // gRPC auth block's law), so one header rides the wire either way.
  const bearerToken = request.auth?.type === 'bearer' ? resolveStr(request.auth.token).trim() : '';
  const headers: WsTransportHeader[] = [];
  let hasAuthorizationRow = false;
  for (const row of request.headers) {
    if (row.enabled === false || !row.key.trim()) continue;
    const key = resolveStr(row.key);
    if (key.toLowerCase().startsWith('sec-websocket-') || RESERVED_HEADER_KEYS.has(key.toLowerCase())) continue;
    if (key.toLowerCase() === 'authorization') hasAuthorizationRow = true;
    headers.push({ key, value: resolveStr(row.value) });
  }
  if (bearerToken !== '' && !hasAuthorizationRow) {
    headers.push({ key: 'Authorization', value: `Bearer ${bearerToken}` });
  }
  const params = request.params
    .filter((p) => p.enabled !== false && p.key.trim() !== '')
    .map((p) => ({ ...p, key: resolveStr(p.key), value: resolveStr(p.value) }));
  // Socket.IO flavor: the namespace resolves with the other target
  // fields; the framing controller CONNECTs it once the engine.io open
  // packet arrives.
  const socketioFlavor = request.flavor === 'socketio';
  const namespace = socketioFlavor ? normalizeNamespace(resolveStr(request.namespace ?? '')) : '/';
  if (unresolved.size > 0) {
    return errorWsSnapshot(
      `Request has unresolved variables (${[...unresolved].join(', ')}). Define them in vault, environment, collection, or workspace before connecting.`,
    );
  }
  if (url === '') return errorWsSnapshot('URL is empty');
  if (!/^wss?:\/\//i.test(url)) {
    return errorWsSnapshot('The URL must start with ws:// or wss://.');
  }
  if (params.length > 0) url = appendQueryParams(url, params);
  if (socketioFlavor) {
    if (!isValidNamespace(namespace)) {
      return errorWsSnapshot('The Socket.IO namespace must not contain a comma.');
    }
    // The engine.io dial URL: default /socket.io/ mount on a bare
    // authority, EIO + transport joined after any user params.
    try {
      url = buildEngineIoUrl(url);
    } catch {
      return errorWsSnapshot('The URL is not valid.');
    }
  }

  // ── The live session on the sendId spine ──
  return new Promise<ExecutedWsSnapshot>((resolve) => {
    const emitter =
      options.emitStreamEvent !== undefined ? createWsStreamEmitter(options.sendId, options.emitStreamEvent) : null;
    const controller = new AbortController();
    let stopped = false;
    let opened = false;
    let protocol = '';
    let extensions = '';
    let proxyRoute: ExecutedProxyRoute | undefined;
    let close: ExecutedWsClose | null = null;
    let settled = false;
    const messages: ExecutedWsMessage[] = [];
    let capturedBytes = 0;
    let droppedMessages = 0;
    const startedAt = performance.now();

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

    const unregisterSend = registerActiveSend(options.sendId, () => {
      stopped = true;
      controller.abort();
    });
    let unregisterSession: (() => void) | null = null;

    const settle = (errorMessage?: string): void => {
      if (settled) return;
      settled = true;
      unregisterSend();
      unregisterSession?.();
      emitter?.end();
      const durationMs = Math.round(performance.now() - startedAt);
      if (!opened) {
        resolve({
          ...errorWsSnapshot(
            stopped ? 'Session stopped before it connected.' : (errorMessage ?? 'The session ended before it opened.'),
          ),
          durationMs,
        });
        return;
      }
      resolve({
        connected: true,
        protocol,
        extensions,
        messages,
        droppedMessages,
        close,
        ...(stopped ? { stopped: true } : {}),
        durationMs,
        ...(proxyRoute !== undefined ? { proxyRoute } : {}),
        error: null,
      });
    };

    // One write path for riders AND protocol frames — every ↑ frame is
    // captured and broadcast verbatim, socket.io control answers
    // (CONNECT, pong) included.
    let writer: WsSessionWriter | null = null;
    const sendText = (text: string): void => {
      if (writer === null || settled) return;
      writer.send(text);
      const data = new TextEncoder().encode(text);
      const dataBase64 = encodeBase64Bytes(data);
      record({ direction: 'up', dataBase64, binary: false }, data.byteLength);
      emitter?.message({ direction: 'up', dataBase64, binary: false, atMs: Date.now() });
    };
    // The socketio flavor ALSO lands the bearer token as the CONNECT
    // packet's auth payload — in-band framing, so it works on hosts
    // whose platform socket cannot carry the header.
    const connectAuthJson = bearerToken !== '' ? JSON.stringify({ token: bearerToken }) : undefined;
    const socketioSession = socketioFlavor
      ? createSocketIoSessionController(namespace, sendText, connectAuthJson)
      : null;

    writer = options.transport.connect(
      {
        url,
        headers,
        subprotocols: request.subprotocols,
        ...(request.sslVerification !== undefined ? { sslVerification: request.sslVerification } : {}),
        ...(request.unixSocketPath !== undefined ? { unixSocketPath: request.unixSocketPath } : {}),
        ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
      },
      {
        onOpen: (selectedProtocol, negotiatedExtensions, route) => {
          opened = true;
          protocol = selectedProtocol;
          extensions = negotiatedExtensions;
          // Route wire truth: the transport reports what its host's
          // environment plane decided — H5 leaves WS no request plane,
          // so the plane is always the executing device's.
          if (route !== undefined) proxyRoute = { plane: 'environment', ...route };
          emitter?.open(selectedProtocol, negotiatedExtensions);
        },
        onMessage: ({ data, binary }) => {
          const dataBase64 = encodeBase64Bytes(data);
          record({ direction: 'down', dataBase64, binary }, data.byteLength);
          emitter?.message({ direction: 'down', dataBase64, binary, atMs: Date.now() });
          // The socket.io controller answers protocol obligations off
          // the same feed the capture records — text frames only
          // (binary attachments carry no engine.io grammar).
          if (socketioSession !== null && !binary) socketioSession.handleFrame(new TextDecoder().decode(data));
        },
        onClose: (event) => {
          close =
            event.code === NO_CLOSE_FRAME_CODE
              ? null
              : { code: event.code, reason: event.reason, wasClean: event.wasClean };
        },
        onEnd: (error) => settle(error?.message),
      },
      controller.signal,
    );

    unregisterSession = registerActiveWsSession(options.sendId, {
      send: (messageText, socketio?: WsSendSocketIoWire) => {
        if (settled || !opened) return { success: false, error: 'The session is not open.' };
        const sendUnresolved = new Set<string>();
        const resolved = resolveWith(messageText, sendUnresolved);
        let frame = resolved;
        if (socketio !== undefined) {
          if (socketioSession === null) {
            return { success: false, error: 'This session is not a Socket.IO session.' };
          }
          const eventName = resolveWith(socketio.eventName, sendUnresolved);
          if (sendUnresolved.size > 0) {
            return {
              success: false,
              error: `Message has unresolved variables (${[...sendUnresolved].join(', ')}).`,
            };
          }
          const encoded = encodeEventPacket(
            namespace,
            socketio.expectAck ? socketioSession.nextAckId() : null,
            eventName,
            resolved,
          );
          if (!encoded.ok) return { success: false, error: encoded.error };
          frame = encoded.frame;
        } else if (sendUnresolved.size > 0) {
          return {
            success: false,
            error: `Message has unresolved variables (${[...sendUnresolved].join(', ')}).`,
          };
        }
        sendText(frame);
        return { success: true };
      },
      close: () => {
        if (settled) return;
        writer?.close(WS_DISCONNECT_CODE, '');
      },
    });
  });
}

/** The oracle-side resolution closure — the module-mirror resolver the
 *  node hosts ride (the HTTP sends' exact pipeline). Hosts whose scopes
 *  live elsewhere inject `options.resolution` instead. */
async function buildOracleResolution(
  request: WebSocketRequest,
  options: ExecuteWsSessionOptions,
): Promise<(template: string, unresolved: Set<string>) => string> {
  const { resolver, context: scope } = await buildResolver(options.workspaceId ?? undefined);
  const context = {
    collectionId: collectionIdForPath(request.path, scope.workspaceId),
    environmentId: options.environmentId,
  };
  return (template, unresolved) => {
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
}

/** The collection whose variables scope this request — same
 *  path-prefix membership the HTTP resolver uses. */
function collectionIdForPath(path: string, workspaceId: string | null): string | undefined {
  const collections = workspaceId ? getRequestCollectionsForWorkspace(workspaceId) : getRequestCollections();
  return collections.find((c) => path.startsWith(`${c.path}/`))?.uid;
}

/** Decoded byte length of a base64 payload without re-decoding it. */
function byteLengthOfBase64(base64: string): number {
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return (base64.length / 4) * 3 - padding;
}

export function errorWsSnapshot(message: string): ExecutedWsSnapshot {
  return {
    connected: false,
    protocol: '',
    extensions: '',
    messages: [],
    droppedMessages: 0,
    close: null,
    durationMs: 0,
    error: message,
  };
}
