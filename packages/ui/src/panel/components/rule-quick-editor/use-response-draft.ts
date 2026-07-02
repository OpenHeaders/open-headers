/**
 * Draft-state subsystem for the response quick-editor's fields: the
 * status/content-type/body draft, its derived dirty flag, the re-prime
 * pass and the auto-rebase pass. Mirrors `use-mod-draft.ts` — dirty
 * derives from draft-vs-canonical fingerprint equality (never an
 * imperative flag), the baseline is `lastPrimedFingerprint` so an
 * external save landing mid-edit can't wedge the form, and convergence
 * with the canonical (manual revert / save echo) snaps the baseline so
 * dirty self-clears.
 */

import type { ResponseAction } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ResponseQuickDraft } from '../../data/response-rule-edit';

interface UseResponseDraftArgs {
  /** Live rule's action, or null when the rule is gone / not a response rule. */
  currentAction: ResponseAction | null;
}

export interface ResponseDraftApi {
  draft: ResponseQuickDraft;
  setDraft: Dispatch<SetStateAction<ResponseQuickDraft>>;
  /** Live mirror of `draft` for the save flow's async closure. */
  draftRef: RefObject<ResponseQuickDraft>;
  updateDraft: (patch: Partial<ResponseQuickDraft>) => void;
  isDirty: boolean;
}

function fingerprintOf(d: ResponseQuickDraft): string {
  return stableStringify({ statusCode: d.statusCode, contentType: d.contentType, responseBody: d.responseBody });
}

export function useResponseDraft({ currentAction }: UseResponseDraftArgs): ResponseDraftApi {
  const [draft, setDraft] = useState<ResponseQuickDraft>(() => ({
    statusCode: currentAction?.statusCode ?? 0,
    contentType: currentAction?.contentType ?? '',
    responseBody: currentAction?.responseBody ?? '',
  }));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const draftFingerprint = useMemo(() => fingerprintOf(draft), [draft]);
  const currentFingerprint = useMemo(
    () =>
      currentAction
        ? fingerprintOf({
            statusCode: currentAction.statusCode,
            contentType: currentAction.contentType,
            responseBody: currentAction.responseBody,
          })
        : null,
    [currentAction],
  );
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: prime only when the underlying fields change.
  useEffect(() => {
    if (isDirty) return;
    if (!currentAction) return;
    setDraft({
      statusCode: currentAction.statusCode,
      contentType: currentAction.contentType,
      responseBody: currentAction.responseBody,
    });
    if (currentFingerprint) setLastPrimedFingerprint(currentFingerprint);
  }, [currentAction?.statusCode, currentAction?.contentType, currentAction?.responseBody]);

  // Auto-rebase: as soon as the draft converges with the current
  // canonical (manual revert / save echo), snap the baseline so dirty
  // clears without imperative bookkeeping.
  useEffect(() => {
    if (currentFingerprint === null) return;
    if (draftFingerprint !== currentFingerprint) return;
    if (lastPrimedFingerprint === currentFingerprint) return;
    setLastPrimedFingerprint(currentFingerprint);
  }, [draftFingerprint, currentFingerprint, lastPrimedFingerprint]);

  const updateDraft = (patch: Partial<ResponseQuickDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  return { draft, setDraft, draftRef, updateDraft, isDirty };
}
