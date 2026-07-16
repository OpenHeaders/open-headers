/**
 * Request execution snapshot — the response shape the runtime returns
 * to UI surfaces after running a Request through the executor.
 */

import type { ResourceTimingEntry } from '../resource-timing';
import type { RequestMutation, ScriptConsoleEntry, ScriptExecutionMode, TestAssertion } from '../scripts';
import type { CredentialsMode } from './request';

/**
 * Wire bytes the executor itself serialized for the request. Only what
 * we set is countable — the browser adds its own headers (Host,
 * User-Agent, Accept-*, Content-Length, …) that fetch never exposes,
 * so these are lower bounds, presented as such.
 */
export interface ExecutedRequestSize {
  /** Serialized `key: value` bytes of the headers the executor set. */
  headersBytes: number;
  /** Body bytes as serialized for the wire. */
  bodyBytes: number;
  /** True when `bodyBytes` is an estimate — multipart bodies use a
   *  browser-generated boundary we can't observe before send. */
  bodyApproximate?: boolean;
}

/**
 * Facts observed at the network-interception layer for the executor's
 * own fetch — things `fetch()` withholds (Set-Cookie is a forbidden
 * response header; the remote address is never exposed). Captured by a
 * heuristic join from the fetch window to the extension's own
 * webRequest traffic; absent when the join found nothing or was
 * ambiguous (more than one candidate chain). Nothing here caches live
 * state — `credentialsMode` records the policy this send ran under.
 */
export interface ExecutedWireCapture {
  /** Server IP the final hop was sent to. */
  ip?: string;
  /** Raw `Set-Cookie` values across the chain's redirect hops, in
   *  arrival order. The response CARRIED these; whether the browser
   *  stored them depends on `credentialsMode`. */
  setCookieHeaders?: string[];
  /** Cookie policy the request was sent under (`'omit'` = the browser
   *  discarded any Set-Cookie it received). */
  credentialsMode: CredentialsMode;
}

/**
 * Machine-readable remedy attached to an error snapshot — lets the UI
 * offer an action instead of only prose. `open-in-tab` covers the
 * untrusted-certificate case: fetch from an extension context rejects
 * self-signed certs with no interstitial, but opening the URL in a
 * regular tab lets the user accept the certificate, after which the
 * browser remembers the exception for that host:port and a retry
 * succeeds.
 */
export interface ExecutedRequestErrorHint {
  kind: 'open-in-tab';
  /** URL to open — the submitted request URL. */
  url: string;
  /** True when the failure is (or is overwhelmingly likely to be) a
   *  certificate rejection — drives the compact trust-steps
   *  presentation: one-line summary instead of the message prose. */
  certificate?: boolean;
  /** Recovered net-stack code (e.g. `net::ERR_CERT_AUTHORITY_INVALID`)
   *  — the UI shows it beside the error title, keeping the generic
   *  code apart from the actionable guidance. Absent when the failure
   *  was classified heuristically without a wire-recovered code. */
  netError?: string;
}

/**
 * One redirect hop of a followed chain — the request that actually went
 * on the wire and the 3xx it answered with, plus the policy transitions
 * the follower applied deriving the NEXT hop. Attribution only ("record
 * what the send DID"): the hop was already followed; nothing here is
 * read back by the runtime.
 */
export interface ExecutedRedirectHop {
  /** URL this hop's request was sent to. */
  url: string;
  /** HTTP method sent on this hop. */
  method: string;
  /** The hop's redirect status (301/302/303/307/308). */
  status: number;
  statusText: string;
  /** The `Location` header value as the hop answered it — possibly
   *  relative; the follower resolves it against this hop's URL. */
  location: string;
  /** Present when the spec's method demotion fired deriving the next
   *  hop (301/302 POST→GET, 303 any-non-GET/HEAD→GET) — the value the
   *  method changed TO. Absent when the method carried over (307/308,
   *  already GET/HEAD, or the `followOriginalHttpMethod` opt-in). */
  methodChangedTo?: string;
  /** What happened to a carried `Authorization` header when this hop's
   *  redirect crossed origin: `'stripped'` (the default policy) or
   *  `'forwarded'` (the `followAuthorizationHeader` opt-in fired).
   *  Absent when no Authorization header was in play or the next hop
   *  stayed same-origin. */
  authorization?: 'stripped' | 'forwarded';
}

