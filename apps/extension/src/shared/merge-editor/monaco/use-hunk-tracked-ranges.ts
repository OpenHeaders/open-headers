/**
 * Sticky tracking decorations for hunks in the result pane.
 *
 * Each hunk gets a Monaco `TrackedRangeStickiness` decoration anchored
 * at its initial result-side range. When the user edits the result
 * buffer (or accepts another hunk above this one), Monaco shifts the
 * decoration's line numbers automatically — subsequent reads of "where
 * is hunk X right now in the buffer?" return the live range, not the
 * stale `mineRange` line numbers the diff produced at session open.
 *
 * Production previously read `hunk.mineRange` from the diff at click
 * time. That works because the diff is recomputed on every result
 * change and hunk identity is content-hashed (stable across non-
 * intersecting edits) — so the *current* diff's `mineRange` is always
 * fresh. But once we add per-side pick state (`use-hunk-pick-state`),
 * the state map needs a stable way to address each hunk's region in
 * the buffer that survives the user accepting other hunks first;
 * stickiness gives us that without coupling state to diff recompute
 * order.
 *
 * Lifecycle:
 *   - Hunks appear/disappear as the diff recomputes. We add
 *     decorations for new hunk ids, drop them for ids no longer in
 *     the live hunk set.
 *   - On unmount the decorations collection clears.
 *   - `liveRangeOf(hunkId)` returns the current Monaco range, or null
 *     if the hunk has no decoration (e.g. just-disappeared).
 *   - `writeHunk(hunkId, text)` replaces the live range atomically and
 *     re-anchors a new sticky decoration around the written range so
 *     subsequent picks on the same hunk target the new span.
 */

import type * as monaco from 'monaco-editor';
import { editor as monacoEditor } from 'monaco-editor/esm/vs/editor/edcore.main';
import { type RefObject, useEffect, useRef } from 'react';
import type { Hunk, LineRange } from '../diff/line-diff';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export interface HunkTrackedRangesHandle {
  /** Live result-side range for `hunkId`, or null when the hunk has
   *  no tracked decoration (e.g. just dropped). The returned range is
   *  Monaco-shaped (1-based inclusive `startLineNumber`, 1-based
   *  exclusive intent on `endLineNumber + 1` — see `writeHunk`). */
  liveRangeOf(hunkId: string): monaco.IRange | null;
  /** Atomic-replace the hunk's live range with `text` and re-anchor a
   *  fresh sticky decoration around the written content. Use this
   *  instead of writing to the model directly when the write should
   *  participate in the per-side pick-state machine.
   *
   *  Returns true on success, false if `hunkId` has no tracking (the
   *  hunk vanished from the live set).
   */
  writeHunk(hunkId: string, text: string): boolean;
}

export interface UseHunkTrackedRangesArgs {
  resultRef: RefObject<MonacoEditorHandle>;
  hunks: readonly Hunk[];
}

const STICKINESS = 1; // monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges

function clampedRange(range: LineRange, lineCount: number): { startLine: number; endLine: number } {
  const start = Math.min(Math.max(range.startLine, 1), Math.max(1, lineCount));
  // `LineRange.endLine` is EXCLUSIVE per `diff/line-diff.ts`'s type
  // doc; Monaco's `IRange.endLineNumber` is INCLUSIVE. Convert here
  // so the stored decoration covers the right lines. For zero-line
  // ranges (insertion-point hunks where startLine === endLine), use
  // startLine for a collapsed range — Monaco can't represent
  // negative-extent ranges and the consumers handle insertion points
  // via the `endLineNumber === startLineNumber` shape.
  const inclusiveEnd = range.endLine > range.startLine ? range.endLine - 1 : range.startLine;
  const end = Math.min(Math.max(inclusiveEnd, start), Math.max(1, lineCount));
  return { startLine: start, endLine: end };
}

