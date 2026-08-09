/**
 * git-panel-view-store — the Git tool window's tab REGISTRY (the
 * terminal-instance analog): per workspace, the flat list of tab
 * identities — log tabs with their scope/filter/selection/rail state,
 * plus the read-only console tab — and the active tab. WHERE each tab
 * lives (splits, per-leaf order, focus) is the shared pane-tabs
 * store's business: {@link getGitPanelWorkbench} binds one pane store
 * per workspace to this registry, the exact terminal wiring.
 *
 * Module-state posture: the dock unmounts inactive tool windows, and
 * both identities and layout must survive a hide/show round-trip.
 * Session-scoped by design — no persisted storage (tabs are cheap
 * scoped views; an app restart starts clean, the IDE posture).
 *
 * The PRIMARY log tab (`log:1`) is permanent: `closeTabs` skips it, so
 * every leaf fold converges back to a panel that still shows the log.
 * It moves and splits freely like any tab — it just never closes.
 */

import { createPaneTabsStore, type PaneTabsRegistry, type WorkbenchPaneTabs } from '../pane-tabs/pane-tabs-store';

/** One log tab's view state — scope, filter, selection, and rail
 *  visibility travel with the tab. */
export interface GitLogTabState {
  kind: 'log';
  id: number;
  selectedRef: string | null;
  filter: string;
  selectedSha: string | null;
  refsCollapsed: boolean;
}

export interface GitConsoleTabState {
  kind: 'console';
}

export type GitPanelTab = GitLogTabState | GitConsoleTabState;

export const GIT_CONSOLE_TAB_KEY = 'console';
export const GIT_PRIMARY_TAB_KEY = 'log:1';

/** Stable registry/strip key of a tab. */
export function gitPanelTabKey(tab: GitPanelTab): string {
  return tab.kind === 'console' ? GIT_CONSOLE_TAB_KEY : `log:${tab.id}`;
}

/** The pane-tabs registry contract plus the git-specific verbs. */
export interface GitPanelTabsRegistry extends PaneTabsRegistry {
  /** Full tab identities in persisted order (labels + view state). */
  tabs(): readonly GitPanelTab[];
  getLogTab(key: string): GitLogTabState | null;
  /** Add a fresh HEAD-scoped log tab and activate it. */
  newLogTab(): void;
  /** Add the console tab if absent, then activate it. */
  openConsole(): void;
  /** Close tabs by key — the primary log tab is silently skipped. */
  closeTabs(keys: readonly string[]): void;
  patchLogTab(key: string, patch: Partial<Omit<GitLogTabState, 'kind' | 'id'>>): void;
}

export interface GitPanelWorkbench {
  registry: GitPanelTabsRegistry;
  panes: WorkbenchPaneTabs;
}

interface RegistryState {
  tabs: GitPanelTab[];
  activeId: string;
  nextTabId: number;
  listeners: Set<() => void>;
}

function makeLogTab(id: number): GitLogTabState {
  return { kind: 'log', id, selectedRef: null, filter: '', selectedSha: null, refsCollapsed: false };
}

function createRegistry(): GitPanelTabsRegistry {
  const state: RegistryState = {
    tabs: [makeLogTab(1)],
    activeId: GIT_PRIMARY_TAB_KEY,
    nextTabId: 2,
    listeners: new Set(),
  };
  const notify = (): void => {
    for (const listener of state.listeners) listener();
  };

  return {
    list: () => state.tabs.map((tab) => ({ id: gitPanelTabKey(tab) })),
    activeId: () => state.activeId,
    activateTab: (id) => {
      if (state.activeId === id || !state.tabs.some((tab) => gitPanelTabKey(tab) === id)) return;
      state.activeId = id;
      notify();
    },
    setOrder: (ids) => {
      const byKey = new Map(state.tabs.map((tab) => [gitPanelTabKey(tab), tab]));
      const next: GitPanelTab[] = [];
      for (const id of ids) {
        const tab = byKey.get(id);
        if (tab !== undefined) {
          next.push(tab);
          byKey.delete(id);
        }
      }
      next.push(...byKey.values());
      if (next.length === state.tabs.length && next.every((tab, i) => tab === state.tabs[i])) return;
      state.tabs = next;
      notify();
    },
    onTabsChange: (listener) => {
      state.listeners.add(listener);
      return () => {
        state.listeners.delete(listener);
      };
    },

    tabs: () => state.tabs,
    getLogTab: (key) => {
      for (const tab of state.tabs) {
        if (tab.kind === 'log' && gitPanelTabKey(tab) === key) return tab;
      }
      return null;
    },
    newLogTab: () => {
      const tab = makeLogTab(state.nextTabId);
      state.nextTabId += 1;
      state.tabs = [...state.tabs, tab];
      state.activeId = gitPanelTabKey(tab);
      notify();
    },
    openConsole: () => {
      if (!state.tabs.some((tab) => tab.kind === 'console')) {
        state.tabs = [...state.tabs, { kind: 'console' }];
      }
      state.activeId = GIT_CONSOLE_TAB_KEY;
      notify();
    },
    closeTabs: (keys) => {
      const closing = new Set(keys);
      closing.delete(GIT_PRIMARY_TAB_KEY);
      if (closing.size === 0) return;
      const next = state.tabs.filter((tab) => !closing.has(gitPanelTabKey(tab)));
      if (next.length === state.tabs.length) return;
      state.tabs = next;
      // A dead active id falls back to the primary; on structural
      // removals the pane store overrules with the in-leaf neighbor.
      if (!next.some((tab) => gitPanelTabKey(tab) === state.activeId)) state.activeId = GIT_PRIMARY_TAB_KEY;
      notify();
    },
    patchLogTab: (key, patch) => {
      let changed = false;
      const next = state.tabs.map((tab) => {
        if (tab.kind !== 'log' || gitPanelTabKey(tab) !== key) return tab;
        changed = true;
        return { ...tab, ...patch };
      });
      if (!changed) return;
      state.tabs = next;
      notify();
    },
  };
}

const workbenches = new Map<string, GitPanelWorkbench>();

/** The per-workspace registry + pane store pair (created on first use,
 *  module-cached — layout and tabs survive dock switches). */
export function getGitPanelWorkbench(workspaceId: string): GitPanelWorkbench {
  let workbench = workbenches.get(workspaceId);
  if (workbench === undefined) {
    const registry = createRegistry();
    workbench = { registry, panes: createPaneTabsStore(registry) };
    workbenches.set(workspaceId, workbench);
  }
  return workbench;
}
