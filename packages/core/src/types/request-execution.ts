/**
 * Request execution snapshot — the response shape the runtime returns
 * to UI surfaces after running a Request through the executor.
 */

import type { ResourceTimingEntry } from '../resource-timing';
import type { RequestMutation, ScriptConsoleEntry, TestAssertion } from '../scripts';
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
}

export interface ExecutedRequestSnapshot {
  /** HTTP status (e.g. 200). `0` when the request never completed
   *  (DNS failure, network offline, aborted). */
  status: number;
  statusText: string;
  /** Final URL after redirects — might differ from the submitted one. */
  url: string;
  headers: Array<{ key: string; value: string }>;
  /** Response body as text. Binary payloads get a base64 fallback via
   *  `bodyEncoding = 'base64'` once we add that — for v1 everything is
   *  read as text. */
  body: string;
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
  /** Wire-layer capture for this fetch (remote IP, raw Set-Cookie).
   *  Absent when nothing was captured or the join was ambiguous. */
  wire?: ExecutedWireCapture;
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
