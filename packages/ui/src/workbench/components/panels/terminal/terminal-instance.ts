/**
 * Module-level owner of the workbench terminal — the xterm instance and
 * its pty session live HERE, not in the panel component. The dock
 * unmounts inactive tool-window bodies, and a terminal must survive tab
 * switches and region collapses with its shell (and scrollback) intact;
 * the panel only attaches the terminal's DOM element while visible and
 * detaches on unmount. The pty itself dies with the app window (the
 * main-process host sweeps sessions on webContents destroy).
 *
 * Host access rides the `terminal` capability — on hosts without it
 * (every browser surface) `getWorkbenchTerminal()` returns null, and
 * the tool window never exists anyway (registry `requiresCapability`).
 */

import { getCapability, type TerminalSession } from '@openheaders/core/capabilities';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';

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

interface InstanceState {
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

let instance: InstanceState | null = null;

function notifyExitChange(state: InstanceState): void {
  for (const listener of state.exitListeners) listener();
}

async function ensureSession(state: InstanceState): Promise<void> {
  if (state.session || state.spawning) return;
  const host = getCapability('terminal');
  if (!host) return;
  state.spawning = true;
  try {
    // A relaunch after exit starts from a clean screen — stale output
    // from the dead shell reads as live state otherwise.
    if (state.everSpawned) state.term.reset();
    const session = await host().spawn({ cols: state.term.cols, rows: state.term.rows });
    state.everSpawned = true;
    state.session = session;
    state.exited = false;
    // The pane may have refit while the spawn was in flight (resizes
    // against a null session are dropped) — true the pty up to the
    // terminal's current grid or full-screen programs draw at spawn size.
    state.sentCols = state.term.cols;
    state.sentRows = state.term.rows;
    session.resize(state.term.cols, state.term.rows);
    state.sessionCleanups = [
      session.onData((data) => state.term.write(data)),
      session.onExit(() => {
        for (const cleanup of state.sessionCleanups) cleanup();
        state.sessionCleanups = [];
        state.session = null;
        state.exited = true;
        notifyExitChange(state);
      }),
    ];
    notifyExitChange(state);
  } catch {
    state.exited = true;
    notifyExitChange(state);
  } finally {
    state.spawning = false;
  }
}

function syncSize(state: InstanceState): void {
  if (!state.term.element) return;
  try {
    state.fit.fit();
  } catch {
    return;
  }
  // A sash drag fires resize per mouse move; tell the pty only when the
  // grid actually changed so the shell isn't stormed with SIGWINCH
  // (each one repaints the whole screen — the drag reads as text churn).
  if (state.term.cols === state.sentCols && state.term.rows === state.sentRows) return;
  if (state.session) {
    state.sentCols = state.term.cols;
    state.sentRows = state.term.rows;
    state.session.resize(state.term.cols, state.term.rows);
  }
}

function ensureRenderer(state: InstanceState): void {
  if (state.webgl || state.webglFailed || !state.term.element) return;
  // GPU rendering keeps resize storms (sash drags) repainting at frame
  // rate — the DOM renderer re-lays-out every cell and visibly lags.
  try {
    const addon = new WebglAddon();
    addon.onContextLoss(() => {
      addon.dispose();
      state.webgl = null;
      state.webglFailed = true;
    });
    state.term.loadAddon(addon);
    state.webgl = addon;
  } catch {
    state.webglFailed = true;
  }
}

/**
 * The singleton workbench terminal, created on first call. Null on
 * hosts without the `terminal` capability.
 */
export function getWorkbenchTerminal(): WorkbenchTerminal | null {
  if (!getCapability('terminal')) return null;
  if (instance) return instance.api;

  const term = new Terminal({
    cursorBlink: true,
    scrollback: 5000,
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  });
  const fit = new FitAddon();
  term.loadAddon(fit);

  const state: InstanceState = {
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
      isExited: () => state.exited,
      onExitChange: (listener) => {
        state.exitListeners.add(listener);
        return () => {
          state.exitListeners.delete(listener);
        };
      },
      ensureSession: () => ensureSession(state),
      syncSize: () => syncSize(state),
      ensureRenderer: () => ensureRenderer(state),
    },
  };
  term.onData((data) => state.session?.write(data));
  instance = state;
  return state.api;
}
