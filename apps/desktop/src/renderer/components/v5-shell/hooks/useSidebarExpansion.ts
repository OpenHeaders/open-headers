/**
 * useSidebarExpansion — shared sidebar tree expansion state.
 *
 * Provides typed methods for expanding/collapsing sidebar tree nodes.
 * All keys use the format `{type}-{id}` (e.g. `col-abc123`, `folder-xyz456`).
 *
 * Used by V5Shell (owns the persistence), Sidebar (renders the tree),
 * and useDraftSave (auto-expands after saving).
 */

import { useCallback, useMemo } from 'react';

export function useSidebarExpansion(expandedCollections: string[], setExpandedCollections: (keys: string[]) => void) {
  const expandedKeys = useMemo(() => new Set(expandedCollections), [expandedCollections]);

  /** Add keys without removing existing ones. No-op if all already present. */
  const ensureExpanded = useCallback(
    (...keys: string[]) => {
      const current = new Set(expandedCollections);
      let changed = false;
      for (const key of keys) {
        if (!current.has(key)) {
          current.add(key);
          changed = true;
        }
      }
      if (changed) setExpandedCollections([...current]);
    },
    [expandedCollections, setExpandedCollections],
  );

  /** Toggle a single key on/off. */
  const toggleExpand = useCallback(
    (key: string) => {
      const next = new Set(expandedCollections);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setExpandedCollections([...next]);
    },
    [expandedCollections, setExpandedCollections],
  );

  /** Replace all expanded keys (used by expandAll/collapseAll). */
  const setAll = setExpandedCollections;

  return { expandedKeys, ensureExpanded, toggleExpand, setAll };
}
