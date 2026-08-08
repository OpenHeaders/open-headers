/**
 * useTreeSearch — the sidebar's on-demand speed-search subsystem.
 *
 * The always-visible filter input is gone from the chrome; the bar
 * opens on demand (⋯ Options → Search, Cmd/Ctrl+F while the panel owns
 * DOM focus, or the focus-sidebar-filter shortcut) and works in one of
 * two inline-toggleable modes:
 *
 *   - FILTER — the pre-existing semantics: non-matching rows are
 *     hidden and every branch force-expands while a query is live.
 *   - SEARCH — rows stay; matches highlight, the first match is
 *     auto-navigated to, ArrowUp/Down cycle matches while the input
 *     keeps DOM focus, Enter opens the active match, and the input
 *     turns red when nothing matches.
 *
 * Split into two hooks on purpose. `filterText` / `revealAll` must
 * feed the per-section node hooks BEFORE the flat item list they
 * produce exists, so the state machine (`useTreeSearch`) runs first
 * and the match/navigation derivation (`useTreeSearchMatches`) runs
 * after `allFlatItems` is assembled — one module, two phases, no
 * render-order cycle.
 *
 * Match source: `allFlatItems`. In search mode a live query sets
 * `revealAll`, which force-expands every collection/folder branch the
 * same way an active filter does (derived — `expandedKeys` is never
 * written, so closing the bar restores the user's expansion state).
 * Collapsed SECTIONS stay as the user left them: sections are a layout
 * choice the user owns (the Expand All contract), and the filter mode
 * has always respected them the same way.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TreeNode } from './types';

export type TreeSearchMode = 'filter' | 'search';

/** Imperative handle the host registers per sidebar view — the
 *  focus-sidebar-filter shortcut resolves the focused panel's handle
 *  and calls `focus()`, which opens the bar (or re-focuses it). */
export interface SidebarSearchHandle {
  focus: () => void;
}

export interface TreeSearch {
  open: boolean;
  mode: TreeSearchMode;
  query: string;
  /** What the node hooks hide on — the query only in filter mode. */
  filterText: string;
  /** Force-expand signal for the tree hooks — search mode + live query. */
  revealAll: boolean;
  /** What the rows highlight — the query only in search mode. */
  highlightQuery: string;
  /** Monotonic counter — each bump asks the bar to re-focus its input. */
  focusNonce: number;
  openBar: () => void;
  closeBar: () => void;
  setQuery: (q: string) => void;
  setMode: (m: TreeSearchMode) => void;
}

export function useTreeSearch(): TreeSearch {
  const [open, setOpen] = useState(false);
  // Search is the default: the bar is an IDE-style speed search
  // first, with filter as the opt-in second mode. The last picked
  // mode survives close/reopen for the panel's lifetime.
  const [mode, setMode] = useState<TreeSearchMode>('search');
  const [query, setQuery] = useState('');
  const [focusNonce, setFocusNonce] = useState(0);

  const openBar = useCallback(() => {
    setOpen(true);
    setFocusNonce((n) => n + 1);
  }, []);

  const closeBar = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const live = open && query !== '';
  return {
    open,
    mode,
    query,
    filterText: live && mode === 'filter' ? query : '',
    revealAll: live && mode === 'search',
    highlightQuery: live && mode === 'search' ? query : '',
    focusNonce,
    openBar,
    closeBar,
    setQuery,
    setMode,
  };
}

interface UseTreeSearchMatchesParams {
  search: TreeSearch;
  /** Flat, view-scoped item list — every row search can land on. */
  allFlatItems: TreeNode[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Keeps the tree cursor on the active match so Esc resumes there. */
  setFocusedId: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface TreeSearchMatches {
  matchIds: string[];
  activeIndex: number;
  activeMatchId: string | null;
  goNext: () => void;
  goPrev: () => void;
  /** Enter — opens the active match's entity. Returns whether it did. */
  openActive: () => boolean;
}

export function useTreeSearchMatches({
  search,
  allFlatItems,
  containerRef,
  setFocusedId,
}: UseTreeSearchMatchesParams): TreeSearchMatches {
  const [activeIndex, setActiveIndex] = useState(0);

  const matchIds = useMemo(() => {
    if (!search.open || search.mode !== 'search' || search.query === '') return [];
    const q = search.query.toLowerCase();
    const ids: string[] = [];
    for (const n of allFlatItems) {
      if (n.kind === 'placeholder') continue;
      if (n.label.toLowerCase().includes(q)) ids.push(n.id);
    }
    return ids;
  }, [search.open, search.mode, search.query, allFlatItems]);

  const revealMatch = useCallback(
    (id: string) => {
      setFocusedId(id);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 0);
    },
    [containerRef, setFocusedId],
  );

  // Auto-navigate: a query change lands on the FIRST match. Keyed on
  // the id list itself (not its length) so a same-count result set for
  // a different query still resets. Item-identity churn alone (tree
  // re-renders while the query is idle) keeps the active slot.
  const matchKey = matchIds.join(' ');
  // Starts '' (not the current key) so a hook mounting with a live
  // query still lands on its first match.
  const lastKeyRef = useRef('');
  useEffect(() => {
    if (lastKeyRef.current === matchKey) return;
    lastKeyRef.current = matchKey;
    setActiveIndex(0);
    const first = matchIds[0];
    if (first) revealMatch(first);
  }, [matchKey, matchIds, revealMatch]);

  const step = useCallback(
    (delta: 1 | -1) => {
      if (matchIds.length === 0) return;
      setActiveIndex((prev) => {
        const next = (prev + delta + matchIds.length) % matchIds.length;
        const id = matchIds[next];
        if (id) revealMatch(id);
        return next;
      });
    },
    [matchIds, revealMatch],
  );

  const goNext = useCallback(() => step(1), [step]);
  const goPrev = useCallback(() => step(-1), [step]);

  const activeMatchId = matchIds.length > 0 ? (matchIds[Math.min(activeIndex, matchIds.length - 1)] ?? null) : null;

  const openActive = useCallback(() => {
    if (!activeMatchId) return false;
    const node = allFlatItems.find((n) => n.id === activeMatchId);
    if (!node?.onOpen) return false;
    node.onOpen();
    return true;
  }, [activeMatchId, allFlatItems]);

  return { matchIds, activeIndex, activeMatchId, goNext, goPrev, openActive };
}
