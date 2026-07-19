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
 *   - `oh:terminal:spawn`  (invoke) — `{ cols, rows }` → `{ ok, id }`.
 *     Spawns the user's shell (login mode on POSIX so PATH matches a
 *     real terminal on GUI-launched apps) with cwd at the home dir.
 *   - `oh:terminal:write`  (send)   — `{ id, data }` keystrokes → pty.
 *   - `oh:terminal:resize` (send)   — `{ id, cols, rows }` → SIGWINCH.
 *   - `oh:terminal:kill`   (send)   — dispose the session.
 *   - `oh:terminal:data`   (push)   — `{ id, data }` pty output stream.
 *   - `oh:terminal:exit`   (push)   — `{ id, exitCode }`, once.
 *
 * Teardown: renderer gone (window close / crash) kills that renderer's
 * ptys; `before-quit` kills everything left.
 */

import os from 'node:os';
import { hostLogger as logger } from '@openheaders/core/logger';
import { app, ipcMain, webContents as webContentsApi } from 'electron';
import { type IPty, spawn as ptySpawn } from 'node-pty';

const SCOPE = 'TerminalHost';

const CHANNEL = {
  spawn: 'oh:terminal:spawn',
  write: 'oh:terminal:write',
  resize: 'oh:terminal:resize',
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
function resolveShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: process.env.ComSpec ?? 'cmd.exe', args: [] };
  }
  const file = process.env.SHELL ?? (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
  return { file, args: ['-l'] };
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
    const { cols, rows } = (raw ?? {}) as { cols?: unknown; rows?: unknown };
    const shell = resolveShell();
    const id = `pty-${nextSessionSeq++}`;
    let pty: IPty;
    try {
      pty = ptySpawn(shell.file, shell.args, {
        name: 'xterm-256color',
        cols: clampDimension(cols, 80),
        rows: clampDimension(rows, 24),
        cwd: os.homedir(),
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

  ipcMain.on(CHANNEL.kill, (event, raw: unknown) => {
    const { id } = (raw ?? {}) as { id?: unknown };
    if (typeof id !== 'string') return;
    const entry = sessions.get(id);
    if (!entry || entry.wcId !== event.sender.id) return;
    disposeSession(id);
  });

  app.on('before-quit', () => {
    for (const id of [...sessions.keys()]) disposeSession(id);
  });
}
