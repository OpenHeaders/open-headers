/**
 * "Missing here" markers via Monaco view zones.
 *
 * Pure-addition hunks (mine added a line, theirs empty) render only
 * on the mine side. The theirs side currently shows nothing —
 * confusing. Symmetric for removals. This hook inserts a thin
 * dashed view-zone bar at the equivalent line position on the empty
 * side so the user sees "content is missing here."
 *
 * View zones are Monaco's primitive for inserting non-text vertical
 * space; `changeViewZones` is atomic and the accessor returns ids we
 * track for removal. No model edits — purely visual.
 */

import { type RefObject, useEffect } from 'react';
import type { Hunk } from '../diff/line-diff';
import type { HunkSide } from './use-hunk-decorations';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export interface UseMissingMarkersArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  /** Side this gutter belongs to. The marker fires only when the
   *  hunk's range on THIS side is zero-length (i.e. the side that
   *  has no content). */
  side: HunkSide;
  hunks: readonly Hunk[];
}

export function useMissingMarkers({ editorRef, side, hunks }: UseMissingMarkersArgs): void {
  useEffect(() => {
    const editor = editorRef.current.editor;
    if (!editor) return;
    const zoneIds: string[] = [];

    editor.changeViewZones((accessor) => {
      for (const h of hunks) {
        const range = side === 'theirs' ? h.theirsRange : h.mineRange;
        // Only mark when this side has NO content for the hunk
        // (zero-length range — pure addition on theirs / pure removal
        // on mine, given how the diff axis is laid out per side).
        if (range.endLine > range.startLine) continue;
        const dom = document.createElement('div');
        dom.className = 'oh-merge__missing-marker';
        const id = accessor.addZone({
          // `afterLineNumber: 0` is valid — places the zone above
          // line 1 (when the missing content would have been the
          // very first line).
          afterLineNumber: Math.max(0, range.startLine - 1),
          heightInPx: 2,
          domNode: dom,
        });
        zoneIds.push(id);
      }
    });

    return () => {
      const e = editorRef.current.editor;
      if (!e) return;
      e.changeViewZones((accessor) => {
        for (const id of zoneIds) accessor.removeZone(id);
      });
    };
  }, [editorRef, side, hunks]);
}
