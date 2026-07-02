/**
 * Conflict surface for RequestEditor — projects the live request + draft
 * into the conflict tracker's form view, wires the per-table inline
 * bridges and per-leaf auto-rebase, and prepares the banner/dialog
 * affordances (keep-mine / use-saved / merge-editor YAML panes).
 * Extracted from the editor shell; the state (draft, dialog-open,
 * baseline ref) stays component-owned and rides in as inputs.
 */

import { canonicalizeRequest, parseRequest, serializeRequest } from '@openheaders/core/codec/yaml';
import { freshDocument } from '@openheaders/core/schemas';
import type { Request } from '@openheaders/core/types';
import { REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import {
  type ConflictResolution,
  type EntityConflictsApi,
  type PathConflict,
  useAutoMergeForm,
} from '@openheaders/ui/shared/conflicts';
import type { MutableRefObject } from 'react';
import { useCallback, useMemo } from 'react';
import { buildRequestUpdates, type Draft, draftFromRequest } from './draft';
import type { KeyValueRowConflictBridge } from './KeyValueTable';
import { requestResolveAdapter } from './request-conflict-adapter';

export interface UseRequestConflictSurfaceArgs {
  liveRequest: Request | null;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  conflicts: EntityConflictsApi<Request>;
  isInitialized: boolean;
  isConflictDialogOpen: boolean;
  /** Save-time merge baseline captured at the most recent re-prime —
   *  read at dialog-open for the merge editor's Show Base pane. */
  baselineRequestRef: MutableRefObject<Request | null>;
}

export interface RequestConflictSurface {
  allConflicts: ReadonlyMap<string, PathConflict>;
  headerConflictBridge: KeyValueRowConflictBridge;
  paramConflictBridge: KeyValueRowConflictBridge;
  handleKeepAllMine: () => void;
  handleUseAllSaved: () => void;
  handleResolveText: (text: string) => void;
  savedYaml: string;
  baseYaml: string | undefined;
  mineText: string;
}

export function useRequestConflictSurface({
  liveRequest,
  draft,
  setDraft,
  conflicts,
  isInitialized,
  isConflictDialogOpen,
  baselineRequestRef,
}: UseRequestConflictSurfaceArgs): RequestConflictSurface {
  const formProjection = useMemo(() => {
    if (!liveRequest || !isInitialized) return null;
    const transient: Request = { ...liveRequest, ...buildRequestUpdates(draft) };
    return conflicts.projectEntity(transient);
  }, [draft, liveRequest, isInitialized, conflicts]);

  const formSetOrders = useMemo(() => {
    const out = new Map<string, string[]>();
    out.set(
      REQUEST_PATHS.headerSet,
      draft.headers.map((h) => h.uid).filter((u): u is string => !!u),
    );
    out.set(
      REQUEST_PATHS.paramSet,
      draft.params.map((p) => p.uid).filter((u): u is string => !!u),
    );
    return out;
  }, [draft.headers, draft.params]);

  const allConflicts = useMemo(
    () => (formProjection ? conflicts.getAllConflicts(formProjection, formSetOrders) : new Map<string, PathConflict>()),
    [formProjection, formSetOrders, conflicts],
  );

  // Inline conflict bridges for the Headers + Params tables. Each cell
  // already writes the local leaf via the table's onChange path; the
  // bridge only acks the tracker so the chip dismisses + baseline
  // catches up. Set-remove flows the same way: the row's `onRemove`
  // drops the row locally, then the bridge acks the `set:*` path.
  const headerConflictBridge = useMemo<KeyValueRowConflictBridge>(
    () => ({
      setPath: REQUEST_PATHS.headerSet,
      getLeafConflict: (path, local) => conflicts.getConflict(path, local),
      getSetConflict: (setPath, uid, formContainsUid) => conflicts.getSetConflict(setPath, uid, formContainsUid),
      onAcceptTheirs: (path, theirs) => conflicts.acceptTheirs(path, theirs),
      onDismiss: (path) => conflicts.dismiss(path),
    }),
    [conflicts],
  );
  const paramConflictBridge = useMemo<KeyValueRowConflictBridge>(
    () => ({
      setPath: REQUEST_PATHS.paramSet,
      getLeafConflict: (path, local) => conflicts.getConflict(path, local),
      getSetConflict: (setPath, uid, formContainsUid) => conflicts.getSetConflict(setPath, uid, formContainsUid),
      onAcceptTheirs: (path, theirs) => conflicts.acceptTheirs(path, theirs),
      onDismiss: (path) => conflicts.dismiss(path),
    }),
    [conflicts],
  );

  // Per-leaf auto-rebase — see EnvironmentEditor for the discipline.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      if (!liveRequest) return;
      const merged = JSON.parse(JSON.stringify({ ...liveRequest, ...buildRequestUpdates(draft) })) as Request;
      if (!requestResolveAdapter.applyResolutionToEntity(merged, path, { base: '', theirs })) return;
      setDraft(draftFromRequest(merged));
    },
    [liveRequest, draft, setDraft],
  );
  useAutoMergeForm({
    conflicts,
    formProjection: formProjection ?? undefined,
    applyToForm: applyAutoMerge,
  });

  // Shared helper: clone the live request, fold in current draft +
  // optional resolutions, then return both the projected request and
  // the corresponding draft. One source of truth for the "use saved"
  // affordances and for the dialog's right-pane preview text.
  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): { req: Request; draft: Draft } | null => {
      if (!liveRequest) return null;
      const merged = JSON.parse(JSON.stringify({ ...liveRequest, ...buildRequestUpdates(draft) })) as Request;
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        requestResolveAdapter.applyResolutionToEntity(merged, path, conflict);
      }
      return { req: merged, draft: draftFromRequest(merged) };
    },
    [liveRequest, draft, allConflicts],
  );

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) conflicts.dismiss(path);
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    if (!liveRequest) return;
    const all = new Map<string, ConflictResolution>();
    for (const path of allConflicts.keys()) all.set(path, 'theirs');
    const projected = projectWithResolutions(all);
    if (!projected) return;
    setDraft(projected.draft);
    for (const [path, conflict] of allConflicts) conflicts.acceptTheirs(path, conflict.theirs);
  }, [allConflicts, conflicts, liveRequest, projectWithResolutions, setDraft]);

  // Phase 6 commit seam — parses the merge-editor's result YAML back
  // to a Request (siblings omitted: the merge surface only carries
  // `request.yaml`; body/variables/scripts round-trip outside this
  // path), populates the draft, dismisses every conflict path. Throws
  // on parse failure — the merge modal renders the error inline.
  const handleResolveText = useCallback(
    (text: string) => {
      if (!liveRequest) return;
      const parsed = parseRequest(text, { path: liveRequest.path });
      setDraft(draftFromRequest(parsed.value));
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [liveRequest, allConflicts, conflicts, setDraft],
  );

  const savedYaml = useMemo(() => {
    if (!isConflictDialogOpen || !liveRequest) return '';
    try {
      return serializeRequest(freshDocument(canonicalizeRequest(liveRequest))).requestYaml;
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveRequest]);

  // Baseline YAML for the merge-editor preview's Show Base layouts.
  // Captured at dialog-open from the form's baseline-request ref.
  const baseYaml = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineRequestRef.current;
    if (!baseline) return undefined;
    try {
      return serializeRequest(freshDocument(canonicalizeRequest(baseline))).requestYaml;
    } catch {
      return undefined;
    }
  }, [isConflictDialogOpen, baselineRequestRef]);

  // Local projection serialized for the merge editor's mine pane —
  // live request + current draft, no per-path picks (the merge editor
  // surface owns picks now).
  const mineText = useMemo(() => {
    if (!isConflictDialogOpen || !liveRequest) return '';
    const merged = { ...liveRequest, ...buildRequestUpdates(draft) } as Request;
    try {
      return serializeRequest(freshDocument(canonicalizeRequest(merged))).requestYaml;
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveRequest, draft]);

  return {
    allConflicts,
    headerConflictBridge,
    paramConflictBridge,
    handleKeepAllMine,
    handleUseAllSaved,
    handleResolveText,
    savedYaml,
    baseYaml,
    mineText,
  };
}
