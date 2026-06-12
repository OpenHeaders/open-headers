/**
 * Pure client-side reducer: `(prev, update) → next`.
 *
 * Mirror image of the engine-side reducer in `@openheaders/oracle/request-lifecycle-store`,
 * minus invariant enforcement. The wire is trusted — the engine already
 * rejected malformed updates before they reached the hub, so this side
 * only needs to APPLY: merge patches, append redirect hops, set HAR /
 * body entries, swap on `gone`.
 *
 * Returning `prev` means noop (no React notification needed). Returning
 * `null` means the request has gone away.
 */

import type {
  RedirectHop,
  RequestLifecycle,
  RequestLifecyclePatch,
  RequestLifecycleUpdate,
} from '@openheaders/core/request-lifecycle';
import { appendStreamMessage, deriveHopNetworkStartMs } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';

/** `prev` = noop, `null` = delete, anything else = new state. */
export type ClientReducerResult = RequestLifecycle | null | typeof NOOP;

/**
 * Sentinel for "no state change" — distinct from a `null` delete and
 * cheaper than wrapping every result in a discriminated union.
 */
export const NOOP = Symbol('lifecycle-client-noop');

export function reduceClientUpdate(
  prev: RequestLifecycle | undefined,
  update: RequestLifecycleUpdate,
): ClientReducerResult {
  switch (update.kind) {
    case 'started':
      return prev === undefined ? update.lifecycle : NOOP;
    case 'phase':
      return prev === undefined ? NOOP : applyPatch(prev, update.patch);
    case 'redirect':
      return prev === undefined ? NOOP : applyRedirect(prev, update.hop, update.nextUrl);
    case 'har-attached':
      return prev === undefined ? NOOP : attachHar(prev, update.hopIndex, update.har);
    case 'body-attached':
      return prev === undefined ? NOOP : attachBody(prev, update.hopIndex, update.body);
    case 'message-appended':
      // The ring policy lives in core (`appendStreamMessage`) so this mirror
      // and the engine reducer can never diverge on the bound.
      return prev === undefined ? NOOP : appendStreamMessage(prev, update.message);
    case 'gone':
      return prev === undefined ? NOOP : null;
  }
}

function applyPatch(prev: RequestLifecycle, patch: RequestLifecyclePatch): RequestLifecycle {
  return {
    ...prev,
    ...(patch.phase !== undefined ? { phase: patch.phase } : {}),
    ...(patch.statusCode !== undefined ? { statusCode: patch.statusCode } : {}),
    ...(patch.statusText !== undefined ? { statusText: patch.statusText } : {}),
    ...(patch.fromCache !== undefined ? { fromCache: patch.fromCache } : {}),
    ...(patch.error !== undefined ? { error: patch.error } : {}),
    ...(patch.completedAtMs !== undefined ? { completedAtMs: patch.completedAtMs } : {}),
    ...(patch.hopNetworkStartMs !== undefined ? { hopNetworkStartMs: patch.hopNetworkStartMs } : {}),
    ...(patch.lastActivityAtMs !== undefined ? { lastActivityAtMs: patch.lastActivityAtMs } : {}),
    ...(patch.bytesReceivedSoFar !== undefined ? { bytesReceivedSoFar: patch.bytesReceivedSoFar } : {}),
    ...(patch.bytesTransferredSoFar !== undefined ? { bytesTransferredSoFar: patch.bytesTransferredSoFar } : {}),
    ...(patch.loadingStoppedAtMs !== undefined ? { loadingStoppedAtMs: patch.loadingStoppedAtMs } : {}),
    ...(patch.requestHeaders !== undefined ? { requestHeaders: patch.requestHeaders } : {}),
    ...(patch.requestHeadersProvisional !== undefined
      ? { requestHeadersProvisional: patch.requestHeadersProvisional }
      : {}),
  };
}

function applyRedirect(prev: RequestLifecycle, hop: RedirectHop, nextUrl: string): RequestLifecycle {
  return {
    ...prev,
    url: nextUrl,
    phase: 'pending',
    redirectHopCount: prev.redirectHopCount + 1,
    redirectHops: [...prev.redirectHops, hop],
    hopStartedAtMs: hop.timestampMs,
    // invariant 5 carve-out — per-hop resolution fields reset on redirect.
    // Twin of the engine-side reset in `oracle/request-lifecycle-store/reducer`;
    // the engine already validated the redirect before it reached the wire.
    statusCode: undefined,
    statusText: undefined,
    fromCache: undefined,
    error: undefined,
    completedAtMs: undefined,
    // The network start is per-hop; the new hop re-learns it from its own
    // timing / HAR.
    hopNetworkStartMs: undefined,
    // In-flight progress is per-hop; the new hop re-accumulates it.
    lastActivityAtMs: undefined,
    bytesReceivedSoFar: undefined,
    bytesTransferredSoFar: undefined,
    loadingStoppedAtMs: undefined,
    // Request headers are per-hop; the redirect target re-learns its own set.
    requestHeaders: undefined,
    requestHeadersProvisional: undefined,
  };
}

function attachHar(prev: RequestLifecycle, hopIndex: number, har: InspectorHarEntry): RequestLifecycle {
  const derived = deriveHopNetworkStartMs(prev, hopIndex, har);
  return {
    ...prev,
    har: setHopSlot(prev.har, hopIndex, har),
    ...(derived !== undefined ? { hopNetworkStartMs: derived } : {}),
  };
}

function attachBody(prev: RequestLifecycle, hopIndex: number, body: InspectorHarBody): RequestLifecycle {
  return { ...prev, harBodyByHop: setHopSlot(prev.harBodyByHop, hopIndex, body) };
}

// Mirror of the engine-side helper in `oracle/request-lifecycle-store/reducer`.
// Kept inline (4 lines) rather than abstracted into core — the two call
// sites have different state shapes and zero shared invariants beyond
// "copy-and-set with null padding."
function setHopSlot<T>(prev: readonly (T | null)[], hopIndex: number, value: T): (T | null)[] {
  const next = prev.slice();
  while (next.length <= hopIndex) next.push(null);
  next[hopIndex] = value;
  return next;
}
