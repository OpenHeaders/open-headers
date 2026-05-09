/**
 * Register merge-editor operations as Monaco actions on the result
 * editor. Each action shows up in Monaco's command palette (F1) under
 * its label so the full toolbar set is keyboard-reachable without us
 * inventing browser-unsafe keybindings.
 *
 * No `keybindings` field — those are out of scope until a browser-safe
 * binding scheme lands. Discoverability stays via the palette + the
 * existing toolbar buttons.
 *
 * `findHunkAtLine` walks the active hunk lists to find one whose
 * result-side range covers the caret. The "accept at cursor" actions
 * use that to splice without the user navigating first.
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect } from 'react';
import type { Hunk } from '../diff/line-diff';
import type { HunkSide } from './use-hunk-decorations';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export interface MergeActionsContext {
  /** Latest theirs-side hunks (theirs ↔ result). */
  theirsHunks: readonly Hunk[];
  /** Latest mine-side hunks (mine ↔ result). */
  mineHunks: readonly Hunk[];
  acceptHunk(hunkId: string, side: HunkSide): void;
  gotoNextHunk(): void;
  gotoPrevHunk(): void;
  applyNonConflicting(): void;
  acceptAllTheirs(): void;
  acceptAllMine(): void;
}

export interface UseMergeActionsArgs {
  /** Result editor — actions register here so the palette opens with
   *  the user's caret in the editable surface. */
  resultEditorRef: RefObject<MonacoEditorHandle>;
  /** Latest action context. Bundled in a ref so action closures can
   *  read fresh state without re-registering on every render. */
  contextRef: RefObject<MergeActionsContext | null>;
}

function findHunkAtLine(hunks: readonly Hunk[], line: number): Hunk | undefined {
  for (const h of hunks) {
    const r = h.mineRange;
    const start = r.startLine;
    const end = r.endLine <= r.startLine ? r.startLine + 1 : r.endLine;
    if (line >= start && line < end) return h;
  }
  return undefined;
}

export function useMergeActions({ resultEditorRef, contextRef }: UseMergeActionsArgs): void {
  useEffect(() => {
    const editor = resultEditorRef.current.editor;
    if (!editor) return;
    const disposables: monaco.IDisposable[] = [];

    const ctx = (): MergeActionsContext | null => contextRef.current;

    disposables.push(
      editor.addAction({
        id: 'oh-merge.next-hunk',
        label: 'Merge: Go to next hunk',
        contextMenuGroupId: 'merge',
        contextMenuOrder: 1,
        run: () => ctx()?.gotoNextHunk(),
      }),
      editor.addAction({
        id: 'oh-merge.prev-hunk',
        label: 'Merge: Go to previous hunk',
        contextMenuGroupId: 'merge',
        contextMenuOrder: 2,
        run: () => ctx()?.gotoPrevHunk(),
      }),
      editor.addAction({
        id: 'oh-merge.accept-theirs-at-cursor',
        label: 'Merge: Accept incoming hunk at cursor',
        contextMenuGroupId: 'merge',
        contextMenuOrder: 3,
        run: (ed) => {
          const c = ctx();
          if (!c) return;
          const pos = ed.getPosition();
          if (!pos) return;
          const hunk = findHunkAtLine(c.theirsHunks, pos.lineNumber);
          if (hunk) c.acceptHunk(hunk.id, 'theirs');
        },
      }),
      editor.addAction({
        id: 'oh-merge.accept-mine-at-cursor',
        label: 'Merge: Accept current hunk at cursor',
        contextMenuGroupId: 'merge',
        contextMenuOrder: 4,
        run: (ed) => {
          const c = ctx();
          if (!c) return;
          const pos = ed.getPosition();
          if (!pos) return;
          const hunk = findHunkAtLine(c.mineHunks, pos.lineNumber);
          if (hunk) c.acceptHunk(hunk.id, 'mine');
        },
      }),
      editor.addAction({
        id: 'oh-merge.apply-non-conflicting',
        label: 'Merge: Apply non-conflicting changes',
        contextMenuGroupId: 'merge',
        contextMenuOrder: 5,
        run: () => ctx()?.applyNonConflicting(),
      }),
      editor.addAction({
        id: 'oh-merge.accept-all-incoming',
        label: 'Merge: Accept all incoming',
        contextMenuGroupId: 'merge',
        contextMenuOrder: 6,
        run: () => ctx()?.acceptAllTheirs(),
      }),
      editor.addAction({
        id: 'oh-merge.accept-all-current',
        label: 'Merge: Accept all current',
        contextMenuGroupId: 'merge',
        contextMenuOrder: 7,
        run: () => ctx()?.acceptAllMine(),
      }),
    );

    return () => {
      for (const d of disposables) d.dispose();
    };
  }, [resultEditorRef, contextRef]);
}
