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
import { diffLines, type Hunk } from '../diff/line-diff';
import { useHunkAcceptArrows } from '../monaco/use-hunk-accept-arrows';
import { type HunkSide, useHunkDecorations } from '../monaco/use-hunk-decorations';
import { useMonacoEditorLifecycle } from '../monaco/use-monaco-editor-lifecycle';
import { useSyncScroll } from '../monaco/use-sync-scroll';
import type { MergeFile } from '../types';

export interface MergePaneProps {
  file: MergeFile;
  /** True for dark Monaco theme. The shell decides; the editor reflects. */
  isDarkMode?: boolean;
  /** Caller wants to know when the editable result text changes. */
  onResultChange?: (text: string) => void;
  /** Optional className for the outer container; consumers may set
   *  height / minHeight via CSS. */
  className?: string;
  /** Optional render slot for a per-pane header strip
   *  (label + future per-pane affordances). Receives the pane key. */
  renderHeader?: (pane: 'theirs' | 'result' | 'mine') => ReactNode;
}

export interface MergePaneHandle {
  /** Read the current editable buffer. Used by the modal at Apply
   *  time; resolves the §5 onApplyRequested contract synchronously
   *  for Phase 1 (no debounced re-observation yet). */
  getResultText(): string;
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
  const { file, isDarkMode, onResultChange, className, renderHeader } = props;
  const language = file.language ?? 'yaml';

  const theirsContainerRef = useRef<HTMLDivElement | null>(null);
  const resultContainerRef = useRef<HTMLDivElement | null>(null);
  const mineContainerRef = useRef<HTMLDivElement | null>(null);

  const has3Panes = file.base !== undefined;

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

  const syncTargets = useMemo(
    () => (has3Panes ? [theirsHandle, resultHandle, mineHandle] : [theirsHandle, resultHandle]),
    [has3Panes, theirsHandle, resultHandle, mineHandle],
  );
  useSyncScroll({ editors: syncTargets });

  // Two diffs against the live result buffer. Hunks point at theirs /
  // mine ranges respectively; the `mineRange` field is overloaded —
  // for the theirs↔result diff it's the result-side range, and same
  // for mine↔result. The accept handler keys off `side` to pick the
  // right source.
  const theirsHunks = useMemo(() => diffLines(file.theirs, resultText), [file.theirs, resultText]);
  const mineHunks = useMemo(() => diffLines(file.mine, resultText), [file.mine, resultText]);

  useHunkDecorations({ editorRef: theirsHandle, side: 'theirs', hunks: theirsHunks });
  useHunkDecorations({ editorRef: mineHandle, side: 'mine', hunks: mineHunks });

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
    },
    [theirsHunks, mineHunks, resultHandle],
  );

  useHunkAcceptArrows({ editorRef: theirsHandle, side: 'theirs', hunks: theirsHunks, onAccept: handleAccept });
  useHunkAcceptArrows({ editorRef: mineHandle, side: 'mine', hunks: mineHunks, onAccept: handleAccept });

  useImperativeHandle(
    ref,
    () => ({
      getResultText: () => resultHandle.current.model?.getValue() ?? '',
    }),
    [resultHandle],
  );

  const paneBg = isDarkMode ? PANE_BG_DARK : PANE_BG_LIGHT;

  return (
    <div
      className={className}
      data-merge-theme={isDarkMode ? 'dark' : 'light'}
      style={{ height: '100%', minHeight: 0, minWidth: 0 }}
    >
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
    </div>
  );
});

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
