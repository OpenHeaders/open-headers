/**
 * Phase 2 — Column layout (3-pane theirs|result|mine) + 2-pane fallback
 * (theirs|result, where result seeds the editable side). Hunk
 * decorations on side panes; gutter accept-arrows splice content into
 * the result buffer as single-undo-unit edits.
 *
 * Diff axes are theirs↔result and mine↔result; both recompute on
 * every result-buffer change. Re-running the LCS keeps each pane's
 * decorations consistent with the user's current resolution state
 * without us having to track per-hunk drift through edits manually.
 *
 * Pane sizing uses Allotment — same primitive every other resizable
 * surface in this app uses (workbench shell, dock layout, import
 * preview). Phase 3's layout switcher swaps the Allotment vs CSS-grid
 * shape per layout but never recreates editor instances.
 */

import { Allotment } from 'allotment';
export type MergeLayout = 'column' | 'show-base-top';
import 'allotment/dist/style.css';
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
import { classifyConflicts } from '../diff/conflict-classify';
import { diffLines, type Hunk } from '../diff/line-diff';
import { useHunkAcceptArrows } from '../monaco/use-hunk-accept-arrows';
import { type HunkSide, useHunkDecorations } from '../monaco/use-hunk-decorations';
import { useMonacoEditorLifecycle } from '../monaco/use-monaco-editor-lifecycle';
import { useSyncScroll } from '../monaco/use-sync-scroll';
import type { MergeFile } from '../types';

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
   *  Default true (show every hunk). VS Code's "Show Non-Conflicting
   *  Changes" toggle is the inverse — `false` here matches `off` there. */
  showNonConflicting?: boolean;
  /** Layout shape. `'column'` (default) renders the 3-pane row only.
   *  `'show-base-top'` adds a full-width read-only base pane above
   *  the row; ignored when `file.base` is undefined. Mixed and Show
   *  Base Center per plan §1 are deferred to subsequent slices. */
  layout?: MergeLayout;
  /** Optional className for the outer container; consumers may set
   *  height / minHeight via CSS. */
  className?: string;
  /** Optional render slot for a per-pane header strip
   *  (label + future per-pane affordances). Receives the pane key. */
  renderHeader?: (pane: 'theirs' | 'result' | 'mine') => ReactNode;
  /** Caller wants user-action narration for an ARIA live region or
   *  for telemetry. Fires on every accept-arrow / bulk-apply call.
   *  Phrasing is stable; consumer renders it into a polite live region. */
  onAnnounce?: (message: string) => void;
}

export interface MergePaneHandle {
  /** Read the current editable buffer. Used by the modal at Apply
   *  time; resolves the §5 onApplyRequested contract synchronously
   *  for Phase 1 (no debounced re-observation yet). */
  getResultText(): string;
  /** Reveal the next remaining hunk after the result-buffer caret.
   *  Cycles through both sides in line order; wraps at the end. */
  gotoNextHunk(): void;
  /** Symmetric to `gotoNextHunk` for the previous hunk. */
  gotoPrevHunk(): void;
  /** Bulk-apply every non-conflicting hunk into the result buffer
   *  in a single undo unit. No-op when there are no non-conflicting
   *  hunks; conflicts are left untouched for manual resolution. */
  applyNonConflicting(): void;
  /** Bulk-apply every theirs-side hunk (including conflicts) into
   *  the result buffer for the active file. Single undo unit. */
  acceptAllTheirs(): void;
  /** Symmetric — bulk-apply every mine-side hunk. */
  acceptAllMine(): void;
}

const PANE_BG_LIGHT = '#ffffff';
const PANE_BG_DARK = '#1e1e1e';

const HEADER_HEIGHT = 28;
const HEADER_PAD = '4px 10px';
const PANE_MIN_PX = 200;

