import { css as cssLang } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { highlightSelectionMatches } from '@codemirror/search';
import type { Extension } from '@codemirror/state';
import { Compartment, Facet } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
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
}

export default function CodeMirrorViewer({ value, language, onCursorChange, searchQuery }: CodeMirrorViewerProps) {
  const lang = langExtension(language);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const searchCompartment = useRef(new Compartment());
  const pendingSearchRef = useRef<string | null>(null);

  const handleUpdate = useCallback(
    (viewUpdate: {
      state: { selection: { main: { head: number } } };
      view: { state: { doc: { lineAt: (pos: number) => { number: number; from: number } } } };
    }) => {
      if (!onCursorChange) return;
      const pos = viewUpdate.state.selection.main.head;
      const line = viewUpdate.view.state.doc.lineAt(pos);
      onCursorChange(line.number, pos - line.from + 1);
    },
    [onCursorChange],
  );

  // Track the search query we need to scroll to.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value triggers re-scroll when document content changes after prettier formats
  useEffect(() => {
    if (searchQuery) pendingSearchRef.current = searchQuery;
  }, [searchQuery, value]);

  // After CodeMirror renders, check if we have a pending search to scroll to.
  // This runs on every CodeMirror update — including after value changes from
  // prettier. We check the actual document content so we only scroll once
  // the formatted text is committed.
  const handleEditorUpdate = useCallback(
    (viewUpdate: { state: { selection: { main: { head: number } } }; view: EditorView }) => {
      // Cursor tracking
      if (onCursorChange) {
        const pos = viewUpdate.state.selection.main.head;
        const line = viewUpdate.view.state.doc.lineAt(pos);
        onCursorChange(line.number, pos - line.from + 1);
      }

      // Pending search scroll
      const query = pendingSearchRef.current;
      if (!query) return;

      const view = viewUpdate.view;
      const text = view.state.doc.toString();
      const idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx < 0) return;

      // Only scroll if we're not already at the match
      const sel = view.state.selection.main;
      if (sel.from === idx && sel.to === idx + query.length) {
        pendingSearchRef.current = null;
        return;
      }

      pendingSearchRef.current = null;
      // Reconfigure facet + select + scroll in one transaction
      view.dispatch({
        effects: [
          searchCompartment.current.reconfigure(searchQueryFacet.of(query)),
          EditorView.scrollIntoView(idx, { y: 'center' }),
        ],
        selection: { anchor: idx, head: idx + query.length },
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
        basicSetup={{ lineNumbers: true, foldGutter: true }}
        onUpdate={handleEditorUpdate}
      />
    </div>
  );
}
