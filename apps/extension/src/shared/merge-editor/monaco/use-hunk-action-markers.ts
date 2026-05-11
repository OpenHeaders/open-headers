/**
 * Per-hunk pixel-y positions for the result-pane action gutters.
 *
 * The flanking action gutters (`<HunkActionGutter>`) render React
 * buttons absolutely-positioned at the vertical CENTER of each hunk's
 * bordered rectangle. The marker's `top` is the Y coordinate of that
 * center; the gutter row applies a `translateY(-50%)` so its visual
 * center lands there exactly.
 *
 * The rectangle's vertical extent includes the status zone above
 * (always 1 line tall) plus either the content rows in the result OR
 * the missing-side placeholder view zone (rendered for pre-acceptance
 * pure additions, where result has no model lines for the hunk).
 *
 * Markers update on:
 *   - hunks change (diff recompute)
 *   - editor scroll
 *   - editor model content change (line wrap / size shift)
 *   - editor layout / configuration change (font, line height)
 */

import * as monaco from 'monaco-editor';
import { type RefObject, useEffect, useState } from 'react';
import type { Hunk } from '../diff/line-diff';
import type { HunkTrackedRangesHandle } from './use-hunk-tracked-ranges';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export interface HunkActionMarker {
  hunkId: string;
  /** Pixel Y of the rectangle's CENTER, in editor-viewport coordinates
   *  (already adjusted for scroll). The gutter row uses
   *  `transform: translateY(-50%)` so its visual midpoint lands here. */
  top: number;
}

export interface UseHunkActionMarkersArgs {
  resultRef: RefObject<MonacoEditorHandle>;
  trackedRangesRef: RefObject<HunkTrackedRangesHandle>;
  hunks: readonly Hunk[];
}

export function useHunkActionMarkers(args: UseHunkActionMarkersArgs): readonly HunkActionMarker[] {
  const [markers, setMarkers] = useState<readonly HunkActionMarker[]>([]);

  useEffect(() => {
    const editor = args.resultRef.current.editor;
    if (!editor) return;

    let raf = 0;
    const compute = (): void => {
      const tracked = args.trackedRangesRef.current;
      const next: HunkActionMarker[] = [];
      const scrollTop = editor.getScrollTop();
      const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
      for (const h of args.hunks) {
        const live = tracked.liveRangeOf(h.id);
        const startLine = live ? live.startLineNumber : h.mineRange.startLine;
        const endLineInclusive = live ? live.endLineNumber : h.mineRange.endLine - 1;
        // Insertion-point encoding (matches `useHunkTrackedRanges` +
        // `useResultStatusZones`): zero-extent range at same line +
        // collapsed columns means the hunk has no model lines in
        // result yet (pre-acceptance pure addition).
        const isInsertionPoint =
          live !== null &&
          live.startLineNumber === live.endLineNumber &&
          live.startColumn === 1 &&
          live.endColumn === 1;
        const contentLineCount =
          isInsertionPoint || endLineInclusive < startLine ? 0 : endLineInclusive - startLine + 1;
        // Rectangle height = status zone (always 1 line above startLine)
        // + content rows OR the missing-side body view zone when the
        // result has no content rows for the hunk.
        const otherLineCount = Math.max(h.theirsLines.length, h.mineLines.length);
        const missingBodyHeight = contentLineCount === 0 ? otherLineCount * lineHeight : 0;
        const statusZoneHeight = lineHeight;
        // `getTopForLineNumber(startLine)` returns the Y of the line
        // AFTER any view zones above it — so for pre-acceptance pure
        // additions, that's below the status zone + missing-side body.
        const topAtStartLine = editor.getTopForLineNumber(startLine);
        const rectangleTop = topAtStartLine - statusZoneHeight - missingBodyHeight;
        const rectangleHeight = statusZoneHeight + contentLineCount * lineHeight + missingBodyHeight;
        const centerY = rectangleTop + rectangleHeight / 2;
        next.push({ hunkId: h.id, top: centerY - scrollTop });
      }
      setMarkers(next);
    };

    const schedule = (): void => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };

    // Initial paint.
    compute();

    const subs = [
      editor.onDidScrollChange(schedule),
      editor.onDidContentSizeChange(schedule),
      editor.onDidChangeModelContent(schedule),
      editor.onDidLayoutChange(schedule),
      editor.onDidChangeConfiguration(schedule),
    ];

    return () => {
      if (raf) cancelAnimationFrame(raf);
      for (const s of subs) s.dispose();
    };
  }, [args.hunks, args.resultRef, args.trackedRangesRef]);

  return markers;
}
