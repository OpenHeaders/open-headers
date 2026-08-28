/**
 * useTreeKeyboardMoves — Alt+Arrow moves on the focused sidebar row,
 * the keyboard twin of the drag gesture. The focused row's tree is
 * found by its id among the three dnd configs; the resolved placement
 * dispatches through that config's `move`, the same call a drop makes.
 * Off while a non-manual sort is active (order is data, sort is view).
 */

import type React from 'react';
import { useCallback, useMemo } from 'react';
import type { TreeDndConfig } from './TreeDnd';
import { roleOf } from './tree-dnd-ids';
import { computeKeyboardMove, moveDirectionForKey } from './tree-dnd-keyboard';
import type { TreeNode } from './types';

interface UseTreeKeyboardMovesParams {
  allFlatItems: readonly TreeNode[];
  focusedId: string | null;
  configs: readonly TreeDndConfig[];
  enabled: boolean;
}

/** Returns a keydown handler that reports whether it consumed the event. */
export function useTreeKeyboardMoves({
  allFlatItems,
  focusedId,
  configs,
  enabled,
}: UseTreeKeyboardMovesParams): (e: React.KeyboardEvent) => boolean {
  const byId = useMemo(() => new Map(allFlatItems.map((n) => [n.id, n])), [allFlatItems]);

  return useCallback(
    (e: React.KeyboardEvent) => {
      const direction = moveDirectionForKey(e);
      if (direction === null || !enabled || !focusedId) return false;
      const activeNode = byId.get(focusedId);
      if (!activeNode) return false;
      const config = configs.find((candidate) => roleOf(activeNode, candidate) !== null);
      if (!config) return false;
      e.preventDefault();
      const placement = computeKeyboardMove({
        direction,
        activeNode,
        nodes: allFlatItems,
        byId,
        config,
        lookupSiblings: config.lookupSiblings,
        lookupItems: config.lookupItems,
        lookupCollections: config.lookupCollections,
      });
      if (placement) config.move([placement]);
      return true;
    },
    [allFlatItems, byId, configs, enabled, focusedId],
  );
}
