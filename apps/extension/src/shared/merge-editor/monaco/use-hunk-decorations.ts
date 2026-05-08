/**
 * Push line-background decorations for a list of hunks onto a Monaco
 * editor (read-only side panes — theirs / mine). Decorations are
 * scoped per-side: theirs-side decorations use the hunk's
 * `theirsRange`, mine-side decorations use the hunk's `mineRange`.
 * Classifications map to CSS classes whose palette lives in
 * `hunk-decorations.css`.
 *
 * The hook returns nothing; on each `hunks` change it replaces the
 * editor's decoration collection (Monaco diffs the collection in
 * place — only the deltas hit the renderer). On unmount or hunk-list
 * shrink, the collection is cleared via `set([])` so stale decorations
 * never leak across model swaps.
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect } from 'react';
import type { Hunk } from '../diff/line-diff';
import './hunk-decorations.css';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export type HunkSide = 'theirs' | 'mine';

const CSS_CLASS_BY_KIND = {
  addition: 'oh-merge__hunk-addition',
  removal: 'oh-merge__hunk-removal',
  modification: 'oh-merge__hunk-modification',
} as const;

export interface UseHunkDecorationsArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  side: HunkSide;
  hunks: readonly Hunk[];
}

export function useHunkDecorations({ editorRef, side, hunks }: UseHunkDecorationsArgs): void {
  useEffect(() => {
    const editor = editorRef.current.editor;
    const model = editorRef.current.model;
    if (!editor || !model) return;

    const decos: monaco.editor.IModelDeltaDecoration[] = [];
    for (const h of hunks) {
      const range = side === 'theirs' ? h.theirsRange : h.mineRange;
      // Skip zero-line ranges — Monaco line decorations need at least
      // one line; pure-additions on the theirs side and pure-removals
      // on the mine side fall here. The OPPOSITE side renders the
      // hunk visibly; this side is implicitly "missing here."
      if (range.endLine <= range.startLine) continue;
      const className = CSS_CLASS_BY_KIND[h.classification];
      decos.push({
        range: {
          startLineNumber: range.startLine,
          startColumn: 1,
          endLineNumber: range.endLine - 1,
          endColumn: model.getLineMaxColumn(Math.min(range.endLine - 1, model.getLineCount())),
        },
        options: {
          isWholeLine: true,
          className,
          stickiness: 1, // monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        },
      });
    }

    const collection = editor.createDecorationsCollection(decos);
    return () => {
      collection.clear();
    };
  }, [editorRef, side, hunks]);
}
