/**
 * `oh.terminal.*` — pty session wire for the workbench Terminal tool
 * window. Raw byte-stream transport only: keystrokes down, pty output
 * up, no protocol above it. Main scopes every session to the sender
 * webContents; ids from other surfaces are ignored there.
 */

import { ipcRenderer } from 'electron';

const TERMINAL_CHANNEL = {
  spawn: 'oh:terminal:spawn',
  write: 'oh:terminal:write',
  resize: 'oh:terminal:resize',
  kill: 'oh:terminal:kill',
  data: 'oh:terminal:data',
  exit: 'oh:terminal:exit',
} as const;

export type TerminalSpawnResult = { ok: true; id: string } | { ok: false; error: string };

export const terminal = {
  spawn(req: { cols: number; rows: number }): Promise<TerminalSpawnResult> {
    return ipcRenderer.invoke(TERMINAL_CHANNEL.spawn, req) as Promise<TerminalSpawnResult>;
  },
  write(req: { id: string; data: string }): void {
    ipcRenderer.send(TERMINAL_CHANNEL.write, req);
  },
  resize(req: { id: string; cols: number; rows: number }): void {
    ipcRenderer.send(TERMINAL_CHANNEL.resize, req);
  },
  kill(req: { id: string }): void {
    ipcRenderer.send(TERMINAL_CHANNEL.kill, req);
  },
  onData(handler: (envelope: { id: string; data: string }) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, envelope: { id: string; data: string }): void => {
      handler(envelope);
    };
    ipcRenderer.on(TERMINAL_CHANNEL.data, listener);
    return () => {
      ipcRenderer.removeListener(TERMINAL_CHANNEL.data, listener);
    };
  },
  onExit(handler: (envelope: { id: string; exitCode: number }) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, envelope: { id: string; exitCode: number }): void => {
      handler(envelope);
    };
    ipcRenderer.on(TERMINAL_CHANNEL.exit, listener);
    return () => {
      ipcRenderer.removeListener(TERMINAL_CHANNEL.exit, listener);
    };
  },
};
