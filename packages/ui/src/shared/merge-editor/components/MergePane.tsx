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
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { Hunk } from '../diff/line-diff';
import { useCharDecorations } from '../monaco/use-char-decorations';
import { useGridResize } from '../monaco/use-grid-resize';
import { useHunkActionMarkers } from '../monaco/use-hunk-action-markers';
import { useHunkActionZones } from '../monaco/use-hunk-action-zones';
import { useHunkAlignmentPlaceholders } from '../monaco/use-hunk-alignment-placeholders';
import { useHunkDecorations } from '../monaco/use-hunk-decorations';
import { useResultStatusZones } from '../monaco/use-result-status-zones';
import { useHunkTrackedRanges } from '../monaco/use-hunk-tracked-ranges';
import { type MergeActionsContext, useMergeActions } from '../monaco/use-merge-actions';
import { useMonacoEditorLifecycle } from '../monaco/use-monaco-editor-lifecycle';
import { useSyncScroll } from '../monaco/use-sync-scroll';
import type { MergeFile } from '../types';
import { createPickStateController, type PickStateController } from '../use-hunk-pick-state';
import { useMergeCompactView } from '../use-merge-compact-view';
import { useMergeDiffs } from '../use-merge-diffs';
import { type HunkStats, useMergeResolutionCommands } from '../use-merge-resolution-commands';
import HunkActionGutter from './HunkActionGutter';
import { gridTemplate, type MergeLayout, paneVisibility } from './layout';
import { DefaultHeader, PaneSlot, Sash } from './merge-pane-chrome';

export type { MergeLayout } from './layout';
export type { HunkStats } from '../use-merge-resolution-commands';

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
  /** Show inline action labels above each pending
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
   *  Same Monaco primitive (`setHiddenAreas`) upstream merge editors
   *  use. Default false. */
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
  const t = useT();
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

  const { theirsHunks, mineHunks, pickStateHunks, analyses } = useMergeDiffs(file, resultText);

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

  // Inline action labels above each pending hunk in
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

  useMergeCompactView({
    theirsRef: theirsHandle,
    mineRef: mineHandle,
    resultRef: resultHandle,
    pickStateHunks,
    trackedRangesRef,
    pickStateRev,
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

  const { gotoNextHunk, gotoPrevHunk, applyNonConflicting, acceptAllTheirs, acceptAllMine, acceptHunk } =
    useMergeResolutionCommands({
      analyses,
      pickStateHunks,
      pickController,
      pickStateRev,
      has3Panes,
      resultRef: resultHandle,
      onHunkStatsChange,
      onAnnounce,
    });

  useImperativeHandle(
    ref,
    () => ({
      getResultText: () => resultHandle.current.model?.getValue() ?? '',
      gotoNextHunk,
      gotoPrevHunk,
      applyNonConflicting,
      acceptAllTheirs,
      acceptAllMine,
      resetLayout: () => {
        gridResize.reset();
        // Defer layout recompute; reset() updates state which re-renders
        // with new templates. Editor.layout fires through onSashResize.
      },
    }),
    [resultHandle, gotoNextHunk, gotoPrevHunk, applyNonConflicting, acceptAllTheirs, acceptAllMine, gridResize],
  );

  // Monaco command palette actions. Bundled into a ref so action
  // closures see fresh hunks / handlers without re-registering on
  // every render.
  const actionContextRef = useRef<MergeActionsContext | null>(null);
  actionContextRef.current = {
    theirsHunks,
    mineHunks,
    acceptHunk,
    gotoNextHunk,
    gotoPrevHunk,
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
        ariaLabel={t('shared.mergeEditor.sash.columns12')}
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
          ariaLabel={t('shared.mergeEditor.sash.columns23')}
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
          ariaLabel={t('shared.mergeEditor.sash.rows')}
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
        header={renderHeader ? renderHeader('theirs') : <DefaultHeader label={t('shared.mergeEditor.pane.incoming')} />}
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
            <DefaultHeader
              label={has3Panes ? t('shared.mergeEditor.pane.result') : t('shared.mergeEditor.pane.yoursEditHere')}
            />
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
        header={renderHeader ? renderHeader('mine') : <DefaultHeader label={t('shared.mergeEditor.pane.current')} />}
        containerRef={mineContainerRef}
      />
      <PaneSlot
        gridArea="base"
        visible={visibility.base}
        bg={paneBg}
        header={renderHeader ? renderHeader('base') : <DefaultHeader label={t('shared.mergeEditor.pane.base')} />}
        containerRef={baseContainerRef}
      />
    </div>
  );
});

export default MergePane;
export type { MergeFile } from '../types';
