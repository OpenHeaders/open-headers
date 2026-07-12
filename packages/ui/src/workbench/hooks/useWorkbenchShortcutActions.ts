/**
 * useWorkbenchShortcutActions — the bound keyboard / command handlers the
 * command palette and the global shortcut registry invoke. Region cycling
 * and panel toggles drive the tool-layout state machine; save / tab-nav /
 * close act on the focused leaf; show-shortcuts drives the docs panel; and
 * the +create menu opener shares its "open + focus first item" behavior
 * across the palette item and the ⌥N shortcut.
 *
 * Pure `useCallback` cluster — no JSX. The two consumer hooks
 * (`useCommandPaletteData`, `useWorkspaceShortcuts`) stay at the call site
 * in `WorkbenchContent`; they are wide option bags fed the handlers this
 * hook returns.
 */

import { focusFirstDropdownItem } from '@openheaders/ui/shared/focus-dropdown-item';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import { getFocusedRegion } from '../stores/focus-region-store';
import type { UseEditorGroupsApi } from './useEditorGroups';
import type { FocusRegionApi } from './useFocusRegion';
import type { InspectorNavContextValue } from './useInspectorNav';
import type { ToolLayoutApi } from './useToolLayout';

interface UseWorkbenchShortcutActionsOptions {
  tl: ToolLayoutApi;
  focus: FocusRegionApi;
  switchTab: UseEditorGroupsApi['switchTab'];
  activeTabId: UseEditorGroupsApi['activeTabId'];
  saveRefMap: UseEditorGroupsApi['saveRefMap'];
  tabs: UseEditorGroupsApi['tabs'];
  openDocs: InspectorNavContextValue['openDocs'];
  docsCurrentSectionRef: InspectorNavContextValue['currentSectionRef'];
  handleCloseTab: (tabId: string) => Promise<void>;
  setCreateMenuOpen: Dispatch<SetStateAction<boolean>>;
}

export interface WorkbenchShortcutActions {
  cycleRegion: (region: 'left' | 'right' | 'bottom' | 'editor') => void;
  togglePanel: (panel: 'sidebar' | 'bottomPanel' | 'inspector') => void;
  handleSave: () => void;
  handlePrevTab: () => void;
  handleNextTab: () => void;
  handleGoToTab: (position: number) => void;
  handleCloseActiveTab: () => void;
  handleShowShortcuts: () => void;
  openCreateMenu: () => void;
}

export function useWorkbenchShortcutActions({
  tl,
  focus,
  switchTab,
  activeTabId,
  saveRefMap,
  tabs,
  openDocs,
  docsCurrentSectionRef,
  handleCloseTab,
  setCreateMenuOpen,
}: UseWorkbenchShortcutActionsOptions): WorkbenchShortcutActions {
  // ── Region cycling — shared semantics for clicks and Alt+1..4 ───
  const cycleRegion = useCallback(
    (region: 'left' | 'right' | 'bottom' | 'editor') => {
      if (region === 'editor') {
        focus.focusRegion('editor');
        return;
      }
      const isFocused = getFocusedRegion() === region;
      const isOpen = tl.isRegionOpen(region);
      if (isOpen && isFocused) {
        tl.toggleRegion(region);
        focus.focusRegion('editor');
        return;
      }
      if (!isOpen) tl.toggleRegion(region);
      focus.focusRegion(region);
    },
    [tl, focus],
  );

  const togglePanel = useCallback(
    (panel: 'sidebar' | 'bottomPanel' | 'inspector') => {
      const region: 'left' | 'right' | 'bottom' =
        panel === 'sidebar' ? 'left' : panel === 'inspector' ? 'right' : 'bottom';
      tl.toggleRegion(region);
    },
    [tl],
  );

  const handleSave = useCallback(() => {
    if (activeTabId) saveRefMap.current.get(activeTabId)?.();
  }, [activeTabId, saveRefMap]);

  // ── Tab navigation for shortcuts ─────────────────────────────
  const handlePrevTab = useCallback(() => {
    if (tabs.length < 2 || !activeTabId) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const prev = idx > 0 ? tabs[idx - 1] : tabs[tabs.length - 1];
    switchTab(prev.id);
  }, [tabs, activeTabId, switchTab]);

  const handleNextTab = useCallback(() => {
    if (tabs.length < 2 || !activeTabId) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const next = idx < tabs.length - 1 ? tabs[idx + 1] : tabs[0];
    switchTab(next.id);
  }, [tabs, activeTabId, switchTab]);

  // Direct tab jump (⌘1..⌘9 on the desktop host). Positions are 1-based;
  // 9 always lands on the last tab regardless of count — the same
  // convention browsers use — so "jump to the end" needs no counting.
  const handleGoToTab = useCallback(
    (position: number) => {
      if (tabs.length === 0) return;
      const target = position === 9 ? tabs[tabs.length - 1] : tabs[position - 1];
      if (target) switchTab(target.id);
    },
    [tabs, switchTab],
  );

  const handleCloseActiveTab = useCallback(() => {
    if (activeTabId) void handleCloseTab(activeTabId);
  }, [activeTabId, handleCloseTab]);

  // Keyboard shortcuts help:
  //   • Docs closed → open and navigate to keyboard-shortcuts.
  //   • Docs open and ALREADY on keyboard-shortcuts → toggle closed
  //     (so the shortcut both shows and hides the cheatsheet when
  //     you're parked on it).
  //   • Docs open on a different section → navigate to keyboard-
  //     shortcuts without closing (don't bury the user's place).
  const handleShowShortcuts = useCallback(() => {
    const docsSlot = tl.dockOf('docs');
    const docsTabActive = docsSlot ? tl.state.docks[docsSlot].active === 'docs' : false;
    const onShortcutsSection = docsCurrentSectionRef.current === 'keyboard-shortcuts';
    if (docsTabActive && onShortcutsSection) {
      tl.toggleWindow('docs');
      return;
    }
    openDocs('keyboard-shortcuts');
  }, [tl, openDocs, docsCurrentSectionRef]);

  // The +create dropdown needs to open from multiple entry points
  // (command palette item, ⌥N shortcut). Share the "open + focus first
  // item" helper so both paths behave identically.
  const openCreateMenu = useCallback(() => {
    setCreateMenuOpen((prev) => {
      if (!prev) focusFirstDropdownItem();
      return !prev;
    });
  }, [setCreateMenuOpen]);

  return {
    cycleRegion,
    togglePanel,
    handleSave,
    handlePrevTab,
    handleNextTab,
    handleGoToTab,
    handleCloseActiveTab,
    handleShowShortcuts,
    openCreateMenu,
  };
}
