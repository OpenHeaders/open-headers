/**
 * The wire-hop seam's shared types — what the policy layer above
 * (redirect chain, digest leg, jar, deadline, capped read, finalize)
 * and the wire pipelines below (undici fetch hop, undici `request()`
 * hop, prior-knowledge h2 hop) exchange per hop. One home so the seam
 * is readable in one place, not re-assembled from re-exports.
 */

import type { LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import type { SecureVersion } from 'node:tls';
import {
  type TransportBody,
  TransportError,
  type TransportHeader,
  type TransportRequest,
  type TransportStreamObserver,
} from '@openheaders/oracle/live/request-exec/transport';
import type { Dispatcher, FormData, Headers, fetch as undiciFetch } from 'undici';
import type { H3HelperClient } from '../h3-helper/helper-process';
import type { H3ClientCert } from '../h3-helper/protocol';
import type { ConnectionRecord } from '../instrumented-connector';
import type { ProxyTunnel } from './connect-tunnel';

/** The fetch pipeline behind the transport — undici's fetch in
 *  production; injectable so tests observe the exact init (including
 *  the dispatcher) without stubbing globals. */
export type NodeFetchFn = typeof undiciFetch;

/** The slice of an undici `request()` result the transport consumes —
 *  the seam is typed to it so tests can hand back plain readables.
 *  `trailers` is undici's live view of the response's HTTP trailer
 *  fields — empty until the body has been consumed, populated after. */
export interface NodeRequestResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Readable;
  trailers?: Record<string, string | string[] | undefined>;
}

/** The spec-free pipeline behind GET/HEAD-with-body and gRPC hops —
 *  undici's `request()` in production; injectable like
 *  {@link NodeFetchFn} and typed to exactly what the transport sends
 *  and reads. */
export type NodeRequestFn = (
  url: string,
  options: {
    method: string;
    headers: Headers;
    body?: string | FormData;
    dispatcher?: Dispatcher;
    signal?: AbortSignal;
  },
) => Promise<NodeRequestResponse>;

/** undici's RequestInit — carries the `dispatcher` slot the DOM-shaped
 *  init type doesn't know about. */
export type NodeRequestInit = NonNullable<Parameters<NodeFetchFn>[1]>;

/** The TLS/connection option bag shared by the direct path (`Agent`'s
 *  `connect`) and the proxied path (`ProxyAgent`'s `requestTls` — the
 *  TARGET leg of the tunnel; `ProxyAgent` ignores a plain `connect`). */
export interface ConnectOptions {
  rejectUnauthorized?: boolean;
  minVersion?: SecureVersion;
  maxVersion?: SecureVersion;
  ciphers?: string;
  lookup?: LookupFunction;
  cert?: string;
  key?: string;
  passphrase?: string;
  allowH2?: boolean;
  socketPath?: string;
}

/** Mutable per-hop send state — what actually changes across a redirect
 *  chain. The body stays the data-only `TransportBody`; `buildBody`
 *  re-materializes a fresh `BodyInit` per hop (a consumed FormData /
 *  URLSearchParams is never reused). */
export interface HopState {
  url: string;
  method: string;
  headers: ReadonlyArray<TransportHeader>;
  body: TransportBody;
}

/** What one wire round-trip yields to the redirect loop and the capped
 *  body read — the slice of the fetch `Response` surface they actually
 *  touch. A fetch hop returns its `Response` as-is; a `request()` hop
 *  (GET/HEAD with a body) adapts onto the same shape. */
type FetchResponse = Awaited<ReturnType<NodeFetchFn>>;
export interface HopResponse {
  status: number;
  statusText: string;
  url: string;
  headers: FetchResponse['headers'];
  body: FetchResponse['body'];
  /** HTTP trailer fields, read AFTER the body is consumed — a thunk
   *  because undici populates its trailers object only once the body
   *  stream ends. Absent on the fetch path: WHATWG fetch dropped
   *  trailers from its surface entirely, so only `request()` hops can
   *  report them. */
  trailers?: () => TransportHeader[];
}

/** Abort deadline over a whole send — see {@link startDeadline}. */
export type Deadline = ReturnType<typeof startDeadline>;

/** The streaming leg of one send — the observer live frames feed plus
 *  the caller's abort signal (Stop). `null` = buffered `send`. */
export interface StreamingLeg {
  observer: TransportStreamObserver;
  signal?: AbortSignal;
}

