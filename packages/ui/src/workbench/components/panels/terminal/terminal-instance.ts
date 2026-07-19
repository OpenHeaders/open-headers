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
 *
 * Tab IDENTITIES (numbered/explicit titles + a titled tab's command)
 * persist across app restarts, gated on the same
 * `general.restoreTabsOnStartup` setting as the editor tab session.
 * Content never persists: a restored tab holds no pty until the panel
 * first attaches it, so restoring N tabs costs no shells up front.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { getCapability, type TerminalSession } from '@openheaders/core/capabilities';
import { hostStorage, type PersistedTerminalTab, UI } from '@openheaders/core/storage';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { type ITheme, Terminal } from '@xterm/xterm';
import { get as getSetting } from '../../../settings/store';

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
  /** True when the shell has a live child process (a command or TUI is
   *  running) — the close affordance confirms before terminating. */
  hasRunningProcess(): Promise<boolean>;
}

export interface TerminalTabInfo {
  readonly id: string;
  /** 1-based title suffix — the lowest number free at creation, so a
   *  closed tab's number is reused ("Local", "Local (2)", …). 0 for
   *  tabs with an explicit title. */
  readonly titleIndex: number;
  /** Explicit label (e.g. the command a tab was opened to run);
   *  overrides the numbered default. */
  readonly title?: string;
}

export interface TerminalTabOptions {
  /** Command typed into the shell (as keystrokes, exactly as a user
   *  would) once the pty spawns — the program never learns it was
   *  launched by the workbench. */
  readonly runCommand?: string;
  /** Explicit tab label instead of the numbered default. */
  readonly title?: string;
}

/** Identity of a closed tab, reopenable from the tab-search dropdown.
 *  Same shape as the persisted identity — a reopened tab starts a
 *  fresh shell exactly like a restored one. */
export type TerminalClosedTab = PersistedTerminalTab;

export interface WorkbenchTerminalTabs {
  list(): TerminalTabInfo[];
  activeId(): string | null;
  getTab(id: string): WorkbenchTerminal | null;
  /** Create a tab (no pty yet — the panel spawns on attach) and make it
   *  active. Returns the new tab's id. */
  createTab(options?: TerminalTabOptions): string;
  activateTab(id: string): void;
  /** Kill the tab's pty, dispose its terminal, and activate a
   *  neighbor. Closing the last tab leaves the list empty. */
  closeTab(id: string): void;
  /** Fires on create, close, and activation change. */
  onTabsChange(listener: () => void): () => void;
  /** Apply the antd-derived theme to every tab, current and future. */
  setTheme(theme: ITheme): void;
  /** Resolves once the persisted tab identities (if any) are restored —
   *  the panel waits on this before auto-creating a first tab. */
  whenReady(): Promise<void>;
  /** Session-only list of closed tab identities, most recent first. */
  recentlyClosed(): readonly TerminalClosedTab[];
  /** Reopen entry `index` of `recentlyClosed()` as a fresh tab (new
   *  shell, new number for untitled tabs) and drop it from the list. */
  reopenClosed(index: number): void;
}

interface TabState {
  id: string;
  titleIndex: number;
  title: string | undefined;
  /** The command this tab was opened to run — retained for restart-
   *  across-app-restarts persistence (pendingCommand clears on spawn). */
  runCommand: string | null;
  pendingCommand: string | null;
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
  /** Closed-tab identities, most recent first, capped — session-only
   *  (a restart restores open tabs, not the closed history). */
  closed: TerminalClosedTab[];
  /** False until the persisted-identity restore settles; mutations
   *  don't write back before then (they'd clobber the stored session
   *  with the pre-restore empty state). */
  hydrated: boolean;
  ready: Promise<void>;
  api: WorkbenchTerminalTabs;
}

let registry: RegistryState | null = null;

/** Bundled terminal face (woff2 shipped via `rules.less` @fontsource
 *  imports); the trailing stack is the OS fallback if the load fails. */
