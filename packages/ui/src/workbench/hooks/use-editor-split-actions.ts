/**
 * useEditorSplitActions — the context-menu split/move/unsplit
 * operations for the split editor. Each callback funnels through the
 * shell's transform spine; see `UseEditorGroupsApi` for why every
 * split action moves (not clones) the tab.
 */

import { useCallback, useMemo } from 'react';
import {
  findLeaf,
  findOppositeLeaf,
  firstLeaf,
  flipParentSplit,
  moveTabBetweenLeaves,
  splitLeafWithTab,
  unsplitAll as treeUnsplitAll,
  unsplitLeaf,
} from '../editor-groups';
import { type EditorGroupsTransform, maybeCollapseEmpty, type UseEditorGroupsApi } from './editor-groups-shared';

export type EditorSplitActions = Pick<
  UseEditorGroupsApi,
  | 'splitAndMoveRight'
  | 'splitAndMoveLeft'
  | 'splitAndMoveDown'
  | 'splitAndMoveUp'
  | 'moveToOppositeGroup'
  | 'changeSplitterOrientation'
  | 'unsplit'
  | 'unsplitAll'
>;

export interface UseEditorSplitActionsArgs {
  transform: EditorGroupsTransform;
}

export function useEditorSplitActions({ transform }: UseEditorSplitActionsArgs): EditorSplitActions {
  const splitInDirection = useCallback(
    (leafId: string, tabId: string, direction: 'left' | 'right' | 'top' | 'bottom') => {
      transform((prev) => {
        const leaf = findLeaf(prev.root, leafId);
        if (!leaf) return prev;
        const tab = leaf.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;
        // Splitting a single-tab leaf is a no-op (would just move the tab).
        if (leaf.tabs.length < 2) return prev;
        const newLeafId = `leaf-${prev.nextId}`;
        const splitId = `split-${prev.nextId}`;
        const { root, newLeafId: createdId } = splitLeafWithTab(prev.root, leafId, direction, tab, newLeafId, splitId);
        return { root, focusedLeafId: createdId, nextId: prev.nextId + 1 };
      });
    },
    [transform],
  );

  const splitAndMoveRight = useCallback(
    (leafId: string, tabId: string) => splitInDirection(leafId, tabId, 'right'),
    [splitInDirection],
  );
  const splitAndMoveLeft = useCallback(
    (leafId: string, tabId: string) => splitInDirection(leafId, tabId, 'left'),
    [splitInDirection],
  );
  const splitAndMoveDown = useCallback(
    (leafId: string, tabId: string) => splitInDirection(leafId, tabId, 'bottom'),
    [splitInDirection],
  );
  const splitAndMoveUp = useCallback(
    (leafId: string, tabId: string) => splitInDirection(leafId, tabId, 'top'),
    [splitInDirection],
  );

  const moveToOppositeGroup = useCallback(
    (leafId: string, tabId: string) => {
      transform((prev) => {
        const leaf = findLeaf(prev.root, leafId);
        if (!leaf) return prev;
        const opposite = findOppositeLeaf(prev.root, leafId);
        if (opposite) {
          const next = moveTabBetweenLeaves(prev.root, leafId, opposite.id, tabId);
          const folded = maybeCollapseEmpty(next, leafId);
          return { ...prev, root: folded.root, focusedLeafId: opposite.id };
        }
        // No sibling yet → create one via split-right (requires 2+ tabs).
        if (leaf.tabs.length < 2) return prev;
        const tab = leaf.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;
        const newLeafId = `leaf-${prev.nextId}`;
        const splitId = `split-${prev.nextId}`;
        const { root, newLeafId: createdId } = splitLeafWithTab(prev.root, leafId, 'right', tab, newLeafId, splitId);
        return { root, focusedLeafId: createdId, nextId: prev.nextId + 1 };
      });
    },
    [transform],
  );

  const changeSplitterOrientation = useCallback(
    (leafId: string) => {
      transform((prev) => ({ ...prev, root: flipParentSplit(prev.root, leafId) }));
    },
    [transform],
  );

  const unsplit = useCallback(
    (leafId: string) => {
      transform((prev) => {
        const next = unsplitLeaf(prev.root, leafId);
        return { ...prev, root: next, focusedLeafId: leafId };
      });
    },
    [transform],
  );

  const unsplitAllAction = useCallback(() => {
    transform((prev) => {
      const next = treeUnsplitAll(prev.root, prev.focusedLeafId);
      const leaf = firstLeaf(next);
      return { ...prev, root: next, focusedLeafId: leaf.id };
    });
  }, [transform]);

  // Identity-stable action bundle — spread into the editor-groups API,
  // whose identity gates consumer memos and effects.
  return useMemo(
    () => ({
      splitAndMoveRight,
      splitAndMoveLeft,
      splitAndMoveDown,
      splitAndMoveUp,
      moveToOppositeGroup,
      changeSplitterOrientation,
      unsplit,
      unsplitAll: unsplitAllAction,
    }),
    [
      splitAndMoveRight,
      splitAndMoveLeft,
      splitAndMoveDown,
      splitAndMoveUp,
      moveToOppositeGroup,
      changeSplitterOrientation,
      unsplit,
      unsplitAllAction,
    ],
  );
}
