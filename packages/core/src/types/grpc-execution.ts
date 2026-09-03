/**
 * gRPC execution snapshot — the response shape the runtime returns to
 * UI surfaces after invoking a GrpcRequest. Own shape beside
 * `ExecutedRequestSnapshot` (own entity kind, own executor plane —
 * never a discriminant on the HTTP snapshot).
 *
 * Capture law: the snapshot records what the call DID, verbatim —
 * unframed message wire bytes with each frame's compression flag as
 * received, initial metadata and trailers as answered, and the
 * grpc-status the reply actually carried (`null` when it carried
 * none). Schema-driven decode is a display-side VIEW over these bytes;
 * nothing here is ever rewritten to make a reply look well-formed.
 */

import type { GrpcScriptKind, ScriptExecutionMode } from '../scripts';
import type {
  ExecutedAuthAttribution,
  ExecutedProxyRoute,
  ExecutedScriptFold,
  ExecutedSessionScriptMark,
  ScriptEventSummary,
  TrustCertificateErrorHint,
} from './request-execution';

/** One message frame of the call, unwrapped from the wire: the payload
 *  bytes base64-encoded and the frame's compression flag as received
 *  (v1 negotiates no compression, so a compressed frame renders as a
 *  diagnostic rather than decoding). Streaming calls record BOTH
 *  directions in call order — `direction` tags each frame ('up' =
 *  client-sent, 'down' = server-sent); absent = 'down', the unary
 *  capture's shape. Timestamps are deliberately NOT here: message
 *  times are session-only display data (the SSE precedent). */
export interface ExecutedGrpcMessageFrame {
  dataBase64: string;
  compressed: boolean;
  direction?: 'up' | 'down';
}

/**
 * One script hook ran — the per-event detail of the call's scripts
 * ({@link ExecutedSessionScriptMark}) under the gRPC hook kinds.
 * Recorded per event (Before invoke once, an On message per captured
 * frame either direction, After response once) up to the mark cap;
 * the snapshot's `scripts` record keeps the tallies past it. `atIndex`
 * is the number of captured frames when the hook FINISHED, so the
 * timeline renders the row at its true position while `messages` and
 * its positional session timing stay untouched (the WebSocket
 * lifecycle law — the frames array is positional, decoded by index).
 */
export interface ExecutedGrpcScriptMark extends ExecutedSessionScriptMark {
  kind: 'script';
  hook: GrpcScriptKind;
  atIndex: number;
}

/**
 * The call's scripts as they ran — one record per hook the call
 * carries scripts for: the once-per-call hooks keep their fold, On
 * message keeps a tally. Absent when no hook ran. `mode` is the trust
 * posture the hooks ran under, recorded on the snapshot — never
 * re-read from live settings.
 */
export interface ExecutedGrpcScripts {
  mode?: ScriptExecutionMode;
  beforeInvoke?: ExecutedScriptFold;
  onMessage?: ScriptEventSummary;
  afterResponse?: ExecutedScriptFold;
  /** The per-event marks stopped at the cap — the tallies above kept
   *  counting; the timeline shows the first frames' detail only. */
  marksCapped?: true;
}

