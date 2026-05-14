/**
 * `useReprime` — typed reprime hook owning the comparison shape
 * (BC1 from the bug-class table) by construction. Callers supply
 * `formFingerprint`, `signature`, `populate`. The hook returns
 * `isDirty` + `primedFingerprint` so the editor never reads both
 * fingerprints simultaneously and cannot write `liveFp !== formFp`
 * by accident.
 *
 * Internally wraps the existing `useEntityReprime` for reprime gating
 * + focus discipline, then layers on the auto-rebase + dirty-derivation
 * logic that every editor used to hand-roll.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEntityReprime, type EntityReprimeScope } from '../forms';

export interface UseReprimeInput<E> {
  liveEntity: E | null | undefined;
  scope: EntityReprimeScope;
  enabled: boolean;
  /** Stable signature of the editor's draft state. The hook compares
   *  this to the last-primed signature to derive `isDirty`. */
  formFingerprint: string;
  /** Entity-to-signature function. Same shape as `useEntityReprime`. */
  signature: (entity: E) => string;
  /** Re-prime callback. Must call the editor's setDraft / setForm.
   *  The hook advances `primedFingerprint` AFTER `populate` runs. */
  populate: (entity: E) => void;
  /** Fires after reprime AND after auto-rebase, with the liveEntity
   *  whose signature the hook just adopted. Editors use this to
   *  advance per-editor baselines (e.g. conflict tracker baseline)
   *  without re-implementing the gating. */
  onPrimed?: (entity: E) => void;
}

export interface UseReprimeOutput {
  isDirty: boolean;
  primedFingerprint: string | null;
}

export function useReprime<E>(input: UseReprimeInput<E>): UseReprimeOutput {
  const { liveEntity, scope, enabled, formFingerprint, signature, populate, onPrimed } = input;

  const [primedFingerprint, setPrimedFingerprint] = useState<string | null>(null);

  const liveFingerprint = useMemo(
    () => (liveEntity ? signature(liveEntity) : null),
    [liveEntity, signature],
  );

  const isDirty = primedFingerprint !== null && formFingerprint !== primedFingerprint;

  // Refs so editors don't have to memoize callbacks for correctness.
  const onPrimedRef = useRef(onPrimed);
  onPrimedRef.current = onPrimed;
  const liveEntityRef = useRef(liveEntity);
  liveEntityRef.current = liveEntity;

  useEntityReprime<E>({
    liveEntity,
    scope,
    isDirty,
    enabled,
    signature,
    populate: (entity) => {
      populate(entity);
      setPrimedFingerprint(signature(entity));
      onPrimedRef.current?.(entity);
    },
  });

  // Auto-rebase: form converged with canonical (Use Saved sweep,
  // post-save echo, peer-mirrors-our-edit). Advance primed-fingerprint
  // so dirty drops to false naturally on the next render.
  useEffect(() => {
    if (liveFingerprint === null) return;
    if (formFingerprint !== liveFingerprint) return;
    if (primedFingerprint === liveFingerprint) return;
    setPrimedFingerprint(liveFingerprint);
    const entity = liveEntityRef.current;
    if (entity) onPrimedRef.current?.(entity);
  }, [formFingerprint, liveFingerprint, primedFingerprint]);

  return { isDirty, primedFingerprint };
}
