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
import { analyzeHunks } from '../diff/hunk-analysis';
import type { Hunk, LineRange } from '../diff/line-diff';
import { diffLinesPatience } from '../diff/patience-diff';
import { useCharDecorations } from '../monaco/use-char-decorations';
import { useGridResize } from '../monaco/use-grid-resize';
import { useHiddenAreas } from '../monaco/use-hidden-areas';
import { useHunkActionMarkers } from '../monaco/use-hunk-action-markers';
import {
  useHunkActionZones,
  useHunkAlignmentPlaceholders,
  useResultStatusZones,
} from '../monaco/use-hunk-action-zones';
import { type HunkSide, useHunkDecorations } from '../monaco/use-hunk-decorations';
import { useHunkTrackedRanges } from '../monaco/use-hunk-tracked-ranges';
import { type MergeActionsContext, useMergeActions } from '../monaco/use-merge-actions';
import { useMonacoEditorLifecycle } from '../monaco/use-monaco-editor-lifecycle';
import { useSyncScroll } from '../monaco/use-sync-scroll';
import type { MergeFile } from '../types';
import { createPickStateController, type HunkPickState, type PickStateController } from '../use-hunk-pick-state';
import HunkActionGutter from './HunkActionGutter';
import { gridTemplate, type MergeLayout, paneVisibility } from './layout';
import { DefaultHeader, PaneSlot, Sash } from './merge-pane-chrome';

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
  /** Monaco theme id the shell wants applied. The shell owns the theme
   *  registry; the editor just calls `setTheme`. Falls back to Monaco's
   *  built-in `vs` / `vs-dark` (per `isDarkMode`) when the shell doesn't
   *  supply one — keeps the editor self-contained. */
  monacoTheme?: string;
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
  /** When true, collapse unchanged regions across all three panes so
   *  the editor focuses on hunk regions + a few lines of context.
   *  Same Monaco primitive (`setHiddenAreas`) VS Code's merge editor
   *  uses. Default false. */
  compactView?: boolean;
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

