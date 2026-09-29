/**
 * Peer-facing DELEGATED socket plane — the session kinds' half of the
 * Execution Place plan's second channel family (`delegated-requests-
 * rpc.ts` is the request half). A context keeps its session's executor
 * — the handshake resolved there, the scripts run there, the timeline
 * and the snapshot built there — and asks this host only for the
 * SOCKET: a WebSocket opened with the resolved handshake, an MQTT
 * byte stream opened with the resolved dial (the mqtt(s):// case no
 * browser page can dial itself), or a gRPC streaming call opened with
 * the resolved dial (the HTTP/2 session with trailers no browser
 * page can open — every message on it encoded by the context against
 * the spec IT holds). This host opens the seam's socket on its own
 * transport, fans the raw events to the opener's peers under the
 * same-user law, and writes what the riders carry. Nothing here
 * reads the workspace: the OPEN frame's `workspaceId` is the gate's
 * subject alone.
 *
 * Gating (the ratified S2 decision — the context family's gate, no
 * new capability): the two-tier egress opt-in, the frame's workspace
 * (required), `workspace.write` as the peer's user, audited; then the
 * structural check of the resolved request. The riders and the abort
 * are authorized by the caller-minted socket id AND its owner — a
 * socket answers only the user that opened it. A socket whose user
 * has no peer left on this host is torn down (its events would go
 * nowhere).
 */

