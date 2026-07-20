/**
 * useWorkspaceLayout — authoritative state machine for the rules page shell.
 *
 * Replaces the old `PanelVisibility` booleans with a richer model that
 * separates "which icon is active on which activity bar" from "which pane
 * is currently showing":
 *
 *   - leftPanel:  LeftPanelKey  | null   top-group left icon / null = collapsed
 *   - rightPanel: RightPanelKey | null   right icon / null = collapsed
 *   - bottomOpen: boolean                 bottom Allotment pane visibility
 *   - bottomTab:  string                  active tab inside the bottom pane
 *   - focusedRegion: which region owns focus (drives blue accent)
 *   - activityBarLabels: whether icons render labels
 *
 * Dockable tool-window semantics — left activity bar splits into two groups:
 *   - Top group (items, recordings…) drives the left Allotment pane.
 *   - Bottom group is a set of launchers to specific bottomTab values;
 *     clicking swaps bottomTab AND forces bottomOpen=true. A second
 *     click on the active launcher closes the bottom pane.
 *
 * Right activity bar has one group; all right panels share the right pane.
 *
 * Persistence: handled by useResponsiveLayout, which owns the chrome.storage
 * slot and calls this hook's `onPersist` with the pieces it persists.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FocusRegion, LeftPanelKey, RightPanelKey, WorkspaceLayout } from '../types';

// ── Bottom-tab key used by the left-bottom activity launcher ──────
//
// Kept in sync with BottomPanel's tab definitions. String-typed so new
// launcher targets can be added here without touching the BottomPanel
// component — the component is free to accept unknown keys and fall
// back to its default tab.

export const BOTTOM_TAB_INSPECTION = 'inspection';

/** Map from a left-bottom activity-bar key to its bottom-tab target. */
export const LEFT_BOTTOM_LAUNCHERS: Partial<Record<LeftPanelKey, string>> = {};

// ── Initial layout ─────────────────────────────────────────────────

export const DEFAULT_LAYOUT: WorkspaceLayout = {
  leftPanel: 'http-rules',
  rightPanel: null,
  bottomOpen: false,
  focusedRegion: null,
  activityBarLabels: true,
};

/** Bottom-pane state not stored on WorkspaceLayout (it's tab-internal). */
export interface BottomPaneState {
  tab: string;
}

// ── Hook API ───────────────────────────────────────────────────────

export interface UseWorkspaceLayoutOptions {
  /** Initial layout overrides (typically from persisted storage). */
  initial?: Partial<WorkspaceLayout>;
  /** Initial bottom-pane tab override. */
  initialBottomTab?: string;
  /** Called after every layout change so the host can persist. */
  onPersist?: (layout: WorkspaceLayout, bottom: BottomPaneState) => void;
}

export interface WorkspaceLayoutApi {
  layout: WorkspaceLayout;
  bottomTab: string;

  // ── Left top group (drives left Allotment pane) ────────────────

  /** Toggle the given top-group key. Clicking the active key collapses. */
  toggleLeftPanel: (key: LeftPanelKey) => void;
  /** Directly set the left panel (null to collapse). */
  setLeftPanel: (key: LeftPanelKey | null) => void;

  // ── Left bottom group (launchers into the bottom Allotment pane) ─

  /**
   * Activate a left-bottom launcher. Opens the bottom pane and switches
   * its tab. Clicking the already-active launcher closes the pane.
   */
  activateBottomLauncher: (key: LeftPanelKey) => void;

  // ── Right group (drives right Allotment pane) ─────────────────

  toggleRightPanel: (key: RightPanelKey) => void;
  setRightPanel: (key: RightPanelKey | null) => void;

  // ── Bottom pane raw ───────────────────────────────────────────

  setBottomOpen: (open: boolean) => void;
  setBottomTab: (tab: string) => void;
  /** Open bottom pane and switch to the given tab in one call. */
  openBottomTab: (tab: string) => void;

  // ── Focus ─────────────────────────────────────────────────────

  setFocusedRegion: (region: FocusRegion) => void;

  // ── Activity bar labels (icons-only mode) ─────────────────────

  toggleActivityBarLabels: () => void;
  setActivityBarLabels: (visible: boolean) => void;

  // ── Derived helpers ───────────────────────────────────────────

  /** True when the activity-bar icon for `key` should render as active. */
  isIconActive: (key: LeftPanelKey | RightPanelKey) => boolean;
  /** True when the given region's panel is currently rendering on screen. */
  isRegionOpen: (region: 'left' | 'right' | 'bottom') => boolean;
}

// ── Implementation ─────────────────────────────────────────────────

