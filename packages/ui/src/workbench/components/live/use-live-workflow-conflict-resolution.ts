/**
 * Conflict-resolution subsystem for `LiveWorkflowEditor` edit mode: the
 * conflict tracker, the draft↔form projection feeding it, per-leaf
 * auto-rebase, the banner's Keep-All/Use-All-Saved handlers, and the
 * merge-editor dialog's text seams. Extracted verbatim from the
 * component (the `useRuleConflictResolution` shape).
 *
 * Baseline coordination rides the two refs the component owns:
 * `setBaselineRef` is wired to `conflicts.setBaseline` render-phase
 * here (the reprime hook's `onPrimed` calls it — effects fire
 * post-render, so the ref is populated in time), and
 * `baselineLiveWorkflowRef` (snapshotted by `onPrimed`) feeds the
 * merge-editor preview's Show Base layouts via `baseText`.
 */

import {
  type DraftStep,
  type DraftWorkflow,
  pickPrimaryLv,
  stripDraftSteps,
  toDraftCapture,
} from '@openheaders/core/live';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveVariable, LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
import { type ConflictResolution, type PathConflict, useAutoMergeForm } from '@openheaders/ui/shared/conflicts';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { liveWorkflowResolveAdapter } from './live-workflow-conflict-adapter';
import { projectLiveWorkflowToForm, useLiveWorkflowConflicts } from './use-live-workflow-conflicts';

interface UseLiveWorkflowConflictResolutionArgs {
  workflow: LiveWorkflow | null;
  draft: DraftWorkflow | null;
  setDraft: Dispatch<SetStateAction<DraftWorkflow | null>>;
  isDirty: boolean;
  boundVars: readonly LiveVariable[];
  setBaselineRef: RefObject<(e: LiveWorkflow) => void>;
  baselineLiveWorkflowRef: RefObject<LiveWorkflow | null>;
}

export interface LiveWorkflowConflictResolution {
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

export function useLiveWorkflowConflictResolution({
  workflow,
  draft,
  setDraft,
  isDirty,
  boundVars,
  setBaselineRef,
  baselineLiveWorkflowRef,
}: UseLiveWorkflowConflictResolutionArgs): LiveWorkflowConflictResolution {
  const conflicts = useLiveWorkflowConflicts({
    liveEntity: workflow,
    isDirty,
    enabled: workflow != null,
    entityType: LIVE_WORKFLOW_ENTITY_TYPE,
  });
  setBaselineRef.current = conflicts.setBaseline;

  const formProjection = useMemo(
    () =>
      draft
        ? projectLiveWorkflowToForm({
            name: draft.name,
            description: draft.description,
            enabled: draft.enabled,
            refresh: draft.refresh,
            steps: stripDraftSteps(draft.steps),
          })
        : null,
    [draft],
  );

  // Per-leaf auto-rebase. Covers workflow-level scalars + per-step +
  // per-capture leaves; the resolve adapter handles the path → field
  // dispatch (scalar / refresh sub-leaf / steps.<uid>.* / steps.<uid>.
  // captures.<uid>.*). Draft.steps round-trips through stripDraftSteps
  // so the transient WorkflowStep[] matches the adapter's expected
  // shape, then re-wrap as DraftStep[] preserving each capture's
  // existing exposure metadata (looked up by uid).
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      if (!workflow || !draft) return;
      const transient: LiveWorkflow = {
        ...workflow,
        name: draft.name,
        description: draft.description,
        enabled: draft.enabled,
        refresh: draft.refresh,
        steps: stripDraftSteps(draft.steps),
      };
      if (!liveWorkflowResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
      setDraft((d) => {
        if (!d) return d;
        // Rewrap captures as DraftCaptures, preserving each existing
        // draft capture's exposure metadata (matched by uid). New /
        // unmatched captures fall back to the toDraftCapture default.
        const draftCapByUid = new Map<string, DraftStep['captures'][number]>();
        for (const s of d.steps) for (const c of s.captures) draftCapByUid.set(c.uid, c);
        const nextSteps: DraftStep[] = transient.steps.map((s) => ({
          ...s,
          captures: s.captures.map((c) => {
            const existing = draftCapByUid.get(c.uid);
            return existing
              ? { ...c, exposed: existing.exposed, liveName: existing.liveName, liveUid: existing.liveUid }
              : toDraftCapture(c, pickPrimaryLv(s.id, c.name, boundVars));
          }),
        }));
        return {
          ...d,
          name: transient.name,
          description: transient.description ?? '',
          enabled: transient.enabled,
          refresh: transient.refresh,
          steps: nextSteps,
        };
      });
    },
    [workflow, draft, boundVars, setDraft],
  );
  useAutoMergeForm({ conflicts, formProjection, applyToForm: applyAutoMerge });

