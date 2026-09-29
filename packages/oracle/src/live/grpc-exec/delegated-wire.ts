/**
 * The DELEGATED gRPC leg's wire shapes — the Execution Place plan's
 * second channel family applied to the last kind that escaped it. A
 * context (the surface the user sits at) resolves everything it holds
 * — the linked spec's files, the variables, the credential, the
 * settings chain, the scripts — ENCODES the message against the spec
 * with the pure core codec, and ships the gRPC transport seam's own
 * request: the authority, the path, the resolved metadata, the
 * encoded unframed message, the dial knobs. The place opens the HTTP/2
 * session and answers the seam's raw response — headers, trailers,
 * framed body bytes — stamping where it ran. Nothing is resolved at
 * the place: no workspace, no spec, no vault, no scripts. The gRPC
 * twin of `request-exec/delegated-wire.ts`.
 *
 * Two halves, the family's own split: the UNARY call is a request
 * (`delegateGrpcInvoke` — one frame in, the whole reply out, the
 * caller-minted `sendId` on the shared Stop registry); the STREAMING
 * shapes are a socket (`delegateGrpcOpen` + the two riders + the
 * shared abort, the events on the `delegatedSocketEvent` frame — the
 * WebSocket and MQTT opens' law). The wire shape IS the seam's shape,
 * JSON-safe: the one binary field, the message, rides base64.
 *
 * Both ends import this module: a context builds a frame through
 * {@link encodeDelegatedGrpcRequest} / {@link encodeDelegatedGrpcStreamRequest};
 * the place validates an inbound frame through the two parsers — a
 * peer's input, every field structurally checked, the message decoded
 * (a run that does not decode refuses the frame), the body cap clamped
 * to the place's own bound.
 */

import {
  DELEGATE_GRPC_INVOKE_CHANNEL,
  DELEGATE_GRPC_OPEN_CHANNEL,
  type DelegatedSocketEvent,
  type DelegatedSocketRider,
  type DelegatedSocketTrustHint,
} from '@openheaders/core/protocol';
import { ProxyModeSchema, TlsVersionSchema } from '@openheaders/core/schemas';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import * as v from 'valibot';
import { toBase64 } from '../request-exec/body-decode';
import { DELEGATED_MAX_BODY_BYTES } from '../request-exec/delegated-wire';
import type {
  GrpcProxyRoute,
  GrpcTransportRequest,
  GrpcTransportResponse,
  GrpcTransportStreamRequest,
} from './transport';

const HeaderSchema = v.object({ key: v.string(), value: v.string() });

/** The knobs both call shapes share — the seam's dial fields, verbatim. */
const DialKnobsSchema = {
  authority: v.pipe(v.string(), v.minLength(1)),
  tls: v.boolean(),
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
  authorityOverride: v.optional(v.string()),
  path: v.pipe(v.string(), v.minLength(1)),
  unixSocketPath: v.optional(v.string()),
  resolveToAddress: v.optional(v.string()),
  proxyMode: v.optional(ProxyModeSchema),
  proxyUrl: v.optional(v.string()),
  proxyCredentialRef: v.optional(v.string()),
  proxyCredential: v.optional(v.string()),
  metadata: v.array(HeaderSchema),
  timeoutMs: v.optional(v.pipe(v.number(), v.minValue(0))),
  keepaliveIntervalMs: v.optional(v.pipe(v.number(), v.minValue(0))),
  keepaliveTimeoutMs: v.optional(v.pipe(v.number(), v.minValue(0))),
};

/** The unary seam request as the wire carries it: the encoded message
 *  base64 in, the seam's bytes out (a run that does not decode refuses
 *  the frame); the body cap clamped to the place's bound. */
