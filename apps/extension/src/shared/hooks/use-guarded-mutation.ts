/**
 * Shared workspace-guard wrapper for renderer write-client hooks.
 *
 * Every `useXxxMutator` hook (rule, request, template, env, collection,
 * vault, files, layout-state, pause-markers, etc.) has the same shape:
 *
 *   1. Module-level `NO_WORKSPACE` failure literal.
 *   2. Per-callback `useCallback(async (...args) => { if (!workspaceId)
 *      return NO_WORKSPACE; return applyXxx(payload, { workspaceId,
 *      surfaceId }); }, [workspaceId, surfaceId])`.
 *   3. Final `useMemo(() => ({ ...callbacks }), [...callbacks])`.
 *
 * `useGuardedMutation` collapses (1) + (2) into a single line per
 * callback. Each call accepts a `body` lambda that takes a typed
 * `BaseSyncWriteOptions` plus the user-facing positional args; the hook
 * guards `workspaceId`, threads `(workspaceId, surfaceId)` to body on
 * the happy path, and returns a stable callback identity per
 * `(workspaceId, surfaceId)` pair.
 *
 * The body lambda is read through a ref so callers can pass freshly-
 * constructed inline lambdas at every render without disturbing the
 * memoised callback's identity — same callback-stability contract the
 * hand-written hooks observe today.
 *
 * Result-type constraint: every renderer write-client result type is a
 * union that includes `SyncFailure` (`SyncSimpleResult` IS this; entity
 * `XMutationResult` shapes carry it as their `{ ok: false }` arm). The
 * `R extends SyncMutationResult` constraint documents that the
 * fallback narrowing in the guard branch is structurally sound — the
 * `as R` is the localized type-system bridge, not a runtime workaround.
 */

import { useCallback, useRef } from 'react';
import type { BaseSyncWriteOptions } from '@/shared/sync/apply-payload';

/** The `{ ok: false; reason: 'other' }` arm every renderer sync
 *  result carries. `message` is optional because `SyncSimpleResult`
 *  declares it that way; the no-workspace literal still populates it. */
export interface SyncFailure {
  ok: false;
  reason: 'other';
  message?: string;
}

/** Constraint on the result type of any guarded mutation body: must be
 *  a union of an `{ ok: true; ... }` arm plus at least one
 *  `{ ok: false; reason: string; message?: string }` arm. Every
 *  renderer write-client result satisfies this by construction (see
 *  session 41 — every `XSimpleResult` is a structural alias of
 *  `SyncSimpleResult`; every entity `XMutationResult` has the failure
 *  arms). */
export type SyncMutationResult =
  | { ok: true; [k: string]: unknown }
  | { ok: false; reason: string; message?: string };

/** Module-level singleton — same identity across every hook + every
 *  guarded callback so failure equality (===) holds at every call
 *  site without per-hook re-allocation. */
export const NO_WORKSPACE_FAILURE: SyncFailure = {
  ok: false,
  reason: 'other',
  message: 'no active workspace',
};

export function useGuardedMutation<A extends readonly unknown[], R extends SyncMutationResult>(
  workspaceId: string | null,
  surfaceId: string,
  body: (writeOpts: BaseSyncWriteOptions, ...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  // Body identity is unstable across renders for callers that build
  // inline lambdas; the ref always carries the latest implementation
  // without churning the callback's identity.
  const bodyRef = useRef(body);
  bodyRef.current = body;

  return useCallback(
    (...args: A): Promise<R> => {
      if (!workspaceId) {
        // SyncFailure is a member of R's union by the
        // `R extends SyncMutationResult` constraint; the narrowing
        // here is structural, not a workaround.
        return Promise.resolve(NO_WORKSPACE_FAILURE as R);
      }
      return bodyRef.current({ workspaceId, surfaceId }, ...args);
    },
    [workspaceId, surfaceId],
  );
}
