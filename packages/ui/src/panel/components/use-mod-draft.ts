/**
 * Draft-state subsystem for the rule hover popover's editor block: the
 * mod draft, its derived dirty flag, the re-prime pass and the
 * auto-rebase pass. Extracted verbatim from `RuleHoverPopover` — the
 * fingerprint shapes and effect gating are load-bearing (see the
 * derived-dirty commentary inline).
 *
 * The conflict-tracker baseline is coordinated through
 * `setConflictBaselineRef` (the `RuleEditor` `setBaselineRef` seam):
 * `useRuleConflicts` consumes this hook's `isDirty`, so it must be
 * called after it, while this hook's effects need the tracker's
 * `setBaseline`. The component owns the ref and wires the setter in
 * after calling the tracker; effects fire post-render, so the ref is
 * populated by the time they run.
 */

import type { HeaderModification, HeaderOperation, Rule } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { type Dispatch, type RefObject, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import type { RuleHoverPopoverTarget } from './RuleHoverPopover';

export interface ModDraft {
  operation: HeaderOperation;
  headerName: string;
  value: string;
  mergeSeparator?: string;
}

interface UseModDraftArgs {
  currentMod: HeaderModification | null;
  target: RuleHoverPopoverTarget | undefined;
  liveRule: Rule | null;
  setConflictBaselineRef: RefObject<(rule: Rule) => void>;
}

export interface ModDraftApi {
  draft: ModDraft;
  setDraft: Dispatch<SetStateAction<ModDraft>>;
  /** Live mirror of `draft` for the save flow's async closure. */
  draftRef: RefObject<ModDraft>;
  updateDraft: (patch: Partial<ModDraft>) => void;
  isDirty: boolean;
}

export function useModDraft({ currentMod, target, liveRule, setConflictBaselineRef }: UseModDraftArgs): ModDraftApi {
  const [draft, setDraft] = useState<ModDraft>(() => ({
    operation: currentMod?.operation ?? target?.operation ?? 'override',
    headerName: currentMod?.headerName ?? target?.headerName ?? '',
    value: currentMod?.value ?? '',
    mergeSeparator: currentMod?.mergeSeparator,
  }));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // ── Derived dirty (matches `shared/forms/index.ts` convention) ──
  //
  // Compare draft to currentMod via a stable fingerprint. Self-heals
  // on every revert path:
  //   - Manual revert (typed back to original): fingerprints align,
  //     dirty clears.
  //   - External save lands: currentMod refreshes via `useRules` →
  //     fingerprints align (assuming user isn't editing) → dirty
  //     clears. The re-prime effect below also catches this case
  //     when the user happens to be editing (gate stays on isDirty).
  //   - Save commit: broadcast lands carrying values we just submitted
  //     → currentMod matches draft → dirty clears.
  const draftFingerprint = useMemo(
    () =>
      stableStringify({
        operation: draft.operation,
        headerName: draft.headerName,
        value: draft.value,
        mergeSeparator: draft.mergeSeparator ?? null,
      }),
    [draft],
  );
  const currentModFingerprint = useMemo(
    () =>
      currentMod
        ? stableStringify({
            operation: currentMod.operation,
            headerName: currentMod.headerName,
            value: currentMod.value ?? '',
            mergeSeparator: currentMod.mergeSeparator ?? null,
          })
        : null,
    [currentMod],
  );
  // `lastPrimedFingerprint` is the baseline the draft was last synced
  // from (init / re-prime / take-theirs / save echo). Comparing against
  // it (NOT against the live `currentMod`) is what distinguishes "user
  // has untouched edits" from "form is briefly stale because a
  // broadcast just landed". Without this, an external save would flip
  // `isDirty` true on a clean popover, gate the re-prime effect, and
  // leave the draft stuck on the old value. Mirrors the workbench
  // pattern (see `RuleEditor`).
  const [lastPrimedFingerprint, setLastPrimedFingerprint] = useState<string | null>(null);
  const isDirty =
    lastPrimedFingerprint !== null && currentModFingerprint !== null && draftFingerprint !== lastPrimedFingerprint;

  // Re-prime on rule version bump (another tab saved) only when the
  // user hasn't started editing yet. Gate is the derived `isDirty`
  // (against `lastPrimedFingerprint`, NOT current canonical — see
  // baseline state above for the architectural rationale). Re-prime
  // also seeds the conflict tracker's baseline; doing it here (NOT on
  // every `liveRule` change) keeps `getConflict`'s `base` pinned to
  // the value the popover was last synced from, so when an external
  // save lands while the user has unsaved typing, base != theirs and
  // the diff chip renders correctly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: prime only when the underlying entry changes.
  useEffect(() => {
    if (isDirty) return;
    if (!currentMod) return;
    setDraft({
      operation: currentMod.operation,
      headerName: currentMod.headerName,
      value: currentMod.value ?? '',
      mergeSeparator: currentMod.mergeSeparator,
    });
    if (currentModFingerprint) setLastPrimedFingerprint(currentModFingerprint);
    if (liveRule) setConflictBaselineRef.current(liveRule);
  }, [currentMod?.operation, currentMod?.headerName, currentMod?.value, currentMod?.mergeSeparator]);

  // Auto-rebase: as soon as the draft converges with the current
  // canonical (manual revert / take-theirs / save echo), snap the
  // baseline so dirty clears without imperative bookkeeping. Same
  // pattern as `RuleEditor`. The conflict baseline catches up here
  // too — if the user took theirs / reverted, the chip should hide.
  useEffect(() => {
    if (currentModFingerprint === null) return;
    if (draftFingerprint !== currentModFingerprint) return;
    if (lastPrimedFingerprint === currentModFingerprint) return;
    setLastPrimedFingerprint(currentModFingerprint);
    if (liveRule) setConflictBaselineRef.current(liveRule);
  }, [draftFingerprint, currentModFingerprint, lastPrimedFingerprint, liveRule, setConflictBaselineRef]);

  const updateDraft = (patch: Partial<ModDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    // Dirty derives from draft vs currentMod equality — no imperative
    // flag needed.
  };

  return { draft, setDraft, draftRef, updateDraft, isDirty };
}
