/**
 * Module-level owner of the workbench terminal tabs — every xterm
 * instance and its pty session live HERE, not in the panel component.
 * The dock unmounts inactive tool-window bodies, and a terminal must
 * survive tab switches and region collapses with its shell (and
 * scrollback) intact; the panel only attaches the active tab's DOM
 * element while visible and detaches on unmount. Each tab is its own
 * terminal + pty pair; background tabs keep receiving output into
 * their buffers while detached. The ptys themselves die with the app
 * window (the main-process host sweeps sessions on webContents
 * destroy).
 *
 * Host access rides the `terminal` capability — on hosts without it
 * (every browser surface) `getWorkbenchTerminalTabs()` returns null,
 * and the tool window never exists anyway (registry
 * `requiresCapability`).
 */

import { getCapability, type TerminalSession } from '@openheaders/core/capabilities';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { type ITheme, Terminal } from '@xterm/xterm';

export interface WorkbenchTerminal {
  readonly term: Terminal;
  readonly fit: FitAddon;
  /** True when the shell exited and no session is live. */
  isExited(): boolean;
  /** Listener fires on every live↔exited transition. */
  onExitChange(listener: () => void): () => void;
  /** Spawn the shell if none is live; no-op while one runs or spawns. */
  ensureSession(): Promise<void>;
  /** Refit to the container and propagate the size to the pty. */
  syncSize(): void;
  /** Attach the GPU renderer once the terminal is opened in a container. */
  ensureRenderer(): void;
}

export interface TerminalTabInfo {
  readonly id: string;
  /** 1-based title suffix — the lowest number free at creation, so a
   *  closed tab's number is reused ("Local", "Local (2)", …). */
  readonly titleIndex: number;
}

export interface WorkbenchTerminalTabs {
  list(): TerminalTabInfo[];
  activeId(): string | null;
  getTab(id: string): WorkbenchTerminal | null;
  /** Create a tab (no pty yet — the panel spawns on attach) and make it
   *  active. Returns the new tab's id. */
  createTab(): string;
  activateTab(id: string): void;
  /** Kill the tab's pty, dispose its terminal, and activate a
   *  neighbor. Closing the last tab leaves the list empty. */
  closeTab(id: string): void;
  /** Fires on create, close, and activation change. */
  onTabsChange(listener: () => void): () => void;
  /** Apply the antd-derived theme to every tab, current and future. */
  setTheme(theme: ITheme): void;
}

interface TabState {
  id: string;
  titleIndex: number;
  term: Terminal;
  fit: FitAddon;
  session: TerminalSession | null;
  sessionCleanups: Array<() => void>;
  exited: boolean;
  spawning: boolean;
  everSpawned: boolean;
  exitListeners: Set<() => void>;
  sentCols: number;
  sentRows: number;
  webgl: WebglAddon | null;
  webglFailed: boolean;
  api: WorkbenchTerminal;
}

interface RegistryState {
  tabs: TabState[];
  activeId: string | null;
  nextTabSeq: number;
  changeListeners: Set<() => void>;
  theme: ITheme | undefined;
  api: WorkbenchTerminalTabs;
}

let registry: RegistryState | null = null;

function notifyTabsChange(state: RegistryState): void {
  for (const listener of state.changeListeners) listener();
}

function notifyExitChange(tab: TabState): void {
  for (const listener of tab.exitListeners) listener();
}

async function ensureSession(tab: TabState): Promise<void> {
  if (tab.session || tab.spawning) return;
  const host = getCapability('terminal');
  if (!host) return;
  tab.spawning = true;
  try {
    // A relaunch after exit starts from a clean screen — stale output
    // from the dead shell reads as live state otherwise.
    if (tab.everSpawned) tab.term.reset();
    const session = await host().spawn({ cols: tab.term.cols, rows: tab.term.rows });
    tab.everSpawned = true;
    tab.session = session;
    tab.exited = false;
    // The pane may have refit while the spawn was in flight (resizes
    // against a null session are dropped) — true the pty up to the
    // terminal's current grid or full-screen programs draw at spawn size.
    tab.sentCols = tab.term.cols;
    tab.sentRows = tab.term.rows;
    session.resize(tab.term.cols, tab.term.rows);
    tab.sessionCleanups = [
      session.onData((data) => tab.term.write(data)),
      session.onExit(() => {
        for (const cleanup of tab.sessionCleanups) cleanup();
        tab.sessionCleanups = [];
        tab.session = null;
        tab.exited = true;
        notifyExitChange(tab);
      }),
    ];
    notifyExitChange(tab);
  } catch {
    tab.exited = true;
    notifyExitChange(tab);
  } finally {
    tab.spawning = false;
  }
}

