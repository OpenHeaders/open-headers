/**
 * Phase 3 — multi-layout merge pane.
 *
 * Architecture: ALL editor containers (theirs / base / result / mine)
 * are mounted ONCE in stable JSX positions. Each carries
 * `style={{ gridArea: ... }}`; the parent's `gridTemplateAreas` /
 * `gridTemplateColumns` / `gridTemplateRows` swap per layout. Layout
 * switches are pure CSS — no React reconciliation moves a container
 * across the tree, so the Monaco editor instances bound to each
 * container survive the swap with cursor / scroll / selection
 * preserved (plan §13 acceptance criterion).
 *
 * Hidden panes get `display: 'none'` on their slot wrapper. The
 * editor + model still exist; resize / scroll recompute when the
 * pane returns to visible.
 *
 * Resize sashes: not part of this slice. Plan §13 commits to
 * "CSS-grid template changes only"; user-driven pane resizing is a
 * separate concern that can layer on later (custom drag handler that
 * mutates `gridTemplateColumns`/`Rows` between sashes). Allotment
 * doesn't fit because moving editor containers between two
 * Allotment.Pane parents would unmount them — the load-bearing
 * invariant the spec requires us to preserve.
 *
 * Diff axes are theirs↔result and mine↔result; both recompute on
 * every result-buffer change. Re-running the LCS keeps each pane's
 * decorations consistent with the user's current resolution state
 * without us having to track per-hunk drift through edits manually.
 */

import { useTheme } from '@context/ThemeContext';
import { editor as monacoEditor } from 'monaco-editor/esm/vs/editor/edcore.main';
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { classifyConflicts, classifyConflicts3Way } from '../diff/conflict-classify';
import type { Hunk } from '../diff/line-diff';
import { diffLinesPatience } from '../diff/patience-diff';
import { useCharDecorations } from '../monaco/use-char-decorations';
import { useGridResize } from '../monaco/use-grid-resize';
import { useHunkActionMarkers } from '../monaco/use-hunk-action-markers';
import {
  useHunkActionZones,
  useHunkAlignmentPlaceholders,
  useResultStatusZones,
} from '../monaco/use-hunk-action-zones';
import { type HunkSide, useHunkDecorations } from '../monaco/use-hunk-decorations';
import { useHunkTrackedRanges } from '../monaco/use-hunk-tracked-ranges';
import { type MergeActionsContext, useMergeActions } from '../monaco/use-merge-actions';
import { useMissingMarkers } from '../monaco/use-missing-markers';
import { useMonacoEditorLifecycle } from '../monaco/use-monaco-editor-lifecycle';
import { useSyncScroll } from '../monaco/use-sync-scroll';
import type { MergeFile } from '../types';
import {
  type HunkPickState,
  PENDING_HUNK,
  type PickStateController,
  createPickStateController,
} from '../use-hunk-pick-state';
import HunkActionGutter from './HunkActionGutter';
import { gridTemplate, type MergeLayout, paneVisibility } from './layout';

export type { MergeLayout } from './layout';

export interface HunkStats {
  /** Remaining hunks where theirs ≠ result (incoming side still
   *  pending). */
  theirsRemaining: number;
  /** Remaining hunks where mine ≠ result. */
  mineRemaining: number;
  /** `theirsRemaining + mineRemaining`. Conflict-counter feed. */
  totalRemaining: number;
  /** Non-conflicting subtotal — auto-mergeable in one click. */
  nonConflicting: number;
  /** True conflicts (both sides diverge in overlapping ranges). */
  conflicts: number;
}

