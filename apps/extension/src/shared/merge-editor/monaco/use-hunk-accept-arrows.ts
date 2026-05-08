/**
 * Gutter accept-arrow widgets for a side pane.
 *
 * Renders one glyph-margin decoration per hunk on the pane's own
 * side; click → `onAccept(hunkId)`. Identity for the click resolution
 * comes from a `Map<lineNumber, hunkId>` rebuilt with the
 * decoration set, so identity stays consistent with what's painted.
 *
 * Uses `editor.onMouseDown` against the glyph margin, which is the
 * standard Monaco entry point for gutter affordances and survives
 * model swaps cleanly.
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect } from 'react';
import type { Hunk } from '../diff/line-diff';
import type { HunkSide } from './use-hunk-decorations';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export interface UseHunkAcceptArrowsArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  /** Which side this gutter belongs to. Drives the glyph direction
   *  CSS class (▶ on theirs / ◀ on mine) and which range is used to
   *  place the glyph. */
  side: HunkSide;
  hunks: readonly Hunk[];
  /** User clicked the accept-this-hunk arrow for `hunkId` from `side`.
   *  The MergePane translates this into a single-undo-unit splice
   *  on the result buffer. */
  onAccept(hunkId: string, side: HunkSide): void;
}

export function useHunkAcceptArrows({ editorRef, side, hunks, onAccept }: UseHunkAcceptArrowsArgs): void {
  useEffect(() => {
    const editor = editorRef.current.editor;
    const model = editorRef.current.model;
    if (!editor || !model) return;

    const lineToHunk = new Map<number, string>();
    const decos: monaco.editor.IModelDeltaDecoration[] = [];
    for (const h of hunks) {
      const range = side === 'theirs' ? h.theirsRange : h.mineRange;
      // No glyph on the empty side of a pure-addition (theirs-empty)
      // or pure-removal (mine-empty) — there's no line to anchor on.
      // The "accept" affordance for those still surfaces from the
      // OPPOSITE side's gutter (the side that has content).
      if (range.endLine <= range.startLine) continue;
      const startLine = range.startLine;
      lineToHunk.set(startLine, h.id);
      decos.push({
        range: {
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: startLine,
          endColumn: 1,
        },
        options: {
          glyphMarginClassName: `oh-merge__hunk-accept oh-merge__hunk-accept-${side}`,
          glyphMarginHoverMessage: {
            value: side === 'theirs' ? 'Accept this hunk from incoming →' : '← Accept this hunk from current',
          },
          stickiness: 1,
        },
      });
    }
    const collection = editor.createDecorationsCollection(decos);

    const sub = editor.onMouseDown((e) => {
      // 2 === editor.MouseTargetType.GUTTER_GLYPH_MARGIN
      if (e.target.type !== 2) return;
      const line = e.target.position?.lineNumber;
      if (line === undefined) return;
      const hunkId = lineToHunk.get(line);
      if (!hunkId) return;
      e.event.preventDefault();
      e.event.stopPropagation();
      onAccept(hunkId, side);
    });

    return () => {
      sub.dispose();
      collection.clear();
    };
  }, [editorRef, side, hunks, onAccept]);
}
