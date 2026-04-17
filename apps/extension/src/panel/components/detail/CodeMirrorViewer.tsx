import { css as cssLang } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { highlightSelectionMatches } from '@codemirror/search';
import type { Extension } from '@codemirror/state';
import { Compartment, Facet } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { useTheme } from '@context';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef } from 'react';

function langExtension(language: string): Extension | null {
  switch (language) {
    case 'json':
      return json();
    case 'css':
      return cssLang();
    case 'javascript':
    case 'html':
      return javascript({ jsx: false });
    default:
      return null;
  }
}

// ── Search highlight decorations ─────────────────────────────────────

const searchQueryFacet = Facet.define<string, string>({ combine: (values) => values[0] ?? '' });

const searchHighlightMark = Decoration.mark({ class: 'cm-searchMatch' });
const searchHighlightActiveMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-active' });

function findVisibleMatches(
  text: string,
  query: string,
  from: number,
  to: number,
): Array<{ from: number; to: number }> {
  if (!query) return [];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const matches: Array<{ from: number; to: number }> = [];
  const padFrom = Math.max(0, from - 1000);
  const padTo = Math.min(text.length, to + 1000);
  let pos = padFrom;
  while (pos <= padTo - qLower.length) {
    const idx = lower.indexOf(qLower, pos);
    if (idx === -1 || idx + qLower.length > padTo) break;
    matches.push({ from: idx, to: idx + qLower.length });
    pos = idx + 1;
  }
  return matches;
}

const searchHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.startState.facet(searchQueryFacet) !== update.state.facet(searchQueryFacet) ||
        !update.startState.selection.main.eq(update.state.selection.main)
      ) {
        this.decorations = this.build(update.view);
      }
    }
    build(view: EditorView): DecorationSet {
      const query = view.state.facet(searchQueryFacet);
      if (!query) return Decoration.none;
      const text = view.state.doc.toString();
      const { from, to } = view.viewport;
      const matches = findVisibleMatches(text, query, from, to);
      if (matches.length === 0) return Decoration.none;
      const sel = view.state.selection.main;
      return Decoration.set(
        matches.map((m) => {
          const isActive = m.from === sel.from && m.to === sel.to;
          return (isActive ? searchHighlightActiveMark : searchHighlightMark).range(m.from, m.to);
        }),
      );
    }
  },
  { decorations: (v) => v.decorations },
);

// ── Component ────────────────────────────────────────────────────────

interface CodeMirrorViewerProps {
  value: string;
  language: 'json' | 'css' | 'javascript' | 'html';
  onCursorChange?: (line: number, col: number) => void;
  searchQuery?: string;
  /** N-th occurrence of `searchQuery` to scroll to (0-based). When
   *  omitted/undefined we fall back to the first match. Updating this
   *  while the query is stable re-runs scroll — that's what lets the
   *  user click match #1 then match #5 in the same body and have the
   *  viewport jump to each in turn. */
  searchMatchIndex?: number;
}

interface PendingScroll {
  query: string;
  matchIndex: number;
}

export default function CodeMirrorViewer({
  value,
  language,
  onCursorChange,
  searchQuery,
  searchMatchIndex,
}: CodeMirrorViewerProps) {
  const lang = langExtension(language);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const searchCompartment = useRef(new Compartment());
  const pendingSearchRef = useRef<PendingScroll | null>(null);
  const { isDarkMode } = useTheme();

  // Queue a scroll whenever the target changes. `searchMatchIndex` is
  // part of the trigger so clicking match #1 then match #5 in the same
  // body (same query) re-queues a scroll for the new match.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value triggers re-scroll when document content changes after prettier formats
  useEffect(() => {
    if (searchQuery) pendingSearchRef.current = { query: searchQuery, matchIndex: searchMatchIndex ?? 0 };
  }, [searchQuery, searchMatchIndex, value]);

  // After CodeMirror renders, check if we have a pending search to scroll to.
  // This runs on every CodeMirror update — including after value changes from
  // prettier. We walk the doc for the N-th occurrence of the query so
  // clicking different matches in the same body scrolls to each in turn.
  const handleEditorUpdate = useCallback(
    (viewUpdate: { state: { selection: { main: { head: number } } }; view: EditorView }) => {
      // Cursor tracking
      if (onCursorChange) {
        const pos = viewUpdate.state.selection.main.head;
        const line = viewUpdate.view.state.doc.lineAt(pos);
        onCursorChange(line.number, pos - line.from + 1);
      }

      const pending = pendingSearchRef.current;
      if (!pending) return;

      const view = viewUpdate.view;
      const text = view.state.doc.toString();
      const lower = text.toLowerCase();
      const qLower = pending.query.toLowerCase();

      // Walk to the N-th occurrence. If the document has fewer matches
      // than requested (e.g. pretty-print removed whitespace that
      // contained the query — rare), fall back to the last match so
      // the click still does something useful.
      let idx = -1;
      let cursor = 0;
      for (let i = 0; i <= pending.matchIndex; i++) {
        const next = lower.indexOf(qLower, cursor);
        if (next === -1) break;
        idx = next;
        cursor = next + qLower.length;
      }
      if (idx < 0) return;

      // Skip if we're already parked on this exact match.
      const sel = view.state.selection.main;
      if (sel.from === idx && sel.to === idx + pending.query.length) {
        pendingSearchRef.current = null;
        return;
      }

      pendingSearchRef.current = null;
      view.dispatch({
        effects: [
          searchCompartment.current.reconfigure(searchQueryFacet.of(pending.query)),
          EditorView.scrollIntoView(idx, { y: 'center' }),
        ],
        selection: { anchor: idx, head: idx + pending.query.length },
      });
    },
    [onCursorChange],
  );

  const extensions: Extension[] = useMemo(() => {
    const exts: Extension[] = [
      EditorView.lineWrapping,
      searchCompartment.current.of(searchQueryFacet.of(searchQuery ?? '')),
      searchHighlightPlugin,
      highlightSelectionMatches(),
    ];
    if (lang) exts.push(lang);
    return exts;
  }, [lang, searchQuery]);

  return (
    <div className="dt-codemirror-wrap">
      <CodeMirror
        ref={editorRef}
        value={value}
        extensions={extensions}
        readOnly
        theme={isDarkMode ? 'dark' : 'light'}
        basicSetup={{ lineNumbers: true, foldGutter: true }}
        onUpdate={handleEditorUpdate}
      />
    </div>
  );
}
