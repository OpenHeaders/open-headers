/**
 * Generic draft-state subsystem for the quick-editors' edit-mode
 * fields: a canonical-primed draft record, its derived dirty flag, the
 * re-prime pass and the auto-rebase pass. Mirrors `use-mod-draft.ts` —
 * dirty derives from draft-vs-canonical fingerprint equality (never an
 * imperative flag), the baseline is `lastPrimedFingerprint` so an
 * external save landing mid-edit can't wedge the form, and convergence
 * with the canonical (manual revert / save echo) snaps the baseline so
 * dirty self-clears.
 *
 * `T` is the editor's draft record (a plain serializable object) —
 * callers map the rule's action into it with `useMemo` and back out of
 * it in their Save builder.
 */

import { stableStringify } from '@openheaders/ui/shared/forms';
import type { RefObject } from 'react';
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';

interface UseActionDraftArgs<T extends object> {
  /** Live rule's fields mapped to the draft shape, or null when the
   *  rule is gone / not editable in this popover. */
  canonical: T | null;
}

export interface ActionDraftApi<T extends object> {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  /** Live mirror of `draft` for the save flow's async closure. */
  draftRef: RefObject<T>;
  updateDraft: (patch: Partial<T>) => void;
  isDirty: boolean;
}

export function useActionDraft<T extends object>({ canonical }: UseActionDraftArgs<T>): ActionDraftApi<T> {
  const canonicalRef = useRef(canonical);
  canonicalRef.current = canonical;

  const [draft, setDraft] = useState<T>(() => ({ ...(canonical ?? ({} as T)) }));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const draftFingerprint = useMemo(() => stableStringify(draft), [draft]);
  const canonicalFingerprint = useMemo(() => (canonical ? stableStringify(canonical) : null), [canonical]);

  // `lastPrimedFingerprint` is the baseline the draft was last synced
  // from (init / re-prime / save echo). Comparing against it (NOT the
  // live canonical) distinguishes "user has untouched edits" from "form
  // is briefly stale because a broadcast just landed" — see
  // `use-mod-draft.ts` for the full rationale.
  const [lastPrimedFingerprint, setLastPrimedFingerprint] = useState<string | null>(null);
  const isDirty =
    lastPrimedFingerprint !== null && canonicalFingerprint !== null && draftFingerprint !== lastPrimedFingerprint;

  // Re-prime on rule version bump (another surface saved) only when the
  // user hasn't started editing yet.
  // biome-ignore lint/correctness/useExhaustiveDependencies: prime only when the canonical CONTENT changes.
  useEffect(() => {
    if (isDirty) return;
    const current = canonicalRef.current;
    if (!current) return;
    setDraft({ ...current });
    setLastPrimedFingerprint(canonicalFingerprint);
  }, [canonicalFingerprint]);

  // Auto-rebase: as soon as the draft converges with the current
  // canonical (manual revert / save echo), snap the baseline so dirty
  // clears without imperative bookkeeping.
  useEffect(() => {
    if (canonicalFingerprint === null) return;
    if (draftFingerprint !== canonicalFingerprint) return;
    if (lastPrimedFingerprint === canonicalFingerprint) return;
    setLastPrimedFingerprint(canonicalFingerprint);
  }, [draftFingerprint, canonicalFingerprint, lastPrimedFingerprint]);

  const updateDraft = (patch: Partial<T>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  return { draft, setDraft, draftRef, updateDraft, isDirty };
}
