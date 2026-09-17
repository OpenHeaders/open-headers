/**
 * The session routes' host seam — what a host that answers the three
 * session Connects (`executeWebSocketRequest`, `executeGraphqlSubscription`,
 * `executeMqttRequest`) contributes to the ONE host-neutral route in
 * this directory: where a session's socket opens, whether its hooks
 * run, how an OAuth 2.0 bundle renews, and where the live frames go.
 * The route owns everything else — the entity load, the pin rules,
 * the executor call, the `executedOn` stamp, the result discipline —
 * so the node hosts (the daemon, the desktop app through the same
 * spine) and the web tab answer the channels through one code path.
 *
 * The transport is leased per session: a lease pairs the seam's
 * transport with the stamp of who answered the open — `null` for the
 * host's own socket, the place's name for a delegated one (the
 * Execution Place plan: a delegated session moves the SOCKET, never
 * the executor). A node host leases its own transport when the frame
 * names no place and the delegating one toward the named backend
 * otherwise; the web tab has exactly one place by construction and
 * leases the delegating transport toward its serving daemon for every
 * session.
 */

import type { MqttStreamEventWire, WsStreamEventWire } from '@openheaders/core/bridge';
import type { ExecutedWsSnapshot } from '@openheaders/core/types';
import { createDelegatingMqttTransport } from '../delegated-socket/delegating-mqtt-transport';
import { createDelegatingWsTransport } from '../delegated-socket/delegating-ws-transport';
import type { DelegatedSocketWire } from '../delegated-socket/wire';
import type { MqttByteTransport } from '../mqtt-exec/transport';
import type { SessionScriptHost } from '../request-exec/script-hooks';
import type { RequestTransport } from '../request-exec/transport';
import type { WsTransport } from '../ws-exec/transport';

/** The answering host's stamp, as every session snapshot carries it. */
export type SessionExecutedOn = NonNullable<ExecutedWsSnapshot['executedOn']>;

/** One session's transport and the stamp of who answered its open. */
export interface SessionTransportLease<T> {
  transport: T;
  /** The host that opened the socket; null when this host's own did. */
  executedOn(): SessionExecutedOn | null;
}

export interface SessionRouteHost {
  /**
   * The WebSocket transport for one session — the frame's place (an
   * explicit backend id, or none) and the gate's subject (the
   * workspace the session reads under).
   */
  wsTransportFor(placeBackendId: string | undefined, workspaceId: string): SessionTransportLease<WsTransport>;
  /** The MQTT byte-stream transport for one session — the same inputs. */
  mqttTransportFor(placeBackendId: string | undefined, workspaceId: string): SessionTransportLease<MqttByteTransport>;
  /**
   * The session's script capability — the hooks run through it; a
   * peer-forwarded session (`forwarded`) runs Safe or not at all.
   * Absent = every session runs scriptless.
   */
  resolveScriptHost?(input: { workspaceId: string; forwarded: boolean }): Promise<SessionScriptHost | null>;
  /**
   * The request transport an expired OAuth 2.0 bundle renews through
   * before a dial attaches it — the host's own HTTP leg, keyed by the
   * workspace the session reads under. Absent = the stored bundle
   * attaches as it is.
   */
  refreshTransportFor?(workspaceId: string): RequestTransport;
  /** The live-frame sinks — the host's `wsStreamEvent` / `mqttStreamEvent` broadcast. */
  emitWsStreamEvent(event: WsStreamEventWire): void;
  emitMqttStreamEvent(event: MqttStreamEventWire): void;
}

/** The host's own socket — nothing to stamp. */
export function ownTransportLease<T>(transport: T): SessionTransportLease<T> {
  return { transport, executedOn: () => null };
}

/** A WebSocket opened on the place the wire reaches, the executor here. */
export function delegatedWsTransportLease(
  wire: DelegatedSocketWire,
  workspaceId: string,
): SessionTransportLease<WsTransport> {
  const transport = createDelegatingWsTransport({ wire, workspaceId });
  return { transport, executedOn: () => transport.executedOn() };
}

/** An MQTT byte stream opened on the place the wire reaches, the executor here. */
export function delegatedMqttTransportLease(
  wire: DelegatedSocketWire,
  workspaceId: string,
): SessionTransportLease<MqttByteTransport> {
  const transport = createDelegatingMqttTransport({ wire, workspaceId });
  return { transport, executedOn: () => transport.executedOn() };
}
