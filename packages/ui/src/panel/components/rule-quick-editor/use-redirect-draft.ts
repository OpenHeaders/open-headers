/**
 * Draft-state subsystem for the redirect quick-editor's target field.
 * Mirrors `use-response-draft.ts` — dirty derives from draft-vs-canonical
 * fingerprint equality (never an imperative flag), the baseline is
 * `lastPrimedFingerprint` so an external save landing mid-edit can't
 * wedge the form, and convergence with the canonical (manual revert /
 * save echo) snaps the baseline so dirty self-clears.
 */

import type { RedirectAction } from '@openheaders/core/types';
import type { RefObject } from 'react';
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';
import type { RedirectQuickEditDraft } from '../../data/rule-create/redirect-rule-edit';

interface UseRedirectDraftArgs {
  /** Live rule's action, or null when the rule is gone / not a redirect rule. */
  currentAction: RedirectAction | null;
}

export interface RedirectDraftApi {
  draft: RedirectQuickEditDraft;
  setDraft: Dispatch<SetStateAction<RedirectQuickEditDraft>>;
  /** Live mirror of `draft` for the save flow's async closure. */
  draftRef: RefObject<RedirectQuickEditDraft>;
  updateDraft: (patch: Partial<RedirectQuickEditDraft>) => void;
  isDirty: boolean;
}

export function useRedirectDraft({ currentAction }: UseRedirectDraftArgs): RedirectDraftApi {
  const [draft, setDraft] = useState<RedirectQuickEditDraft>(() => ({
    redirectTo: currentAction?.redirectTo ?? '',
  }));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Single scalar field — the raw string IS the fingerprint.
  const draftFingerprint = draft.redirectTo;
  const currentFingerprint = currentAction ? currentAction.redirectTo : null;
  // `lastPrimedFingerprint` is the baseline the draft was last synced
  // from (init / re-prime / save echo). Comparing against it (NOT the
  // live canonical) distinguishes "user has untouched edits" from "form
  // is briefly stale because a broadcast just landed" — see
  // `use-mod-draft.ts` for the full rationale.
  const [lastPrimedFingerprint, setLastPrimedFingerprint] = useState<string | null>(null);
  const isDirty =
    lastPrimedFingerprint !== null && currentFingerprint !== null && draftFingerprint !== lastPrimedFingerprint;

  // Re-prime on rule version bump (another surface saved) only when the
  // user hasn't started editing yet.
  // biome-ignore lint/correctness/useExhaustiveDependencies: prime only when the underlying field changes.
  useEffect(() => {
    if (isDirty) return;
    if (!currentAction) return;
    setDraft({ redirectTo: currentAction.redirectTo });
    setLastPrimedFingerprint(currentAction.redirectTo);
  }, [currentAction?.redirectTo]);

  // Auto-rebase: as soon as the draft converges with the current
  // canonical (manual revert / save echo), snap the baseline so dirty
  // clears without imperative bookkeeping.
  useEffect(() => {
    if (currentFingerprint === null) return;
    if (draftFingerprint !== currentFingerprint) return;
    if (lastPrimedFingerprint === currentFingerprint) return;
    setLastPrimedFingerprint(currentFingerprint);
  }, [draftFingerprint, currentFingerprint, lastPrimedFingerprint]);

  const updateDraft = (patch: Partial<RedirectQuickEditDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  return { draft, setDraft, draftRef, updateDraft, isDirty };
}