export interface MergePaneProps {
  file: MergeFile;
  /** True for dark Monaco theme. The shell decides; the editor reflects. */
  isDarkMode?: boolean;
  /** Caller wants to know when the editable result text changes. */
  onResultChange?: (text: string) => void;
  /** Caller wants live counts for a header pill / navigator. Fired
   *  after every diff recompute. */
  onHunkStatsChange?: (stats: HunkStats) => void;
  /** Hide non-conflicting hunks from gutters + decorations when false.
   *  Default true. */
  showNonConflicting?: boolean;
  /** Layout shape (plan §1). `'column'` (default) renders the 3-pane
   *  row only. `'show-base-top'` adds a full-width read-only base
   *  pane above the row. `'show-base-center'` puts the base between
   *  theirs and mine on top with result spanning the full width
   *  below. Layouts that need a base degrade to `column` when
   *  `file.base` is undefined. */
  layout?: MergeLayout;
  /** Optional className for the outer container. */
  className?: string;
  /** Optional render slot for a per-pane header strip. */
  renderHeader?: (pane: 'theirs' | 'base' | 'result' | 'mine') => ReactNode;
  /** Caller wants user-action narration for an ARIA live region. */
  onAnnounce?: (message: string) => void;
  /** When true, accepting one side auto-dismisses the other so the
   *  hunk is fully resolved on the first click. Default false — the
   *  diagonal-append affordance stays visible so users can opt to
   *  stack both sides. */
  singleClickResolve?: boolean;
  /** Show VS Code-style inline action labels above each pending
   *  hunk in the theirs / mine panes ("Accept Incoming | Accept
   *  Combination | Ignore"). Layout-agnostic. Default true. */
  inlineActionLabels?: boolean;
  /** Show side action gutters flanking the result editor
   *  ("× ▶" / "◀ ×"). Spatially correct only when result is
   *  between theirs and mine on the same row (Column layout). The
   *  modal force-disables this in `show-base-*` layouts. Default
   *  true (subject to the per-layout availability check). */
  sideActionGutters?: boolean;
  /** Fires whenever the per-side pick-state map changes (any click,
   *  bulk action, undo/redo, or session reset). The argument is the
   *  affected hunk id, or `null` when many changed at once. Surface
   *  for the modal to derive the sidebar status pill + Complete Merge
   *  gate from a single source of truth. */
  onPickStateChange?: (hunkId: string | null) => void;
}

export interface MergePaneHandle {
  getResultText(): string;
  gotoNextHunk(): void;
  gotoPrevHunk(): void;
  applyNonConflicting(): void;
  acceptAllTheirs(): void;
  acceptAllMine(): void;
  /** Restore the default sash ratios for the current layout. */
  resetLayout(): void;
}

const PANE_BG_LIGHT = '#ffffff';
const PANE_BG_DARK = '#1e1e1e';
const HEADER_HEIGHT = 28;
const HEADER_PAD = '4px 10px';

