/**
 * Monaco-backed read-only body viewer for the DevTools panel.
 *
 * Features:
 *   • Line numbers + fold gutter via Monaco defaults.
 *   • Cursor-position reporting via `onCursorChange`.
 *   • Search highlighting: `searchQuery` is applied as a decoration
 *     across every match; `searchMatchIndex` selects which match the
 *     viewport scrolls to so clicking match #1 then #5 in the same
 *     body re-scrolls.
 */

import { useTheme } from '@context';
import Editor from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';
// Side-effect import: kicks Monaco's bootstrap at module load.
import '@openheaders/ui/workbench/components/monaco/bootstrap';

interface CodeViewerProps {
  value: string;
  language: 'json' | 'css' | 'javascript' | 'html';
  onCursorChange?: (line: number, col: number) => void;
  searchQuery?: string;
  /**
   * N-th occurrence of `searchQuery` to scroll to (0-based). Updating
   * this while the query is stable re-runs scroll — that's what lets
   * the user click match #1 then match #5 in the same body.
   */
  searchMatchIndex?: number;
}

export default function CodeViewer({
  value,
  language,
  onCursorChange,
  searchQuery,
  searchMatchIndex,
}: CodeViewerProps) {
  const { monacoTheme } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  // Apply search-match decorations + scroll to the active match whenever
  // the query, match index, or value changes. `value` is in the dep list
  // so the effect re-runs after Prettier rewrites the content — otherwise
  // match positions would be stale relative to the formatted doc.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value drives re-decoration after pretty-print
  useEffect(() => {
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
    editor.revealRangeInCenter(activeMatch.range);
    editor.setSelection(activeMatch.range);
  }, [searchQuery, searchMatchIndex, value]);

  return (
    <div className="dt-codemirror-wrap">
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        theme={monacoTheme}
        value={value}
        onMount={(ed, m) => {
          editorRef.current = ed;
          monacoRef.current = m as unknown as typeof monaco;
          if (onCursorChange) {
            ed.onDidChangeCursorPosition((e) => {
              onCursorChange(e.position.lineNumber, e.position.column);
            });
            const pos = ed.getPosition();
            if (pos) onCursorChange(pos.lineNumber, pos.column);
          }
        }}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          lineNumbers: 'on',
          folding: true,
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: 'none',
        }}
      />
    </div>
  );
}
