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
import { getCapability, type TerminalSession, type TerminalSpawnProfile } from '@openheaders/core/capabilities';
import { hostStorage, type PersistedTerminalTab, UI } from '@openheaders/core/storage';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { type ITheme, Terminal } from '@xterm/xterm';
import { resolveFontFamily } from '../../../settings/schema/editor';
import type { TerminalCursorStyle, TerminalProfilesValue } from '../../../settings/schema/terminal';
import { get as getSetting, subscribeKey } from '../../../settings/store';
import type { SettingKey, SettingsMap } from '../../../settings/types';

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
  /** Terminal profile this tab spawns with. Absent = the default
   *  profile at spawn time (which may be the system shell). */
  readonly profileId?: string;
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
  /** Give the tab an explicit label (the IDE Rename Session idiom). The
   *  numbered default stays reserved via `titleIndex`; a blank or
   *  unchanged name is a no-op. */
  renameTab(id: string, title: string): void;
  /** Align the flat list to `ids` (the pane tree's leaf-concatenated
   *  order after a reorder/move/split). The stored session mirrors
   *  list order, so visual order persists across restarts. Ids not in
   *  the list keep their relative position at the end. */
  setOrder(ids: readonly string[]): void;
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
  profileId: string | null;
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
  webLinks: WebLinksAddon | null;
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

/**
 * The xterm options the Terminal settings category drives, read as one
 * snapshot. Falls back to the registered defaults when the settings
 * store isn't initialized (unit environments) so a terminal can always
 * be built.
 */
interface TerminalOptionSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: TerminalCursorStyle;
  cursorBlink: boolean;
  minimumContrastRatio: number;
  scrollback: number;
  macOptionIsMeta: boolean;
}

function readSetting<K extends SettingKey>(key: K, fallback: SettingsMap[K]): SettingsMap[K] {
  try {
    return getSetting(key);
  } catch {
    // Store not initialized (unit envs) — the registered default.
    return fallback;
  }
}

function readOptionSettings(): TerminalOptionSettings {
  return {
    fontFamily: resolveFontFamily(readSetting('terminal.fontFamilyPreset', 'jetbrains-mono')),
    fontSize: readSetting('terminal.fontSize', 13),
    lineHeight: readSetting('terminal.lineHeight', 1),
    cursorStyle: readSetting('terminal.cursorStyle', 'block'),
    cursorBlink: readSetting('terminal.cursorBlink', true),
    minimumContrastRatio: readSetting('terminal.minimumContrastRatio', 1),
    scrollback: readSetting('terminal.scrollback', 5000),
    macOptionIsMeta: readSetting('terminal.macOptionIsMeta', false),
  };
}

/** First family of a CSS font stack, unquoted — the face to preload. */
function primaryFontFamily(stack: string): string {
  return stack
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

const fontReadyByFamily = new Map<string, Promise<void>>();

/**
 * Resolves once the active terminal font is loaded, regular and bold.
 * xterm measures its cell grid when a terminal opens, so opening before
 * the woff2 arrives measures the fallback font and misaligns every
 * glyph until the next refit — the panel awaits this before attaching,
 * and the font-family subscription awaits it before re-optioning live
 * tabs. Environments without the CSS Font Loading API resolve
 * immediately.
 */
export function whenTerminalFontReady(): Promise<void> {
  const family = primaryFontFamily(readOptionSettings().fontFamily);
  let ready = fontReadyByFamily.get(family);
  if (!ready) {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    ready = fonts
      ? Promise.all([fonts.load(`13px "${family}"`), fonts.load(`bold 13px "${family}"`)]).then(
          () => undefined,
          () => undefined,
        )
      : Promise.resolve();
    fontReadyByFamily.set(family, ready);
  }
  return ready;
}

let bellContext: AudioContext | null = null;

/** Short WebAudio beep for the audible-bell setting — no asset, no
 *  media element; best-effort (no audio device = silent). */
function playBell(): void {
  try {
    bellContext ??= new AudioContext();
    const context = bellContext;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.15);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
  } catch {
    // No audio output — the bell is best-effort.
  }
}

/** Route an activated terminal link to the host's external opener —
 *  terminal URLs open in the user's browser, never inside the app. */
