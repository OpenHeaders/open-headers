/**
 * Monaco-backed body viewer for the DevTools panel — read-only by
 * default; a caller that passes `readOnly={false}` + `onChange` gets an
 * editable buffer (the IndexedDB record editor's write path).
 *
 * Features:
 *   • Line numbers + fold gutter via Monaco defaults.
 *   • Cursor-position reporting via `onCursorChange`.
 *   • Search highlighting: `searchQuery` is applied as a decoration
 *     across every match; `searchMatchIndex` selects which match the
 *     viewport scrolls to so clicking match #1 then #5 in the same
 *     body re-scrolls.
 *   • Detected-JWT underlines whose hover opens the shared JWT modal —
 *     a viewer on read-only buffers, an editor writing back into the
 *     buffer on editable ones.
 *   • Whole-buffer decode chip when the entire buffer is one detected
 *     encoded value — same viewer/editor split via the shared
 *     encoded-value modal.
 */

import Editor from '@monaco-editor/react';
import { useTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useMonacoJwtEdit } from '@openheaders/ui/workbench/components/value-editors/useMonacoJwtEdit';
import { useWholeBufferDecode } from '@openheaders/ui/workbench/components/value-editors/useWholeBufferDecode';
import type * as monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
// Side-effect import: kicks Monaco's bootstrap at module load.
import '@openheaders/ui/workbench/components/monaco/bootstrap';

const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const FIND_CHORD = IS_MAC ? '⌘F' : 'Ctrl+F';

interface CodeViewerProps {
  value: string;
  language: 'json' | 'css' | 'javascript' | 'html' | 'plaintext';
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  searchQuery?: string;
  /**
   * N-th occurrence of `searchQuery` to scroll to (0-based). Updating
   * this while the query is stable re-runs scroll — that's what lets
   * the user click match #1 then match #5 in the same body.
   */
  searchMatchIndex?: number;
  /** Detected-JWT affordance (underline + hover link opening the JWT
   *  modal). Viewer on read-only buffers, editor with buffer write-back
   *  on editable ones. Consumers whose value semantics own JWT handling
   *  themselves opt out. */
  jwtDetection?: boolean;
  /** Whole-buffer decode affordance (corner "Decode" chip opening the
   *  encoded-value modal when the entire buffer is one detected value).
   *  Same read-only/editable split as the JWT plane. Consumers that ARE
   *  the decoded document of a detected value opt out. */
  decodeAffordance?: boolean;
}