function paneShell(): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
  };
}

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
  const showBase = layout === 'show-base-top' && file.base !== undefined;

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

  // Base pane is created unconditionally so layout swaps don't recreate
  // editor instances (plan §13 acceptance: layout changes preserve
  // cursor/scroll/selection). When `file.base` is undefined the model
  // holds an empty string and the pane simply isn't rendered into the
  // grid; the lifecycle hook still owns its dispose path.
  const baseHandle = useMonacoEditorLifecycle({
    containerRef: baseContainerRef,
    value: file.base ?? '',
    language,
    readOnly: true,
  });

  // Track result text in state so diff recomputes on every edit.
  const [resultText, setResultText] = useState<string>(file.initialResult);

  // Wire result-buffer changes -> resultText state + outer onResultChange.
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

  // Re-seed resultText when the underlying file changes (file switch).
  useEffect(() => {
    setResultText(file.initialResult);
  }, [file.initialResult]);

  // Sync the global Monaco theme to dark/light. Theme is global per
  // Monaco instance; setting it on any one editor takes effect on all.
  useEffect(() => {
    monacoEditor.setTheme(isDarkMode ? 'oh-dark' : 'oh-light');
  }, [isDarkMode]);

  const syncTargets = useMemo(() => {
    const editors = has3Panes ? [theirsHandle, resultHandle, mineHandle] : [theirsHandle, resultHandle];
    if (showBase) editors.push(baseHandle);
    return editors;
  }, [has3Panes, showBase, theirsHandle, resultHandle, mineHandle, baseHandle]);
  useSyncScroll({ editors: syncTargets });

  // Two diffs against the live result buffer. Hunks point at theirs /
  // mine ranges respectively; the `mineRange` field is overloaded —
  // for the theirs↔result diff it's the result-side range, and same
  // for mine↔result. The accept handler keys off `side` to pick the
  // right source.
  const theirsHunks = useMemo(() => diffLines(file.theirs, resultText), [file.theirs, resultText]);
  const mineHunks = useMemo(() => diffLines(file.mine, resultText), [file.mine, resultText]);
  const classification = useMemo(() => classifyConflicts(theirsHunks, mineHunks), [theirsHunks, mineHunks]);

  // Filter when the toggle hides non-conflicting hunks. Identity is
  // preserved (filtered list is a subset; ids unchanged) so the
  // decoration / arrow hooks treat removed hunks as cleared.
  const visibleTheirs = useMemo(
    () => (showNonConflicting ? theirsHunks : theirsHunks.filter((h) => classification.theirsConflictIds.has(h.id))),
    [showNonConflicting, theirsHunks, classification],
  );
  const visibleMine = useMemo(
    () => (showNonConflicting ? mineHunks : mineHunks.filter((h) => classification.mineConflictIds.has(h.id))),
    [showNonConflicting, mineHunks, classification],
  );

  useHunkDecorations({ editorRef: theirsHandle, side: 'theirs', hunks: visibleTheirs });
  useHunkDecorations({ editorRef: mineHandle, side: 'mine', hunks: visibleMine });

  const handleAccept = useCallback(
    (hunkId: string, side: HunkSide) => {
      const hunks: readonly Hunk[] = side === 'theirs' ? theirsHunks : mineHunks;
      const hunk = hunks.find((h) => h.id === hunkId);
      if (!hunk) return;
      const editor = resultHandle.current.editor;
      const model = resultHandle.current.model;
      if (!editor || !model) return;

      // The "right side" of each diff IS the result buffer, so
      // `hunk.mineRange` is the splice target on the result. The
      // replacement text is the OPPOSITE side (theirsLines on a
      // theirs-accept, mineLines on a mine-accept).
      const targetRange = hunk.mineRange;
      const replacementLines = side === 'theirs' ? hunk.theirsLines : hunk.mineLines;
      const replacementText = replacementLines.join('\n') + (replacementLines.length > 0 ? '\n' : '');

      // Resolve the splice range to a Monaco Range. A zero-line range
      // (start === end) anchors at start-of-line for an insertion.
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
      // Single undo unit per spec §2.4 invariant 2.
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

  // Surface hunk stats to the consumer for header pills / counters.
  useEffect(() => {
    const conflicts = classification.theirsConflictIds.size + classification.mineConflictIds.size;
    const total = theirsHunks.length + mineHunks.length;
    onHunkStatsChange?.({
      theirsRemaining: theirsHunks.length,
      mineRemaining: mineHunks.length,
      totalRemaining: total,
      nonConflicting: total - conflicts,
      conflicts,
    });
  }, [theirsHunks, mineHunks, classification, onHunkStatsChange]);

  // Navigator state — current hunk-index across the union of theirs +
  // mine hunks ordered by their result-side start line. Tracked in a
  // ref so consumer-driven `gotoNext` / `gotoPrev` calls don't trigger
  // re-renders.
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
      // Reverse-sort by start line so each edit's range stays valid
      // after earlier-applied edits shift line numbers below them.
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
      // executeEdits coalesces multi-op calls into a single undo unit.
      editor.executeEdits('oh-merge-bulk', ops);
    },
    [resultHandle],
  );

  const applyNonConflicting = useCallback(() => {
    const picks: { hunk: Hunk; replacement: readonly string[] }[] = [];
    for (const h of theirsHunks) {
      if (!classification.theirsConflictIds.has(h.id)) picks.push({ hunk: h, replacement: h.theirsLines });
    }
    for (const h of mineHunks) {
      if (!classification.mineConflictIds.has(h.id)) picks.push({ hunk: h, replacement: h.mineLines });
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
    }),
    [resultHandle, revealHunkAt, applyNonConflicting, acceptAllTheirs, acceptAllMine],
  );

  const paneBg = isDarkMode ? PANE_BG_DARK : PANE_BG_LIGHT;

  return (
    <div
      className={className}
      data-merge-theme={isDarkMode ? 'dark' : 'light'}
      style={{ height: '100%', minHeight: 0, minWidth: 0 }}
    >
      {/* Vertical Allotment is always present so the base editor's
          DOM container has a stable parent across layout switches.
          Allotment toggles the base pane's visibility via the `visible`
          prop without remounting. Plan §13 acceptance: layout changes
          must NOT dispose+recreate editors. */}
      <Allotment vertical proportionalLayout defaultSizes={[1, 2]}>
        <Allotment.Pane minSize={120} visible={showBase} preferredSize="35%">
          <BasePaneShell containerRef={baseContainerRef} bg={paneBg} />
        </Allotment.Pane>
        <Allotment.Pane minSize={240}>
          <Allotment proportionalLayout defaultSizes={has3Panes ? [1, 1, 1] : [1, 1]}>
            <Allotment.Pane minSize={PANE_MIN_PX}>
              <Pane
                header={renderHeader ? renderHeader('theirs') : <DefaultHeader label="Incoming (theirs)" />}
                containerRef={theirsContainerRef}
                bg={paneBg}
              />
            </Allotment.Pane>
            <Allotment.Pane minSize={PANE_MIN_PX}>
              <Pane
                header={
                  renderHeader ? (
                    renderHeader('result')
                  ) : (
                    <DefaultHeader label={has3Panes ? 'Result' : 'Yours (mine, edit here)'} />
                  )
                }
                containerRef={resultContainerRef}
                bg={paneBg}
              />
            </Allotment.Pane>
            {has3Panes ? (
              <Allotment.Pane minSize={PANE_MIN_PX}>
                <Pane
                  header={renderHeader ? renderHeader('mine') : <DefaultHeader label="Current (mine)" />}
                  containerRef={mineContainerRef}
                  bg={paneBg}
                />
              </Allotment.Pane>
            ) : null}
          </Allotment>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
});

function BasePaneShell({
  containerRef,
  bg,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  bg: string;
}): React.ReactElement {
  return (
    <div style={{ ...paneShell(), background: bg }}>
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
        Base (common ancestor)
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </div>
  );
}

interface PaneProps {
  header: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  bg: string;
}

function Pane({ header, containerRef, bg }: PaneProps): React.ReactElement {
  return (
    <div style={{ ...paneShell(), background: bg }}>
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

export default MergePane;
export type { MergeFile } from '../types';
