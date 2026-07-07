/**
 * Script sandboxing — shared types for pre-request + test scripts
 * (ARCHITECTURE §19). Platform-agnostic; the extension wraps these in
 * an offscreen-document sandbox, and the desktop app will wrap the
 * same types in a Worker when it lands.
 *
 * Design:
 *   • `ScriptExecutionRequest` + `ScriptExecutionResult` are the
 *     request/reply envelope for running ONE script — pure data, no
 *     code references, JSON-round-trippable so it can cross the
 *     SW ⇄ offscreen ⇄ iframe boundary via `postMessage`.
 *   • `oh.*` API calls from inside the sandbox are reflected back to
 *     the host as `ScriptHostRequest` messages; the host replies with
 *     `ScriptHostResponse`. The sandbox never touches storage or
 *     network directly.
 *   • `RequestSnapshot` / `ResponseSnapshot` are the mutable views of
 *     the request/response exposed to scripts. Pre-request scripts
 *     return a `RequestMutation` describing the diff; test scripts
 *     return assertion results.
 */

import type { HttpMethod, RequestBody } from '../types';
// ── Kinds ──────────────────────────────────────────────────────────

export type ScriptKind = 'pre-request' | 'post-response';

// ── Request / response shapes the script sees ──────────────────────

/**
 * Lightweight view of the outgoing request the script can read in
 * pre-request mode and read-only inspect in test mode. Headers + params
 * are carried as ordered tuples to preserve the user's edit intent.
 *
 * `body` mirrors the persistence-layer `RequestBody` discriminated
 * union — same variants, same field names — so a pre-request script
 * can return `{ type: 'form', formParts: [...] }` and the host can
 * apply the mutation without re-shaping. File parts are surfaced by
 * their `FileRef` metadata only; raw bytes don't cross the sandbox
 * boundary (scripts can't read or modify the wire blobs).
 */
export type RequestSnapshotBody = RequestBody;

export interface RequestSnapshot {
  method: HttpMethod;
  url: string;
  headers: Array<{ key: string; value: string }>;
  params: Array<{ key: string; value: string }>;
  body: RequestSnapshotBody;
}

/**
 * Read-only view of the response handed to test scripts. `body` is a
 * string — scripts parse JSON themselves (e.g. `JSON.parse(oh.response.body)`).
 */
export interface ResponseSnapshot {
  status: number;
  statusText: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
  durationMs: number;
}

// ── What scripts return ────────────────────────────────────────────

/**
 * A single assertion the test script registered via `oh.test(...)`.
 * Ordered so UI can render them in call order. `passed: false` carries
 * a best-effort message; uncaught errors land as a failed assertion
 * with name `'script error'`.
 */
export interface TestAssertion {
  name: string;
  passed: boolean;
  message?: string;
  durationMs?: number;
}

/**
 * Mutation diff a pre-request script produced. The host applies these
 * on top of the resolved request BEFORE the wire-level fetch.
 *
 * Absent keys mean "no change" — so a script that only tweaks one
 * header doesn't have to re-emit the whole request. This also keeps
 * the wire payload small when the script is a no-op.
 */
export interface RequestMutation {
  method?: HttpMethod;
  url?: string;
  /** Full replacement for the request's header list (post-resolution). */
  headers?: Array<{ key: string; value: string }>;
  /** Full replacement for the request's param list. */
  params?: Array<{ key: string; value: string }>;
  /** New body shape — same discriminated union as `RequestSnapshot.body`.
   *  Omit to leave the body untouched. */
  body?: RequestSnapshotBody;
}

/**
 * Log entry captured from `console.log/warn/error/info` inside the
 * sandbox. Serialized as stringified args so the log can cross the
 * postMessage boundary safely.
 */
export interface ScriptConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: string[];
  /** Millis since script start (`performance.now()`-based). */
  timeMs: number;
}

// ── Outer envelopes ────────────────────────────────────────────────

/**
 * One workspace script package shipped alongside an execution so
 * `oh.require('<name>')` resolves synchronously inside the sandbox.
 * The module source assigns its public surface to `module.exports`;
 * packages cannot require other packages.
 */
export interface ScriptPackageModule {
  name: string;
  source: string;
}

