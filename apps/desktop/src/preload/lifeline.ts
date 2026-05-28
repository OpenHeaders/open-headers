/**
 * `oh.lifeline.*` — long-lived per-surface port wire. Each renderer
 * surface holds one port; main fans `webContents` destroy and
 * renderer-initiated close events to oracle's awareness lifeline ports.
 */

import { ipcRenderer } from 'electron';

const LIFELINE_CHANNEL = {
  open: 'oh:lifeline:open',
  message: 'oh:lifeline:message',
  close: 'oh:lifeline:close',
  hostMessage: 'oh:lifeline:host-message',
  hostDisconnect: 'oh:lifeline:host-disconnect',
} as const;

export const lifeline = {
  open(req: { portId: string; name: string }): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(LIFELINE_CHANNEL.open, req) as Promise<{ ok: boolean; error?: string }>;
  },
  message(req: { portId: string; message: unknown }): void {
    ipcRenderer.send(LIFELINE_CHANNEL.message, req);
  },
  close(req: { portId: string }): void {
    ipcRenderer.send(LIFELINE_CHANNEL.close, req);
  },
  onHostMessage(handler: (envelope: { portId: string; message: unknown }) => void): () => void {
    const listener = (
      _event: Electron.IpcRendererEvent,
      envelope: { portId: string; message: unknown },
    ): void => {
      handler(envelope);
    };
    ipcRenderer.on(LIFELINE_CHANNEL.hostMessage, listener);
    return () => {
      ipcRenderer.removeListener(LIFELINE_CHANNEL.hostMessage, listener);
    };
  },
  onHostDisconnect(handler: (envelope: { portId: string; errorMessage?: string }) => void): () => void {
    const listener = (
      _event: Electron.IpcRendererEvent,
      envelope: { portId: string; errorMessage?: string },
    ): void => {
      handler(envelope);
    };
    ipcRenderer.on(LIFELINE_CHANNEL.hostDisconnect, listener);
    return () => {
      ipcRenderer.removeListener(LIFELINE_CHANNEL.hostDisconnect, listener);
    };
  },
};
