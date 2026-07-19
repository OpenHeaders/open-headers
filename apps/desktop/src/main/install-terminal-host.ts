/**
 * Pty host for the workbench Terminal tool window.
 *
 * Owns node-pty sessions on behalf of renderer surfaces. Each session
 * is a REAL pty running the user's shell — the embedded program can
 * never tell it isn't in a stand-alone terminal, and nothing rides a
 * side channel past it (the `oh` CLI inside the pane authenticates
 * through its own config exactly as it would anywhere else).
 *
 * Wire protocol (all session traffic scoped by `(webContents.id, id)`
 * so one renderer can't address another's ptys):
 *
 *   - `oh:terminal:spawn`  (invoke) — `{ cols, rows, profile? }` →
 *     `{ ok, id }`. Spawns the user's shell (login mode on POSIX so
 *     PATH matches a real terminal on GUI-launched apps) with cwd at
 *     the home dir; a `profile` (`{ shell, args, cwd? }` — a terminal
 *     profile) overrides the command line, with cwd falling back to
 *     the home dir when absent or not a directory.
 *   - `oh:terminal:write`  (send)   — `{ id, data }` keystrokes → pty.
 *   - `oh:terminal:resize` (send)   — `{ id, cols, rows }` → SIGWINCH.
 *   - `oh:terminal:has-children` (invoke) — `{ id }` → boolean; true
 *     while the session's shell has a live child process (used by the
 *     tab close affordance to confirm before terminating work).
 *   - `oh:terminal:kill`   (send)   — dispose the session.
 *   - `oh:terminal:data`   (push)   — `{ id, data }` pty output stream.
 *   - `oh:terminal:exit`   (push)   — `{ id, exitCode }`, once.
 *
 * Teardown: renderer gone (window close / crash) kills that renderer's
 * ptys; `before-quit` kills everything left.
 */

import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import os from 'node:os';
import { hostLogger as logger } from '@openheaders/core/logger';
import { app, ipcMain, webContents as webContentsApi } from 'electron';
import { type IPty, spawn as ptySpawn } from 'node-pty';

const SCOPE = 'TerminalHost';

const CHANNEL = {
  spawn: 'oh:terminal:spawn',
  write: 'oh:terminal:write',
  resize: 'oh:terminal:resize',
  hasChildren: 'oh:terminal:has-children',
  kill: 'oh:terminal:kill',
  data: 'oh:terminal:data',
  exit: 'oh:terminal:exit',
} as const;

const MIN_DIMENSION = 2;
const MAX_DIMENSION = 1000;

interface SessionEntry {
  pty: IPty;
  wcId: number;
  exited: boolean;
}

function clampDimension(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.floor(value)));
}

/** The user's shell + args, resolved like a terminal emulator would.
 *  POSIX shells run in login mode so profile-sourced PATH entries are
 *  present even when the app was launched from the GUI. */
/** True when the shell process has at least one live child. POSIX
 *  only (`pgrep -P`); on Windows this reports false until the ConPTY
 *  pass gives the host a process-tree probe. */
function shellHasChildren(pid: number): Promise<boolean> {
  if (process.platform === 'win32') return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile('pgrep', ['-P', String(pid)], (error, stdout) => {
      // pgrep exits 1 for "no matches" — that's a clean false, not a
      // failure; any other error also reads as "nothing running".
      resolve(!error && stdout.trim().length > 0);
    });
  });
}

interface SpawnCommand {
  file: string;
  args: string[];
  cwd?: string;
}

function resolveShell(): SpawnCommand {
  if (process.platform === 'win32') {
    return { file: process.env.ComSpec ?? 'cmd.exe', args: [] };
  }
  const file = process.env.SHELL ?? (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
  return { file, args: ['-l'] };
}

/** Narrow an untrusted wire payload to a usable profile override —
 *  anything malformed reads as "no override" rather than an error, so
 *  a stale renderer can never wedge the spawn path. */
function parseProfile(raw: unknown): SpawnCommand | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { shell, args, cwd } = raw as { shell?: unknown; args?: unknown; cwd?: unknown };
  if (typeof shell !== 'string' || shell.trim().length === 0) return null;
  if (!Array.isArray(args) || !args.every((arg): arg is string => typeof arg === 'string')) return null;
  return {
    file: shell,
    args,
    ...(typeof cwd === 'string' && cwd.trim().length > 0 ? { cwd } : {}),
  };
}

/** The profile's cwd when it exists and is a directory; home otherwise
 *  — a profile whose directory has since been deleted still opens. */
function resolveCwd(cwd: string | undefined): string {
  if (cwd === undefined) return os.homedir();
  try {
    return statSync(cwd).isDirectory() ? cwd : os.homedir();
  } catch {
    return os.homedir();
  }
}

