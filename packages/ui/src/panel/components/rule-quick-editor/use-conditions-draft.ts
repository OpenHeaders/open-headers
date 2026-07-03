/**
 * Conditions draft for the quick-editor EDIT bodies — the canonical
 * rule's condition list, editable in the Conditions row. Mirrors
 * `use-response-draft.ts`: dirty derives from draft-vs-baseline
 * fingerprint equality (never an imperative flag), the baseline is
 * `lastPrimedFingerprint` so an external save landing mid-edit can't
 * wedge the form, and convergence with the canonical (manual revert /
 * save echo) snaps the baseline so dirty self-clears.
 *
 * Kept separate from the per-type field drafts on purpose: conditions
 * are shared by every rule type, while the field drafts are type-scoped
 * (header mod / response fields). The save paths include the edited
 * list only when THIS draft is dirty, so an untouched conditions row
 * never clobbers a concurrent conditions edit from another surface.
 */

import type { RuleCondition } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface UseConditionsDraftArgs {
  /** Live rule's conditions, or null when the rule is gone. */
  canonical: RuleCondition[] | null;
}

export interface ConditionsDraftApi {
  conditions: RuleCondition[];
  setConditions: Dispatch<SetStateAction<RuleCondition[]>>;
  /** Live mirror for the save flow's async closure. */
  conditionsRef: RefObject<RuleCondition[]>;
  isDirty: boolean;
}

export function useConditionsDraft({ canonical }: UseConditionsDraftArgs): ConditionsDraftApi {
  const [conditions, setConditions] = useState<RuleCondition[]>(() => canonical ?? []);
  const conditionsRef = useRef(conditions);
  conditionsRef.current = conditions;

  const draftFingerprint = useMemo(() => stableStringify(conditions), [conditions]);
  const canonicalFingerprint = useMemo(() => (canonical ? stableStringify(canonical) : null), [canonical]);

  const [lastPrimedFingerprint, setLastPrimedFingerprint] = useState<string | null>(null);
  const isDirty =
    lastPrimedFingerprint !== null && canonicalFingerprint !== null && draftFingerprint !== lastPrimedFingerprint;

  // Re-prime on rule version bump (another surface saved) only when the
  // user hasn't started editing yet.
  // biome-ignore lint/correctness/useExhaustiveDependencies: prime only when the canonical list changes.
  useEffect(() => {
    if (isDirty) return;
    if (!canonical) return;
    setConditions(canonical);
    if (canonicalFingerprint) setLastPrimedFingerprint(canonicalFingerprint);
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

  return { conditions, setConditions, conditionsRef, isDirty };
}
