/**
 * Maps `DiffViewerOptions` to Monaco's `IDiffEditorConstructionOptions`.
 * Kept separate from the React component so option-derivation is pure
 * and trivially testable.
 */

import type * as monaco from 'monaco-editor';
import type { DiffViewerOptions } from './types';

export function toMonacoDiffOptions(opts: DiffViewerOptions): monaco.editor.IDiffEditorConstructionOptions {
  return {
    readOnly: true,
    renderSideBySide: opts.mode === 'side-by-side',
    ignoreTrimWhitespace: opts.whitespace === 'ignore',
    // `legacy` is a Myers-style line diff that runs synchronously in
    // the main thread; on the small canonical-YAML blobs the import
    // preview compares (single entity at a time, typically <1 KB) it
    // completes within the same frame as the model update, so the
    // red/green decorations paint together with the content. The
    // default `advanced` algorithm is async — it ships through a
    // `IDocumentDiffProvider` worker — and creates a visible 100–200ms
    // gap between content paint and decoration paint. Quality
    // difference at this scale is imperceptible.
    diffAlgorithm: 'legacy',
    hideUnchangedRegions: { enabled: opts.collapseUnchanged, contextLineCount: 2 },
    renderWhitespace: opts.showWhitespaces ? 'all' : 'selection',
    lineNumbers: opts.showLineNumbers ? 'on' : 'off',
    guides: { indentation: opts.showIndentGuides },
    wordWrap: opts.softWrap ? 'on' : 'off',
    minimap: { enabled: false },
    folding: false,
    renderOverviewRuler: false,
    renderLineHighlight: 'none',
    // Without this, Monaco reserves a full viewport of empty space
    // past the last line so users can scroll the cursor up — useful
    // in an IDE, pure noise in a read-only diff (shows up as a
    // phantom scrollbar with nothing below the content).
    scrollBeyondLastLine: false,
    scrollbar: { useShadows: false, verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    // Monaco's default `renderSideBySideInlineBreakpoint` is 900 — at
    // narrower widths it auto-flips to inline even when the user
    // explicitly chose side-by-side. Push the breakpoint down so the
    // user's choice sticks unless the pane is genuinely cramped.
    renderSideBySideInlineBreakpoint: 480,
  };
}
