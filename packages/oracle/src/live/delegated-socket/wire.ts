/**
 * The delegated socket family's OPEN frames — the two transport seams'
 * request shapes as the wire carries them (the Execution Place plan;
 * names, riders and events live in `@openheaders/core/protocol`,
 * `delegated-sockets`). A context resolves the handshake or the dial
 * and ships the seam's own request; the place validates it
 * structurally (a peer's input — every field checked) and opens the
 * socket with it. Both shapes are JSON-safe as they are: strings,
 * lists, booleans, numbers, PEM text — nothing binary rides an OPEN.
 */

import {
  DELEGATE_MQTT_END_CHANNEL,
  DELEGATE_MQTT_OPEN_CHANNEL,
  DELEGATE_MQTT_WRITE_CHANNEL,
  DELEGATE_SOCKET_ABORT_CHANNEL,
  DELEGATE_WS_CLOSE_CHANNEL,
  DELEGATE_WS_OPEN_CHANNEL,
  DELEGATE_WS_SEND_CHANNEL,
  type DelegatedSocketEvent,
  type DelegatedSocketOpenResult,
  type DelegatedSocketRider,
} from '@openheaders/core/protocol';
import { ProxyModeSchema, TlsVersionSchema } from '@openheaders/core/schemas';
import * as v from 'valibot';
import type { MqttTransportRequest } from '../mqtt-exec/transport';
import type { WsTransportRequest } from '../ws-exec/transport';

const TlsKnobsSchema = {
  sslVerification: v.optional(v.boolean()),
  trustedRootsPem: v.optional(v.array(v.string())),
  clientCertificateRef: v.optional(v.string()),
  clientCertificatePem: v.optional(v.string()),
  clientCertificateKeyPem: v.optional(v.string()),
  clientCertificatePassphrase: v.optional(v.string()),
  tlsMinVersion: v.optional(TlsVersionSchema),
  tlsMaxVersion: v.optional(TlsVersionSchema),
  tlsCipherSuites: v.optional(v.string()),
  sniServerName: v.optional(v.string()),
  resolveToAddress: v.optional(v.string()),
  proxyMode: v.optional(ProxyModeSchema),
  proxyUrl: v.optional(v.string()),
  proxyCredentialRef: v.optional(v.string()),
  proxyCredential: v.optional(v.string()),
  timeoutMs: v.optional(v.pipe(v.number(), v.minValue(0))),
};

/** The WebSocket seam's request, as the wire carries it. */
export const WsTransportRequestWireSchema = v.object({
  url: v.string(),
  headers: v.array(v.object({ key: v.string(), value: v.string() })),
  subprotocols: v.array(v.string()),
  ...TlsKnobsSchema,
  unixSocketPath: v.optional(v.string()),
  followRedirects: v.optional(v.boolean()),
  maxRedirects: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
});

/** The MQTT byte-stream seam's request, as the wire carries it. */
export const MqttTransportRequestWireSchema = v.object({
  url: v.string(),
  ...TlsKnobsSchema,
  alpnProtocol: v.optional(v.string()),
});

const socketId = v.pipe(v.string(), v.minLength(1));

export const DelegatedWsOpenFrameSchema = v.object({
  type: v.literal(DELEGATE_WS_OPEN_CHANNEL),
  socketId,
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  request: WsTransportRequestWireSchema,
});

export const DelegatedMqttOpenFrameSchema = v.object({
  type: v.literal(DELEGATE_MQTT_OPEN_CHANNEL),
  socketId,
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  request: MqttTransportRequestWireSchema,
});

export type DelegatedWsOpenFrame = v.InferOutput<typeof DelegatedWsOpenFrameSchema>;
export type DelegatedMqttOpenFrame = v.InferOutput<typeof DelegatedMqttOpenFrameSchema>;
export type DelegatedSocketOpenFrame = DelegatedWsOpenFrame | DelegatedMqttOpenFrame;

