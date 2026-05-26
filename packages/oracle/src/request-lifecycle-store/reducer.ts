/**
 * Pure per-entity reducer: `(prev, update) → result`.
 *
 * The reducer is the sole place where lifecycle invariants 3, 5, 6 are
 * enforced on apply. Rejections are returned as structured results so
 * the store can log/drop without throwing; the reducer never mutates.
 *
 * Invariants enforced here (each by name in comments at the rejection
 * site):
 *   - Invariant 3: monotonic steady-phase advance.
 *   - Invariant 5: monotonic information content across `phase` patches.
 *   - Invariant 6: redirect is the sole retrograde transition, may not
 *                  fire from a terminal phase.
 *
 * Invariants NOT enforced here:
 *   - Invariant 1 (identity tuple) — the store's keyed map embodies it.
 *   - Invariant 2 (tab scope) — owned by the store's per-tab partition
 *                                + `forgetTab` wiring.
 *   - Invariants 7, 8 — owned by the heuristic correlator / integration.
 */

import {
  isPhaseAdvance,
  isRedirectReset,
  isTerminalPhase,
  patchRefines,
} from '@openheaders/core/request-lifecycle';
import type {
  RedirectHop,
  RequestLifecycle,
  RequestLifecyclePatch,
  RequestLifecycleUpdate,
} from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';

/** Why a reducer step rejected an update. */
export type ReducerRejection =
  /** `started` for an already-tracked `(tabId, requestId)` — correlator bug. */
  | 'duplicate-started'
  /** Any non-`started`/non-`gone` update referencing an unknown lifecycle. */
  | 'unknown-request'
  /** Invariant 3: phase moved backward (non-redirect). */
  | 'phase-retrograde'
  /** Invariant 3: terminal-to-terminal swap (`completed` ↔ `failed`). */
  | 'phase-terminal-swap'
  /** Invariant 5: patch tried to clear a previously-set field. */
  | 'patch-disappearance'
  /** Invariant 6: redirect arrived after a terminal phase. */
  | 'redirect-from-terminal'
  /** Invariant 6: redirect hop count did not advance by exactly one. */
  | 'redirect-hop-mismatch';

/** What the store should do with the entry after this update. */
export type ReducerResult =
  | { readonly kind: 'insert'; readonly next: RequestLifecycle }
  | { readonly kind: 'update'; readonly next: RequestLifecycle }
  | { readonly kind: 'delete' }
  | { readonly kind: 'noop' }
  | { readonly kind: 'reject'; readonly reason: ReducerRejection };

export function reduce(
  prev: RequestLifecycle | undefined,
  update: RequestLifecycleUpdate,
): ReducerResult {
  switch (update.kind) {
    case 'started':
      return reduceStarted(prev, update.lifecycle);
    case 'phase':
      return reducePhase(prev, update.patch);
    case 'redirect':
      return reduceRedirect(prev, update.hop, update.nextUrl);
    case 'har-attached':
      return reduceHarAttached(prev, update.hopIndex, update.har);
    case 'body-attached':
      return reduceBodyAttached(prev, update.hopIndex, update.body);
    case 'gone':
      return prev === undefined ? { kind: 'noop' } : { kind: 'delete' };
  }
}

function reduceStarted(
  prev: RequestLifecycle | undefined,
  lifecycle: RequestLifecycle,
): ReducerResult {
  if (prev !== undefined) return { kind: 'reject', reason: 'duplicate-started' };
  return { kind: 'insert', next: lifecycle };
}

function reducePhase(
  prev: RequestLifecycle | undefined,
  patch: RequestLifecyclePatch,
): ReducerResult {
  if (prev === undefined) return { kind: 'reject', reason: 'unknown-request' };

  if (patch.phase !== undefined) {
    if (!isPhaseAdvance(prev.phase, patch.phase)) {
      const isTerminalSwap =
        isTerminalPhase(prev.phase) && isTerminalPhase(patch.phase) && prev.phase !== patch.phase;
      return { kind: 'reject', reason: isTerminalSwap ? 'phase-terminal-swap' : 'phase-retrograde' };
    }
  }

  if (!patchRefines(prev, patch)) {
    // Invariant 5 — a previously-set field would disappear.
    return { kind: 'reject', reason: 'patch-disappearance' };
  }

  return { kind: 'update', next: applyPatch(prev, patch) };
}

function reduceRedirect(
  prev: RequestLifecycle | undefined,
  hop: RedirectHop,
  nextUrl: string,
): ReducerResult {
  if (prev === undefined) return { kind: 'reject', reason: 'unknown-request' };

  const nextHopCount = prev.redirectHopCount + 1;
  if (!isRedirectReset(prev.phase, prev.redirectHopCount, nextHopCount)) {
    // Invariant 6 — either terminal-phase source or non-unit hop advance.
    return {
      kind: 'reject',
      reason: isTerminalPhase(prev.phase) ? 'redirect-from-terminal' : 'redirect-hop-mismatch',
    };
  }

  const next: RequestLifecycle = {
    ...prev,
    url: nextUrl,
    phase: 'pending',
    redirectHopCount: nextHopCount,
    redirectHops: [...prev.redirectHops, hop],
    hopStartedAtMs: hop.timestampMs,
    // invariant 5 carve-out — per-hop resolution fields reset on redirect.
    // `patchRefines` would reject this as patch-disappearance if it ran here;
    // it doesn't, because the reducer constructs `next` directly. The 3xx
    // status is preserved on `hop.statusCode`, not on `statusCode`.
    statusCode: undefined,
    statusText: undefined,
    fromCache: undefined,
    error: undefined,
    cors: undefined,
    completedAtMs: undefined,
  };
  return { kind: 'update', next };
}

function reduceHarAttached(
  prev: RequestLifecycle | undefined,
  hopIndex: number,
  har: InspectorHarEntry,
): ReducerResult {
  if (prev === undefined) return { kind: 'reject', reason: 'unknown-request' };
  const nextHar = new Map(prev.har);
  nextHar.set(hopIndex, har);
  return { kind: 'update', next: { ...prev, har: nextHar } };
}

function reduceBodyAttached(
  prev: RequestLifecycle | undefined,
  hopIndex: number,
  body: InspectorHarBody,
): ReducerResult {
  if (prev === undefined) return { kind: 'reject', reason: 'unknown-request' };
  const nextBody = new Map(prev.harBodyByHop);
  nextBody.set(hopIndex, body);
  return { kind: 'update', next: { ...prev, harBodyByHop: nextBody } };
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