export function useWorkspaceLayout({
  initial,
  initialBottomTab = BOTTOM_TAB_INSPECTION,
  onPersist,
}: UseWorkspaceLayoutOptions = {}): WorkspaceLayoutApi {
  const [layout, setLayoutState] = useState<WorkspaceLayout>(() => ({
    ...DEFAULT_LAYOUT,
    ...(initial ?? {}),
  }));
  const [bottomTab, setBottomTabState] = useState<string>(initialBottomTab);

  // Ref-captured persist so the effect stays stable.
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;

  useEffect(() => {
    persistRef.current?.(layout, { tab: bottomTab });
  }, [layout, bottomTab]);

  const patch = useCallback((next: Partial<WorkspaceLayout> | ((prev: WorkspaceLayout) => WorkspaceLayout)) => {
    setLayoutState((prev) => (typeof next === 'function' ? next(prev) : { ...prev, ...next }));
  }, []);

  // ── Left top group ──────────────────────────────────────────────

  const toggleLeftPanel = useCallback(
    (key: LeftPanelKey) => {
      patch((prev) => ({ ...prev, leftPanel: prev.leftPanel === key ? null : key }));
    },
    [patch],
  );

  const setLeftPanel = useCallback(
    (key: LeftPanelKey | null) => {
      patch({ leftPanel: key });
    },
    [patch],
  );

  // ── Right group ─────────────────────────────────────────────────

  const toggleRightPanel = useCallback(
    (key: RightPanelKey) => {
      patch((prev) => ({ ...prev, rightPanel: prev.rightPanel === key ? null : key }));
    },
    [patch],
  );

  const setRightPanel = useCallback(
    (key: RightPanelKey | null) => {
      patch({ rightPanel: key });
    },
    [patch],
  );

  // ── Bottom pane ─────────────────────────────────────────────────

  const setBottomOpen = useCallback(
    (open: boolean) => {
      patch({ bottomOpen: open });
    },
    [patch],
  );

  const setBottomTab = useCallback((tab: string) => {
    setBottomTabState(tab);
  }, []);

  const openBottomTab = useCallback(
    (tab: string) => {
      setBottomTabState(tab);
      patch({ bottomOpen: true });
    },
    [patch],
  );

  // ── Left-bottom launcher ────────────────────────────────────────

  const activateBottomLauncher = useCallback(
    (key: LeftPanelKey) => {
      const target = LEFT_BOTTOM_LAUNCHERS[key];
      if (!target) return;
      setLayoutState((prev) => {
        const isAlreadyActive = prev.bottomOpen && bottomTab === target;
        if (isAlreadyActive) {
          return { ...prev, bottomOpen: false };
        }
        return { ...prev, bottomOpen: true };
      });
      setBottomTabState(target);
    },
    [bottomTab],
  );

  // ── Focus ───────────────────────────────────────────────────────

  const setFocusedRegion = useCallback(
    (region: FocusRegion) => {
      patch((prev) => (prev.focusedRegion === region ? prev : { ...prev, focusedRegion: region }));
    },
    [patch],
  );

  // ── Activity bar labels ─────────────────────────────────────────

  const toggleActivityBarLabels = useCallback(() => {
    patch((prev) => ({ ...prev, activityBarLabels: !prev.activityBarLabels }));
  }, [patch]);

  const setActivityBarLabels = useCallback(
    (visible: boolean) => {
      patch({ activityBarLabels: visible });
    },
    [patch],
  );

  // ── Derived ─────────────────────────────────────────────────────

  const isIconActive = useCallback(
    (key: LeftPanelKey | RightPanelKey): boolean => {
      // Right panel keys
      if (key === 'docs' || key === 'var-scope') {
        return layout.rightPanel === key;
      }
      // Left bottom launchers: active only while bottom is open on their tab
      const launcherTab = LEFT_BOTTOM_LAUNCHERS[key];
      if (launcherTab) {
        return layout.bottomOpen && bottomTab === launcherTab;
      }
      // Left top panels
      return layout.leftPanel === key;
    },
    [layout, bottomTab],
  );

  const isRegionOpen = useCallback(
    (region: 'left' | 'right' | 'bottom'): boolean => {
      if (region === 'left') return layout.leftPanel !== null;
      if (region === 'right') return layout.rightPanel !== null;
      return layout.bottomOpen;
    },
    [layout],
  );

  return useMemo(
    () => ({
      layout,
      bottomTab,
      toggleLeftPanel,
      setLeftPanel,
      activateBottomLauncher,
      toggleRightPanel,
      setRightPanel,
      setBottomOpen,
      setBottomTab,
      openBottomTab,
      setFocusedRegion,
      toggleActivityBarLabels,
      setActivityBarLabels,
      isIconActive,
      isRegionOpen,
    }),
    [
      layout,
      bottomTab,
      toggleLeftPanel,
      setLeftPanel,
      activateBottomLauncher,
      toggleRightPanel,
      setRightPanel,
      setBottomOpen,
      setBottomTab,
      openBottomTab,
      setFocusedRegion,
      toggleActivityBarLabels,
      setActivityBarLabels,
      isIconActive,
      isRegionOpen,
    ],
  );
}
