/**
 * Step script hooks — the host-injectable seam that lets a workflow
 * step opt into running its request's pre-request / post-response
 * scripts (`WorkflowStep.runScripts`).
 *
 * The executor stays host-neutral: it only knows the
 * {@link StepScriptRunner} port. The browser SW injects an
 * offscreen-sandbox-backed runner; hosts without a script runtime
 * (Firefox, the desktop main process today) inject nothing and the
 * step executes scriptless exactly as before.
 *
 * Chain-run semantics are STRICTER than interactive Send:
 *   - a pre-request script error fails the step (an interactive Send
 *     proceeds to the wire) — a chain that ships an unmutated request
 *     and commits its captures would cache silently-wrong data;
 *   - a post-response script error fails the step;
 *   - a failed `oh.test` assertion fails the step — assertions gate
 *     the atomic capture commit, so last-good values survive a run
 *     whose response shape went wrong.
 *
 * `RequestSnapshot.params` note: the host-neutral resolver folds query
 * params into the URL at resolve time (there is no structured param
 * list on {@link ResolvedRequest}), so the snapshot's `params` are
 * parsed back out of the resolved URL's query string, and a `params`
 * mutation REPLACES that query string wholesale. Same observable
 * contract as the interactive executor: url + params always agree.
 */

import type {
  RequestMutation,
  RequestSnapshot,
  ResponseSnapshot,
  ScriptExecutionResult,
  ScriptKind,
  TestAssertion,
} from '@openheaders/core/scripts';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { ensureScheme } from '@openheaders/core/utils';
import { defaultContentType, type ResolvedRequest } from './resolve-request';

/** One script execution the host runs on the step's behalf. */
export interface StepScriptInput {
  kind: ScriptKind;
  source: string;
  request: RequestSnapshot;
  response?: ResponseSnapshot;
}

/**
 * Host script capability. Implementations run the source in the host's
 * sandbox and never throw — sandbox/transport failures surface as
 * `succeeded: false` results, mirroring the offscreen contract.
 */
export type StepScriptRunner = (input: StepScriptInput) => Promise<ScriptExecutionResult>;

/**
 * Project a resolved request into the mutable view scripts see.
 * Query params are parsed from the resolved URL (see module doc).
 */
export function resolvedToScriptSnapshot(resolved: ResolvedRequest): RequestSnapshot {
  return {
    method: resolved.method,
    url: resolved.url,
    headers: resolved.headers.map((h) => ({ key: h.key, value: h.value })),
    params: parseUrlParams(resolved.url),
    body: resolved.body,
  };
}

function parseUrlParams(url: string): Array<{ key: string; value: string }> {
  try {
    const parsed = new URL(ensureScheme(url.trim()));
    return [...parsed.searchParams.entries()].map(([key, value]) => ({ key, value }));
  } catch {
    return [];
  }
}

/**
 * Apply a pre-request script's mutation diff on top of the resolved
 * request. Mirrors the interactive executor's contract: headers /
 * params are full-list replacements, a body mutation re-derives the
 * default Content-Type unless an explicit header is present. A `params`
 * mutation rewrites the URL's query string (applied after a `url`
 * mutation, so the two compose the way scripts observe them).
 */
export function applyScriptMutation(resolved: ResolvedRequest, mutation: RequestMutation): ResolvedRequest {
  const next: ResolvedRequest = { ...resolved };
  if (mutation.method) next.method = mutation.method;
  if (mutation.url) next.url = mutation.url;
  if (mutation.headers) next.headers = mutation.headers.map((h) => ({ key: h.key, value: h.value }));
  if (mutation.params) next.url = replaceUrlParams(next.url, mutation.params);
  if (mutation.body) {
    next.body = mutation.body;
    if (!next.headers.some((h) => h.key.toLowerCase() === 'content-type')) {
      const ct = defaultContentType(mutation.body);
      if (ct) next.headers = [...next.headers, { key: 'Content-Type', value: ct }];
    }
  }
  return next;
}

function replaceUrlParams(url: string, params: Array<{ key: string; value: string }>): string {
  try {
    const parsed = new URL(ensureScheme(url.trim()));
    parsed.search = '';
    for (const p of params) parsed.searchParams.append(p.key, p.value);
    return parsed.toString();
  } catch {
    // Unparseable URL — leave it; the wire executor surfaces the
    // malformed-URL error with the specific reason.
    return url;
  }
}

/** First failed assertion of a post-response run, if any. */
export function firstFailedAssertion(assertions: readonly TestAssertion[]): TestAssertion | undefined {
  return assertions.find((a) => !a.passed);
}

type ScriptsOutcome = NonNullable<ExecutedRequestSnapshot['scripts']>;

/** Map a sandbox result to the snapshot's `scripts.preRequest` shape. */
export function toPreRequestOutcome(result: ScriptExecutionResult): ScriptsOutcome['preRequest'] {
  return {
    succeeded: result.succeeded,
    error: result.error ? { name: result.error.name, message: result.error.message } : undefined,
    consoleLog: result.consoleLog,
    durationMs: result.durationMs,
    mutation: result.mutation,
  };
}

/** Map a sandbox result to the snapshot's `scripts.postResponse` shape. */
export function toPostResponseOutcome(result: ScriptExecutionResult): ScriptsOutcome['postResponse'] {
  return {
    succeeded: result.succeeded,
    error: result.error ? { name: result.error.name, message: result.error.message } : undefined,
    assertions: result.assertions,
    consoleLog: result.consoleLog,
    durationMs: result.durationMs,
  };
}
