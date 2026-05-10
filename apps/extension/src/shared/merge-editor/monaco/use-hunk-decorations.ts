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
import type { SideState } from '../use-hunk-pick-state';
import './hunk-decorations.css';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export type HunkSide = 'theirs' | 'mine';

const CSS_CLASS_BY_KIND = {
  addition: 'oh-merge__hunk-addition',
  removal: 'oh-merge__hunk-removal',
  modification: 'oh-merge__hunk-modification',
} as const;

const STATE_SUFFIX: Record<SideState, string> = {
  pending: '',
  accepted: ' oh-merge__hunk-accepted',
  dismissed: ' oh-merge__hunk-dismissed',
};

export interface UseHunkDecorationsArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  side: HunkSide;
  hunks: readonly Hunk[];
  /** Optional per-hunk side state. When provided, the hook applies a
   *  state-suffix CSS class so accepted / dismissed hunks render with
   *  visually distinct treatment (dashed brackets for dismissed, etc.)
   *  per `MERGE_CONFLICT_EDITOR_PLAN.md` §5.3 — the side panes are
   *  reference surfaces, so resolved hunks fade to signal "this
   *  divergence is decided." Pending hunks keep the solid kind tint.
   *
   *  Reads the state for the side this hook decorates: the theirs
   *  pane reads `state.theirs`, the mine pane reads `state.mine`. */
  getSideState?: (hunkId: string) => SideState;
  /** Force the hook to re-run when the controller's state map mutates.
   *  Bumped via `pickStateRev` from MergePane. */
  stateRev?: number;
}

export function useHunkDecorations({ editorRef, side, hunks, getSideState, stateRev }: UseHunkDecorationsArgs): void {
  useEffect(() => {
    const editor = editorRef.current.editor;
    const model = editorRef.current.model;
    if (!editor || !model) return;

    const decos: monaco.editor.IModelDeltaDecoration[] = [];
    for (const h of hunks) {
      const range = side === 'theirs' ? h.theirsRange : h.mineRange;
      if (range.endLine <= range.startLine) continue;
      // Per-pane display kind. The diff algorithm classifies left-only
      // segments as 'removal' (going left→right those lines would be
      // deleted) and right-only segments as 'addition' (those lines
      // would be added). But the source panes display content from
      // their OWN side, and the user's mental model is "this pane has
      // content the other doesn't" — which always reads as ADDITION
      // regardless of which operand of the diff is which. Without
      // this flip, a peer-added hunk (theirs has X-C, result lacks)
      // shows as RED on the theirs pane because the diff was
      // theirs→result and theirs has the extra; the user expects
      // GREEN ("theirs added"). Modifications stay AMBER (both sides
      // have differing content here, kind is symmetric).
      const displayKind = h.classification === 'removal' ? 'addition' : h.classification;
      const baseClass = CSS_CLASS_BY_KIND[displayKind];
      const sideState = getSideState ? getSideState(h.id) : 'pending';
      const className = baseClass + STATE_SUFFIX[sideState];
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
          stickiness: 1,
        },
      });
    }

    const collection = editor.createDecorationsCollection(decos);
    return () => {
      collection.clear();
    };
    // stateRev intentionally in deps — bumped on every controller
    // mutation so decorations refresh in lock-step with the gutter.
  }, [editorRef, side, hunks, getSideState, stateRev]);
}
