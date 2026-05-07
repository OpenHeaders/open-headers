/**
 * Per-leaf auto-rebase effect for editors with a conflict tracker.
 *
 * The whole-form `useEntityReprime` only re-primes when every leaf is
 * clean — once any field is dirty, all leaves stop catching up to peer
 * commits. That's wrong per §6.2: two surfaces editing different paths
 * must both apply unconditionally with no banner.
 *
 * `useEntityConflicts.getAutoMergeable(form)` returns the set of leaves
 * where `form === baseline` (untouched in this tab) AND `live` diverged.
 * This hook walks that set on every relevant change and:
 *
 *   1. Calls the caller's `applyToForm(path, theirs)` — writes the new
 *      value into the editor's form / draft state.
 *   2. Calls `acceptTheirs(path, theirs)` — advances the conflict
 *      tracker baseline + dismisses the chip.
 *
 * Touched leaves never enter `getAutoMergeable`, so this hook can't
 * silently overwrite a user edit; the existing chip / banner / dialog
 * surfaces continue to handle real conflicts.
 *
 * Entity-agnostic: works for every editor that wires `useEntityConflicts`.
 */

import { useEffect } from 'react';
import type { PathMap } from './conflict-adapters';
import type { EntityConflictsApi } from './use-entity-conflicts';

export interface UseAutoMergeFormArgs<E extends { uid: string }> {
  conflicts: Pick<EntityConflictsApi<E>, 'getAutoMergeable' | 'acceptTheirs'>;
  /**
   * Path-keyed projection of the editor's current form. Same shape
   * `extractBaseline` produces on the entity. Pass `null` while the
   * editor isn't ready (no live entity, no form yet) and the effect
   * short-circuits.
   */
  formProjection: PathMap | null | undefined;
  /**
   * Caller's per-path write into the form / draft state. Receives the
   * peer's value at this path; should write it via `form.setFieldValue`
   * / `setDraft` / equivalent. Implementations typically reuse the
   * entity's `applyResolutionToForm` adapter with `{ base: '', theirs }`.
   * Returning a boolean is allowed but not required — the effect
   * doesn't branch on it.
   */
  applyToForm: (path: string, theirs: string) => void;
}

export function useAutoMergeForm<E extends { uid: string }>(args: UseAutoMergeFormArgs<E>): void {
  const { conflicts, formProjection, applyToForm } = args;
  useEffect(() => {
    if (!formProjection) return;
    const auto = conflicts.getAutoMergeable(formProjection);
    if (auto.size === 0) return;
    for (const [path, theirs] of auto) {
      applyToForm(path, theirs);
      conflicts.acceptTheirs(path, theirs);
    }
  }, [formProjection, conflicts, applyToForm]);
}