const MergePane = forwardRef<MergePaneHandle, MergePaneProps>(function MergePane(props, ref) {
  const {
    file,
    isDarkMode,
    onResultChange,
    onHunkStatsChange,
    showNonConflicting = true,
    layout = 'column',
    className,
    renderHeader,
    onAnnounce,
    singleClickResolve = false,
    inlineActionLabels = true,
    sideActionGutters = true,
    onPickStateChange,
  } = props;
  // Monaco theme id comes from the active variant — the chrome's
  // `isDarkMode` prop only drives the merge-pane background shading.
  const { monacoTheme } = useTheme();
  const language = file.language ?? 'yaml';

  const theirsContainerRef = useRef<HTMLDivElement | null>(null);
  const resultContainerRef = useRef<HTMLDivElement | null>(null);
  const mineContainerRef = useRef<HTMLDivElement | null>(null);
  const baseContainerRef = useRef<HTMLDivElement | null>(null);

  const has3Panes = file.base !== undefined;
  const baseAvailable = file.base !== undefined;
  const visibility = paneVisibility(layout, has3Panes, baseAvailable);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const theirsHandle = useMonacoEditorLifecycle({
    containerRef: theirsContainerRef,
    value: file.theirs,
    language,
    readOnly: true,
  });

  const resultHandle = useMonacoEditorLifecycle({
    containerRef: resultContainerRef,
    value: file.initialResult,
    language,
    readOnly: false,
  });

  const mineHandle = useMonacoEditorLifecycle({
    containerRef: mineContainerRef,
    value: file.mine,
    language,
    readOnly: true,
  });

  // Base editor is created unconditionally so layout swaps can show
  // it without dispose+recreate. Empty string when the file has no base.
  const baseHandle = useMonacoEditorLifecycle({
    containerRef: baseContainerRef,
    value: file.base ?? '',
    language,
    readOnly: true,
  });

  // Sash drag → editor layout()s. Run for every visible editor so
  // Monaco's scrollbar / wrap geometry tracks the live pane size.
  const onSashResize = useCallback(() => {
    if (visibility.theirs) theirsHandle.current.editor?.layout();
    if (visibility.result) resultHandle.current.editor?.layout();
    if (visibility.mine) mineHandle.current.editor?.layout();
    if (visibility.base) baseHandle.current.editor?.layout();
  }, [visibility, theirsHandle, resultHandle, mineHandle, baseHandle]);

  const gridResize = useGridResize({ containerRef, onResize: onSashResize });
  const grid = gridTemplate(layout, has3Panes, baseAvailable, gridResize.ratios);

  // Track result text in state so diff recomputes on every edit.
  const [resultText, setResultText] = useState<string>(file.initialResult);

  useEffect(() => {
    const model = resultHandle.current.model;
    if (!model) return;
    const sub = model.onDidChangeContent(() => {
      const next = model.getValue();
      setResultText(next);
      onResultChange?.(next);
    });
    return () => {
      sub.dispose();
    };
  }, [onResultChange, resultHandle]);

  useEffect(() => {
    setResultText(file.initialResult);
  }, [file.initialResult]);

  useEffect(() => {
    monacoEditor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // After a layout swap, panes that were hidden may have stale layout
  // metrics inside Monaco (zero-sized container during the hidden
  // window). Force a layout recompute when visibility changes.
  useEffect(() => {
    if (visibility.theirs) theirsHandle.current.editor?.layout();
    if (visibility.result) resultHandle.current.editor?.layout();
    if (visibility.mine) mineHandle.current.editor?.layout();
    if (visibility.base) baseHandle.current.editor?.layout();
  }, [visibility, theirsHandle, resultHandle, mineHandle, baseHandle]);

  const syncTargets = useMemo(() => {
    const editors = [theirsHandle, resultHandle];
    if (visibility.mine) editors.push(mineHandle);
    if (visibility.base) editors.push(baseHandle);
    return editors;
  }, [visibility.mine, visibility.base, theirsHandle, resultHandle, mineHandle, baseHandle]);
  useSyncScroll({ editors: syncTargets });

  // For `kind: 'add'` the entity has no local counterpart — `mine` is
  // empty by design, NOT a divergence the user has to resolve. The
  // `mine ↔ result` diff against an empty `mine` would otherwise emit
  // a phantom whole-content hunk that drives every add file to
  // permanent "unresolved" status (sidebar pill never flips, "Accept
  // all incoming" is a silent no-op because the result already equals
  // theirs). Symmetric for `kind: 'remove'` on the theirs side.
  const theirsHunks = useMemo(
    () => (file.kind === 'remove' ? [] : diffLinesPatience(file.theirs, resultText)),
    [file.theirs, resultText, file.kind],
  );
  const mineHunks = useMemo(
    () => (file.kind === 'add' ? [] : diffLinesPatience(file.mine, resultText)),
    [file.mine, resultText, file.kind],
  );

  // Base-axis diffs feed the 3-way classifier when base is available.
  // They run only when base is supplied; a 2-way fallback handles the
  // base-less case (entity adapters that haven't wired baseText yet).
  const theirsBaseHunks = useMemo(
    () => (file.base !== undefined ? diffLinesPatience(file.base, file.theirs) : []),
    [file.base, file.theirs],
  );
  const mineBaseHunks = useMemo(
    () => (file.base !== undefined ? diffLinesPatience(file.base, file.mine) : []),
    [file.base, file.mine],
  );

  const classification = useMemo(() => {
    if (file.base !== undefined) {
      return classifyConflicts3Way({ theirsHunks, mineHunks, theirsBaseHunks, mineBaseHunks });
    }
    return {
      ...classifyConflicts(theirsHunks, mineHunks),
      theirsCleanIds: new Set<string>(),
      mineCleanIds: new Set<string>(),
    };
  }, [file.base, theirsHunks, mineHunks, theirsBaseHunks, mineBaseHunks]);

  // Line backgrounds + missing markers + char-diff render for EVERY
  // hunk, regardless of the show-non-conflicting toggle. Per
  // `MERGE_CONFLICT_EDITOR_PLAN.md` §5.4 the toggle "shows / hides
  // the gutter [arrows]" — i.e. the actionable affordance, not the
  // visual diff itself.
  // Side-pane "missing here" markers + char-diff render for every
  // hunk regardless of pick state — they're orthogonal to the
  // accept/dismiss decision (showing where content lives on each
  // side, not whether the user has decided yet).
  useMissingMarkers({ editorRef: theirsHandle, side: 'theirs', hunks: theirsHunks });
  useMissingMarkers({ editorRef: mineHandle, side: 'mine', hunks: mineHunks });
  useCharDecorations({ editorRef: theirsHandle, side: 'theirs', hunks: theirsHunks });
  useCharDecorations({ editorRef: mineHandle, side: 'mine', hunks: mineHunks });

  // Hunks that participate in the per-side state machine. Use
  // `theirsHunks` as the identity domain — each carries both
  // `theirsLines` (peer's version) AND `mineLines` (result's
  // current content for that region, which initially equals mine's
  // version at the same lines). The pick-state controller writes
  // into the result buffer per the (theirs, mine) state tuple.
  const pickStateHunks = theirsHunks;

  // Sticky tracking decorations on the result pane — anchor each
  // hunk's range so subsequent picks target the live span (not the
  // stale `mineRange` line numbers from when the diff was computed).
  const trackedRangesRef = useHunkTrackedRanges({ resultRef: resultHandle, hunks: pickStateHunks });

  // Per-side pick state controller. Memoized so the same instance
  // survives re-renders. Refs feed the controller hooks-style data
  // (current hunks, current toggle) without recreating it.
  const pickHunksRef = useRef<readonly Hunk[]>(pickStateHunks);
  pickHunksRef.current = pickStateHunks;
  const singleClickRef = useRef<boolean>(singleClickResolve);
  singleClickRef.current = singleClickResolve;
  const [pickStateRev, setPickStateRev] = useState(0);
  // Ref-mirror the parent-supplied onChange so the controller stays
  // stable across parent re-renders even when the parent passes a
  // fresh inline arrow each render. Without this, `useMemo([...,
  // onPickStateChange])` recreates the controller on every render →
  // file-switch reset effect fires → reset() emits onChange →
  // setPickStateRev → re-render → loop. React #185 ("max update
  // depth exceeded") was the symptom; the trigger we saw in the
  // wild was a window-resize burst from Chrome split-tab drag,
  // which floods Monaco layout events through `useHunkActionMarkers`.
  const onPickStateChangeRef = useRef(onPickStateChange);
  onPickStateChangeRef.current = onPickStateChange;
  const pickController = useMemo<PickStateController>(
    () =>
      createPickStateController({
        hunksRef: pickHunksRef,
        trackedRangesRef,
        singleClickResolveRef: singleClickRef,
        onChange: (hunkId) => {
          setPickStateRev((n) => n + 1);
          onPickStateChangeRef.current?.(hunkId);
        },
      }),
    [trackedRangesRef],
  );

  // Per-side state lookups for the decoration hooks. Theirs-list
  // hunks are the identity domain for the pick state machine; the
  // mine pane reads `state.mine` for the SAME hunk id (the controller
  // tracks both slots per hunk).
  const getTheirsSideState = useCallback(
    (hunkId: string) => pickController.get(hunkId).theirs,
    [pickController],
  );
  const getMineSideStateForTheirsHunks = useCallback(
    (hunkId: string) => pickController.get(hunkId).mine,
    [pickController],
  );

  useHunkDecorations({
    editorRef: theirsHandle,
    side: 'theirs',
    hunks: theirsHunks,
    getSideState: getTheirsSideState,
    stateRev: pickStateRev,
  });
  useHunkDecorations({
    editorRef: mineHandle,
    side: 'mine',
    hunks: theirsHunks,
    getSideState: getMineSideStateForTheirsHunks,
    stateRev: pickStateRev,
  });
  // Additional mine pane decorations for the user's local-edit
  // divergences (mineHunks). These don't have controller state, so
  // they always render with the pending-style "this is different"
  // tint until the user resolves them via direct buffer editing or
  // the gutter actions on overlapping theirs hunks.
  useHunkDecorations({ editorRef: mineHandle, side: 'mine', hunks: mineHunks });

  // VS Code-style inline action labels above each pending hunk in
  // the theirs / mine panes. Layout-agnostic — works in every
  // layout because the labels live INSIDE the source panes. Toggled
  // independently from the side gutters via `inlineActionLabels`.
  useHunkActionZones({
    editorRef: theirsHandle,
    side: 'theirs',
    hunks: pickStateHunks,
    controller: pickController,
    stateRev: pickStateRev,
    enabled: inlineActionLabels,
  });
  useHunkActionZones({
    editorRef: mineHandle,
    side: 'mine',
    hunks: pickStateHunks,
    controller: pickController,
    stateRev: pickStateRev,
    enabled: inlineActionLabels && has3Panes,
  });
  // Result-pane status zone — non-interactive labels that maintain
  // row alignment with the theirs / mine action zones (so all three
  // panes' content lines up vertically). Renders "No Changes
  // Accepted" / "Incoming Accepted" / etc. based on per-hunk state.
  useResultStatusZones({
    resultRef: resultHandle,
    trackedRangesRef,
    hunks: pickStateHunks,
    controller: pickController,
    stateRev: pickStateRev,
    enabled: inlineActionLabels,
  });
  // Hashed-diagonal alignment placeholders in theirs / mine when the
  // result region has more lines than the source side does (e.g.
  // both-accepted combination on a 1-line hunk where result becomes
  // 2 lines). Keeps the three panes line-by-line aligned.
  useHunkAlignmentPlaceholders({
    editorRef: theirsHandle,
    side: 'theirs',
    hunks: pickStateHunks,
    controller: pickController,
    stateRev: pickStateRev,
    enabled: inlineActionLabels,
  });
  useHunkAlignmentPlaceholders({
    editorRef: mineHandle,
    side: 'mine',
    hunks: pickStateHunks,
    controller: pickController,
    stateRev: pickStateRev,
    enabled: inlineActionLabels && has3Panes,
  });

  // Reset the controller's state when the file switches — stale entries
  // would carry false signals for hunks that don't exist in the new
  // file's diff.
  // biome-ignore lint/correctness/useExhaustiveDependencies: file id is the lifecycle handle
  useEffect(() => {
    pickController.reset();
    // pickController is stable by construction (ref-mirror above);
    // dropping it from deps avoids the reset cascade that triggered
    // React #185 on Chrome split-tab drag bursts.
  }, [file.id]);

  // Pixel-y positions for the action gutter rows. Recomputed when the
  // hunk set changes or the result editor scrolls / lays out.
  const actionMarkers = useHunkActionMarkers({
    resultRef: resultHandle,
    trackedRangesRef,
    hunks: pickStateHunks,
  });

  // Markers gated by the show-non-conflicting toggle: when off, hide
  // action affordances on hunks whose theirs side didn't change vs
  // base (the "clean from theirs" auto-mergeable case). Still render
  // markers for true conflicts. The toggle only affects the action
  // gutters; line decorations stay always-on per §5.4.
  const visibleActionMarkers = useMemo(() => {
    if (showNonConflicting) return actionMarkers;
    const visibleIds = new Set<string>();
    for (const h of pickStateHunks) {
      const cleanFromTheirs = classification.theirsCleanIds.has(h.id);
      if (!cleanFromTheirs) visibleIds.add(h.id);
    }
    return actionMarkers.filter((m) => visibleIds.has(m.hunkId));
  }, [actionMarkers, showNonConflicting, pickStateHunks, classification]);

  // Legacy single-click accept callback retained for the Monaco
  // command palette ("Accept incoming/current hunk at cursor"). The
  // chord lands as if the user clicked the corresponding action-gutter
  // arrow, routing through the controller so state + buffer stay in
  // lock-step.
  const handleAccept = useCallback(
    (hunkId: string, side: HunkSide) => {
      pickController.dispatch({ hunkId, slot: side === 'theirs' ? 'left' : 'right', action: 'arrow' });
      const sourceLabel = side === 'theirs' ? 'incoming' : 'current';
      onAnnounce?.(`Accepted ${sourceLabel} hunk.`);
    },
    [pickController, onAnnounce],
  );

  useEffect(() => {
    // Stats derive from the per-side pick-state controller. In 3-pane
    // sessions both sides count toward "remaining"; in 2-pane fallback
    // (no base / mine pane hidden) only the theirs side is reachable
    // from the gutter UI, so the mine side is auto-resolved (treated
    // as dismissed) and never blocks Complete Merge gating.
    let theirsPending = 0;
    let minePending = 0;
    let trueConflicts = 0;
    for (const h of pickStateHunks) {
      const state = pickController.get(h.id);
      if (state.theirs === 'pending') theirsPending++;
      if (has3Panes && state.mine === 'pending') minePending++;
      const flagged = classification.theirsConflictIds.has(h.id);
      const cleanFromTheirs = classification.theirsCleanIds.has(h.id);
      const baseRegionConflict =
        'theirsTrueConflicts' in classification && classification.theirsTrueConflicts.has(h.id);
      const isTrueConflict = (flagged && !cleanFromTheirs) || baseRegionConflict;
      const sidesPending = state.theirs === 'pending' || (has3Panes && state.mine === 'pending');
      if (isTrueConflict && sidesPending) trueConflicts++;
    }
    const total = theirsPending + minePending;
    onHunkStatsChange?.({
      theirsRemaining: theirsPending,
      mineRemaining: minePending,
      totalRemaining: total,
      nonConflicting: Math.max(0, total - trueConflicts),
      conflicts: trueConflicts,
    });
    void pickStateRev;
  }, [pickStateHunks, classification, onHunkStatsChange, pickController, pickStateRev, has3Panes]);

  const navIndexRef = useRef(-1);
  const orderedNav = useMemo(() => {
    // Hunks classified clean-from-theirs / clean-from-mine are
    // auto-applicable via "Apply non-conflicting" — skip them in
    // navigator order so F-key cycling lands on hunks the user
    // actually has to think about. Falls back to "show every hunk"
    // when no 3-way classification is available (no base).
    const all = [
      ...theirsHunks
        .filter((h) => !classification.theirsCleanIds.has(h.id))
        .map((h) => ({ hunk: h, side: 'theirs' as const })),
      ...mineHunks
        .filter((h) => !classification.mineCleanIds.has(h.id))
        .map((h) => ({ hunk: h, side: 'mine' as const })),
    ];
    all.sort((a, b) => a.hunk.mineRange.startLine - b.hunk.mineRange.startLine);
    return all;
  }, [theirsHunks, mineHunks, classification]);

  const revealHunkAt = useCallback(
    (idx: number) => {
      if (orderedNav.length === 0) return;
      const wrapped = ((idx % orderedNav.length) + orderedNav.length) % orderedNav.length;
      navIndexRef.current = wrapped;
      const target = orderedNav[wrapped];
      const editor = resultHandle.current.editor;
      if (!editor) return;
      const line = target.hunk.mineRange.startLine;
      // Land the conflict near the TOP of the viewport (VS Code's
      // navigator convention) so the user immediately sees the
      // hunk's content + action zones above it without further
      // scrolling. Pairs with `scrollBeyondLastLine: true` so this
      // works even for hunks near EOF.
      editor.revealLineNearTop(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    },
    [orderedNav, resultHandle],
  );

  // In 2-pane fallback the mine slot isn't reachable from the gutter,
  // so bulk actions skip writing to it (the stats useEffect already
  // treats `mine: 'pending'` in 2-pane as auto-resolved).
  const minePostState: 'dismissed' | 'pending' = has3Panes ? 'dismissed' : 'pending';

  const applyNonConflicting = useCallback(() => {
    const updates: { hunkId: string; next: HunkPickState }[] = [];
    for (const h of pickStateHunks) {
      const flaggedConflict = classification.theirsConflictIds.has(h.id);
      const cleanOverride = classification.theirsCleanIds.has(h.id);
      const baseRegionConflict =
        'theirsTrueConflicts' in classification && classification.theirsTrueConflicts.has(h.id);
      const isTrueConflict = (flaggedConflict && !cleanOverride) || baseRegionConflict;
      if (isTrueConflict) continue;
      const prev = pickController.get(h.id);
      if (prev.theirs !== 'pending') continue;
      updates.push({ hunkId: h.id, next: { theirs: 'accepted', mine: minePostState } });
    }
    if (updates.length > 0) {
      onAnnounce?.(`Applied ${updates.length} non-conflicting ${updates.length === 1 ? 'hunk' : 'hunks'}.`);
      pickController.bulkSet(updates);
    }
  }, [pickStateHunks, classification, pickController, onAnnounce, minePostState]);

  const acceptAllTheirs = useCallback(() => {
    const updates: { hunkId: string; next: HunkPickState }[] = pickStateHunks.map((h) => ({
      hunkId: h.id,
      next: { theirs: 'accepted', mine: minePostState },
    }));
    if (updates.length > 0) {
      onAnnounce?.(`Accepted all ${updates.length} incoming ${updates.length === 1 ? 'hunk' : 'hunks'}.`);
      pickController.bulkSet(updates);
    }
  }, [pickStateHunks, pickController, onAnnounce, minePostState]);

  const acceptAllMine = useCallback(() => {
    // In 2-pane fallback there is no separate "mine" content to take —
    // the right pane isn't displayed and the mine slot is unreachable
    // from the gutter. Skip the action entirely.
    if (!has3Panes) return;
    const updates: { hunkId: string; next: HunkPickState }[] = pickStateHunks.map((h) => ({
      hunkId: h.id,
      next: { theirs: 'dismissed', mine: 'accepted' },
    }));
    if (updates.length > 0) {
      onAnnounce?.(`Accepted all ${updates.length} current ${updates.length === 1 ? 'hunk' : 'hunks'}.`);
      pickController.bulkSet(updates);
    }
  }, [pickStateHunks, pickController, onAnnounce, has3Panes]);

  useImperativeHandle(
    ref,
    () => ({
      getResultText: () => resultHandle.current.model?.getValue() ?? '',
      gotoNextHunk: () => revealHunkAt(navIndexRef.current + 1),
      gotoPrevHunk: () => revealHunkAt(navIndexRef.current - 1),
      applyNonConflicting,
      acceptAllTheirs,
      acceptAllMine,
      resetLayout: () => {
        gridResize.reset();
        // Defer layout recompute; reset() updates state which re-renders
        // with new templates. Editor.layout fires through onSashResize.
      },
    }),
    [resultHandle, revealHunkAt, applyNonConflicting, acceptAllTheirs, acceptAllMine, gridResize],
  );

  // Monaco command palette actions. Bundled into a ref so action
  // closures see fresh hunks / handlers without re-registering on
  // every render.
  const actionContextRef = useRef<MergeActionsContext | null>(null);
  actionContextRef.current = {
    theirsHunks,
    mineHunks,
    acceptHunk: handleAccept,
    gotoNextHunk: () => revealHunkAt(navIndexRef.current + 1),
    gotoPrevHunk: () => revealHunkAt(navIndexRef.current - 1),
    applyNonConflicting,
    acceptAllTheirs,
    acceptAllMine,
    pickUndo: () => pickController.undo(),
    pickRedo: () => pickController.redo(),
  };
  useMergeActions({ resultEditorRef: resultHandle, contextRef: actionContextRef });

  const paneBg = isDarkMode ? PANE_BG_DARK : PANE_BG_LIGHT;

  const sashBg = isDarkMode ? '#3a3a3a' : '#d0d0d0';

  return (
    <div
      className={className}
      ref={containerRef}
      data-merge-theme={isDarkMode ? 'dark' : 'light'}
      style={{
        display: 'grid',
        gridTemplateAreas: grid.areas,
        gridTemplateColumns: grid.cols,
        gridTemplateRows: grid.rows,
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        background: isDarkMode ? '#2a2a2a' : '#e5e5e5',
      }}
    >
      <Sash
        gridArea="sashTL"
        axis="col"
        bg={sashBg}
        ariaLabel="Resize column 1 / column 2"
        ariaValueNow={Math.round((gridResize.ratios.cols[0] / 3) * 100)}
        onPointerDown={(e) => gridResize.onColSashPointerDown(0, e)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.15 : 0.05;
          if (e.key === 'ArrowLeft') {
            gridResize.nudgeColSash(0, 'left', step);
            e.preventDefault();
          } else if (e.key === 'ArrowRight') {
            gridResize.nudgeColSash(0, 'right', step);
            e.preventDefault();
          }
        }}
      />
      {has3Panes ? (
        <Sash
          gridArea="sashTR"
          axis="col"
          bg={sashBg}
          ariaLabel="Resize column 2 / column 3"
          ariaValueNow={Math.round((gridResize.ratios.cols[1] / 3) * 100)}
          onPointerDown={(e) => gridResize.onColSashPointerDown(1, e)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 0.15 : 0.05;
            if (e.key === 'ArrowLeft') {
              gridResize.nudgeColSash(1, 'left', step);
              e.preventDefault();
            } else if (e.key === 'ArrowRight') {
              gridResize.nudgeColSash(1, 'right', step);
              e.preventDefault();
            }
          }}
        />
      ) : null}
      {grid.rowSash ? (
        <Sash
          gridArea="rsash"
          axis="row"
          bg={sashBg}
          ariaLabel="Resize top row / bottom row"
          ariaValueNow={Math.round(gridResize.ratios.rows[0] * 100)}
          onPointerDown={gridResize.onRowSashPointerDown}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 0.15 : 0.05;
            if (e.key === 'ArrowUp') {
              gridResize.nudgeRowSash('up', step);
              e.preventDefault();
            } else if (e.key === 'ArrowDown') {
              gridResize.nudgeRowSash('down', step);
              e.preventDefault();
            }
          }}
        />
      ) : null}
      <PaneSlot
        gridArea="theirs"
        visible={visibility.theirs}
        bg={paneBg}
        header={renderHeader ? renderHeader('theirs') : <DefaultHeader label="Incoming (theirs)" />}
        containerRef={theirsContainerRef}
      />
      <PaneSlot
        gridArea="result"
        visible={visibility.result}
        bg={paneBg}
        header={
          renderHeader ? (
            renderHeader('result')
          ) : (
            <DefaultHeader label={has3Panes ? 'Result' : 'Yours (mine, edit here)'} />
          )
        }
        containerRef={resultContainerRef}
        leftFlanker={
          sideActionGutters && pickStateHunks.length > 0 ? (
            <HunkActionGutter
              side="left"
              markers={visibleActionMarkers}
              controller={pickController}
              stateRev={pickStateRev}
            />
          ) : undefined
        }
        rightFlanker={
          // Right (mine) decisions only matter in 3-pane sessions —
          // in 2-pane fallback the right pane (mine) doesn't render
          // and the user can't compare against a separate local copy.
          // Theirs↔result resolution via the left gutter is the whole
          // surface in that case.
          sideActionGutters && pickStateHunks.length > 0 && has3Panes ? (
            <HunkActionGutter
              side="right"
              markers={visibleActionMarkers}
              controller={pickController}
              stateRev={pickStateRev}
            />
          ) : undefined
        }
      />
      <PaneSlot
        gridArea="mine"
        visible={visibility.mine}
        bg={paneBg}
        header={renderHeader ? renderHeader('mine') : <DefaultHeader label="Current (mine)" />}
        containerRef={mineContainerRef}
      />
      <PaneSlot
        gridArea="base"
        visible={visibility.base}
        bg={paneBg}
        header={renderHeader ? renderHeader('base') : <DefaultHeader label="Base (common ancestor)" />}
        containerRef={baseContainerRef}
      />
    </div>
  );
});

