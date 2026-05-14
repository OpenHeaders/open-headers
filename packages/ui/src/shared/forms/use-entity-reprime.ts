/**
 * `useEntityReprime` — entity-agnostic reactive form reconcile.
 *
 * Every entity editor (Rule, Request, Template, Environment, Vault,
 * WorkspaceVariables, LiveWorkflow, LiveVariable, …) implements the
 * same pattern: when the live entity mirror broadcasts a fresh
 * snapshot, the editor re-primes its form (or controlled draft state)
 * from the new value SO LONG AS the user isn't mid-edit. This hook
 * encapsulates the gating discipline so every editor reads identical
 * semantics from one place — same shape as `<EntityField>` for focus
 * publishing.
 *
 * Gates (in order):
 *
 *   1. **`enabled`**. Caller passes `false` while the editor's first
 *      init pass hasn't happened yet, or while it's in a mode that
 *      doesn't reconcile (create-mode drafts before first save).
 *   2. **No entity**. Nothing to reconcile against.
 *   3. **`isDirty`**. The user has uncommitted edits; the LWW save
 *      resolves the conflict at oracle time per design §6.3, the
 *      inline diff chip handles the focused-field case. Re-priming
 *      would drop the user's typing.
 *   4. **Signature unchanged**. The live mirror rebuilds the entity
 *      object on every broadcast (new reference, identical content);
 *      without this guard the effect re-runs on every rebroadcast and
 *      re-primes for free. Caller supplies the signature function so
 *      it controls equality semantics.
 *   5. **Local focus on THIS entity**. While the local surface has a
 *      field of this entity focused, re-priming would tear down
 *      `Form.List` rows / controlled inputs — the focused element
 *      remounts, the browser fires blur on the removed node, the
 *      `EntityField` blur capture publishes `null`, and the
 *      field-level presence chip vanishes even though the user is
 *      still inside the field. This also covers the post-save echo
 *      path: after a local save, the broadcasts that come back
 *      already match the form's values; re-priming would just churn
 *      focus. Reconciliation resumes the next time the signature
 *      changes after blur.
 *
 * The hook returns `markPopulated` so the caller's init pass can
 * seed the signature ref after its own first populate — that prevents
 * the very first post-init broadcast from re-priming for content
 * we already populated.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useActiveFieldFocus } from '../awareness';

export interface EntityReprimeScope {
  entityType: string;
  /** May be `null` / `undefined` while the editor is in a pre-entity
   *  mode (create flow before first save). The hook short-circuits in
   *  that case regardless of `enabled`. */
  entityId: string | null | undefined;
}

export interface UseEntityReprimeOptions<T> {
  /** The live entity from the renderer-side mirror. `null` /
   *  `undefined` skips reconciliation. */
  liveEntity: T | null | undefined;
  scope: EntityReprimeScope;
  isDirty: boolean;
  /** Caller's "ready to reconcile" gate — typically a state mirror of
   *  the editor's init-completed flag. */
  enabled: boolean;
  /** Content equality function. Returns a stable string the hook
   *  compares to the last-populated signature. Common shape:
   *  `JSON.stringify(entity)`. */
  signature: (entity: T) => string;
  /** Caller's re-prime callback. Invoked with the latest live entity
   *  whenever a re-prime passes all gates. Side-effectful (calls
   *  `form.setFieldsValue` / `setDraft` / etc.). */
  populate: (entity: T) => void;
}

export interface EntityReprimeHandle {
  /** Seed the last-populated signature without invoking `populate`.
   *  Caller's own init pass calls this after its first populate so
   *  the post-init broadcast (carrying identical content) doesn't
   *  trigger a redundant re-prime. */
  markPopulated(entity: unknown): void;
}

export function useEntityReprime<T>(opts: UseEntityReprimeOptions<T>): EntityReprimeHandle {
  const { liveEntity, scope, isDirty, enabled, signature, populate } = opts;

  const sig = useMemo(() => (liveEntity ? signature(liveEntity) : null), [liveEntity, signature]);

  const lastSignatureRef = useRef<string | null>(null);
  // Effects close over the latest populate via ref so callers don't
  // have to memoize their populate function — re-prime correctness
  // shouldn't depend on referential stability of an inert callback.
  const populateRef = useRef(populate);
  populateRef.current = populate;
  // Same dance for `signature`: recomputed inline when seeding via
  // `markPopulated`, where the caller passes a fresh entity.
  const signatureRef = useRef(signature);
  signatureRef.current = signature;

  const activeFieldFocus = useActiveFieldFocus();
  const localFocusedOnThisEntity =
    activeFieldFocus !== null &&
    !!scope.entityId &&
    activeFieldFocus.entityType === scope.entityType &&
    activeFieldFocus.entityId === scope.entityId;

  useEffect(() => {
    if (!enabled) return;
    if (!liveEntity) return;
    if (isDirty) return;
    if (sig !== null && lastSignatureRef.current === sig) return;
    if (localFocusedOnThisEntity) return;
    lastSignatureRef.current = sig;
    populateRef.current(liveEntity);
  }, [enabled, liveEntity, isDirty, sig, localFocusedOnThisEntity]);

  return {
    markPopulated(entity) {
      if (entity == null) {
        lastSignatureRef.current = null;
        return;
      }
      lastSignatureRef.current = signatureRef.current(entity as T);
    },
  };
}
