/**
 * Per-hunk pixel-y positions for the result-pane action gutters.
 *
 * The flanking action gutters (`<HunkActionGutter>`) render React
 * buttons absolutely-positioned at each hunk's start line. To match
 * the editor's scroll position + line height, this hook subscribes to
 * the result editor's scroll + layout events and exposes a `markers`
 * snapshot — `Array<{hunkId, top}>` in result-pane Y-pixel coordinates.
 *
 * Markers update on:
 *   - hunks change (diff recompute)
 *   - editor scroll
 *   - editor model content change (line wrap / size shift)
 *   - editor layout / configuration change (font, line height)
 *
 * Returns a state `Array<{hunkId, top}>` so React re-renders the
 * gutters at the new positions.
 */

import { type RefObject, useEffect, useState } from 'react';
import type { Hunk } from '../diff/line-diff';
import type { HunkTrackedRangesHandle } from './use-hunk-tracked-ranges';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export interface HunkActionMarker {
  hunkId: string;
  /** Pixel offset from the editor's top, accounting for scroll. */
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
      for (const h of args.hunks) {
        const live = tracked.liveRangeOf(h.id);
        const startLine = live ? live.startLineNumber : h.mineRange.startLine;
        // `getTopForLineNumber` returns the absolute pixel y of the
        // line within the editor's content, before scroll offset. We
        // subtract scrollTop so the React gutter (which lives outside
        // the editor) tracks the visible viewport.
        const topInContent = editor.getTopForLineNumber(startLine);
        next.push({ hunkId: h.id, top: topInContent - scrollTop });
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