const DelegatedSocketRiderSchema = v.variant('type', [
  v.object({ type: v.literal(DELEGATE_WS_SEND_CHANNEL), socketId, text: v.string() }),
  v.object({ type: v.literal(DELEGATE_WS_SEND_CHANNEL), socketId, binaryBase64: v.string() }),
  v.object({
    type: v.literal(DELEGATE_WS_CLOSE_CHANNEL),
    socketId,
    code: v.pipe(v.number(), v.integer()),
    reason: v.string(),
  }),
  v.object({ type: v.literal(DELEGATE_MQTT_WRITE_CHANNEL), socketId, bytesBase64: v.string() }),
  v.object({ type: v.literal(DELEGATE_MQTT_END_CHANNEL), socketId }),
  v.object({ type: v.literal(DELEGATE_SOCKET_ABORT_CHANNEL), socketId }),
]);

export type DelegatedSocketParse<T> = { ok: true; frame: T } | { ok: false; error: string };

function failure(issue: v.BaseIssue<unknown>, what: string): { ok: false; error: string } {
  const path = v.getDotPath(issue);
  return { ok: false, error: `Malformed ${what}${path !== null ? ` at ${path}` : ''}: ${issue.message}` };
}

/** The place side: a WebSocket OPEN frame onto the seam's request. */
export function parseDelegatedWsOpenFrame(
  message: Record<string, unknown>,
): DelegatedSocketParse<{ socketId: string; workspaceId: string; request: WsTransportRequest }> {
  const parsed = v.safeParse(DelegatedWsOpenFrameSchema, message);
  if (!parsed.success) return failure(parsed.issues[0], 'delegated WebSocket open frame');
  const { socketId: id, workspaceId, request } = parsed.output;
  return { ok: true, frame: { socketId: id, workspaceId, request } };
}

/** The place side: an MQTT OPEN frame onto the seam's request. */
export function parseDelegatedMqttOpenFrame(
  message: Record<string, unknown>,
): DelegatedSocketParse<{ socketId: string; workspaceId: string; request: MqttTransportRequest }> {
  const parsed = v.safeParse(DelegatedMqttOpenFrameSchema, message);
  if (!parsed.success) return failure(parsed.issues[0], 'delegated MQTT open frame');
  const { socketId: id, workspaceId, request } = parsed.output;
  return { ok: true, frame: { socketId: id, workspaceId, request } };
}

/** The place side: a rider onto its typed shape. */
export function parseDelegatedSocketRider(
  message: Record<string, unknown>,
): DelegatedSocketParse<DelegatedSocketRider> {
  const parsed = v.safeParse(DelegatedSocketRiderSchema, message);
  if (!parsed.success) return failure(parsed.issues[0], 'delegated socket rider');
  return { ok: true, frame: parsed.output };
}

/**
 * The wire a delegating socket transport rides — one place, chosen by
 * an explicit backend id. `call` sends an OPEN or a rider and awaits
 * the place's answer (rejecting on a dead wire or the place's
 * refusal); `subscribe` claims the place's events for one socket id
 * until the disposer runs.
 */
export interface DelegatedSocketWire {
  call(frame: DelegatedSocketOpenFrame | DelegatedSocketRider): Promise<unknown>;
  subscribe(socketId: string, onEvent: (event: DelegatedSocketEvent) => void): () => void;
}

/** Narrow a place's OPEN answer — a stamped success, or a failure
 *  with its sentence (stamped by the place, or unstamped when the wire
 *  itself answered it); anything else reads as no answer. */
export function isDelegatedSocketOpenResult(value: unknown): value is DelegatedSocketOpenResult {
  if (!value || typeof value !== 'object') return false;
  const { success, error, executedOn } = value as { success?: unknown; error?: unknown; executedOn?: unknown };
  const stamped = !!executedOn && typeof executedOn === 'object';
  if (success === true) return stamped;
  return success === false && typeof error === 'string';
}
