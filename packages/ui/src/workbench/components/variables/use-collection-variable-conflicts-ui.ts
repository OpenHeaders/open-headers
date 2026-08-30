/**
 * `useCollectionVariableConflictsUi` — the per-leaf conflict wiring a
 * collection-variables table needs (baseline, auto-rebase, the table
 * bridge, the banner counts and the merge dialog's texts), lifted out
 * of {@link CollectionVariablesEditor} so the request container editor
 * hosts the same table with the same discipline. The caller owns the
 * draft and the reprime; this hook owns everything conflict-shaped.
 */

import { canonicalJsonPretty } from '@openheaders/core/sync';
import type { Variable } from '@openheaders/core/types';
import { type ConflictResolution, useAutoMergeForm } from '@openheaders/ui/shared/conflicts';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { VariableTableConflictBridge } from '../panels/VariableTable';
import { projectVariablesToForm, useVariableConflicts } from './use-variable-conflicts';
import { type VariableEntity, variableResolveAdapter } from './variable-conflict-adapter';

export interface UseCollectionVariableConflictsUiInput {
  collectionUid: string;
  entityType: string;
  /** The saved variables, `null` while the collection is unknown. */
  savedVariables: Variable[] | null;
  draft: Variable[];
  setDraft: (next: Variable[]) => void;
  isDirty: boolean;
}

export interface CollectionVariableConflictsUi {
  conflictBridge: VariableTableConflictBridge;
  conflictCount: number;
  /** Feed the reprime's `onPrimed` — advances the conflict baseline. */
  onPrimed: (variables: Variable[]) => void;
  /** Call after a successful save. */
  clearDismissed: () => void;
  banner: { onReview: () => void; onKeepAllMine: () => void; onUseAllSaved: () => void };
  dialog: {
    open: boolean;
    savedText: string;
    mineText: string;
    baseText: string | undefined;
    onResolveText: (text: string) => void;
    onClose: () => void;
  };
}

export function useCollectionVariableConflictsUi(
  input: UseCollectionVariableConflictsUiInput,
): CollectionVariableConflictsUi {
  const { collectionUid, entityType, savedVariables, draft, setDraft, isDirty } = input;

  const liveEntity: VariableEntity | null = useMemo(
    () => (savedVariables ? { uid: collectionUid, variables: savedVariables } : null),
    [collectionUid, savedVariables],
  );

  const baselineVariablesRef = useRef<readonly Variable[] | null>(null);

  const conflicts = useVariableConflicts({
    liveEntity,
    isDirty,
    enabled: savedVariables !== null,
    entityType,
  });

  const onPrimed = useCallback(
    (variables: Variable[]) => {
      conflicts.setBaseline({ uid: collectionUid, variables });
      baselineVariablesRef.current = variables;
    },
    [conflicts, collectionUid],
  );

  const formProjection = useMemo(() => projectVariablesToForm(draft), [draft]);
  const formSetOrders = useMemo(
    () => new Map<string, readonly string[]>([['variables', draft.map((v) => v.uid)]]),
    [draft],
  );
  const allConflicts = useMemo(
    () => conflicts.getAllConflicts(formProjection, formSetOrders),
    [conflicts, formProjection, formSetOrders],
  );
  const [open, setOpen] = useState(false);

  // Per-leaf auto-rebase — see EnvironmentEditor for the full discipline.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      const transient: VariableEntity = { uid: collectionUid, variables: [...draft] };
      if (!variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
      setDraft(transient.variables);
    },
    [collectionUid, draft, setDraft],
  );
  useAutoMergeForm({ conflicts, formProjection, applyToForm: applyAutoMerge });

  const conflictBridge = useMemo<VariableTableConflictBridge>(
    () => ({
      getLeafConflict: (path, local) => conflicts.getConflict(path, local),
      getSetConflict: (setPath, uid, formContainsUid) => conflicts.getSetConflict(setPath, uid, formContainsUid),
      onAcceptTheirs: (path, theirs) => {
        const transient: VariableEntity = { uid: collectionUid, variables: [...draft] };
        if (!variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
        setDraft(transient.variables);
        conflicts.acceptTheirs(path, theirs);
      },
      onDismiss: (path) => conflicts.dismiss(path),
    }),
    [conflicts, draft, collectionUid, setDraft],
  );

  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): VariableEntity => {
      const transient: VariableEntity = { uid: collectionUid, variables: [...draft] };
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        variableResolveAdapter.applyResolutionToEntity(transient, path, conflict);
      }
      return transient;
    },
    [allConflicts, draft, collectionUid],
  );

  const onKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) conflicts.dismiss(path);
  }, [allConflicts, conflicts]);

  const onUseAllSaved = useCallback(() => {
    const all = new Map<string, ConflictResolution>();
    for (const path of allConflicts.keys()) all.set(path, 'theirs');
    setDraft(projectWithResolutions(all).variables);
    for (const [path, conflict] of allConflicts) conflicts.acceptTheirs(path, conflict.theirs);
  }, [allConflicts, conflicts, projectWithResolutions, setDraft]);

  // The merge editor's result text parsed back into the variables
  // array; every conflict path dismissed. Throws on malformed JSON or a
  // non-array shape.
  const onResolveText = useCallback(
    (text: string) => {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Collection variables must be a JSON array.');
      setDraft(parsed as Variable[]);
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [allConflicts, conflicts, setDraft],
  );

  // All three panes serialize via canonicalJsonPretty: the saved side
  // round-tripped chrome.storage (alphabetized row keys) while the mine
  // side carries literal construction order — an insertion-ordered dump
  // would light spurious diff lines on structurally-equal rows.
  const savedText = useMemo(
    () => (open && savedVariables ? canonicalJsonPretty(savedVariables) : ''),
    [open, savedVariables],
  );
  const baseText = useMemo(() => {
    if (!open) return undefined;
    const baseline = baselineVariablesRef.current;
    return baseline ? canonicalJsonPretty(baseline) : undefined;
  }, [open]);
  const mineText = useMemo(() => (open ? canonicalJsonPretty(draft) : ''), [open, draft]);

  const onReview = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);

  return {
    conflictBridge,
    conflictCount: allConflicts.size,
    onPrimed,
    clearDismissed: conflicts.clearDismissed,
    banner: { onReview, onKeepAllMine, onUseAllSaved },
    dialog: { open, savedText, mineText, baseText, onResolveText, onClose },
  };
}
