/**
 * Request execution snapshot — the response shape the runtime returns
 * to UI surfaces after running a Request through the executor.
 */

import type { RequestMutation, ScriptConsoleEntry, TestAssertion } from '../scripts';

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
  /** Bytes read from the wire before any truncation. */
  bodyBytes: number;
  durationMs: number;
  /** Non-null when the request failed before producing a response. */
  error: string | null;
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