const MergePane = forwardRef<MergePaneHandle, MergePaneProps>(function MergePane(props, ref) {
  const {
    file,
    isDarkMode,
    monacoTheme,
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
    compactView = false,
  } = props;
  // The shell supplies the Monaco theme id; `isDarkMode` independently
  // drives the merge-pane background shading and the built-in fallback.
  const resolvedMonacoTheme = monacoTheme ?? (isDarkMode ? 'vs-dark' : 'vs');
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
    // Result pane is read-only — every write goes through the
    // controller (Accept Incoming / Current / Combination / Remove)
    // so user free-typing can't introduce parse-incompatible content.
    // Programmatic `executeEdits` from the controller still works on
    // a read-only editor, and Monaco's undo stack still records
    // those edits so Cmd/Ctrl+Z reverts them via our chord handler.
    readOnly: true,
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
    monacoEditor.setTheme(resolvedMonacoTheme);
  }, [resolvedMonacoTheme]);

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

  // Base-axis diffs feed the analysis pipeline when base is available.
  // 2-pane fallback (file.base undefined) lets `analyzeHunks` derive
  // per-side kinds from the pair-diff alone.
  const theirsBaseHunks = useMemo(
    () => (file.base !== undefined ? diffLinesPatience(file.base, file.theirs) : []),
    [file.base, file.theirs],
  );
  const mineBaseHunks = useMemo(
    () => (file.base !== undefined ? diffLinesPatience(file.base, file.mine) : []),
    [file.base, file.mine],
  );

  // Hunks that participate in the per-side state machine AND drive
  // every visual decoration. Computed ONCE against
  // `file.initialResult` (not the live `resultText`) so hunk identity
  // is stable across the user's own pick-driven buffer edits. If we
  // used the live `theirsHunks`, accepting a hunk would write theirs
  // into result, causing diff(theirs, result) to drop that hunk
  // (content matches now) — which would tear down the OTHER side's
  // action zone too, destroying the user's affordance to also accept
  // the other side and produce a combination. Static hunks persist
  // until the file switches.
  //
  // pickStateHunks's range axes (theirsRange = positions in
  // file.theirs, mineRange = positions in file.initialResult ≈
  // file.mine) are stable, which is what the per-pane decorations
  // need — live hunks have result-side mineRange that drifts from
  // mine after each accept, causing decorations to land on the
  // wrong rows.
  const pickStateHunks = useMemo(
    () => (file.kind === 'remove' ? [] : diffLinesPatience(file.theirs, file.initialResult)),
    [file.theirs, file.initialResult, file.kind],
  );

  // Per-hunk base-aware analysis. One pass producing one HunkAnalysis
  // per pickStateHunk — every downstream visual decision (line tint,
  // frame color, missing-side placeholder, conflict counter, "apply
  // non-conflicting" gate) reads from this single source of truth.
  // Stable: depends on initialResult, not the live result text. Base
  // hunks are passed only when file.base is supplied; 2-pane fallback
  // derives kinds from the pair-diff inside `analyzeHunks`.
  const analyses = useMemo(
    () =>
      analyzeHunks({
        pickHunks: pickStateHunks,
        theirsBaseHunks: file.base !== undefined ? theirsBaseHunks : undefined,
        mineBaseHunks: file.base !== undefined ? mineBaseHunks : undefined,
      }),
    [pickStateHunks, file.base, theirsBaseHunks, mineBaseHunks],
  );

  // Char-diff decorations — must run AFTER pickStateHunks since they
  // consume it. Empty-side hunks are visualised by
  // `useHunkAlignmentPlaceholders`'s missing-side slot (a full
  // bordered hashed rectangle of the right line count on the empty
  // side), so no separate "missing marker" hook is needed.
  useCharDecorations({ editorRef: theirsHandle, side: 'theirs', hunks: pickStateHunks });
  useCharDecorations({ editorRef: mineHandle, side: 'mine', hunks: pickStateHunks });

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
  const getTheirsSideState = useCallback((hunkId: string) => pickController.get(hunkId).theirs, [pickController]);
  const getMineSideStateForTheirsHunks = useCallback(
    (hunkId: string) => pickController.get(hunkId).mine,
    [pickController],
  );

  useHunkDecorations({
    editorRef: theirsHandle,
    side: 'theirs',
    analyses,
    getSideState: getTheirsSideState,
    stateRev: pickStateRev,
  });
  useHunkDecorations({
    editorRef: mineHandle,
    side: 'mine',
    analyses,
    getSideState: getMineSideStateForTheirsHunks,
    stateRev: pickStateRev,
  });
  // No third decoration call for `mineHunks` (live mine ↔ result
  // diff). With the result pane read-only and every write going
  // through the controller, the only divergence between mine and
  // result is the controller's own writes — already represented in
  // pickStateHunks above. Adding a `mineHunks`-driven decoration
  // would re-paint the same conflict twice, AND the mine-side range
  // it carries is the post-write RESULT position (not mine), so
  // decorations would land on the wrong rows after the first accept.

  // VS Code-style inline action labels above each pending hunk in
  // the theirs / mine panes. Layout-agnostic — works in every
  // layout because the labels live INSIDE the source panes. Frame
  // color (orange/blue/grey) derives from `analysis.conflict` +
  // per-side pick state inside the hook via `frameForSide`.
  useHunkActionZones({
    editorRef: theirsHandle,
    side: 'theirs',
    analyses,
    controller: pickController,
    stateRev: pickStateRev,
    enabled: inlineActionLabels,
  });
  useHunkActionZones({
    editorRef: mineHandle,
    side: 'mine',
    analyses,
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
    analyses,
    controller: pickController,
    stateRev: pickStateRev,
    enabled: inlineActionLabels,
  });
  // Alignment placeholders in theirs / mine. Missing-side variant
  // (red "Removed here" vs grey "No content here") derives from
  // `analysis.theirs.kind` / `analysis.mine.kind` inside the hook.
  useHunkAlignmentPlaceholders({
    editorRef: theirsHandle,
    side: 'theirs',
    analyses,
    controller: pickController,
    stateRev: pickStateRev,
    enabled: inlineActionLabels,
    has3Panes,
  });
  useHunkAlignmentPlaceholders({
    editorRef: mineHandle,
    side: 'mine',
    analyses,
    controller: pickController,
    stateRev: pickStateRev,
    enabled: inlineActionLabels && has3Panes,
    has3Panes,
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

  // Compact-view hidden ranges. Theirs / mine use pickStateHunks's
  // own range axes directly (stable, pane-local coordinates).
  // Result must read live tracked ranges via trackedRangesRef
  // because the result pane's content shifts every time the user
  // accepts a hunk — pickStateHunks's mineRange points at the
  // INITIAL insertion position, which can drift from the actual
  // post-accept content for multi-line stacks (e.g. Accept
  // Combination of a 5+5-line modification). pickStateRev in the
  // memo's deps busts the cache on every controller mutation so
  // the visible windows track the live content.
  const theirsVisibleRanges = useMemo<LineRange[]>(() => pickStateHunks.map((h) => h.theirsRange), [pickStateHunks]);
  const mineVisibleRanges = useMemo<LineRange[]>(() => pickStateHunks.map((h) => h.mineRange), [pickStateHunks]);
  const resultVisibleRanges = useMemo<LineRange[]>(() => {
    const ranges: LineRange[] = [];
    for (const h of pickStateHunks) {
      const live = trackedRangesRef.current?.liveRangeOf(h.id);
      if (live) {
        ranges.push({ startLine: live.startLineNumber, endLine: live.endLineNumber + 1 });
      } else {
        ranges.push(h.mineRange);
      }
    }
    void pickStateRev;
    return ranges;
  }, [pickStateHunks, pickStateRev, trackedRangesRef]);
  // Smallest indent across the hunk's actual content lines. Drives
  // ancestor lookup in `useHiddenAreas` so insertion-point hunks
  // (whose pane-local anchor is a sibling line, not a child) still
  // find the right structural parent. e.g. a peer-added row inserted
  // at the `responseHeaders:` line — anchor indent 2, content indent
  // 4 → walking from indent 4 surfaces `requestHeaders:` at indent 2
  // as the logical parent. Same array reused across all three panes
  // since the content text doesn't depend on which pane displays it.
  const hunkContentIndents = useMemo<ReadonlyArray<number | undefined>>(
    () =>
      pickStateHunks.map((h) => {
        let min = Number.POSITIVE_INFINITY;
        for (const line of [...h.theirsLines, ...h.mineLines]) {
          if (line.trim() === '') continue;
          let i = 0;
          while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
          if (i < min) min = i;
        }
        return Number.isFinite(min) ? min : undefined;
      }),
    [pickStateHunks],
  );

  useHiddenAreas({
    editorRef: theirsHandle,
    visibleRanges: theirsVisibleRanges,
    contentIndents: hunkContentIndents,
    context: 3,
    enabled: compactView,
  });
  useHiddenAreas({
    editorRef: mineHandle,
    visibleRanges: mineVisibleRanges,
    contentIndents: hunkContentIndents,
    context: 3,
    enabled: compactView,
  });
  useHiddenAreas({
    editorRef: resultHandle,
    visibleRanges: resultVisibleRanges,
    contentIndents: hunkContentIndents,
    context: 3,
    enabled: compactView,
  });

  // Pixel-y positions for the action gutter rows. Recomputed when the
  // hunk set changes or the result editor scrolls / lays out.
  const actionMarkers = useHunkActionMarkers({
    resultRef: resultHandle,
    trackedRangesRef,
    hunks: pickStateHunks,
  });

  // Markers gated by the show-non-conflicting toggle: when off, hide
  // hunks where THEIRS didn't change vs base — those are the user's
  // own edits flowing through result, not peer changes that need a
  // decision. Pure-theirs changes (peer added / modified, mine
  // untouched) stay visible because the user still has to acknowledge
  // them. True conflicts stay visible too. The toggle only affects
  // the action gutters; line decorations stay always-on per §5.4.
  const visibleActionMarkers = useMemo(() => {
    if (showNonConflicting) return actionMarkers;
    const visibleIds = new Set<string>();
    for (const a of analyses) {
      if (a.theirs.kind !== 'unchanged') visibleIds.add(a.id);
    }
    return actionMarkers.filter((m) => visibleIds.has(m.hunkId));
  }, [actionMarkers, showNonConflicting, analyses]);

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
    // Stats derive from the controller + the unified analysis. In
    // 2-pane fallback (mine pane hidden) the mine slot is unreachable
    // so its pending count is ignored — the stats useEffect already
    // treats `mine: 'pending'` in 2-pane as auto-resolved.
    let theirsPending = 0;
    let minePending = 0;
    let trueConflicts = 0;
    for (const analysis of analyses) {
      const state = pickController.get(analysis.id);
      if (state.theirs === 'pending') theirsPending++;
      if (has3Panes && state.mine === 'pending') minePending++;
      const sidesPending = state.theirs === 'pending' || (has3Panes && state.mine === 'pending');
      if (analysis.conflict === 'true' && sidesPending) trueConflicts++;
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
  }, [analyses, onHunkStatsChange, pickController, pickStateRev, has3Panes]);

  const navIndexRef = useRef(-1);
  const orderedNav = useMemo(() => {
    // Navigate only through TRUE conflicts (auto-mergeable hunks
    // resolve via "Apply Non-Conflicting" — no need to cycle through
    // them with the F-keys). Order by mine-side line for natural top-
    // to-bottom traversal in the result pane.
    const trueConflictIds = new Set<string>();
    for (const a of analyses) if (a.conflict === 'true') trueConflictIds.add(a.id);
    const visible = pickStateHunks.filter((h) => trueConflictIds.has(h.id));
    return visible
      .map((h) => ({ hunk: h, side: 'theirs' as const }))
      .sort((a, b) => a.hunk.mineRange.startLine - b.hunk.mineRange.startLine);
  }, [analyses, pickStateHunks]);

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
    for (const analysis of analyses) {
      if (analysis.conflict === 'true') continue;
      const prev = pickController.get(analysis.id);
      if (prev.theirs !== 'pending') continue;
      // Auto-mergeable hunk shape: take whichever side actually
      // changed vs base. Mine-only change ⇒ keep mine (dismiss
      // theirs). Theirs-only change ⇒ accept theirs (default
      // dismissed mine in 3-pane). 2-pane fallback collapses to
      // "accept theirs" because that's the only axis the user can
      // act on.
      if (analysis.hasBase && analysis.theirs.kind === 'unchanged' && analysis.mine.kind !== 'unchanged') {
        updates.push({ hunkId: analysis.id, next: { theirs: 'dismissed', mine: 'accepted' } });
      } else {
        updates.push({ hunkId: analysis.id, next: { theirs: 'accepted', mine: minePostState } });
      }
    }
    if (updates.length > 0) {
      onAnnounce?.(`Applied ${updates.length} non-conflicting ${updates.length === 1 ? 'hunk' : 'hunks'}.`);
      pickController.bulkSet(updates);
    }
  }, [analyses, pickController, onAnnounce, minePostState]);

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
  // Side editors get the undo/redo chords too so Cmd/Ctrl+Z works
  // regardless of which pane has focus — undo is global to the
  // modal, not bound to a single editor's focus.
  const sideEditorRefs = useMemo(() => [theirsHandle, mineHandle, baseHandle], [theirsHandle, mineHandle, baseHandle]);
  useMergeActions({
    resultEditorRef: resultHandle,
    sideEditorRefs,
    contextRef: actionContextRef,
  });

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

export default MergePane;
export type { MergeFile } from '../types';
