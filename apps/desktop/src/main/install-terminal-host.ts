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
 *   - `oh:terminal:spawn`  (invoke) — `{ cols, rows, profile?, cwd? }`
 *     → `{ ok, id }`. Spawns the user's shell (login mode on POSIX so
 *     PATH matches a real terminal on GUI-launched apps) with cwd at
 *     the home dir; a `profile` (`{ shell, args, cwd? }` — a terminal
 *     profile) overrides the command line. The starting directory is
 *     the profile's cwd, else the request-level cwd (the Start
 *     Directory setting), falling back to the home dir when absent or
 *     not a directory.
 *   - `oh:terminal:write`  (send)   — `{ id, data }` keystrokes → pty.
 *   - `oh:terminal:resize` (send)   — `{ id, cols, rows }` → SIGWINCH.
 *   - `oh:terminal:has-children` (invoke) — `{ id }` → boolean; true
 *     while anything beside the shell runs in the session (used by the
 *     tab close affordance to confirm before terminating work).
 *   - `oh:terminal:kill`   (send)   — dispose the session.
 *   - `oh:terminal:data`   (push)   — `{ id, data }` pty output stream.
 *   - `oh:terminal:exit`   (push)   — `{ id, exitCode }`, once.
 *
 * Teardown: renderer gone (window close / crash) kills that renderer's
 * ptys; the app lifecycle's quit teardown drains everything left.
 */

import { statSync } from 'node:fs';
import os from 'node:os';
import { hostLogger as logger } from '@openheaders/core/logger';
import { refreshedWindowsPath } from '@openheaders/oracle-host-node/host-runtime/windows-user-path';
import {
  type ProcessReader,
  type ProcessRoot,
  type ProcessRootRegistry,
  readProcessDescendants,
} from '@openheaders/oracle-host-node/process-reader';
import { ipcMain, webContents as webContentsApi } from 'electron';
import { type IPty, spawn as ptySpawn } from 'node-pty';
import { registerTeardown } from './bootstrap/lifecycle';

const SCOPE = 'TerminalHost';

/** Quit-time cap on waiting for killed ptys' exit callbacks to land. */
const PTY_DRAIN_DEADLINE_MS = 1_500;

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
  /** The shell as it was registered at its spawn; null where the host has no process reader. */
  root: ProcessRoot | null;
}

function clampDimension(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.floor(value)));
}

export interface TerminalHostDeps {
  /** The host's process reader; null where it has none. */
  processReader: ProcessReader | null;
  /** Where each session's shell is registered as it is spawned (the activity monitor plan §6, law 5). */
  processRoots: ProcessRootRegistry;
}

/** True while anything beside the shell runs in the session: what the
 *  shell started, and what shares its terminal — a process that
 *  detached from the shell still ends with the tab. Walked down from
 *  the shell as it was registered at its spawn, through the process
 *  reader's seam (the activity monitor plan §7, fork 3); false where
 *  the host has no reader, and on Windows, where its reader walks
 *  nothing. */
function sessionHasWork(reader: ProcessReader | null, shell: ProcessRoot | null): boolean {
  if (reader === null || shell === null) return false;
  return readProcessDescendants(reader, shell, { terminal: true }).length > 0;
}

interface SpawnCommand {
  file: string;
  args: string[];
  cwd?: string;
}

/** The user's shell + args, resolved like a terminal emulator would.
 *  POSIX shells run in login mode so profile-sourced PATH entries are
 *  present even when the app was launched from the GUI. */
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

export function installTerminalHost(deps: TerminalHostDeps): void {
  const sessions = new Map<string, SessionEntry>();
  const trackedWebContents = new Set<number>();
  // Exit promises for every pty whose exit callback hasn't landed yet —
  // killed-but-not-dead ptys included, which the `sessions` map no
  // longer tracks. The quit-time drain awaits these.
  const pendingExits = new Set<Promise<void>>();
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

  ipcMain.handle(CHANNEL.spawn, async (event, raw: unknown) => {
    const { cols, rows, profile, cwd } = (raw ?? {}) as {
      cols?: unknown;
      rows?: unknown;
      profile?: unknown;
      cwd?: unknown;
    };
    const shell = parseProfile(profile) ?? resolveShell();
    if (shell.cwd === undefined && typeof cwd === 'string' && cwd.trim().length > 0) shell.cwd = cwd;
    const id = `pty-${nextSessionSeq++}`;
    const env: NodeJS.ProcessEnv = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
    if (process.platform === 'win32') {
      // Windows shells inherit this process's PATH snapshot — an
      // installer that appended to the registry user PATH after launch
      // is invisible without this merge (POSIX tabs re-source PATH via
      // their login-mode profiles instead). Replace in place under the
      // env's own key casing: adding a second PATH-cased key would hand
      // ConPTY a duplicate.
      const refreshed = await refreshedWindowsPath(process.env);
      if (refreshed !== null) {
        const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === 'PATH') ?? 'Path';
        env[key] = refreshed;
      }
    }
    let pty: IPty;
    try {
      pty = ptySpawn(shell.file, shell.args, {
        name: 'xterm-256color',
        cols: clampDimension(cols, 80),
        rows: clampDimension(rows, 24),
        cwd: resolveCwd(shell.cwd),
        env,
      });
    } catch (err) {
      logger.warn(SCOPE, `spawn failed for ${shell.file}`, err);
      return { ok: false as const, error: err instanceof Error ? err.message : 'spawn failed' };
    }
    // The session is the owner: its id names the row, and the tab that holds it names it for the person.
    const registration = deps.processRoots.register({ kind: 'terminal', id }, pty.pid, { terminal: true });
    const entry: SessionEntry = { pty, wcId: event.sender.id, exited: false, root: registration.root };
    sessions.set(id, entry);
    trackWebContents(event.sender.id);

    let resolveExit!: () => void;
    const exitLanded = new Promise<void>((resolve) => {
      resolveExit = resolve;
    });
    pendingExits.add(exitLanded);

    const sender = event.sender;
    pty.onData((data) => {
      if (sender.isDestroyed()) return;
      sender.send(CHANNEL.data, { id, data });
    });
    pty.onExit(({ exitCode }) => {
      entry.exited = true;
      registration.release();
      sessions.delete(id);
      pendingExits.delete(exitLanded);
      resolveExit();
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
    return sessionHasWork(deps.processReader, entry.root);
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
  // unexpectedly"). Registered as a lifecycle teardown participant:
  // kill whatever is left (the machine's window destroy already swept
  // renderer-owned sessions), then drain the outstanding exits — the
  // participant deadline keeps a hung shell from wedging quit forever.
  registerTeardown('pty-drain', PTY_DRAIN_DEADLINE_MS, async () => {
    for (const id of [...sessions.keys()]) disposeSession(id);
    await Promise.all([...pendingExits]);
  });
}
