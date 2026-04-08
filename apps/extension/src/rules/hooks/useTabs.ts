/**
 * useTabs — core tab state for the workspace.html IDE shell.
 *
 * Owns: tabs[], activeTabId, recentlyClosed[], dirtyMap, saveRefMap.
 * All tab mutations go through this hook. The companion useTabLifecycle
 * hook wraps closeTab with dirty-confirmation logic.
 */

import { useCallback, useRef, useState } from 'react';
import type { ClosedTab, RulesTab } from '../types';

const MAX_RECENTLY_CLOSED = 20;

/** Modes that should NOT be tracked in recently-closed. */
const SKIP_RECENTLY_CLOSED: Set<string> = new Set(['create', 'collection-overview', 'folder-overview']);

export function useTabs() {
  const [tabs, setTabs] = useState<RulesTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [recentlyClosed, setRecentlyClosed] = useState<ClosedTab[]>([]);

  const dirtyMap = useRef<Map<string, boolean>>(new Map());
  const saveRefMap = useRef<Map<string, () => void>>(new Map());

  // ── Add / open ──────────────────────────────────────────────────

  const addTab = useCallback((tab: RulesTab) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === tab.id);
      if (existing) return prev; // already open
      return [...prev, tab];
    });
    setActiveTabId(tab.id);
    // Remove from recently closed if reopened
    setRecentlyClosed((prev) => prev.filter((c) => c.tab.id !== tab.id));
  }, []);

  // ── Close ───────────────────────────────────────────────────────

  const closeTab = useCallback((tabId: string, force = false) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx === -1) return prev;

      const tab = prev[idx];

      // If dirty and not forced, skip (lifecycle hook handles confirmation)
      if (!force && (tab.dirty || tab.mode === 'create')) return prev;

      // Track in recently closed (skip drafts/overviews)
      if (!SKIP_RECENTLY_CLOSED.has(tab.mode)) {
        setRecentlyClosed((rc) =>
          [{ tab, closedAt: Date.now() }, ...rc.filter((c) => c.tab.id !== tabId)].slice(0, MAX_RECENTLY_CLOSED),
        );
      }

      // Clean up refs
      dirtyMap.current.delete(tabId);
      saveRefMap.current.delete(tabId);

      const next = prev.filter((t) => t.id !== tabId);

      // Select adjacent tab
      setActiveTabId((currentActive) => {
        if (currentActive !== tabId) return currentActive;
        if (next.length === 0) return null;
        return next[Math.min(idx, next.length - 1)].id;
      });

      return next;
    });
  }, []);

  // ── Switch ──────────────────────────────────────────────────────

  const switchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // ── Update (patch in place) ─────────────────────────────────────

  const updateTab = useCallback((tabId: string, updates: Partial<RulesTab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t)));
  }, []);

  // ── Replace (draft → edit transition) ───────────────────────────

  const replaceTab = useCallback((oldId: string, newTab: RulesTab) => {
    dirtyMap.current.delete(oldId);
    saveRefMap.current.delete(oldId);
    setTabs((prev) => prev.map((t) => (t.id === oldId ? newTab : t)));
    setActiveTabId((current) => (current === oldId ? newTab.id : current));
  }, []);

  // ── Reorder (drag-and-drop) ─────────────────────────────────────

  const reorderTab = useCallback((fromId: string, toId: string, side: 'left' | 'right') => {
    setTabs((prev) => {
      const fromIdx = prev.findIndex((t) => t.id === fromId);
      const toIdx = prev.findIndex((t) => t.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      const insertIdx = next.findIndex((t) => t.id === toId);
      next.splice(side === 'left' ? insertIdx : insertIdx + 1, 0, moved);
      return next;
    });
  }, []);

  // ── Batch close helpers ─────────────────────────────────────────
  // These are "raw" closes used by useTabLifecycle after confirmation.

  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs((prev) => {
      const keep = prev.filter((t) => t.id === tabId);
      for (const t of prev) {
        if (t.id !== tabId) {
          dirtyMap.current.delete(t.id);
          saveRefMap.current.delete(t.id);
        }
      }
      if (keep.length > 0) setActiveTabId(keep[0].id);
      else setActiveTabId(null);
      return keep;
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    dirtyMap.current.clear();
    saveRefMap.current.clear();
  }, []);

  const closeUnmodifiedTabs = useCallback(() => {
    setTabs((prev) => {
      const keep = prev.filter((t) => t.dirty || t.mode === 'create');
      for (const t of prev) {
        if (!t.dirty && t.mode !== 'create') {
          dirtyMap.current.delete(t.id);
          saveRefMap.current.delete(t.id);
        }
      }
      setActiveTabId((current) => {
        if (keep.find((t) => t.id === current)) return current;
        return keep.length > 0 ? keep[0].id : null;
      });
      return keep;
    });
  }, []);

  const closeTabsToLeft = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx <= 0) return prev;
      const removed = prev.slice(0, idx);
      for (const t of removed) {
        dirtyMap.current.delete(t.id);
        saveRefMap.current.delete(t.id);
      }
      const keep = prev.slice(idx);
      setActiveTabId((current) => {
        if (keep.find((t) => t.id === current)) return current;
        return keep[0]?.id ?? null;
      });
      return keep;
    });
  }, []);

  const closeTabsToRight = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const removed = prev.slice(idx + 1);
      for (const t of removed) {
        dirtyMap.current.delete(t.id);
        saveRefMap.current.delete(t.id);
      }
      const keep = prev.slice(0, idx + 1);
      setActiveTabId((current) => {
        if (keep.find((t) => t.id === current)) return current;
        return keep[keep.length - 1]?.id ?? null;
      });
      return keep;
    });
  }, []);

  // ── Reopen from recently closed ────────────────────────────────

  const reopenTab = useCallback(
    (closed: ClosedTab) => {
      addTab(closed.tab);
    },
    [addTab],
  );

  return {
    tabs,
    activeTabId,
    recentlyClosed,
    dirtyMap,
    saveRefMap,
    addTab,
    closeTab,
    switchTab,
    updateTab,
    replaceTab,
    reorderTab,
    closeOtherTabs,
    closeAllTabs,
    closeUnmodifiedTabs,
    closeTabsToLeft,
    closeTabsToRight,
    reopenTab,
  };
}