const GrpcTransportRequestWireSchema = v.pipe(
  v.object({
    ...DialKnobsSchema,
    messageBase64: v.string(),
    maxBodyBytes: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(0),
      v.transform((bytes) => Math.min(bytes, DELEGATED_MAX_BODY_BYTES)),
    ),
  }),
  v.rawTransform(({ dataset, addIssue, NEVER }) => {
    const { messageBase64, ...request } = dataset.value;
    const decoded = decodeBase64Bytes(messageBase64);
    if (decoded === null) {
      addIssue({
        message: 'message bytes are not base64',
        path: [{ type: 'object', origin: 'value', input: dataset.value, key: 'messageBase64', value: messageBase64 }],
      });
      return NEVER;
    }
    return { ...request, message: new Uint8Array(decoded) };
  }),
);

/** The streaming seam request as the wire carries it — the unary
 *  shape minus the message and the cap (upstream rides the riders,
 *  the cap is the context executor's). */
const GrpcTransportStreamRequestWireSchema = v.object(DialKnobsSchema);

/** The JSON shapes a context puts on the wire. */
export type DelegatedGrpcRequestWire = v.InferInput<typeof GrpcTransportRequestWireSchema>;
export type DelegatedGrpcStreamRequestWire = v.InferInput<typeof GrpcTransportStreamRequestWireSchema>;

const DelegatedGrpcInvokeFrameSchema = v.object({
  type: v.literal(DELEGATE_GRPC_INVOKE_CHANNEL),
  sendId: v.pipe(v.string(), v.minLength(1)),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  request: GrpcTransportRequestWireSchema,
});

const DelegatedGrpcOpenFrameSchema = v.object({
  type: v.literal(DELEGATE_GRPC_OPEN_CHANNEL),
  socketId: v.pipe(v.string(), v.minLength(1)),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  request: GrpcTransportStreamRequestWireSchema,
});

/** One `delegateGrpcInvoke` frame as it crosses the wire. `workspaceId`
 *  is the gate's subject — the place resolves nothing against it. */
export type DelegatedGrpcInvokeFrame = v.InferInput<typeof DelegatedGrpcInvokeFrameSchema>;
/** One `delegateGrpcOpen` frame — the socket half's open. */
export type DelegatedGrpcOpenFrame = v.InferInput<typeof DelegatedGrpcOpenFrameSchema>;

/** Who answered — the answering host's label, stamped by that host. */
export interface DelegatedGrpcExecutedOn {
  kind: 'backend';
  name: string;
}

/** The seam's unary response as the wire carries it — the framed body
 *  base64, everything else verbatim. */
export interface DelegatedGrpcResponseWire {
  httpStatus: number;
  headers: Array<{ key: string; value: string }>;
  trailers: Array<{ key: string; value: string }>;
  bodyBase64: string;
  bodyTruncated: boolean;
  proxyRoute?: GrpcProxyRoute;
  connectionError?: string;
}

/**
 * The place's answer to a unary invoke. A non-zero grpc-status is a
 * `success: true` response like on the seam; `success: false` carries
 * the transport's classified pre-head failure — the sentence, the
 * canonical status the client runtime assigns it and the trust remedy
 * — for the context to stamp on its own error snapshot. Both carry the
 * stamp: where the call failed is still that host.
 */
export type DelegatedGrpcInvokeResult =
  | { success: true; response: DelegatedGrpcResponseWire; executedOn: DelegatedGrpcExecutedOn }
  | {
      success: false;
      error: string;
      canonicalStatus?: number;
      hint?: DelegatedSocketTrustHint;
      executedOn: DelegatedGrpcExecutedOn;
    };

export type DelegatedGrpcParse<T> = { ok: true; frame: T } | { ok: false; error: string };

function failure(issue: v.BaseIssue<unknown>, what: string): { ok: false; error: string } {
  const path = v.getDotPath(issue);
  return { ok: false, error: `Malformed ${what}${path !== null ? ` at ${path}` : ''}: ${issue.message}` };
}

/** The place side: a unary invoke frame onto the seam's request. */
export function parseDelegatedGrpcInvokeFrame(
  message: Record<string, unknown>,
): DelegatedGrpcParse<{ sendId: string; workspaceId: string; request: GrpcTransportRequest }> {
  const parsed = v.safeParse(DelegatedGrpcInvokeFrameSchema, message);
  if (!parsed.success) return failure(parsed.issues[0], 'delegated gRPC invoke frame');
  const { sendId, workspaceId, request } = parsed.output;
  return { ok: true, frame: { sendId, workspaceId, request } };
}

