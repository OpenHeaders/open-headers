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
    ...(patch.cors !== undefined ? { cors: patch.cors } : {}),
    ...(patch.completedAtMs !== undefined ? { completedAtMs: patch.completedAtMs } : {}),
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
    statusCode: undefined,
    statusText: undefined,
    fromCache: undefined,
    error: undefined,
    cors: undefined,
    completedAtMs: undefined,
  };
}

function attachHar(prev: RequestLifecycle, hopIndex: number, har: InspectorHarEntry): RequestLifecycle {
  const nextHar = new Map(prev.har);
  nextHar.set(hopIndex, har);
  return { ...prev, har: nextHar };
}

function attachBody(prev: RequestLifecycle, hopIndex: number, body: InspectorHarBody): RequestLifecycle {
  const nextBody = new Map(prev.harBodyByHop);
  nextBody.set(hopIndex, body);
  return { ...prev, harBodyByHop: nextBody };
}
