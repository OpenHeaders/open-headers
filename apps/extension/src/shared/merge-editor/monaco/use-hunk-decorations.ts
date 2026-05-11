/**
 * Push line-background decorations on a side pane (theirs / mine).
 *
 * Reads per-hunk visual treatment from `view/hunk-visual.ts` — the
 * hook itself owns no palette decisions. For each analyzed hunk it
 * asks `lineTintFor` for the kind class, suffixes the result with
 * the pick-state class (`accepted` / `dismissed` / `pending`), and
 * applies the decoration. Empty-side hunks return `null` and are
 * skipped here; the missing-side placeholder in
 * `useHunkAlignmentPlaceholders` carries the visual for those.
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect } from 'react';
import type { HunkAnalysis } from '../diff/hunk-analysis';
import type { SideState } from '../use-hunk-pick-state';
import { type HunkSide, type LineTint, lineTintFor } from '../view/hunk-visual';
import './hunk-decorations.css';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export type { HunkSide } from '../view/hunk-visual';

const CSS_CLASS_BY_TINT: Record<LineTint, string> = {
  addition: 'oh-merge__hunk-addition',
  removal: 'oh-merge__hunk-removal',
  modification: 'oh-merge__hunk-modification',
};

const STATE_SUFFIX: Record<SideState, string> = {
  pending: '',
  accepted: ' oh-merge__hunk-accepted',
  dismissed: ' oh-merge__hunk-dismissed',
};

export interface UseHunkDecorationsArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  side: HunkSide;
  analyses: readonly HunkAnalysis[];
  /** Reads the per-hunk pick state for this side. Drives the
   *  accepted / dismissed suffix so resolved hunks fade into a
   *  reference treatment. */
  getSideState: (hunkId: string) => SideState;
  /** Bumped on every controller mutation so the effect re-runs in
   *  lock-step with the gutter / action zones. */
  stateRev: number;
}

export function useHunkDecorations({
  editorRef,
  side,
  analyses,
  getSideState,
  stateRev,
}: UseHunkDecorationsArgs): void {
  // stateRev is the load-bearing trigger — the pick controller is
  // ref-stable and React can't observe its mutations, so the parent
  // bumps stateRev on every state change to force this effect to
  // re-run. biome's exhaustive-deps check doesn't see the ref
  // indirection, so the suppression is intentional.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stateRev is intentional reactivity bridge
  useEffect(() => {
    const editor = editorRef.current.editor;
    const model = editorRef.current.model;
    if (!editor || !model) return;

    const decos: monaco.editor.IModelDeltaDecoration[] = [];
    for (const analysis of analyses) {
      const tint = lineTintFor(analysis, side);
      if (tint === null) continue;
      const sideChange = side === 'theirs' ? analysis.theirs : analysis.mine;
      const state = getSideState(analysis.id);
      const className = CSS_CLASS_BY_TINT[tint] + STATE_SUFFIX[state];
      const range = sideChange.range;
      const endLineInclusive = Math.min(range.endLine - 1, model.getLineCount());
      decos.push({
        range: {
          startLineNumber: range.startLine,
          startColumn: 1,
          endLineNumber: endLineInclusive,
          endColumn: model.getLineMaxColumn(endLineInclusive),
        },
        options: {
          isWholeLine: true,
          className,
          stickiness: 1,
        },
      });
    }

    const collection = editor.createDecorationsCollection(decos);
    return () => {
      collection.clear();
    };
  }, [editorRef, side, analyses, getSideState, stateRev]);
}