const TERMINAL_FONT_FAMILY =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** JetBrains Mono is drawn for 13px UI rendering — the vendor's own
 *  terminal default. */
const TERMINAL_FONT_SIZE = 13;

let fontReady: Promise<void> | null = null;

/**
 * Resolves once the bundled terminal font is loaded, regular and bold.
 * xterm measures its cell grid when a terminal opens, so opening before
 * the woff2 arrives measures the fallback font and misaligns every
 * glyph until the next refit — the panel awaits this before attaching.
 * Environments without the CSS Font Loading API resolve immediately.
 */
export function whenTerminalFontReady(): Promise<void> {
  if (!fontReady) {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    fontReady = fonts
      ? Promise.all([
          fonts.load(`${TERMINAL_FONT_SIZE}px "JetBrains Mono"`),
          fonts.load(`bold ${TERMINAL_FONT_SIZE}px "JetBrains Mono"`),
        ]).then(
          () => undefined,
          () => undefined,
        )
      : Promise.resolve();
  }
  return fontReady;
}

function notifyTabsChange(state: RegistryState): void {
  persistTabs(state);
  for (const listener of state.changeListeners) listener();
}

function restoreOnStartup(): boolean {
  // The same gate as the editor tab session. The store isn't
  // initialized in unit environments — read as "restore on".
  try {
    return getSetting('general.restoreTabsOnStartup');
  } catch {
    return true;
  }
}

function persistTabs(state: RegistryState): void {
  if (!state.hydrated) return;
  const tabs: PersistedTerminalTab[] = state.tabs.map((tab) => ({
    titleIndex: tab.titleIndex,
    ...(tab.title !== undefined ? { title: tab.title } : {}),
    ...(tab.runCommand !== null ? { runCommand: tab.runCommand } : {}),
  }));
  const activeIndex = Math.max(
    0,
    state.tabs.findIndex((tab) => tab.id === state.activeId),
  );
  // Best-effort — a failed (or adapterless, in unit envs) write only
  // costs restore.
  try {
    void hostStorage.set(UI.terminalTabs, { tabs, activeIndex }).catch(() => {});
  } catch {
    // No host adapter installed.
  }
}

async function hydrate(state: RegistryState): Promise<void> {
  try {
    if (!restoreOnStartup()) return;
    const stored = await hostStorage.get(UI.terminalTabs);
    if (!stored || !Array.isArray(stored.tabs) || stored.tabs.length === 0) return;
    // A tab created before the restore settled (panel opened faster
    // than storage answered) wins — don't merge the stale session in.
    if (state.tabs.length > 0) return;
    for (const persisted of stored.tabs) {
      if (typeof persisted?.titleIndex !== 'number') continue;
      buildTab(state, {
        titleIndex: persisted.titleIndex,
        title: typeof persisted.title === 'string' ? persisted.title : undefined,
        runCommand: typeof persisted.runCommand === 'string' ? persisted.runCommand : null,
      });
    }
    if (state.tabs.length === 0) return;
    const activeIndex = Math.min(Math.max(0, stored.activeIndex ?? 0), state.tabs.length - 1);
    state.activeId = state.tabs[activeIndex].id;
    notifyTabsChange(state);
  } catch {
    // Unreadable session — start empty, exactly like a fresh install.
  } finally {
    state.hydrated = true;
  }
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
    // A tab opened to run a command types it in on first spawn only —
    // a restart after exit hands the user a plain shell.
    if (tab.pendingCommand !== null) {
      session.write(`${tab.pendingCommand}\r`);
      tab.pendingCommand = null;
    }
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
  // Explicitly-titled tabs (titleIndex 0) never show a number, so they
  // don't consume one — "Local" numbering stays dense around them.
  const used = new Set(state.tabs.map((tab) => tab.titleIndex));
  let index = 1;
  while (used.has(index)) index++;
  return index;
}

interface TabInit {
  titleIndex: number;
  title: string | undefined;
  runCommand: string | null;
}

