/**
 * Conflict-resolution subsystem for `LiveVariableEditor` edit mode: the
 * conflict tracker, the draft↔form projection feeding it, per-leaf
 * auto-rebase, the banner's Keep-All/Use-All-Saved handlers, and the
 * merge-editor dialog's text seams. Extracted verbatim from the
 * component (the `useLiveWorkflowConflictResolution` shape).
 *
 * Baseline coordination rides the two refs the component owns:
 * `setBaselineRef` is wired to `conflicts.setBaseline` render-phase
 * here (the reprime hook's `onPrimed` calls it — effects fire
 * post-render, so the ref is populated in time), and
 * `baselineLiveVariableRef` (snapshotted by `onPrimed`) feeds the
 * merge-editor preview's Show Base layouts via `baseText`.
 */

import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveVariable } from '@openheaders/core/types';
import { type ConflictResolution, type PathConflict, useAutoMergeForm } from '@openheaders/ui/shared/conflicts';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { liveVariableResolveAdapter } from './live-variable-conflict-adapter';
import type { EditDraft } from './live-variable-drafts';
import { projectLiveVariableToForm, useLiveVariableConflicts } from './use-live-variable-conflicts';

interface UseLiveVariableConflictResolutionArgs {
  liveVariable: LiveVariable | null;
  draft: EditDraft | null;
  setDraft: Dispatch<SetStateAction<EditDraft | null>>;
  isDirty: boolean;
  setBaselineRef: RefObject<(e: LiveVariable) => void>;
  baselineLiveVariableRef: RefObject<LiveVariable | null>;
}

export interface LiveVariableConflictResolution {
  allConflicts: ReadonlyMap<string, PathConflict>;
  clearDismissed: () => void;
  isConflictDialogOpen: boolean;
  setConflictDialogOpen: (open: boolean) => void;
  handleKeepAllMine: () => void;
  handleUseAllSaved: () => void;
  handleResolveText: (text: string) => void;
  savedText: string;
  baseText: string | undefined;
  mineText: string;
}