export interface ExecutedGrpcSnapshot {
  /** HTTP/2 `:status` of the reply (200 on any well-formed gRPC
   *  exchange, error statuses included). `0` when the call never
   *  produced a response (connect failure, pre-head deadline, abort). */
  httpStatus: number;
  /** Initial metadata (the response HEADERS frame), wire order. */
  headers: Array<{ key: string; value: string }>;
  /** Trailer fields, verbatim — empty for trailers-only replies
   *  (their status rides `headers`; see `grpcStatusSource`). */
  trailers: Array<{ key: string; value: string }>;
  /** The reply's `grpc-status` code; `null` = the server sent none
   *  anywhere — surfaced honestly, never defaulted to 0. */
  grpcStatus: number | null;
  /** `grpc-message`, percent-decoded; absent when the server sent none. */
  grpcMessage?: string;
  /** Where the status was found: `'trailers'` (the normal shape) or
   *  `'headers'` (a trailers-only reply). `null` with a null status. */
  grpcStatusSource: 'trailers' | 'headers' | null;
  /** Unwrapped response message frames in wire order — one entry for a
   *  well-behaved unary reply; extras are captured and surfaced. */
  messages: ExecutedGrpcMessageFrame[];
  /** How many of `messages` preceded the response head in CALL order —
   *  where "Response received" interleaves into the timeline. Absent on
   *  unary captures (no timeline) and calls that never produced a head. */
  headAtMessage?: number;
  /** True when the body ended mid-frame (capped read, severed
   *  connection) — `messages` holds the complete frames that arrived. */
  incompleteTail?: boolean;
  /** True when the response body exceeded the byte cap and the read
   *  was aborted. */
  bodyTruncated: boolean;
  /** The cap in force when `bodyTruncated` — labels the actual limit. */
  bodyCapBytes?: number;
  /** Framed body bytes read off the wire before any truncation. */
  bodyBytes: number;
  durationMs: number;
  /** The auth the call applied and where it came from — the request's
   *  own or a resolved ancestor pool entry; absent when the request's
   *  own auth is `none` (the HTTP snapshot's twin). */
  auth?: ExecutedAuthAttribution;
  /**
   * Wire truth for the call's proxy routing — the effective route as
   * the dial ran it. gRPC editors carry no request-plane proxy knobs
   * (the H5 ruling), so the plane is always `'system'` and the
   * stand-down analog is the Unix-socket pin only. Present only when
   * the system plane decided something; a plain direct call
   * carries no field.
   */
  proxyRoute?: ExecutedProxyRoute;
  /** True when the user stopped a streaming call after the response
   *  head — the capture holds what arrived (unary aborts before a head
   *  map onto `error` instead). */
  stopped?: boolean;
  /**
   * The connection died AFTER the response head — a keepalive ping
   * unanswered, the server's GOAWAY, a reset mid-body. The capture
   * holds what arrived and `grpcStatus` keeps its honest null (no
   * trailers came); this names the reason. Never beside `error`
   * (pre-head failures) or `stopped` (the user's own end).
   */
  connectionError?: string;
  /**
   * The remote host that executed this invoke on the caller's behalf —
   * a peer-forwarded dispatch answered by a connected back-end. Stamped
   * by the ANSWERING host at run time (the HTTP snapshot's twin: the
   * egress IP / locale the target saw belongs to that machine, not this
   * surface's). Absent = the invoke executed on this surface's own host.
   */
  executedOn?: {
    kind: 'backend';
    /** The executing machine's hostname label. */
    name: string;
  };
  /** The metadata pairs the call actually carried, in send order —
   *  user rows template-resolved plus the auth-composed
   *  `authorization` pair, recorded by the executor at dispatch (the
   *  ↑ twin of `headers`). Present iff the wire exchange was
   *  attempted: a compose/resolve failure that never dispatched
   *  carries none. Session display truth — examples never persist it
   *  (resolved values are volatile). */
  requestMetadata?: Array<{ key: string; value: string }>;
  /** The call's script hooks as they ran — see {@link ExecutedGrpcScripts};
   *  absent when no hook ran. */
  scripts?: ExecutedGrpcScripts;
  /** The per-event script marks in the order they landed, each at its
   *  capture position — see {@link ExecutedGrpcScriptMark}. Absent
   *  when no hook ran. Session display truth beside `scripts` —
   *  examples never persist either. */
  scriptMarks?: ExecutedGrpcScriptMark[];
  /** Non-null when the call failed before producing a response. */
  error: string | null;
  /** The canonical gRPC status the CLIENT runtime assigned a LOCAL
   *  failure — 14 UNAVAILABLE for an unreachable target, 4
   *  DEADLINE_EXCEEDED for an elapsed deadline, 1 CANCELLED for a
   *  pre-head stop (the client-runtime semantic every gRPC runtime
   *  surfaces; the meta strip's status pill renders it). Never wire
   *  truth — `grpcStatus` keeps its honest null. Present only beside
   *  `error`, and absent where no canonical mapping exists (a
   *  malformed target, a compose error). */
  localStatus?: number;
  /** A TLS verification failure's remedy — the presented chain the
   *  pane can offer for pinning (the HTTP snapshot's hint). Present
   *  only beside `error`, on a TLS channel. */
  hint?: TrustCertificateErrorHint;
}
