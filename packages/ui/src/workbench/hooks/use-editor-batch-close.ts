/**
 * useEditorBatchClose — the tab-strip batch close helpers ("close
 * others / all / unmodified / to the left / to the right"), scoped to
 * whichever leaf owns the anchor tab. Each callback funnels through
 * the shell's transform spine.
 */

import { useCallback, useMemo } from 'react';
import { activateTabInLeaf, type EditorNode, findLeaf, insertTabIntoLeaf, removeAllFromLeaf } from '../editor-groups';
import {
  type EditorGroupsTransform,
  locateTab,
  maybeCollapseEmpty,
  type UseEditorGroupsApi,
} from './editor-groups-shared';

export type EditorBatchCloseActions = Pick<
  UseEditorGroupsApi,
  'closeOtherTabs' | 'closeAllTabs' | 'closeUnmodifiedTabs' | 'closeTabsToLeft' | 'closeTabsToRight'
>;

export interface UseEditorBatchCloseArgs {
  transform: EditorGroupsTransform;
  dirtyMap: React.MutableRefObject<Map<string, boolean>>;
  saveRefMap: React.MutableRefObject<Map<string, () => void>>;
}

export function useEditorBatchClose({
  transform,
  dirtyMap,
  saveRefMap,
}: UseEditorBatchCloseArgs): EditorBatchCloseActions {
  const closeOtherTabs = useCallback(
    (tabId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        const keep = leaf.tabs.find((t) => t.id === tabId);
        if (!keep) return prev;
        for (const t of leaf.tabs) {
          if (t.id !== tabId) {
            dirtyMap.current.delete(t.id);
            saveRefMap.current.delete(t.id);
          }
        }
        const cleared = removeAllFromLeaf(prev.root, leaf.id);
        const filled = insertTabIntoLeaf(cleared, leaf.id, keep);
        return { ...prev, root: filled, focusedLeafId: leaf.id };
      });
    },
    [transform, dirtyMap, saveRefMap],
  );

  const closeAllTabs = useCallback(() => {
    transform((prev) => {
      const leaf = findLeaf(prev.root, prev.focusedLeafId);
      if (!leaf) return prev;
      for (const t of leaf.tabs) {
        dirtyMap.current.delete(t.id);
        saveRefMap.current.delete(t.id);
      }
      const emptied = removeAllFromLeaf(prev.root, leaf.id);
      const folded = maybeCollapseEmpty(emptied, leaf.id);
      return { ...prev, root: folded.root, focusedLeafId: folded.focusLeafId };
    });
  }, [transform, dirtyMap, saveRefMap]);

  const closeUnmodifiedTabs = useCallback(() => {
    transform((prev) => {
      const leaf = findLeaf(prev.root, prev.focusedLeafId);
      if (!leaf) return prev;
      const keep = leaf.tabs.filter((t) => t.dirty || t.mode === 'request-create');
      for (const t of leaf.tabs) {
        if (!t.dirty && t.mode !== 'request-create') {
          dirtyMap.current.delete(t.id);
          saveRefMap.current.delete(t.id);
        }
      }
      const nextActive =
        leaf.activeTabId && keep.some((t) => t.id === leaf.activeTabId) ? leaf.activeTabId : (keep[0]?.id ?? null);
      const cleared = removeAllFromLeaf(prev.root, leaf.id);
      const filled = keep.reduce<EditorNode>((acc, t) => insertTabIntoLeaf(acc, leaf.id, t), cleared);
      const withActive = nextActive ? activateTabInLeaf(filled, leaf.id, nextActive) : filled;
      const folded = maybeCollapseEmpty(withActive, leaf.id);
      return { ...prev, root: folded.root, focusedLeafId: folded.focusLeafId };
    });
  }, [transform, dirtyMap, saveRefMap]);

  const closeTabsToLeft = useCallback(
    (tabId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        const idx = leaf.tabs.findIndex((t) => t.id === tabId);
        if (idx <= 0) return prev;
        const removed = leaf.tabs.slice(0, idx);
        for (const t of removed) {
          dirtyMap.current.delete(t.id);
          saveRefMap.current.delete(t.id);
        }
        const keep = leaf.tabs.slice(idx);
        const cleared = removeAllFromLeaf(prev.root, leaf.id);
        const filled = keep.reduce<EditorNode>((acc, t) => insertTabIntoLeaf(acc, leaf.id, t), cleared);
        const nextActive =
          leaf.activeTabId && keep.some((t) => t.id === leaf.activeTabId) ? leaf.activeTabId : (keep[0]?.id ?? null);
        const withActive = nextActive ? activateTabInLeaf(filled, leaf.id, nextActive) : filled;
        return { ...prev, root: withActive };
      });
    },
    [transform, dirtyMap, saveRefMap],
  );

  const closeTabsToRight = useCallback(
    (tabId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        const idx = leaf.tabs.findIndex((t) => t.id === tabId);
        if (idx === -1 || idx === leaf.tabs.length - 1) return prev;
        const removed = leaf.tabs.slice(idx + 1);
        for (const t of removed) {
          dirtyMap.current.delete(t.id);
          saveRefMap.current.delete(t.id);
        }
        const keep = leaf.tabs.slice(0, idx + 1);
        const cleared = removeAllFromLeaf(prev.root, leaf.id);
        const filled = keep.reduce<EditorNode>((acc, t) => insertTabIntoLeaf(acc, leaf.id, t), cleared);
        const nextActive =
          leaf.activeTabId && keep.some((t) => t.id === leaf.activeTabId)
            ? leaf.activeTabId
            : (keep[keep.length - 1]?.id ?? null);
        const withActive = nextActive ? activateTabInLeaf(filled, leaf.id, nextActive) : filled;
        return { ...prev, root: withActive };
      });
    },
    [transform, dirtyMap, saveRefMap],
  );

  // Identity-stable action bundle — spread into the editor-groups API,
  // whose identity gates consumer memos and effects.
  return useMemo(
    () => ({ closeOtherTabs, closeAllTabs, closeUnmodifiedTabs, closeTabsToLeft, closeTabsToRight }),
    [closeOtherTabs, closeAllTabs, closeUnmodifiedTabs, closeTabsToLeft, closeTabsToRight],
  );
}
