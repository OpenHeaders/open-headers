/**
 * useDirtyDraft — shared dirty-tracking for editor tabs.
 *
 * Four editor surfaces (environment, workspace-vars, vault, collection-
 * vars) implemented the same pattern by hand: fingerprint the persisted
 * value, fingerprint the in-flight draft, surface an `isDirty` boolean
 * for the save button + parent notification. Each copy had the same
 * latent bug — `persistedFp` was kept in a `useRef`, which does not
 * trigger the `isDirty` `useMemo` when it changes, so a fresh save
 * would flip `isDirty` to `false` briefly and then snap back to `true`
 * on the next render. This hook centralizes the pattern so the bug
 * can't come back.
 *
 * Contract:
 *   - `serverDraft` is the server's current authoritative value in
 *     draft shape. Callers that transform between persisted + draft
 *     shapes (e.g. `VaultEditor`'s `toVars` / `fromVars`) do the
 *     transform outside the hook and pass the draft-shape view in.
 *   - `fingerprint` MUST be a stable reference across renders.
 *     Declare it at module scope, or wrap in `useCallback`. The hook
 *     uses it inside `useMemo` / `useEffect` deps; a fresh fingerprint
 *     fn every render thrashes the memo.
 *   - `markPersisted(next)` is called after a successful save to
 *     snapshot the just-persisted value. `isDirty` flips to false on
 *     the next render.
 *   - `resetToServer()` discards local edits — used by the
 *     stale-draft "reload" path.
 *
 * Resync behaviour: when `serverDraft` changes identity AND its
 * fingerprint differs from the last-known persisted fingerprint, the
 * hook snaps `draft` to the new server value and updates
 * `persistedFp`. This matches the prior per-editor behaviour (another
 * tab saves → my draft is replaced). The Phase 10 stale-draft banner
 * is the richer UX; this hook is just the plumbing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface UseDirtyDraftOptions<T> {
  /** Server's current value in draft shape. `null` during loading. */
  serverDraft: T | null;
  /** Fingerprint the draft. STABLE REFERENCE REQUIRED. */
  fingerprint: (draft: T) => string;
  /** Fallback draft when `serverDraft` is null (not yet loaded). */
  empty: T;
}

export interface UseDirtyDraftApi<T> {
  draft: T;
  setDraft: React.Dispatch<React.SetStateAction<T>>;
  isDirty: boolean;
  /** Snapshot a just-persisted value as the new "clean" baseline.
   *  Callers that transform before saving (e.g. vault) pass the
   *  transformed draft so the fingerprint lines up. */
  markPersisted: (persisted: T) => void;
  /** Discard local edits; snap draft + fingerprint back to
   *  `serverDraft`. No-op when the server value isn't loaded yet. */
  resetToServer: () => void;
}

export function useDirtyDraft<T>({ serverDraft, fingerprint, empty }: UseDirtyDraftOptions<T>): UseDirtyDraftApi<T> {
  const initial = serverDraft ?? empty;
  const [draft, setDraft] = useState<T>(() => initial);
  const [persistedFp, setPersistedFp] = useState<string>(() => fingerprint(initial));

  // Recomputed each render; React compares primitives by value so the
  // effect only re-runs when the server fingerprint actually changes.
  const serverFp = serverDraft == null ? null : fingerprint(serverDraft);

  // Resync on SERVER-CONTENT changes only — keyed on the fingerprint
  // string, not on `serverDraft` identity. Broadcast replays hand us a
  // new array with identical content; we must NOT treat that as "the
  // server moved" and blow away in-flight edits.
  //
  // `fingerprint` is deterministic-by-contract: identical content →
  // identical `serverFp` → effect doesn't re-run → draft preserved.
  // When the server's content actually changes, `serverFp` changes and
  // React creates a fresh effect closure with the new `serverDraft`,
  // so the `setDraft(serverDraft)` below sees the post-change value.
  // biome-ignore lint/correctness/useExhaustiveDependencies: server-content-change only — see comment block above
  useEffect(() => {
    if (serverDraft == null || serverFp == null) return;
    setPersistedFp(serverFp);
    setDraft(serverDraft);
  }, [serverFp]);

  const isDirty = useMemo(() => fingerprint(draft) !== persistedFp, [draft, persistedFp, fingerprint]);

  const markPersisted = useCallback(
    (persisted: T) => {
      setPersistedFp(fingerprint(persisted));
    },
    [fingerprint],
  );

  const resetToServer = useCallback(() => {
    if (serverDraft == null || serverFp == null) return;
    setPersistedFp(serverFp);
    setDraft(serverDraft);
  }, [serverDraft, serverFp]);

  return { draft, setDraft, isDirty, markPersisted, resetToServer };
}
