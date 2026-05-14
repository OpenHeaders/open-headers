/**
 * Inline character-level diff decorations inside modification hunks.
 *
 * For each `modification` hunk on the active side, pair theirs/mine
 * lines by index and run `diffChars` on each pair. The resulting
 * character spans become Monaco inline decorations on top of the
 * line-background tint that `useHunkDecorations` already paints.
 *
 * Pairing rule: lines paired by 0-based index within the hunk.
 * When line counts differ, we pair only the overlap. The unpaired
 * lines keep the whole-line tint without char-level highlight —
 * good-enough fallback (those lines are pure additions/removals
 * inside the modification block).
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect } from 'react';
import { diffWords } from '../diff/char-diff';
import type { Hunk } from '../diff/line-diff';
import { pairLines } from '../diff/pair-lines';
import type { HunkSide } from './use-hunk-decorations';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

const CSS_CLASS = 'oh-merge__char-diff';

export interface UseCharDecorationsArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  side: HunkSide;
  hunks: readonly Hunk[];
}

export function useCharDecorations({ editorRef, side, hunks }: UseCharDecorationsArgs): void {
  useEffect(() => {
    const editor = editorRef.current.editor;
    if (!editor) return;

    const decos: monaco.editor.IModelDeltaDecoration[] = [];

    for (const h of hunks) {
      if (h.classification !== 'modification') continue;
      const range = side === 'theirs' ? h.theirsRange : h.mineRange;
      if (range.endLine <= range.startLine) continue;
      const ownLines = side === 'theirs' ? h.theirsLines : h.mineLines;
      const otherLines = side === 'theirs' ? h.mineLines : h.theirsLines;
      // LCS-pair lines so shifted-content hunks (e.g. theirs=[B,A,C]
      // vs mine=[X,B,Y]) align on the matching B instead of mis-pairing
      // by index. Exact-match pairs need no char-diff (identical
      // strings produce no spans anyway, but we skip the call).
      // `pairLines` is symmetric — pass the side's own array first
      // so `aIdx` belongs to this side.
      const pairs = side === 'theirs' ? pairLines(ownLines, otherLines) : pairLines(otherLines, ownLines);
      for (const pair of pairs) {
        if (pair.exactMatch) continue;
        const ownIdx = side === 'theirs' ? pair.aIdx : pair.bIdx;
        const otherIdx = side === 'theirs' ? pair.bIdx : pair.aIdx;
        const own = ownLines[ownIdx];
        const other = otherLines[otherIdx];
        const result = diffWords(own, other);
        const spans = side === 'theirs' ? result.aSpans : result.bSpans;
        const lineNumber = range.startLine + ownIdx;
        for (const s of spans) {
          decos.push({
            range: {
              startLineNumber: lineNumber,
              startColumn: s.start + 1,
              endLineNumber: lineNumber,
              endColumn: s.end + 1,
            },
            options: {
              inlineClassName: CSS_CLASS,
              stickiness: 1,
            },
          });
        }
      }
    }

    const collection = editor.createDecorationsCollection(decos);
    return () => {
      collection.clear();
    };
  }, [editorRef, side, hunks]);
}
