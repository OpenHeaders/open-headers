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
import { useTheme } from '@context/ThemeContext';
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
import { useHunkAcceptArrows } from '../monaco/use-hunk-accept-arrows';
import { type HunkSide, useHunkDecorations } from '../monaco/use-hunk-decorations';
import { type MergeActionsContext, useMergeActions } from '../monaco/use-merge-actions';
import { useMissingMarkers } from '../monaco/use-missing-markers';
import { useMonacoEditorLifecycle } from '../monaco/use-monaco-editor-lifecycle';
import { useSyncScroll } from '../monaco/use-sync-scroll';
import type { MergeFile } from '../types';
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
  } = props;
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
    options: { glyphMargin: true },
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
    options: { glyphMargin: true },
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

  const theirsHunks = useMemo(() => diffLinesPatience(file.theirs, resultText), [file.theirs, resultText]);
  const mineHunks = useMemo(() => diffLinesPatience(file.mine, resultText), [file.mine, resultText]);

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

  const visibleTheirs = useMemo(
    () =>
      showNonConflicting
        ? theirsHunks
        : theirsHunks.filter(
            (h) => classification.theirsConflictIds.has(h.id) && !classification.theirsCleanIds.has(h.id),
          ),
    [showNonConflicting, theirsHunks, classification],
  );
  const visibleMine = useMemo(
    () =>
      showNonConflicting
        ? mineHunks
        : mineHunks.filter((h) => classification.mineConflictIds.has(h.id) && !classification.mineCleanIds.has(h.id)),
    [showNonConflicting, mineHunks, classification],
  );

  useHunkDecorations({ editorRef: theirsHandle, side: 'theirs', hunks: visibleTheirs });
  useHunkDecorations({ editorRef: mineHandle, side: 'mine', hunks: visibleMine });
  useMissingMarkers({ editorRef: theirsHandle, side: 'theirs', hunks: visibleTheirs });
  useMissingMarkers({ editorRef: mineHandle, side: 'mine', hunks: visibleMine });
  useCharDecorations({ editorRef: theirsHandle, side: 'theirs', hunks: visibleTheirs });
  useCharDecorations({ editorRef: mineHandle, side: 'mine', hunks: visibleMine });

  const handleAccept = useCallback(
    (hunkId: string, side: HunkSide) => {
      const hunks: readonly Hunk[] = side === 'theirs' ? theirsHunks : mineHunks;
      const hunk = hunks.find((h) => h.id === hunkId);
      if (!hunk) return;
      const editor = resultHandle.current.editor;
      const model = resultHandle.current.model;
      if (!editor || !model) return;

      const targetRange = hunk.mineRange;
      const replacementLines = side === 'theirs' ? hunk.theirsLines : hunk.mineLines;
      const replacementText = replacementLines.join('\n') + (replacementLines.length > 0 ? '\n' : '');

      const startLine = Math.max(1, targetRange.startLine);
      const endLine = targetRange.endLine;
      const isInsertion = endLine <= startLine;
      const lineCount = model.getLineCount();
      const replaceRange = isInsertion
        ? {
            startLineNumber: Math.min(startLine, lineCount + 1),
            startColumn: 1,
            endLineNumber: Math.min(startLine, lineCount + 1),
            endColumn: 1,
          }
        : {
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: Math.min(endLine - 1, lineCount),
            endColumn: model.getLineMaxColumn(Math.min(endLine - 1, lineCount)),
          };
      editor.executeEdits('oh-merge-accept', [
        {
          range: replaceRange,
          text: isInsertion ? replacementText : replacementLines.join('\n'),
          forceMoveMarkers: true,
        },
      ]);
      const sourceLabel = side === 'theirs' ? 'incoming' : 'current';
      onAnnounce?.(`Accepted ${sourceLabel} hunk at line ${startLine}.`);
    },
    [theirsHunks, mineHunks, resultHandle, onAnnounce],
  );

  useHunkAcceptArrows({ editorRef: theirsHandle, side: 'theirs', hunks: visibleTheirs, onAccept: handleAccept });
  useHunkAcceptArrows({ editorRef: mineHandle, side: 'mine', hunks: visibleMine, onAccept: handleAccept });

  useEffect(() => {
    // 3-way refines the conflict count: a hunk in the 2-way conflict
    // set is NOT a true conflict if the corresponding side is in the
    // clean-from-X set (peer-only or user-only edit).
    const trueTheirsConflicts = new Set<string>();
    for (const id of classification.theirsConflictIds) {
      if (!classification.theirsCleanIds.has(id)) trueTheirsConflicts.add(id);
    }
    const trueMineConflicts = new Set<string>();
    for (const id of classification.mineConflictIds) {
      if (!classification.mineCleanIds.has(id)) trueMineConflicts.add(id);
    }
    const conflicts = trueTheirsConflicts.size + trueMineConflicts.size;
    const total = theirsHunks.length + mineHunks.length;
    onHunkStatsChange?.({
      theirsRemaining: theirsHunks.length,
      mineRemaining: mineHunks.length,
      totalRemaining: total,
      nonConflicting: total - conflicts,
      conflicts,
    });
  }, [theirsHunks, mineHunks, classification, onHunkStatsChange]);

  const navIndexRef = useRef(-1);
  const orderedNav = useMemo(() => {
    const all = [
      ...theirsHunks.map((h) => ({ hunk: h, side: 'theirs' as const })),
      ...mineHunks.map((h) => ({ hunk: h, side: 'mine' as const })),
    ];
    all.sort((a, b) => a.hunk.mineRange.startLine - b.hunk.mineRange.startLine);
    return all;
  }, [theirsHunks, mineHunks]);

  const revealHunkAt = useCallback(
    (idx: number) => {
      if (orderedNav.length === 0) return;
      const wrapped = ((idx % orderedNav.length) + orderedNav.length) % orderedNav.length;
      navIndexRef.current = wrapped;
      const target = orderedNav[wrapped];
      const editor = resultHandle.current.editor;
      if (!editor) return;
      const line = target.hunk.mineRange.startLine;
      editor.revealLineInCenterIfOutsideViewport(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    },
    [orderedNav, resultHandle],
  );

  const bulkApply = useCallback(
    (picks: ReadonlyArray<{ hunk: Hunk; replacement: readonly string[] }>) => {
      const editor = resultHandle.current.editor;
      const model = resultHandle.current.model;
      if (!editor || !model || picks.length === 0) return;
      const sorted = [...picks].sort((a, b) => b.hunk.mineRange.startLine - a.hunk.mineRange.startLine);
      const lineCount = model.getLineCount();
      const ops = sorted.map(({ hunk, replacement }) => {
        const startLine = Math.max(1, hunk.mineRange.startLine);
        const endLine = hunk.mineRange.endLine;
        const isInsertion = endLine <= startLine;
        const replacementText = replacement.join('\n') + (replacement.length > 0 && isInsertion ? '\n' : '');
        const range = isInsertion
          ? {
              startLineNumber: Math.min(startLine, lineCount + 1),
              startColumn: 1,
              endLineNumber: Math.min(startLine, lineCount + 1),
              endColumn: 1,
            }
          : {
              startLineNumber: startLine,
              startColumn: 1,
              endLineNumber: Math.min(endLine - 1, lineCount),
              endColumn: model.getLineMaxColumn(Math.min(endLine - 1, lineCount)),
            };
        return { range, text: isInsertion ? replacementText : replacement.join('\n'), forceMoveMarkers: true };
      });
      editor.executeEdits('oh-merge-bulk', ops);
    },
    [resultHandle],
  );

  const applyNonConflicting = useCallback(() => {
    // A hunk is non-conflicting if it's not flagged 2-way OR if the
    // 3-way clean set tells us only one side actually changed vs base.
    const picks: { hunk: Hunk; replacement: readonly string[] }[] = [];
    for (const h of theirsHunks) {
      const flaggedConflict = classification.theirsConflictIds.has(h.id);
      const cleanOverride = classification.theirsCleanIds.has(h.id);
      if (!flaggedConflict || cleanOverride) picks.push({ hunk: h, replacement: h.theirsLines });
    }
    for (const h of mineHunks) {
      const flaggedConflict = classification.mineConflictIds.has(h.id);
      const cleanOverride = classification.mineCleanIds.has(h.id);
      if (!flaggedConflict || cleanOverride) picks.push({ hunk: h, replacement: h.mineLines });
    }
    if (picks.length > 0)
      onAnnounce?.(`Applied ${picks.length} non-conflicting ${picks.length === 1 ? 'hunk' : 'hunks'}.`);
    bulkApply(picks);
  }, [theirsHunks, mineHunks, classification, bulkApply, onAnnounce]);

  const acceptAllTheirs = useCallback(() => {
    if (theirsHunks.length > 0)
      onAnnounce?.(`Accepted all ${theirsHunks.length} incoming ${theirsHunks.length === 1 ? 'hunk' : 'hunks'}.`);
    bulkApply(theirsHunks.map((h) => ({ hunk: h, replacement: h.theirsLines })));
  }, [theirsHunks, bulkApply, onAnnounce]);

  const acceptAllMine = useCallback(() => {
    if (mineHunks.length > 0)
      onAnnounce?.(`Accepted all ${mineHunks.length} current ${mineHunks.length === 1 ? 'hunk' : 'hunks'}.`);
    bulkApply(mineHunks.map((h) => ({ hunk: h, replacement: h.mineLines })));
  }, [mineHunks, bulkApply, onAnnounce]);

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
}

function PaneSlot({ gridArea, visible, bg, header, containerRef }: PaneSlotProps): React.ReactElement {
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
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
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