export function useLiveVariableConflictResolution({
  liveVariable: lv,
  draft,
  setDraft,
  isDirty,
  setBaselineRef,
  baselineLiveVariableRef,
}: UseLiveVariableConflictResolutionArgs): LiveVariableConflictResolution {
  const conflicts = useLiveVariableConflicts({
    liveEntity: lv,
    isDirty,
    enabled: lv != null,
    entityType: LIVE_VARIABLE_ENTITY_TYPE,
  });
  setBaselineRef.current = conflicts.setBaseline;

  const formProjection = useMemo(
    () =>
      draft
        ? projectLiveVariableToForm({
            name: draft.name,
            description: draft.description,
            enabled: draft.enabled,
            requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
            workflowUid: draft.workflowUid,
            stepId: draft.stepId,
            captureName: draft.captureName,
          })
        : null,
    [draft],
  );

  // Per-leaf auto-rebase for §6.2 killer-demo conformance: peer commits
  // to a leaf the user hasn't touched silently catch the draft up.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      if (!lv || !draft) return;
      const transient = { ...lv } as LiveVariable;
      if (!liveVariableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
      setDraft((d) =>
        d
          ? {
              ...d,
              name: transient.name,
              description: transient.description ?? '',
              enabled: transient.enabled,
              requireFreshOnRuleBuild: Boolean(transient.requireFreshOnRuleBuild),
              workflowUid: transient.workflowUid,
              stepId: transient.stepId,
              captureName: transient.captureName,
            }
          : d,
      );
    },
    [lv, draft, setDraft],
  );
  useAutoMergeForm({ conflicts, formProjection, applyToForm: applyAutoMerge });

  const allConflicts = useMemo(
    () => (formProjection ? conflicts.getAllConflicts(formProjection) : new Map()),
    [conflicts, formProjection],
  );
  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): LiveVariable | null => {
      if (!lv || !draft) return null;
      const transient: LiveVariable = {
        ...lv,
        name: draft.name,
        description: draft.description,
        enabled: draft.enabled,
        requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
        workflowUid: draft.workflowUid,
        stepId: draft.stepId,
        captureName: draft.captureName,
      };
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        liveVariableResolveAdapter.applyResolutionToEntity(transient, path, conflict);
      }
      return transient;
    },
    [allConflicts, draft, lv],
  );

  const adoptProjected = useCallback(
    (projected: LiveVariable) => {
      setDraft((d) =>
        d
          ? {
              ...d,
              name: projected.name,
              description: projected.description ?? '',
              enabled: projected.enabled,
              requireFreshOnRuleBuild: Boolean(projected.requireFreshOnRuleBuild),
              workflowUid: projected.workflowUid,
              stepId: projected.stepId,
              captureName: projected.captureName,
            }
          : d,
      );
    },
    [setDraft],
  );

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) conflicts.dismiss(path);
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    if (!lv) return;
    const all = new Map<string, ConflictResolution>();
    for (const path of allConflicts.keys()) all.set(path, 'theirs');
    const projected = projectWithResolutions(all);
    if (!projected) return;
    adoptProjected(projected);
    for (const [path, conflict] of allConflicts) conflicts.acceptTheirs(path, conflict.theirs);
  }, [allConflicts, conflicts, lv, projectWithResolutions, adoptProjected]);

  // Phase 6 commit seam — parse the merge-editor's result text back to
  // the projection, adopt to draft, dismiss every conflict path. Save
  // re-prime advances the tracker baseline. Throws on malformed JSON.
  const handleResolveText = useCallback(
    (text: string) => {
      if (!lv) return;
      const raw = JSON.parse(text) as Partial<{
        name: string;
        description: string;
        enabled: boolean;
        requireFreshOnRuleBuild: boolean;
        workflowUid: string;
        stepId: string;
        captureName: string;
      }>;
      setDraft((d) =>
        d
          ? {
              ...d,
              name: typeof raw.name === 'string' ? raw.name : d.name,
              description: typeof raw.description === 'string' ? raw.description : d.description,
              enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
              requireFreshOnRuleBuild: Boolean(raw.requireFreshOnRuleBuild ?? d.requireFreshOnRuleBuild),
              workflowUid: typeof raw.workflowUid === 'string' ? raw.workflowUid : d.workflowUid,
              stepId: typeof raw.stepId === 'string' ? raw.stepId : d.stepId,
              captureName: typeof raw.captureName === 'string' ? raw.captureName : d.captureName,
            }
          : d,
      );
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [lv, allConflicts, conflicts, setDraft],
  );

  const savedText = useMemo(() => {
    if (!isConflictDialogOpen || !lv) return '';
    return JSON.stringify(
      {
        name: lv.name,
        description: lv.description ?? '',
        enabled: lv.enabled,
        requireFreshOnRuleBuild: Boolean(lv.requireFreshOnRuleBuild),
        workflowUid: lv.workflowUid,
        stepId: lv.stepId,
        captureName: lv.captureName,
      },
      null,
      2,
    );
  }, [isConflictDialogOpen, lv]);

  // Baseline JSON for the merge-editor preview's Show Base layouts.
  // Same shape as savedText / mineText so the 3-pane diff aligns.
  const baseText = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineLiveVariableRef.current;
    if (!baseline) return undefined;
    return JSON.stringify(
      {
        name: baseline.name,
        description: baseline.description ?? '',
        enabled: baseline.enabled,
        requireFreshOnRuleBuild: Boolean(baseline.requireFreshOnRuleBuild),
        workflowUid: baseline.workflowUid,
        stepId: baseline.stepId,
        captureName: baseline.captureName,
      },
      null,
      2,
    );
  }, [isConflictDialogOpen, baselineLiveVariableRef]);

  const mineText = useMemo(() => {
    if (!isConflictDialogOpen || !draft) return '';
    return JSON.stringify(
      {
        name: draft.name,
        description: draft.description,
        enabled: draft.enabled,
        requireFreshOnRuleBuild: Boolean(draft.requireFreshOnRuleBuild),
        workflowUid: draft.workflowUid,
        stepId: draft.stepId,
        captureName: draft.captureName,
      },
      null,
      2,
    );
  }, [isConflictDialogOpen, draft]);

  return {
    allConflicts,
    clearDismissed: conflicts.clearDismissed,
    isConflictDialogOpen,
    setConflictDialogOpen,
    handleKeepAllMine,
    handleUseAllSaved,
    handleResolveText,
    savedText,
    baseText,
    mineText,
  };
}