import { emitAuditEntry, hasCapability, resolveDaemonPeerIdentitySnapshot } from '@openheaders/core/identity';
import {
  DELEGATE_GRPC_HALF_CLOSE_CHANNEL,
  DELEGATE_GRPC_OPEN_CHANNEL,
  DELEGATE_GRPC_SEND_CHANNEL,
  DELEGATE_MQTT_END_CHANNEL,
  DELEGATE_MQTT_OPEN_CHANNEL,
  DELEGATE_MQTT_WRITE_CHANNEL,
  DELEGATE_SOCKET_ABORT_CHANNEL,
  DELEGATE_WS_CLOSE_CHANNEL,
  DELEGATE_WS_OPEN_CHANNEL,
  DELEGATE_WS_SEND_CHANNEL,
  DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE,
  DELEGATED_SOCKET_EVENT_FRAME,
  DELEGATED_SOCKET_RIDER_CHANNELS,
  type DelegatedSocketEndError,
  type DelegatedSocketEvent,
  type DelegatedSocketOpenResult,
} from '@openheaders/core/protocol';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import {
  parseDelegatedMqttOpenFrame,
  parseDelegatedSocketRider,
  parseDelegatedWsOpenFrame,
} from '@openheaders/oracle/live/delegated-socket/wire';
import { parseDelegatedGrpcOpenFrame } from '@openheaders/oracle/live/grpc-exec/delegated-wire';
import type { GrpcStreamWriter, GrpcTransport, GrpcTransportError } from '@openheaders/oracle/live/grpc-exec/transport';
import type { MqttByteTransport, MqttStreamWriter } from '@openheaders/oracle/live/mqtt-exec/transport';
import { toBase64 } from '@openheaders/oracle/live/request-exec/body-decode';
import type { WsSessionWriter, WsTransport } from '@openheaders/oracle/live/ws-exec/transport';
import type { OracleWsServer, WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';
import { createNodeGrpcTransport } from '../live/node-grpc-transport';
import { createNodeMqttTransport } from '../live/node-mqtt-transport';
import { createNodeWsTransport } from '../live/node-ws-transport';
import { daemonExecutedOn } from './executed-on';
import { defaultPeerExecuteOptIn, type PeerExecuteOptIn } from './peer-execute-opt-in';
import { getWsPeerServer } from './ws-peer-slot';

export interface DelegatedSocketsRpcOptions {
  /** Injectable for tests; default the node transports. */
  wsTransport?: WsTransport;
  mqttTransport?: MqttByteTransport;
  grpcTransport?: GrpcTransport;
  /** The egress opt-in gate — the spine composes one per host posture;
   *  absent (test rigs) the desktop's remote-off default. */
  peerExecute?: PeerExecuteOptIn;
}

type OpenSocket =
  | { kind: 'ws'; userId: string; writer: WsSessionWriter; abort: () => void }
  | { kind: 'mqtt'; userId: string; writer: MqttStreamWriter; abort: () => void }
  | { kind: 'grpc'; userId: string; writer: GrpcStreamWriter; abort: () => void };

/** One delegated socket's events fan to the opener's peers alone. */
function socketEventSink(userId: string): (event: DelegatedSocketEvent) => void {
  return (event) => {
    getWsPeerServer()?.broadcastFrame(
      { type: DELEGATED_SOCKET_EVENT_FRAME, payload: event },
      { filterPeer: (peer) => peer.userId === userId },
    );
  };
}

/** The seam's classified end onto the wire's plain error. */
function endErrorOf(error: { message: string; hint?: DelegatedSocketEndError['hint'] }): DelegatedSocketEndError {
  return { message: error.message, ...(error.hint !== undefined ? { hint: error.hint } : {}) };
}

export function createDelegatedSocketsRpc(options: DelegatedSocketsRpcOptions = {}): WsPeerRpcHooks {
  const wsTransport = options.wsTransport ?? createNodeWsTransport();
  const mqttTransport = options.mqttTransport ?? createNodeMqttTransport();
  const grpcTransport = options.grpcTransport ?? createNodeGrpcTransport();
  const peerExecute = options.peerExecute ?? defaultPeerExecuteOptIn();
  const sockets = new Map<string, OpenSocket>();
  // A user's sockets die with their last peer — subscribed once per
  // server instance (a bind swap mints a new server).
  const sweeping = new WeakSet<OracleWsServer>();

  function ensureSweep(): void {
    const server = getWsPeerServer();
    if (server === null || server === undefined || sweeping.has(server)) return;
    sweeping.add(server);
    server.subscribePeerChange((event) => {
      if (event.kind !== 'disconnect' || event.peer.userId === null) return;
      const { userId } = event.peer;
      if (server.listConnectedPeers().some((peer) => peer.userId === userId)) return;
      for (const [socketId, socket] of sockets) {
        if (socket.userId !== userId) continue;
        sockets.delete(socketId);
        socket.abort();
      }
    });
  }

  async function gate(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<string> {
    await peerExecute.assert(peer);
    const workspaceId =
      typeof message.workspaceId === 'string' && message.workspaceId !== '' ? message.workspaceId : null;
    if (workspaceId === null) throw new Error(DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE);
    const snapshot = await resolveDaemonPeerIdentitySnapshot(peer.userId);
    const decision = hasCapability(snapshot, 'workspace.write', { workspaceId });
    emitAuditEntry({ actorUserId: peer.userId, capability: 'workspace.write', workspaceId, decision });
    if (!decision.allow) {
      throw new Error(`permission denied: workspace.write on ${workspaceId} (${decision.reason ?? 'denied'})`);
    }
    return workspaceId;
  }

  function openWs(message: Record<string, unknown>, peer: WsPeerRpcContext): DelegatedSocketOpenResult {
    const executedOn = daemonExecutedOn();
    const parsed = parseDelegatedWsOpenFrame(message);
    if (!parsed.ok) return { success: false, error: parsed.error, executedOn };
    const { socketId, request } = parsed.frame;
    if (sockets.has(socketId))
      return { success: false, error: `A delegated socket ${socketId} is already open.`, executedOn };
    ensureSweep();
    const emit = socketEventSink(peer.userId);
    const controller = new AbortController();
    let seq = 0;
    const writer = wsTransport.connect(
      request,
      {
        onOpen: (protocol, extensions, proxyRoute) =>
          emit({ socketId, seq: seq++, kind: 'open', protocol, extensions, ...(proxyRoute ? { proxyRoute } : {}) }),
        onMessage: (message) =>
          emit({ socketId, seq: seq++, kind: 'message', dataBase64: toBase64(message.data), binary: message.binary }),
        onClose: (close) => emit({ socketId, seq: seq++, kind: 'close', ...close }),
        onEnd: (error) => {
          sockets.delete(socketId);
          emit({ socketId, seq: seq++, kind: 'end', ...(error !== undefined ? { error: endErrorOf(error) } : {}) });
        },
      },
      controller.signal,
    );
    sockets.set(socketId, { kind: 'ws', userId: peer.userId, writer, abort: () => controller.abort() });
    return { success: true, executedOn };
  }

  function openMqtt(message: Record<string, unknown>, peer: WsPeerRpcContext): DelegatedSocketOpenResult {
    const executedOn = daemonExecutedOn();
    const parsed = parseDelegatedMqttOpenFrame(message);
    if (!parsed.ok) return { success: false, error: parsed.error, executedOn };
    const { socketId, request } = parsed.frame;
    if (sockets.has(socketId))
      return { success: false, error: `A delegated socket ${socketId} is already open.`, executedOn };
    ensureSweep();
    const emit = socketEventSink(peer.userId);
    const controller = new AbortController();
    let seq = 0;
    const writer = mqttTransport.connect(
      request,
      {
        onConnect: (proxyRoute) =>
          emit({ socketId, seq: seq++, kind: 'connect', ...(proxyRoute ? { proxyRoute } : {}) }),
        onData: (chunk) => emit({ socketId, seq: seq++, kind: 'data', dataBase64: toBase64(chunk) }),
        onEnd: (error) => {
          sockets.delete(socketId);
          emit({ socketId, seq: seq++, kind: 'end', ...(error !== undefined ? { error: endErrorOf(error) } : {}) });
        },
      },
      controller.signal,
    );
    sockets.set(socketId, { kind: 'mqtt', userId: peer.userId, writer, abort: () => controller.abort() });
    return { success: true, executedOn };
  }

  /** A gRPC streaming call: the head, the raw framed body chunks and
   *  the trailers fan as they arrive (unwrapping is the context's
   *  core-proto pass); a pre-head failure ends with the canonical
   *  status the transport assigned it beside the trust remedy. */
  function openGrpc(message: Record<string, unknown>, peer: WsPeerRpcContext): DelegatedSocketOpenResult {
    const executedOn = daemonExecutedOn();
    const parsed = parseDelegatedGrpcOpenFrame(message);
    if (!parsed.ok) return { success: false, error: parsed.error, executedOn };
    const openStream = grpcTransport.openStream;
    if (openStream === undefined) {
      return { success: false, error: 'This place cannot open gRPC streams.', executedOn };
    }
    const { socketId, request } = parsed.frame;
    if (sockets.has(socketId))
      return { success: false, error: `A delegated socket ${socketId} is already open.`, executedOn };
    ensureSweep();
    const emit = socketEventSink(peer.userId);
    const controller = new AbortController();
    let seq = 0;
    const onEnd = (error?: GrpcTransportError): void => {
      sockets.delete(socketId);
      emit({
        socketId,
        seq: seq++,
        kind: 'end',
        ...(error !== undefined
          ? {
              error: {
                ...endErrorOf(error),
                ...(error.canonicalStatus !== undefined ? { canonicalStatus: error.canonicalStatus } : {}),
              },
            }
          : {}),
      });
    };
    let writer: GrpcStreamWriter;
    try {
      writer = openStream.call(
        grpcTransport,
        request,
        {
          onHead: (httpStatus, headers, proxyRoute) =>
            emit({
              socketId,
              seq: seq++,
              kind: 'head',
              httpStatus,
              headers: headers.map((h) => ({ key: h.key, value: h.value })),
              ...(proxyRoute ? { proxyRoute } : {}),
            }),
          onData: (chunk) => emit({ socketId, seq: seq++, kind: 'data', dataBase64: toBase64(chunk) }),
          onTrailers: (trailers) =>
            emit({
              socketId,
              seq: seq++,
              kind: 'trailers',
              trailers: trailers.map((h) => ({ key: h.key, value: h.value })),
            }),
          onEnd,
        },
        controller.signal,
      );
    } catch (err) {
      // A transport that refuses synchronously (a malformed target)
      // never registered a socket — the refusal is the open's answer.
      return { success: false, error: err instanceof Error ? err.message : String(err), executedOn };
    }
    sockets.set(socketId, { kind: 'grpc', userId: peer.userId, writer, abort: () => controller.abort() });
    return { success: true, executedOn };
  }

  function ride(message: Record<string, unknown>, peer: WsPeerRpcContext): { success: boolean; error?: string } {
    const parsed = parseDelegatedSocketRider(message);
    if (!parsed.ok) return { success: false, error: parsed.error };
    const rider = parsed.frame;
    const socket = sockets.get(rider.socketId);
    // An unknown id and another user's socket read the same — nothing
    // to write into; the response names neither.
    if (socket === undefined || socket.userId !== peer.userId) return { success: false, error: 'No such socket' };
    switch (rider.type) {
      case DELEGATE_SOCKET_ABORT_CHANNEL:
        socket.abort();
        return { success: true };
      case DELEGATE_WS_SEND_CHANNEL: {
        if (socket.kind !== 'ws') return { success: false, error: 'Not a WebSocket' };
        if ('text' in rider) {
          socket.writer.send(rider.text);
          return { success: true };
        }
        const bytes = decodeBase64Bytes(rider.binaryBase64);
        if (bytes === null) return { success: false, error: 'Binary payload is not base64' };
        if (socket.writer.sendBinary === undefined) return { success: false, error: 'Binary frames are not supported' };
        socket.writer.sendBinary(bytes);
        return { success: true };
      }
      case DELEGATE_WS_CLOSE_CHANNEL:
        if (socket.kind !== 'ws') return { success: false, error: 'Not a WebSocket' };
        socket.writer.close(rider.code, rider.reason);
        return { success: true };
      case DELEGATE_MQTT_WRITE_CHANNEL: {
        if (socket.kind !== 'mqtt') return { success: false, error: 'Not an MQTT stream' };
        const bytes = decodeBase64Bytes(rider.bytesBase64);
        if (bytes === null) return { success: false, error: 'Payload is not base64' };
        socket.writer.write(bytes);
        return { success: true };
      }
      case DELEGATE_MQTT_END_CHANNEL:
        if (socket.kind !== 'mqtt') return { success: false, error: 'Not an MQTT stream' };
        socket.writer.end();
        return { success: true };
      case DELEGATE_GRPC_SEND_CHANNEL: {
        if (socket.kind !== 'grpc') return { success: false, error: 'Not a gRPC stream' };
        const bytes = decodeBase64Bytes(rider.messageBase64);
        if (bytes === null) return { success: false, error: 'Message is not base64' };
        socket.writer.sendMessage(new Uint8Array(bytes));
        return { success: true };
      }
      case DELEGATE_GRPC_HALF_CLOSE_CHANNEL:
        if (socket.kind !== 'grpc') return { success: false, error: 'Not a gRPC stream' };
        socket.writer.halfClose();
        return { success: true };
    }
  }

  return {
    owns(type: string): boolean {
      return (
        type === DELEGATE_WS_OPEN_CHANNEL ||
        type === DELEGATE_MQTT_OPEN_CHANNEL ||
        type === DELEGATE_GRPC_OPEN_CHANNEL ||
        (DELEGATED_SOCKET_RIDER_CHANNELS as readonly string[]).includes(type)
      );
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      const type = message.type;
      if (type === DELEGATE_WS_OPEN_CHANNEL) {
        await gate(message, peer);
        return openWs(message, peer);
      }
      if (type === DELEGATE_MQTT_OPEN_CHANNEL) {
        await gate(message, peer);
        return openMqtt(message, peer);
      }
      if (type === DELEGATE_GRPC_OPEN_CHANNEL) {
        await gate(message, peer);
        return openGrpc(message, peer);
      }
      // The riders ride ahead of the capability tier — the socket id
      // and its owner are the authorization (the Stop precedent); no
      // capability decision is made, so no audit row.
      return ride(message, peer);
    },
  };
}