export function useHunkTrackedRanges({
  resultRef,
  hunks,
}: UseHunkTrackedRangesArgs): RefObject<HunkTrackedRangesHandle> {
  // Map<hunkId, decorationId> — owned by this hook for the editor's lifetime.
  const trackedRef = useRef<Map<string, string>>(new Map());
  const handleRef = useRef<HunkTrackedRangesHandle>({
    liveRangeOf: () => null,
    writeHunk: () => false,
  });

  useEffect(() => {
    const editor = resultRef.current.editor;
    const model = resultRef.current.model;
    if (!editor || !model) return;
    const tracked = trackedRef.current;

    const liveIds = new Set(hunks.map((h) => h.id));

    // Drop decorations for hunks that are no longer in the diff.
    const removed: string[] = [];
    for (const [hunkId, decoId] of tracked) {
      if (!liveIds.has(hunkId)) {
        removed.push(decoId);
        tracked.delete(hunkId);
      }
    }
    if (removed.length > 0) editor.deltaDecorations(removed, []);

    // Add decorations for new hunks. Anchor on the result-side range
    // (`mineRange` per the line-diff convention — diff(mine, result)
    // maps mineRange to the result side because result is seeded from
    // mine; for diff(theirs, result), mineRange is the result-side
    // range too because that's the right operand of the diff).
    //
    // endColumn encoding distinguishes content-bearing hunks from
    // insertion-point hunks at write time:
    //   - Content (>= 1 line): endColumn = lineMaxColumn(endLine).
    //     The decoration stores a real visible-extent range; writeHunk
    //     reads endColumn > 1 and expands to the next-line-start for
    //     whole-line replacement.
    //   - Insertion point (zero lines): endColumn = 1. Decoration is
    //     zero-width at the start of `startLine`; writeHunk reads
    //     endColumn === 1 + startLine === endLine and uses the range
    //     AS-IS — Monaco treats a zero-width range as "insert here,"
    //     so the line below stays intact.
    // Without this distinction both shapes serialize as
    // {start:N:1, end:N:1} and writeHunk's "+1 to consume the trailing
    // newline" logic deletes the line below for insertion-point
    // hunks. Bug surfaced after we wired Accept Incoming to actually
    // write the buffer (model.pushEditOperations vs. the readOnly-
    // gated executeEdits) — pure-additions wrote X-C content over
    // the insertion-anchor line.
    const added: monaco.editor.IModelDeltaDecoration[] = [];
    const newHunkIds: string[] = [];
    const lineCount = model.getLineCount();
    for (const h of hunks) {
      if (tracked.has(h.id)) continue;
      const isInsertionPoint = h.mineRange.endLine <= h.mineRange.startLine;
      const { startLine, endLine } = clampedRange(h.mineRange, lineCount);
      added.push({
        range: {
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: isInsertionPoint ? 1 : model.getLineMaxColumn(endLine),
        },
        options: { stickiness: STICKINESS },
      });
      newHunkIds.push(h.id);
    }
    if (added.length > 0) {
      const ids = editor.deltaDecorations([], added);
      for (let i = 0; i < ids.length && i < newHunkIds.length; i++) {
        tracked.set(newHunkIds[i], ids[i]);
      }
    }

    // Refresh the imperative handle so callers always read the
    // current map even across hunk-set changes.
    handleRef.current = {
      liveRangeOf(hunkId) {
        const decoId = tracked.get(hunkId);
        if (!decoId) return null;
        const live = editor.getModel()?.getDecorationRange(decoId);
        return live ?? null;
      },
      writeHunk(hunkId, text) {
        const decoId = tracked.get(hunkId);
        if (!decoId) return false;
        const live = editor.getModel()?.getDecorationRange(decoId);
        if (!live) return false;
        const lc = model.getLineCount();
        const startLine = live.startLineNumber;
        // Insertion-point detection: zero-width decoration on a single
        // line (start == end on both line and column). For these we
        // use the live range AS-IS; Monaco treats a zero-width edit
        // range as "insert at position" and leaves the line below
        // intact. Without this branch, the +1 expansion below would
        // consume the line that the insertion point anchors against.
        const isInsertionPoint =
          live.startLineNumber === live.endLineNumber && live.startColumn === 1 && live.endColumn === 1;
        // Whole-line replacement range for content-bearing hunks:
        // from the start of the first tracked line to the start of
        // the line AFTER the last tracked line, so the trailing
        // newline is consumed cleanly. If we're at end-of-buffer, use
        // the model's max column on the final line instead.
        const endLineExclusive = live.endLineNumber + 1;
        const useTailColumn = !isInsertionPoint && endLineExclusive > lc;
        const replaceRange: monaco.IRange = isInsertionPoint
          ? {
              startLineNumber: startLine,
              startColumn: 1,
              endLineNumber: startLine,
              endColumn: 1,
            }
          : useTailColumn
            ? {
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: lc,
                endColumn: model.getLineMaxColumn(lc),
              }
            : {
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: endLineExclusive,
                endColumn: 1,
              };
        // Compute the new tracked range = the lines actually written.
        // `text` is expected to end with `\n` for whole-line writes;
        // empty `text` is a removal (collapses to a zero-line range).
        const writtenLineCount = text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
        const newEndLine = Math.max(startLine, startLine + writtenLineCount - 1);
        // Use `model.pushEditOperations` instead of
        // `editor.executeEdits`. The result editor is `readOnly: true`
        // (so the user can't free-type into the merged buffer), and
        // Monaco's editor-level `executeEdits` checks the readOnly
        // option and silently no-ops when set — the controller would
        // update its state map and the status zone would refresh, but
        // the buffer would never reflect the accept. Model-level edits
        // bypass the readOnly gate (it lives on the editor widget,
        // not the model), which is the right escape hatch for
        // programmatic writes that originate from our own UI.
        model.pushEditOperations(
          null,
          [
            {
              range: replaceRange,
              text: useTailColumn && !text.endsWith('\n') ? text : useTailColumn ? text.slice(0, -1) : text,
              forceMoveMarkers: true,
            },
          ],
          () => null,
        );
        // Re-anchor: drop the old decoration, install a fresh one at
        // the new range (skip when the range collapsed to zero — the
        // hunk is now empty and a follow-up diff recompute will drop
        // the hunk id naturally). Use lineMaxColumn for the new end
        // so the content/insertion-point distinction survives across
        // subsequent writes (a re-decided hunk previously stored as
        // insertion-point now holds real content; next write should
        // treat it as content).
        if (writtenLineCount > 0) {
          const newIds = editor.deltaDecorations(
            [decoId],
            [
              {
                range: {
                  startLineNumber: startLine,
                  startColumn: 1,
                  endLineNumber: newEndLine,
                  endColumn: model.getLineMaxColumn(newEndLine),
                },
                options: { stickiness: STICKINESS },
              },
            ],
          );
          if (newIds[0]) tracked.set(hunkId, newIds[0]);
        } else {
          editor.deltaDecorations([decoId], []);
          tracked.delete(hunkId);
        }
        return true;
      },
    };
    // Acknowledge the import to avoid the unused-import lint when
    // someone strips the comment-only references to monacoEditor —
    // we keep it in scope so the file lifts cleanly into a future
    // package extraction even though we don't reference it directly.
    void monacoEditor;
  }, [resultRef, hunks]);

  // Cleanup on unmount: clear all tracked decorations.
  useEffect(() => {
    const editor = resultRef.current.editor;
    return () => {
      const ids = Array.from(trackedRef.current.values());
      if (ids.length > 0 && editor) editor.deltaDecorations(ids, []);
      trackedRef.current.clear();
    };
  }, [resultRef]);

  return handleRef;
}