/**
 * Host → sandbox: run this script.
 *
 * `workspaceId` is echoed back on every host-RPC reply so the host can
 * route them to the right workspace context without the sandbox having
 * to know workspace ids.
 */
export interface ScriptExecutionRequest {
  /** Correlation id for this execution (host-assigned). */
  executionId: string;
  kind: ScriptKind;
  source: string;
  request: RequestSnapshot;
  response?: ResponseSnapshot;
  /** Optional OAuth credentialRef the script may request via `oh.vault.get(ref)`. */
  credentialRef?: string;
  /** Hard timeout for this script (default: 5000 ms). */
  timeoutMs?: number;
  /** Workspace script packages available to `oh.require` (active workspace). */
  packages?: ScriptPackageModule[];
}

/**
 * Sandbox → host: result of running one script.
 *
 * `succeeded` is false when the script threw a synchronous error,
 * exceeded `timeoutMs`, or raised a syntax error. Even then,
 * `assertions` + `mutation` + `consoleLog` carry whatever the script
 * produced BEFORE the error — a test script that asserts twice and
 * then throws still surfaces both assertion outcomes.
 */
export interface ScriptExecutionResult {
  executionId: string;
  succeeded: boolean;
  error?: { name: string; message: string; stack?: string };
  mutation?: RequestMutation;
  assertions: TestAssertion[];
  consoleLog: ScriptConsoleEntry[];
  /** Wall-clock duration, ms. */
  durationMs: number;
}

// ── `oh.*` host RPC envelopes ─────────────────────────────────────

/**
 * API calls the sandbox reflects back to the host. Each `HostRequest`
 * is replied to with a matching `HostResponse` whose `rpcId` matches.
 *
 * Discriminated on `op` so TypeScript enforces exhaustive handling on
 * the host side.
 *
 * Supported ops (the `oh.*` surface):
 *   • `variables.get(name)`       → string | null
 *   • `variables.set(name, value)` → void (writes to the `workspace`
 *                                    scope by default — env / vault
 *                                    can't be mutated from scripts
 *                                    without explicit opt-in)
 *   • `vault.get(ref)`             → string | null (read-only per §18)
 *   • `sendRequest(request)`       → ResponseSnapshot
 */
export type ScriptHostRequest =
  | {
      executionId: string;
      rpcId: string;
      op: 'variables.get';
      name: string;
    }
  | {
      executionId: string;
      rpcId: string;
      op: 'variables.set';
      name: string;
      value: string;
    }
  | {
      executionId: string;
      rpcId: string;
      op: 'vault.get';
      ref: string;
    }
  | {
      executionId: string;
      rpcId: string;
      op: 'sendRequest';
      request: RequestSnapshot;
    };

/**
 * Reply envelope for `ScriptHostRequest`. `value` is the op-specific
 * result; `error` is set when the host refused / failed. Exactly one
 * of the two is set.
 */
export type ScriptHostResponse =
  | { executionId: string; rpcId: string; ok: true; value: unknown }
  | { executionId: string; rpcId: string; ok: false; error: string };

// ── postMessage wire envelopes ─────────────────────────────────────

/**
 * The offscreen doc brokers three kinds of messages between SW and
 * sandbox. Tagging them explicitly stops mis-routing when multiple
 * scripts run concurrently.
 */
export type ScriptWireMessage =
  | { type: 'script.execute'; request: ScriptExecutionRequest }
  | { type: 'script.result'; result: ScriptExecutionResult }
  | { type: 'script.host-request'; request: ScriptHostRequest }
  | { type: 'script.host-response'; response: ScriptHostResponse };

/** Default timeout when `ScriptExecutionRequest.timeoutMs` is omitted. */
export const DEFAULT_SCRIPT_TIMEOUT_MS = 5000;

/** Hard upper bound — protects the SW from a runaway script even if
 *  the caller asks for more. */
export const MAX_SCRIPT_TIMEOUT_MS = 30000;

export function clampScriptTimeoutMs(requested: number | undefined): number {
  if (typeof requested !== 'number' || !Number.isFinite(requested) || requested <= 0) {
    return DEFAULT_SCRIPT_TIMEOUT_MS;
  }
  return Math.min(requested, MAX_SCRIPT_TIMEOUT_MS);
}