export interface ExecutedRequestSnapshot {
  /** HTTP status (e.g. 200). `0` when the request never completed
   *  (DNS failure, network offline, aborted). */
  status: number;
  statusText: string;
  /** Final URL after redirects — might differ from the submitted one. */
  url: string;
  headers: Array<{ key: string; value: string }>;
  /**
   * HTTP trailer fields the final response carried after its body
   * (gRPC's `grpc-status`/`grpc-message` live here). Present only when
   * the executing host's network stack exposes trailers and the
   * response sent some — browser fetch never does (the extension omits
   * them, like other unhonorable knobs); the node runtime reads them
   * off its `request()` wire path. Attribution only — recorded from
   * what arrived, never a behavior change.
   */
  trailers?: Array<{ key: string; value: string }>;
  /** Response body. UTF-8 text verbatim by default; when the wire bytes
   *  don't decode as UTF-8 the executor stores them base64-encoded and
   *  marks `bodyEncoding` — lossless either way. */
  body: string;
  /** Present (`'base64'`) when `body` carries base64-encoded wire bytes
   *  because the payload is not valid UTF-8 text. Absent = text. */
  bodyEncoding?: 'base64';
  /** True when the body exceeded the wire byte cap and was truncated. */
  bodyTruncated: boolean;
  /** The cap the executor applied when it truncated — present only
   *  when `bodyTruncated`, so the UI labels the actual limit (a user
   *  setting) instead of assuming a constant. */
  bodyCapBytes?: number;
  /** Bytes read from the wire before any truncation. */
  bodyBytes: number;
  durationMs: number;
  /**
   * Resource-timing entry the executor's own performance timeline
   * recorded for this fetch. Absent when the platform recorded none
   * (unsupported context, entry never matched). Connection legs and
   * sizes are gated by `Timing-Allow-Origin` and read `0` when the
   * server withholds them — consumers must treat `0` as "hidden",
   * never as an instant step. HTTP version derives from
   * `timing.nextHopProtocol` at consume time; it is not cached here.
   */
  timing?: ResourceTimingEntry;
  /** Bytes the executor serialized onto the wire for the request —
   *  absent on error snapshots. */
  requestSize?: ExecutedRequestSize;
  /**
   * True when the draft carried a body the runtime could not put on the
   * wire for this method — browser `fetch()` refuses to construct a
   * GET/HEAD request with a body — so the send proceeded WITHOUT it.
   * Attribution for the response surface: the exchange succeeded, but
   * the server never saw the body.
   */
  requestBodyOmitted?: boolean;
  /** Wire-layer capture for this fetch (remote IP, raw Set-Cookie).
   *  Absent when nothing was captured or the join was ambiguous. */
  wire?: ExecutedWireCapture;
  /**
   * True when this send ran with SSL certificate verification disabled
   * (the per-request `sslVerification: false` opt-in, honored by node
   * runtimes). Recorded on the snapshot — not read from live request
   * state — so the response surface can mark the run even after the
   * setting is flipped back. Absent = the runtime verified as usual.
   */
  sslVerificationDisabled?: boolean;
  /**
   * True when this send ran with its TLS protocol floor LOWERED below
   * the runtime's TLS 1.2 default (the per-request `tlsMinVersion:
   * '1.0' | '1.1'` opt-in, honored by node runtimes). Like
   * `sslVerificationDisabled`, the policy is known before the wire —
   * recorded on success and error snapshots alike so the response
   * surface can mark the run even after the setting is raised back.
   * Absent = the send kept the runtime's own floor.
   */
  tlsFloorLowered?: boolean;
  /**
   * True when this send actually RE-SENT the `Authorization` header
   * across a cross-origin redirect hop (the per-request
   * `followAuthorizationHeader` opt-in, honored by node runtimes).
   * Recorded only when the policy fired — a send whose chain stayed
   * same-origin (or never redirected) carries no marker even with the
   * knob on; attribution records what the send did, not what was
   * configured.
   */
  authorizationForwarded?: boolean;
  /**
   * The `Cookie` header value the runtime's cookie jar attached to the
   * FIRST hop of this send (the per-request `cookieJar` opt-in, honored
   * by node runtimes). Recorded for reproducibility — the wire request
   * is not reconstructible without it — never read from live jar
   * state. Absent when the jar was off, empty, matched nothing, or a
   * user-set `Cookie` header won. Not a trust marker.
   */
  cookieHeaderAttached?: string;
  /**
   * Names of the cookies this send's `Set-Cookie` responses stored
   * into the runtime's cookie jar, across every hop of the chain in
   * arrival order (the per-request `cookieJar` opt-in). Absent when
   * the jar was off or nothing was stored.
   */
  cookiesCaptured?: string[];
  /**
   * Phase marks the executing host's transport measured around its own
   * exchange, ms — the node runtime's manual-marks twin of the
   * browser's `timing` entry (its network stack exposes no resource
   * timing). `redirectMs` = time chasing redirect hops before the
   * final hop's dispatch (present only when the chain had hops);
   * `waitingMs` = final hop dispatch → response head (TTFB; the
   * DNS/connect/TLS legs the runtime cannot observe separately are
   * inside it); `downloadMs` = head → end of the body read. Absent on
   * hosts that record a real `timing` entry instead, and on error
   * snapshots. Attribution only — recorded from what the send did.
   */
  phaseTimings?: {
    redirectMs?: number;
    waitingMs: number;
    downloadMs: number;
  };
  /**
   * The redirect hops this send followed before the final response,
   * in wire order — each one the request sent and the 3xx it answered
   * with (the final response is the snapshot itself). Present only
   * when the executing host's network stack owns its redirect chain
   * (the node runtime's hand-rolled follower) AND at least one
   * redirect was followed; browser fetch follows internally and never
   * exposes hops, so the extension omits the field — the usual
   * capability asymmetry. Attribution only, never a behavior change.
   */
  redirectChain?: ExecutedRedirectHop[];
  /**
   * The remote host that executed this send on the caller's behalf — a
   * peer-forwarded dispatch answered by a connected back-end. Stamped
   * by the ANSWERING host at run time, so the attribution (the egress
   * IP / locale the target saw belongs to that machine, not this
   * surface's) survives reconnecting to a different back-end. Absent =
   * the send executed on this surface's own host.
   */
  executedOn?: {
    kind: 'backend';
    /** The executing machine's hostname label. */
    name: string;
  };
  /**
   * How a streamed interactive capture ended — present only when the
   * live stream phase actually engaged (body chunks were pushed while
   * the read was still in progress) or the read ended early:
   *
   *   - `'end'`     — the server closed the stream after live frames
   *                    had been pushed (an SSE source that finished).
   *   - `'stop'`    — the user stopped the send; the body is whatever
   *                    arrived ("stop and snapshot" — NOT truncation).
   *   - `'cap'`     — the byte cap aborted a live stream
   *                    (`bodyTruncated` rides alongside as usual).
   *   - `'timeout'` — the per-request deadline fired after the response
   *                    head arrived; partial body materialized instead
   *                    of an error snapshot.
   *   - `'error'`   — the connection failed mid-body; partial body
   *                    materialized, the failure text in `message`.
   *
   * Ordinary responses — even under a streaming read — complete before
   * the first flush window and carry no rider. Attribution only:
   * recorded from what the send did, never read back by the runtime.
   */
  streamedCapture?: {
    endedBy: 'end' | 'stop' | 'cap' | 'timeout' | 'error';
    /** Failure text for `endedBy: 'error'` — the classified network
     *  error that ended the stream after bytes had arrived. */
    message?: string;
  };
  /** Non-null when the request failed before producing a response. */
  error: string | null;
  /** Actionable remedy for the failure — present only alongside
   *  `error`, when the executor could classify one. */
  errorHint?: ExecutedRequestErrorHint;
  /**
   * Script outcome — `null` when no scripts ran, otherwise carries the
   * assertions + console + mutation summary surfaced by the pre-request
   * and/or post-response scripts. Split into two fields so the UI can
   * render them independently (pre-request logs vs assertions).
   */
  scripts?: {
    /**
     * Execution mode this send's scripts ran under (`'safe'` = the
     * host's sandboxed runtime, `'developer'` = the full-runtime worker
     * opt-in). Recorded on the snapshot — never read from live settings
     * — so the response surface can attribute the run even after the
     * workspace's mode is flipped. Absent on snapshots minted before
     * the mode existed (the extension's offscreen sandbox pre-dates it).
     */
    mode?: ScriptExecutionMode;
    preRequest?: {
      succeeded: boolean;
      error?: { name: string; message: string };
      consoleLog: ScriptConsoleEntry[];
      durationMs: number;
      /** Summary of what the pre-request script mutated — useful for
       *  the UI to show "1 header added" style hints. Non-authoritative;
       *  the actual fetch uses the merged snapshot. */
      mutation?: RequestMutation;
    };
    postResponse?: {
      succeeded: boolean;
      error?: { name: string; message: string };
      assertions: TestAssertion[];
      consoleLog: ScriptConsoleEntry[];
      durationMs: number;
    };
  } | null;
}