function buildTab(state: RegistryState, init: TabInit): TabState {
  const term = new Terminal({
    cursorBlink: true,
    scrollback: 5000,
    fontSize: TERMINAL_FONT_SIZE,
    fontFamily: TERMINAL_FONT_FAMILY,
    theme: state.theme,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);

  const tab: TabState = {
    id: `tab-${state.nextTabSeq++}`,
    titleIndex: init.titleIndex,
    title: init.title,
    runCommand: init.runCommand,
    pendingCommand: init.runCommand,
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
      hasRunningProcess: async () => {
        if (!tab.session) return false;
        try {
          return await tab.session.hasChildren();
        } catch {
          return false;
        }
      },
    },
  };
  term.onData((data) => tab.session?.write(data));
  state.tabs.push(tab);
  return tab;
}

function createTab(state: RegistryState, options?: TerminalTabOptions): string {
  const tab = buildTab(state, {
    titleIndex: options?.title !== undefined ? 0 : lowestFreeTitleIndex(state),
    title: options?.title,
    runCommand: options?.runCommand ?? null,
  });
  state.activeId = tab.id;
  notifyTabsChange(state);
  return tab.id;
}

const CLOSED_TAB_CAP = 10;

function closeTab(state: RegistryState, id: string): void {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;
  const [tab] = state.tabs.splice(index, 1);
  state.closed.unshift({
    titleIndex: tab.titleIndex,
    ...(tab.title !== undefined ? { title: tab.title } : {}),
    ...(tab.runCommand !== null ? { runCommand: tab.runCommand } : {}),
  });
  if (state.closed.length > CLOSED_TAB_CAP) state.closed.length = CLOSED_TAB_CAP;
  for (const cleanup of tab.sessionCleanups) cleanup();
  tab.sessionCleanups = [];
  // Teardown is exception-isolated: whatever a disposer throws, the
  // registry must still converge and notify — otherwise the strip
  // keeps rendering a tab that no longer exists.
  try {
    tab.session?.dispose();
  } catch (error) {
    console.error('terminal tab close: pty dispose failed', error);
  }
  tab.session = null;
  // The WebGL addon goes first, while the terminal is still live: its
  // dispose swaps a fallback renderer onto the render service, which
  // needs an undisposed core (disposing the terminal first hands the
  // addon a dead core mid-teardown).
  try {
    tab.webgl?.dispose();
  } catch (error) {
    console.error('terminal tab close: renderer dispose failed', error);
  }
  tab.webgl = null;
  // Disposing the terminal tears down its remaining addons (fit) and
  // removes its element from wherever the panel attached it.
  try {
    tab.term.dispose();
  } catch (error) {
    console.error('terminal tab close: terminal dispose failed', error);
  }
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
    closed: [],
    hydrated: false,
    ready: Promise.resolve(),
    api: {
      list: () => state.tabs.map((tab) => ({ id: tab.id, titleIndex: tab.titleIndex, title: tab.title })),
      activeId: () => state.activeId,
      getTab: (id) => state.tabs.find((tab) => tab.id === id)?.api ?? null,
      createTab: (options) => createTab(state, options),
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
      whenReady: () => state.ready,
      recentlyClosed: () => state.closed,
      reopenClosed: (index) => {
        const closed = state.closed[index];
        if (!closed) return;
        state.closed.splice(index, 1);
        createTab(
          state,
          closed.title !== undefined ? { title: closed.title, runCommand: closed.runCommand } : undefined,
        );
      },
    },
  };
  state.ready = hydrate(state);
  // The tray-resident window hides on close instead of dying, so this
  // module survives what the user experiences as quitting the app. The
  // recently-closed ring is session-scoped — reset it at that boundary.
  try {
    hostBridge.subscribe('windowHiddenToTray', () => {
      if (state.closed.length === 0) return;
      state.closed = [];
      notifyTabsChange(state);
    });
  } catch {
    // No bridge adapter installed (unit envs) — module state dies with
    // the process anyway.
  }
  registry = state;
  return state.api;
}