/**
 * Per-send prior-knowledge pipeline leg — present exactly when the
 * request pins `'2-prior-knowledge'`. Carries the connection-option
 * bag every hop's h2 session dials with (computed once, the
 * one-dispatcher-per-send discipline) and the sink the pipeline's
 * spoken-protocol facts report into — the always-on report's source
 * for sends that never touch a dispatcher.
 */
export interface H2Leg {
  kind: '2-prior-knowledge';
  connect: ConnectOptions;
  /** CONNECT-tunnel route when the request sets a proxy — every hop's
   *  session dials the proxy, tunnels to the origin, and runs its TLS
   *  (or h2c framing) over the tunnel socket. */
  proxy?: ProxyTunnel;
  onProtocol(origin: string, alpnProtocol: string): void;
  /** `captureNetwork` sink: every hop's session dial hands over its
   *  connection record at dial start, the instrumented connector's
   *  contract (a tunneled hop's record describes the proxy leg — see
   *  `h2-prior-knowledge.ts`). Absent = no socket-fact collection. */
  onConnection?(record: ConnectionRecord): void;
}

/**
 * Per-send HTTP/3 pipeline leg — present exactly when the request pins
 * `'3'`. Carries the helper client every hop rides, the TLS trust legs
 * the framed protocol maps onto rustls (which inherits nothing from
 * Node/OpenSSL — see the request-engine H3-protocol design), and the
 * spoken-protocol sink, like {@link H2Leg}. The client-certificate key
 * is already decrypted — a passphrase never crosses the protocol.
 */
export interface H3Leg {
  kind: '3';
  client: H3HelperClient;
  insecure?: boolean;
  clientCert?: H3ClientCert;
  connectAddress?: string;
  /** TLS 1.3 IANA suite names restricting every hop's handshake —
   *  parsed and gated to the helper's vocabulary pre-wire. */
  cipherSuites?: string[];
  /** `captureNetwork`: every hop asks the helper for a fresh
   *  instrumented dial (never a pooled connection) whose socket facts
   *  and QUIC dial timings ride the response head. */
  captureNetwork?: boolean;
  onProtocol(origin: string, alpnProtocol: string): void;
  /** `captureNetwork` sink: each hop's instrumented-dial facts as a
   *  connection record (see `h3-helper/h3-hop.ts` — the record lands at
   *  the response head, marks synthesized from the helper's measured
   *  durations; no TCP leg on QUIC). Absent = no collection. */
  onConnection?(record: ConnectionRecord): void;
}

/** The per-send pinned-pipeline leg — `null` on sends that ride the
 *  undici pipelines (`auto` / `'1.1'` / `'2'`). */
export type WireLeg = H2Leg | H3Leg;

/**
 * Arm an abort deadline for the round-trip; `null` when neither trigger
 * exists. A streaming leg's external signal (the executor's Stop hook)
 * merges onto the same controller so one signal spans connection and
 * body read for both triggers — `expired()` still names only the
 * timeout, which is how callers tell the two apart.
 */
export function startDeadline(timeoutMs: number | undefined, externalSignal?: AbortSignal) {
  if (timeoutMs === undefined && externalSignal === undefined) return null;
  const controller = new AbortController();
  let expired = false;
  const timer =
    timeoutMs === undefined
      ? null
      : setTimeout(() => {
          expired = true;
          controller.abort();
        }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal !== undefined) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort);
  }
  return {
    signal: controller.signal,
    expired: () => expired,
    clear: () => {
      if (timer !== null) clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

export function timeoutError(timeoutMs: number | undefined): TransportError {
  return new TransportError(`Request timed out after ${timeoutMs} ms.`);
}

/**
 * Backstop deadline for the hand-rolled pinned pipelines when the
 * request carries no timeout of its own. The undici pipelines are
 * backstopped by undici's built-in 300 s headers/body timers, but the
 * prior-knowledge h2 session and the HTTP/3 helper exchange have no
 * library watchdog — without this, a server that keeps the connection
 * alive (pings) while never answering would hang the send forever.
 * Same 300 s figure, so the two worlds fail alike.
 */
export const PINNED_PIPELINE_TIMEOUT_MS = 300_000;

/** Apply {@link PINNED_PIPELINE_TIMEOUT_MS} to a timeout-less
 *  `'2-prior-knowledge'` / `'3'` send; every other request passes
 *  through untouched (a user-set timeout always wins). */
export function withPinnedPipelineTimeout(request: TransportRequest): TransportRequest {
  if (request.timeoutMs !== undefined) return request;
  if (request.httpVersion !== '3' && request.httpVersion !== '2-prior-knowledge') return request;
  return { ...request, timeoutMs: PINNED_PIPELINE_TIMEOUT_MS };
}