export default function CodeViewer({
  value,
  language,
  readOnly = true,
  onChange,
  onCursorChange,
  searchQuery,
  searchMatchIndex,
  jwtDetection = true,
  decodeAffordance = true,
}: CodeViewerProps) {
  const t = useT();
  const { monacoTheme } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const revealRafRef = useRef<number | null>(null);
  // Monaco mounts asynchronously (lazy chunk + loader) — flipped by
  // onMount so the decoration effect below re-runs once the editor
  // exists; on a fresh open its first run precedes the mount and
  // would otherwise silently drop the search highlight.
  const [editorReady, setEditorReady] = useState(false);
  const { attachJwtDetection, jwtModal } = useMonacoJwtEdit({ readOnly });

  // Whole-buffer write-back rides the editor's edit stack (undoable,
  // and Monaco's own change event carries it up through `onChange`).
  const applyWholeBuffer = useCallback((encoded: string) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;
    editor.executeEdits('oh-decode-edit', [{ range: model.getFullModelRange(), text: encoded }]);
  }, []);
  const { decodeChip, decodeModal } = useWholeBufferDecode({
    value,
    readOnly,
    enabled: decodeAffordance,
    onApply: !readOnly && onChange ? applyWholeBuffer : undefined,
  });

  // Apply search-match decorations + scroll to the active match whenever
  // the query, match index, or value changes. `value` is in the dep list
  // so the effect re-runs after Prettier rewrites the content — otherwise
  // match positions would be stale relative to the formatted doc.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value drives re-decoration after pretty-print
  useEffect(() => {
    if (!editorReady) return;
    const editor = editorRef.current;
    const m = monacoRef.current;
    if (!editor || !m) return;
    const model = editor.getModel();
    if (!model) return;

    if (!searchQuery) {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const matches = model.findMatches(
      searchQuery,
      /* searchOnlyEditableRange */ false,
      /* isRegex */ false,
      /* matchCase */ false,
      /* wordSeparators */ null,
      /* captureMatches */ false,
    );
    if (matches.length === 0) {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const activeIdx = Math.max(0, Math.min(searchMatchIndex ?? 0, matches.length - 1));
    const decorations: monaco.editor.IModelDeltaDecoration[] = matches.map((match, idx) => ({
      range: match.range,
      options: {
        inlineClassName: idx === activeIdx ? 'dt-monaco-search-active' : 'dt-monaco-search',
      },
    }));
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decorations);

    const activeMatch = matches[activeIdx];
    editor.setSelection(activeMatch.range);

    // Center the active match and hold it centered per frame for a
    // bounded window: a one-shot reveal races post-mount layout settle
    // (word-wrap re-measure of large bodies shifts line positions over
    // several frames), leaving the line parked at the viewport top
    // behind Monaco's sticky-scroll rows. Each tick re-centers
    // immediately (no smooth animation to interrupt), but only when the
    // line has drifted out of the middle band — a doc too short to
    // center just no-ops until the deadline.
    if (revealRafRef.current !== null) cancelAnimationFrame(revealRafRef.current);
    const deadline = performance.now() + 2000;
    const tick = (): void => {
      revealRafRef.current = null;
      const ed = editorRef.current;
      const mn = monacoRef.current;
      if (!ed || !mn || ed.getModel() !== model) return;
      const height = ed.getLayoutInfo().height;
      const top = ed.getTopForLineNumber(activeMatch.range.startLineNumber) - ed.getScrollTop();
      if (height === 0 || top < height * 0.2 || top > height * 0.8) {
        ed.revealRangeInCenter(activeMatch.range, mn.editor.ScrollType.Immediate);
      }
      if (performance.now() > deadline) return;
      revealRafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (revealRafRef.current !== null) {
        cancelAnimationFrame(revealRafRef.current);
        revealRafRef.current = null;
      }
    };
  }, [searchQuery, searchMatchIndex, value, editorReady]);

  return (
    <div className="dt-codemirror-wrap">
      {decodeChip}
      <button
        type="button"
        className="dt-codeviewer-find"
        title={t('panel.inspector.viewer.findTitle', { chord: FIND_CHORD })}
        aria-label={t('panel.inspector.viewer.find')}
        onClick={() => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();
          void editor.getAction('actions.find')?.run();
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16" y2="16" />
        </svg>
      </button>
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        theme={monacoTheme}
        value={value}
        onChange={onChange ? (next) => onChange(next ?? '') : undefined}
        onMount={(ed, m) => {
          editorRef.current = ed;
          monacoRef.current = m as unknown as typeof monaco;
          setEditorReady(true);
          if (jwtDetection) attachJwtDetection(ed, m as unknown as typeof monaco);
          if (onCursorChange) {
            ed.onDidChangeCursorPosition((e) => {
              onCursorChange(e.position.lineNumber, e.position.column);
            });
            const pos = ed.getPosition();
            if (pos) onCursorChange(pos.lineNumber, pos.column);
          }
        }}
        options={{
          readOnly,
          minimap: { enabled: false },
          lineNumbers: 'on',
          folding: true,
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: 'none',
          // Below-the-cursor placement avoids the flicker that happens
          // when Monaco's content hover collides with the find widget
          // (or the top of the viewport) and re-flips each frame.
          hover: { above: false },
          // Removes the empty extra-line gap Monaco reserves above line
          // 1 to host the find widget. Find still slides in over the
          // first line; the gap was a clipped-strip artifact above the
          // find toolbar on narrow viewports.
          find: { addExtraSpaceOnTop: false },
        }}
      />
      {jwtModal}
      {decodeModal}
    </div>
  );
}