  const allConflicts = useMemo(
    () => (formProjection ? conflicts.getAllConflicts(formProjection) : new Map()),
    [conflicts, formProjection],
  );
  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): LiveWorkflow | null => {
      if (!workflow || !draft) return null;
      const transient: LiveWorkflow = {
        ...workflow,
        name: draft.name,
        description: draft.description,
        enabled: draft.enabled,
        refresh: draft.refresh,
      };
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        liveWorkflowResolveAdapter.applyResolutionToEntity(transient, path, conflict);
      }
      return transient;
    },
    [allConflicts, draft, workflow],
  );

  const adoptProjected = useCallback(
    (projected: LiveWorkflow) => {
      setDraft((d) =>
        d
          ? {
              ...d,
              name: projected.name,
              description: projected.description ?? '',
              enabled: projected.enabled,
              refresh: projected.refresh,
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
    if (!workflow) return;
    const all = new Map<string, ConflictResolution>();
    for (const path of allConflicts.keys()) all.set(path, 'theirs');
    const projected = projectWithResolutions(all);
    if (!projected) return;
    adoptProjected(projected);
    for (const [path, conflict] of allConflicts) conflicts.acceptTheirs(path, conflict.theirs);
  }, [allConflicts, conflicts, workflow, projectWithResolutions, adoptProjected]);

  // Phase 6 commit seam — parses the merge-editor's result text back to
  // the projection, adopts to draft, then dismisses every conflict path.
  // Steps are reconstructed as DraftSteps via toDraftCapture so the
  // editor's per-capture exposure metadata is rebuilt from the bound
  // LiveVariable set. Throws on malformed JSON.
  const handleResolveText = useCallback(
    (text: string) => {
      if (!workflow) return;
      const raw = JSON.parse(text) as Partial<{
        name: string;
        description: string;
        enabled: boolean;
        refresh: LiveWorkflow['refresh'];
        steps: WorkflowStep[];
      }>;
      const nextSteps: DraftStep[] | undefined = Array.isArray(raw.steps)
        ? raw.steps.map((step) => ({
            ...step,
            captures: step.captures.map((c) => toDraftCapture(c, pickPrimaryLv(step.id, c.name, boundVars))),
          }))
        : undefined;
      setDraft((d) =>
        d
          ? {
              ...d,
              name: typeof raw.name === 'string' ? raw.name : d.name,
              description: typeof raw.description === 'string' ? raw.description : d.description,
              enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
              refresh: raw.refresh !== undefined ? raw.refresh : d.refresh,
              steps: nextSteps !== undefined ? nextSteps : d.steps,
            }
          : d,
      );
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [workflow, allConflicts, conflicts, boundVars, setDraft],
  );

  const savedText = useMemo(() => {
    if (!isConflictDialogOpen || !workflow) return '';
    return JSON.stringify(
      {
        name: workflow.name,
        description: workflow.description ?? '',
        enabled: workflow.enabled,
        refresh: workflow.refresh,
        steps: workflow.steps,
      },
      null,
      2,
    );
  }, [isConflictDialogOpen, workflow]);

  // Baseline JSON for the merge-editor preview's Show Base layouts.
  // Same shape as savedText / mineText so the 3-pane diff aligns.
  const baseText = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineLiveWorkflowRef.current;
    if (!baseline) return undefined;
    return JSON.stringify(
      {
        name: baseline.name,
        description: baseline.description ?? '',
        enabled: baseline.enabled,
        refresh: baseline.refresh,
        steps: baseline.steps,
      },
      null,
      2,
    );
  }, [isConflictDialogOpen, baselineLiveWorkflowRef]);

  const mineText = useMemo(() => {
    if (!isConflictDialogOpen || !draft) return '';
    return JSON.stringify(
      {
        name: draft.name,
        description: draft.description,
        enabled: draft.enabled,
        refresh: draft.refresh,
        steps: stripDraftSteps(draft.steps),
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
