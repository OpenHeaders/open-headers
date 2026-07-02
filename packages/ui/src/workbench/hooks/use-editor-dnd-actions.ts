/**
 * useEditorDndActions — the cross-leaf drag-and-drop primitives for
 * the split editor (move a tab into another leaf; drop a tab onto a
 * leaf edge to split it). Each callback funnels through the shell's
 * transform spine.
 */

import { useCallback } from 'react';
import { findLeaf, moveTabBetweenLeaves, removeTabFromLeaf, splitLeafWithTab } from '../editor-groups';
import { type EditorGroupsTransform, maybeCollapseEmpty, type UseEditorGroupsApi } from './editor-groups-shared';

export type EditorDndActions = Pick<UseEditorGroupsApi, 'moveTabToLeaf' | 'splitLeafWithDrop'>;

export interface UseEditorDndActionsArgs {
  transform: EditorGroupsTransform;
}

export function useEditorDndActions({ transform }: UseEditorDndActionsArgs): EditorDndActions {
  const moveTabToLeaf = useCallback(
    (fromLeafId: string, toLeafId: string, tabId: string, insertAt?: number) => {
      transform((prev) => {
        const next = moveTabBetweenLeaves(prev.root, fromLeafId, toLeafId, tabId, insertAt);
        const folded =
          fromLeafId !== toLeafId ? maybeCollapseEmpty(next, fromLeafId) : { root: next, focusLeafId: fromLeafId };
        return { ...prev, root: folded.root, focusedLeafId: toLeafId };
      });
    },
    [transform],
  );

  const splitLeafWithDrop = useCallback(
    (targetLeafId: string, direction: 'left' | 'right' | 'top' | 'bottom', fromLeafId: string, tabId: string) => {
      transform((prev) => {
        const source = findLeaf(prev.root, fromLeafId);
        if (!source) return prev;
        const tab = source.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;
        // Refuse to split a leaf into itself when it holds only one tab.
        if (fromLeafId === targetLeafId && source.tabs.length < 2) return prev;

        // Remove from source first.
        const afterRemove = removeTabFromLeaf(prev.root, fromLeafId, tabId);
        const target = findLeaf(afterRemove, targetLeafId);
        if (!target) return prev;

        const newLeafId = `leaf-${prev.nextId}`;
        const splitId = `split-${prev.nextId}`;
        const { root } = splitLeafWithTab(afterRemove, targetLeafId, direction, tab, newLeafId, splitId);
        const folded =
          fromLeafId !== targetLeafId ? maybeCollapseEmpty(root, fromLeafId) : { root, focusLeafId: newLeafId };
        return {
          ...prev,
          root: folded.root,
          focusedLeafId: newLeafId,
          nextId: prev.nextId + 1,
        };
      });
    },
    [transform],
  );

  return { moveTabToLeaf, splitLeafWithDrop };
}