function openTerminalLink(uri: string): void {
  if (!readSetting('terminal.hyperlinks', true)) return;
  const open = getCapability('openExternalUrl');
  if (!open) return;
  void open(uri).catch(() => {});
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
    ...(tab.profileId !== null ? { profileId: tab.profileId } : {}),
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
        profileId: typeof persisted.profileId === 'string' ? persisted.profileId : null,
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

/**
 * The spawn override for a tab, derived from the profiles setting at
 * spawn time — never cached on the tab, so an edited profile applies
 * to the next spawn and a deleted one (or a plain tab with no default
 * set) falls through to the host's own shell resolution.
 */
function resolveSpawnProfile(profileId: string | null): TerminalSpawnProfile | undefined {
  let value: TerminalProfilesValue;
  try {
    value = getSetting('terminal.profiles');
  } catch {
    // Store not initialized (unit envs) — host default resolution.
    return undefined;
  }
  const id = profileId ?? value.defaultProfileId;
  if (id === null) return undefined;
  const profile = value.profiles.find((candidate) => candidate.id === id);
  if (!profile) return undefined;
  return {
    shell: profile.shell,
    args: profile.args,
    ...(profile.cwd !== undefined ? { cwd: profile.cwd } : {}),
  };
}

async function ensureSession(state: RegistryState, tab: TabState): Promise<void> {
  if (tab.session || tab.spawning) return;
  const host = getCapability('terminal');
  if (!host) return;
  tab.spawning = true;
  try {
    // A relaunch after exit starts from a clean screen — stale output
    // from the dead shell reads as live state otherwise.
    if (tab.everSpawned) tab.term.reset();
    const profile = resolveSpawnProfile(tab.profileId);
    // The Start Directory setting rides the spawn as a fallback cwd —
    // resolved at spawn time like the profile itself; a profile's own
    // directory wins host-side.
    const startDirectory = readSetting('terminal.startDirectory', '').trim();
    const session = await host().spawn({
      cols: tab.term.cols,
      rows: tab.term.rows,
      ...(profile !== undefined ? { profile } : {}),
      ...(startDirectory.length > 0 ? { cwd: startDirectory } : {}),
    });
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
        // Close-on-exit: the tab goes with its shell instead of parking
        // on the restart affordance. User-initiated closes never reach
        // here — closeTab unsubscribes this listener before disposing.
        if (readSetting('terminal.closeTabOnExit', false)) closeTab(state, tab.id);
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
  profileId: string | null;
}

function buildTab(state: RegistryState, init: TabInit): TabState {
  const options = readOptionSettings();
  const term = new Terminal({
    cursorBlink: options.cursorBlink,
    cursorStyle: options.cursorStyle,
    scrollback: options.scrollback,
    fontSize: options.fontSize,
    fontFamily: options.fontFamily,
    lineHeight: options.lineHeight,
    minimumContrastRatio: options.minimumContrastRatio,
    macOptionIsMeta: options.macOptionIsMeta,
    theme: state.theme,
    // OSC 8 hyperlinks (programs emitting explicit links); the
    // detection of plain-text URLs rides the web-links addon. Both
    // funnel through the same gated opener.
    linkHandler: { activate: (_event, uri) => openTerminalLink(uri) },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.onSelectionChange(() => {
    if (!readSetting('terminal.copyOnSelect', false)) return;
    const selection = term.getSelection();
    if (selection.length === 0 || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(selection).catch(() => {});
  });
  term.onBell(() => {
    if (readSetting('terminal.audibleBell', false)) playBell();
  });

  const tab: TabState = {
    id: `tab-${state.nextTabSeq++}`,
    titleIndex: init.titleIndex,
    title: init.title,
    runCommand: init.runCommand,
    pendingCommand: init.runCommand,
    profileId: init.profileId,
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
    webLinks: null,
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
      ensureSession: () => ensureSession(state, tab),
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
  syncWebLinks(tab);
  state.tabs.push(tab);
  return tab;
}

/** Converge the web-links addon (plain-text URL detection) on the
 *  hyperlinks setting — loaded while on, disposed while off. */
function syncWebLinks(tab: TabState): void {
  const enabled = readSetting('terminal.hyperlinks', true);
  if (enabled && tab.webLinks === null) {
    const addon = new WebLinksAddon((_event, uri) => openTerminalLink(uri));
    tab.term.loadAddon(addon);
    tab.webLinks = addon;
    return;
  }
  if (!enabled && tab.webLinks !== null) {
    tab.webLinks.dispose();
    tab.webLinks = null;
  }
}

/** Push the current option settings onto every live terminal, then
 *  refit — font metrics changes re-measure the cell grid, and the
 *  attached tab must tell its pty about the new cols/rows. */
function applyOptionSettings(state: RegistryState): void {
  const options = readOptionSettings();
  for (const tab of state.tabs) {
    const target = tab.term.options;
    if (target.fontFamily !== options.fontFamily) target.fontFamily = options.fontFamily;
    if (target.fontSize !== options.fontSize) target.fontSize = options.fontSize;
    if (target.lineHeight !== options.lineHeight) target.lineHeight = options.lineHeight;
    if (target.cursorStyle !== options.cursorStyle) target.cursorStyle = options.cursorStyle;
    if (target.cursorBlink !== options.cursorBlink) target.cursorBlink = options.cursorBlink;
    if (target.minimumContrastRatio !== options.minimumContrastRatio)
      target.minimumContrastRatio = options.minimumContrastRatio;
    if (target.scrollback !== options.scrollback) target.scrollback = options.scrollback;
    if (target.macOptionIsMeta !== options.macOptionIsMeta) target.macOptionIsMeta = options.macOptionIsMeta;
    syncSize(tab);
  }
}

const OPTION_SETTING_KEYS = [
  'terminal.fontSize',
  'terminal.lineHeight',
  'terminal.cursorStyle',
  'terminal.cursorBlink',
  'terminal.minimumContrastRatio',
  'terminal.scrollback',
  'terminal.macOptionIsMeta',
] as const;

/** Live settings → live terminals. Registered once with the registry;
 *  spawn-time settings (profiles, start directory, close-on-exit,
 *  copy-on-select, bell) are read at their moment of use instead. */
function installSettingsSync(state: RegistryState): void {
  for (const key of OPTION_SETTING_KEYS) {
    subscribeKey(key, () => applyOptionSettings(state));
  }
  // A new font family must be loaded before xterm measures it, or every
  // glyph misaligns until the next refit.
  subscribeKey('terminal.fontFamilyPreset', () => {
    void whenTerminalFontReady().then(() => applyOptionSettings(state));
  });
  subscribeKey('terminal.hyperlinks', () => {
    for (const tab of state.tabs) syncWebLinks(tab);
  });
}

function createTab(state: RegistryState, options?: TerminalTabOptions): string {
  const tab = buildTab(state, {
    titleIndex: options?.title !== undefined ? 0 : lowestFreeTitleIndex(state),
    title: options?.title,
    runCommand: options?.runCommand ?? null,
    profileId: options?.profileId ?? null,
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
    ...(tab.profileId !== null ? { profileId: tab.profileId } : {}),
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
      renameTab: (id, title) => {
        const tab = state.tabs.find((candidate) => candidate.id === id);
        const trimmed = title.trim();
        if (!tab || trimmed.length === 0 || trimmed === tab.title) return;
        tab.title = trimmed;
        notifyTabsChange(state);
      },
      setOrder: (ids) => {
        const rank = new Map(ids.map((id, index) => [id, index]));
        const next = state.tabs
          .map((tab, index) => ({ tab, index }))
          .sort((a, b) => (rank.get(a.tab.id) ?? ids.length + a.index) - (rank.get(b.tab.id) ?? ids.length + b.index))
          .map((entry) => entry.tab);
        if (next.every((tab, index) => tab === state.tabs[index])) return;
        state.tabs = next;
        notifyTabsChange(state);
      },
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
        createTab(state, {
          ...(closed.title !== undefined ? { title: closed.title, runCommand: closed.runCommand } : {}),
          ...(closed.profileId !== undefined ? { profileId: closed.profileId } : {}),
        });
      },
    },
  };
  state.ready = hydrate(state);
  installSettingsSync(state);
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