function syncSize(tab: TabState): void {
  if (!tab.term.element) return;
  try {
    tab.fit.fit();
  } catch {
    return;
  }
  // A sash drag fires resize per mouse move; tell the pty only when the
  // grid actually changed so the shell isn't stormed with SIGWINCH
  // (each one repaints the whole screen — the drag reads as text churn).
  if (tab.term.cols === tab.sentCols && tab.term.rows === tab.sentRows) return;
  if (tab.session) {
    tab.sentCols = tab.term.cols;
    tab.sentRows = tab.term.rows;
    tab.session.resize(tab.term.cols, tab.term.rows);
  }
}

function ensureRenderer(tab: TabState): void {
  if (tab.webgl || tab.webglFailed || !tab.term.element) return;
  // GPU rendering keeps resize storms (sash drags) repainting at frame
  // rate — the DOM renderer re-lays-out every cell and visibly lags.
  try {
    const addon = new WebglAddon();
    addon.onContextLoss(() => {
      addon.dispose();
      tab.webgl = null;
      tab.webglFailed = true;
    });
    tab.term.loadAddon(addon);
    tab.webgl = addon;
  } catch {
    tab.webglFailed = true;
  }
}

function lowestFreeTitleIndex(state: RegistryState): number {
  const used = new Set(state.tabs.map((tab) => tab.titleIndex));
  let index = 1;
  while (used.has(index)) index++;
  return index;
}

function createTab(state: RegistryState): string {
  const term = new Terminal({
    cursorBlink: true,
    scrollback: 5000,
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    theme: state.theme,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);

  const tab: TabState = {
    id: `tab-${state.nextTabSeq++}`,
    titleIndex: lowestFreeTitleIndex(state),
    term,
    fit,
    session: null,
    sessionCleanups: [],
    exited: false,
    spawning: false,
    everSpawned: false,
    exitListeners: new Set(),
    sentCols: 0,
    sentRows: 0,
    webgl: null,
    webglFailed: false,
    api: {
      term,
      fit,
      isExited: () => tab.exited,
      onExitChange: (listener) => {
        tab.exitListeners.add(listener);
        return () => {
          tab.exitListeners.delete(listener);
        };
      },
      ensureSession: () => ensureSession(tab),
      syncSize: () => syncSize(tab),
      ensureRenderer: () => ensureRenderer(tab),
    },
  };
  term.onData((data) => tab.session?.write(data));
  state.tabs.push(tab);
  state.activeId = tab.id;
  notifyTabsChange(state);
  return tab.id;
}

function closeTab(state: RegistryState, id: string): void {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;
  const [tab] = state.tabs.splice(index, 1);
  for (const cleanup of tab.sessionCleanups) cleanup();
  tab.sessionCleanups = [];
  tab.session?.dispose();
  tab.session = null;
  // Disposing the terminal tears down its addons (fit, webgl) and
  // removes its element from wherever the panel attached it.
  tab.term.dispose();
  if (state.activeId === id) {
    const neighbor = state.tabs[index] ?? state.tabs[index - 1] ?? null;
    state.activeId = neighbor ? neighbor.id : null;
  }
  notifyTabsChange(state);
}

/**
 * The singleton workbench terminal tab registry, created on first
 * call. Null on hosts without the `terminal` capability.
 */
export function getWorkbenchTerminalTabs(): WorkbenchTerminalTabs | null {
  if (!getCapability('terminal')) return null;
  if (registry) return registry.api;

  const state: RegistryState = {
    tabs: [],
    activeId: null,
    nextTabSeq: 1,
    changeListeners: new Set(),
    theme: undefined,
    api: {
      list: () => state.tabs.map((tab) => ({ id: tab.id, titleIndex: tab.titleIndex })),
      activeId: () => state.activeId,
      getTab: (id) => state.tabs.find((tab) => tab.id === id)?.api ?? null,
      createTab: () => createTab(state),
      activateTab: (id) => {
        if (state.activeId === id || !state.tabs.some((tab) => tab.id === id)) return;
        state.activeId = id;
        notifyTabsChange(state);
      },
      closeTab: (id) => closeTab(state, id),
      onTabsChange: (listener) => {
        state.changeListeners.add(listener);
        return () => {
          state.changeListeners.delete(listener);
        };
      },
      setTheme: (theme) => {
        state.theme = theme;
        for (const tab of state.tabs) tab.term.options.theme = theme;
      },
    },
  };
  registry = state;
  return state.api;
}