export function installTerminalHost(): void {
  const sessions = new Map<string, SessionEntry>();
  const trackedWebContents = new Set<number>();
  let nextSessionSeq = 1;

  function disposeSession(id: string): void {
    const entry = sessions.get(id);
    if (!entry) return;
    sessions.delete(id);
    if (!entry.exited) {
      try {
        entry.pty.kill();
      } catch (err) {
        logger.warn(SCOPE, `kill failed for session ${id}`, err);
      }
    }
  }

  function dropSessionsForWebContents(wcId: number): void {
    for (const [id, entry] of sessions) {
      if (entry.wcId === wcId) disposeSession(id);
    }
  }

  function trackWebContents(wcId: number): void {
    if (trackedWebContents.has(wcId)) return;
    trackedWebContents.add(wcId);
    const wc = webContentsApi.fromId(wcId);
    if (!wc) return;
    wc.once('destroyed', () => {
      trackedWebContents.delete(wcId);
      dropSessionsForWebContents(wcId);
    });
    wc.once('render-process-gone', () => {
      trackedWebContents.delete(wcId);
      dropSessionsForWebContents(wcId);
    });
  }

  ipcMain.handle(CHANNEL.spawn, (event, raw: unknown) => {
    const { cols, rows, profile } = (raw ?? {}) as { cols?: unknown; rows?: unknown; profile?: unknown };
    const shell = parseProfile(profile) ?? resolveShell();
    const id = `pty-${nextSessionSeq++}`;
    let pty: IPty;
    try {
      pty = ptySpawn(shell.file, shell.args, {
        name: 'xterm-256color',
        cols: clampDimension(cols, 80),
        rows: clampDimension(rows, 24),
        cwd: resolveCwd(shell.cwd),
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      });
    } catch (err) {
      logger.warn(SCOPE, `spawn failed for ${shell.file}`, err);
      return { ok: false as const, error: err instanceof Error ? err.message : 'spawn failed' };
    }
    const entry: SessionEntry = { pty, wcId: event.sender.id, exited: false };
    sessions.set(id, entry);
    trackWebContents(event.sender.id);

    const sender = event.sender;
    pty.onData((data) => {
      if (sender.isDestroyed()) return;
      sender.send(CHANNEL.data, { id, data });
    });
    pty.onExit(({ exitCode }) => {
      entry.exited = true;
      sessions.delete(id);
      if (sender.isDestroyed()) return;
      sender.send(CHANNEL.exit, { id, exitCode });
    });
    return { ok: true as const, id };
  });

  ipcMain.on(CHANNEL.write, (event, raw: unknown) => {
    const { id, data } = (raw ?? {}) as { id?: unknown; data?: unknown };
    if (typeof id !== 'string' || typeof data !== 'string') return;
    const entry = sessions.get(id);
    if (!entry || entry.wcId !== event.sender.id || entry.exited) return;
    entry.pty.write(data);
  });

  ipcMain.on(CHANNEL.resize, (event, raw: unknown) => {
    const { id, cols, rows } = (raw ?? {}) as { id?: unknown; cols?: unknown; rows?: unknown };
    if (typeof id !== 'string') return;
    const entry = sessions.get(id);
    if (!entry || entry.wcId !== event.sender.id || entry.exited) return;
    try {
      entry.pty.resize(clampDimension(cols, 80), clampDimension(rows, 24));
    } catch (err) {
      logger.warn(SCOPE, `resize failed for session ${id}`, err);
    }
  });

  ipcMain.handle(CHANNEL.hasChildren, async (event, raw: unknown) => {
    const { id } = (raw ?? {}) as { id?: unknown };
    if (typeof id !== 'string') return false;
    const entry = sessions.get(id);
    if (!entry || entry.wcId !== event.sender.id || entry.exited) return false;
    return shellHasChildren(entry.pty.pid);
  });

  ipcMain.on(CHANNEL.kill, (event, raw: unknown) => {
    const { id } = (raw ?? {}) as { id?: unknown };
    if (typeof id !== 'string') return;
    const entry = sessions.get(id);
    if (!entry || entry.wcId !== event.sender.id) return;
    disposeSession(id);
  });

  // Quit must WAIT for the ptys to finish dying: node-pty delivers its
  // exit callbacks over a ThreadSafeFunction, and one landing while the
  // Node environment is mid-cleanup aborts the whole process (SIGABRT
  // in `Napi::Error::ThrowAsJavaScriptException` — macOS shows "quit
  // unexpectedly"). Hold the quit, drain the exits, then requit; the
  // timeout keeps a hung shell from wedging quit forever.
  let quitReady = false;
  let quitDraining = false;
  app.on('before-quit', (event) => {
    if (quitReady) return;
    if (quitDraining) {
      // A second quit request while the drain runs must keep waiting —
      // the session map is already empty, but the ptys aren't dead yet.
      event.preventDefault();
      return;
    }
    const live = [...sessions.values()].filter((entry) => !entry.exited);
    if (live.length === 0) {
      quitReady = true;
      return;
    }
    event.preventDefault();
    quitDraining = true;
    const exits = live.map(
      (entry) =>
        new Promise<void>((resolve) => {
          entry.pty.onExit(() => resolve());
        }),
    );
    for (const id of [...sessions.keys()]) disposeSession(id);
    const timeout = new Promise<void>((resolve) => {
      setTimeout(resolve, 1500);
    });
    void Promise.race([Promise.all(exits), timeout]).then(() => {
      quitReady = true;
      app.quit();
    });
  });
}