/** The place side: a streaming open frame onto the seam's request. */
export function parseDelegatedGrpcOpenFrame(
  message: Record<string, unknown>,
): DelegatedGrpcParse<{ socketId: string; workspaceId: string; request: GrpcTransportStreamRequest }> {
  const parsed = v.safeParse(DelegatedGrpcOpenFrameSchema, message);
  if (!parsed.success) return failure(parsed.issues[0], 'delegated gRPC open frame');
  const { socketId, workspaceId, request } = parsed.output;
  return { ok: true, frame: { socketId, workspaceId, request } };
}

/** The context side: the unary seam request as the wire carries it —
 *  the encoded message base64. */
export function encodeDelegatedGrpcRequest(request: GrpcTransportRequest): DelegatedGrpcRequestWire {
  const { message, metadata, ...rest } = request;
  return { ...rest, metadata: [...metadata], messageBase64: toBase64(message) };
}

/** The context side: the streaming seam request as the wire carries it. */
export function encodeDelegatedGrpcStreamRequest(request: GrpcTransportStreamRequest): DelegatedGrpcStreamRequestWire {
  return { ...request, metadata: [...request.metadata] };
}

/** The place side: the seam's unary response onto the wire. */
export function encodeDelegatedGrpcResponse(response: GrpcTransportResponse): DelegatedGrpcResponseWire {
  return {
    httpStatus: response.httpStatus,
    headers: response.headers.map((h) => ({ key: h.key, value: h.value })),
    trailers: response.trailers.map((h) => ({ key: h.key, value: h.value })),
    bodyBase64: toBase64(response.body),
    bodyTruncated: response.bodyTruncated,
    ...(response.proxyRoute !== undefined ? { proxyRoute: response.proxyRoute } : {}),
    ...(response.connectionError !== undefined ? { connectionError: response.connectionError } : {}),
  };
}

/** The context side: the wire's unary response onto the seam's; null
 *  when the body does not decode (the place's answer is malformed). */
export function decodeDelegatedGrpcResponse(wire: DelegatedGrpcResponseWire): GrpcTransportResponse | null {
  const body = decodeBase64Bytes(wire.bodyBase64);
  if (body === null) return null;
  const { bodyBase64: _encoded, ...rest } = wire;
  return { ...rest, body: new Uint8Array(body) };
}

/** Narrow a place's invoke answer — a stamped success, or a failure
 *  with its sentence; anything else reads as no answer. */
export function isDelegatedGrpcInvokeResult(value: unknown): value is DelegatedGrpcInvokeResult {
  if (!value || typeof value !== 'object') return false;
  const { success, error, executedOn, response } = value as {
    success?: unknown;
    error?: unknown;
    executedOn?: unknown;
    response?: unknown;
  };
  const stamped = !!executedOn && typeof executedOn === 'object';
  if (success === true) return stamped && !!response && typeof response === 'object';
  return success === false && typeof error === 'string' && stamped;
}

/**
 * The wire a delegating gRPC transport rides — one place, chosen by an
 * explicit backend id. `invoke` sends the unary frame and awaits the
 * whole reply deadline-free (the call's own ceiling rides inside the
 * frame); `abort` asks the place to stop the unary call it knows by
 * this id; `call` sends an OPEN or a rider and awaits the place's
 * answer; `subscribe` claims the place's events for one socket id
 * until the disposer runs. Every call rejects on a dead wire or the
 * place's refusal.
 */
export interface DelegatedGrpcWire {
  invoke(frame: DelegatedGrpcInvokeFrame): Promise<unknown>;
  abort(sendId: string): void;
  call(frame: DelegatedGrpcOpenFrame | DelegatedSocketRider): Promise<unknown>;
  subscribe(socketId: string, onEvent: (event: DelegatedSocketEvent) => void): () => void;
}
