/**
 * Compact-view wiring for `MergePane` — derives the per-pane visible
 * windows around each hunk and feeds them to `useHiddenAreas` so
 * unchanged regions collapse across all three panes.
 */

import type { RefObject } from 'react';
import { useMemo } from 'react';
import type { Hunk, LineRange } from './diff/line-diff';
import { useHiddenAreas } from './monaco/use-hidden-areas';
import type { HunkTrackedRangesHandle } from './monaco/use-hunk-tracked-ranges';
import type { MonacoEditorHandle } from './monaco/use-monaco-editor-lifecycle';

interface UseMergeCompactViewArgs {
  theirsRef: RefObject<MonacoEditorHandle>;
  mineRef: RefObject<MonacoEditorHandle>;
  resultRef: RefObject<MonacoEditorHandle>;
  pickStateHunks: readonly Hunk[];
  trackedRangesRef: RefObject<HunkTrackedRangesHandle>;
  pickStateRev: number;
  enabled: boolean;
}

export function useMergeCompactView({
  theirsRef,
  mineRef,
  resultRef,
  pickStateHunks,
  trackedRangesRef,
  pickStateRev,
  enabled,
}: UseMergeCompactViewArgs): void {
  // Compact-view hidden ranges. Theirs / mine use pickStateHunks's
  // own range axes directly (stable, pane-local coordinates).
  // Result must read live tracked ranges via trackedRangesRef
  // because the result pane's content shifts every time the user
  // accepts a hunk — pickStateHunks's mineRange points at the
  // INITIAL insertion position, which can drift from the actual
  // post-accept content for multi-line stacks (e.g. Accept
  // Combination of a 5+5-line modification). pickStateRev in the
  // memo's deps busts the cache on every controller mutation so
  // the visible windows track the live content.
  const theirsVisibleRanges = useMemo<LineRange[]>(() => pickStateHunks.map((h) => h.theirsRange), [pickStateHunks]);
  const mineVisibleRanges = useMemo<LineRange[]>(() => pickStateHunks.map((h) => h.mineRange), [pickStateHunks]);
  const resultVisibleRanges = useMemo<LineRange[]>(() => {
    const ranges: LineRange[] = [];
    for (const h of pickStateHunks) {
      const live = trackedRangesRef.current?.liveRangeOf(h.id);
      if (live) {
        ranges.push({ startLine: live.startLineNumber, endLine: live.endLineNumber + 1 });
      } else {
        ranges.push(h.mineRange);
      }
    }
    void pickStateRev;
    return ranges;
  }, [pickStateHunks, pickStateRev, trackedRangesRef]);
  // Smallest indent across the hunk's actual content lines. Drives
  // ancestor lookup in `useHiddenAreas` so insertion-point hunks
  // (whose pane-local anchor is a sibling line, not a child) still
  // find the right structural parent. e.g. a peer-added row inserted
  // at the `responseHeaders:` line — anchor indent 2, content indent
  // 4 → walking from indent 4 surfaces `requestHeaders:` at indent 2
  // as the logical parent. Same array reused across all three panes
  // since the content text doesn't depend on which pane displays it.
  const hunkContentIndents = useMemo<ReadonlyArray<number | undefined>>(
    () =>
      pickStateHunks.map((h) => {
        let min = Number.POSITIVE_INFINITY;
        for (const line of [...h.theirsLines, ...h.mineLines]) {
          if (line.trim() === '') continue;
          let i = 0;
          while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
          if (i < min) min = i;
        }
        return Number.isFinite(min) ? min : undefined;
      }),
    [pickStateHunks],
  );

  useHiddenAreas({
    editorRef: theirsRef,
    visibleRanges: theirsVisibleRanges,
    contentIndents: hunkContentIndents,
    context: 3,
    enabled,
  });
  useHiddenAreas({
    editorRef: mineRef,
    visibleRanges: mineVisibleRanges,
    contentIndents: hunkContentIndents,
    context: 3,
    enabled,
  });
  useHiddenAreas({
    editorRef: resultRef,
    visibleRanges: resultVisibleRanges,
    contentIndents: hunkContentIndents,
    context: 3,
    enabled,
  });
}