interface PaneSlotProps {
  gridArea: string;
  visible: boolean;
  bg: string;
  header: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Optional flex-row flankers around the editor container. Used by
   *  the result pane to render the per-side action gutters
   *  (`<HunkActionGutter>`) flanking the editable Monaco surface. */
  leftFlanker?: ReactNode;
  rightFlanker?: ReactNode;
}

function PaneSlot({
  gridArea,
  visible,
  bg,
  header,
  containerRef,
  leftFlanker,
  rightFlanker,
}: PaneSlotProps): React.ReactElement {
  return (
    <div
      style={{
        gridArea,
        // Hide via display:none; the inner editor instance + DOM
        // container survive (React keeps the subtree mounted; CSS
        // just removes it from layout). Re-showing triggers a Monaco
        // layout() in the visibility effect upstream so the editor
        // recovers its scroll geometry.
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        background: bg,
      }}
    >
      <div
        style={{
          height: HEADER_HEIGHT,
          padding: HEADER_PAD,
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(127,127,127,0.2)',
        }}
      >
        {header}
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
        {leftFlanker}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
        {rightFlanker}
      </div>
    </div>
  );
}

function DefaultHeader({ label }: { label: string }): React.ReactElement {
  return <span>{label}</span>;
}

interface SashProps {
  gridArea: string;
  axis: 'col' | 'row';
  bg: string;
  ariaLabel: string;
  /** Approximate "first pane" share as a percentage (0–100). */
  ariaValueNow: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function Sash({
  gridArea,
  axis,
  bg,
  ariaLabel,
  ariaValueNow,
  onPointerDown,
  onKeyDown,
}: SashProps): React.ReactElement {
  return (
    <div
      className="oh-merge__sash"
      style={{
        gridArea,
        background: bg,
        cursor: axis === 'col' ? 'col-resize' : 'row-resize',
        zIndex: 2,
      }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="separator"
      aria-orientation={axis === 'col' ? 'vertical' : 'horizontal'}
      aria-label={ariaLabel}
      aria-valuenow={ariaValueNow}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}

export default MergePane;
export type { MergeFile } from '../types';
