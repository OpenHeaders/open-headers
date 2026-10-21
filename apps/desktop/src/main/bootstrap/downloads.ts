/**
 * Download feedback (the error reports plan §4.5): a document's
 * download — the diagnostic bundle, an export — runs through Chromium's
 * default save routine, so only main sees whether the native dialog
 * ended in a file. Main watches every download on the default session
 * and tells the window that started it where the file went
 * (`downloadDone`); the workbench shows the saved-file toast with its
 * "Show in folder" action, which comes back here over one channel and
 * reveals only a path main reported itself. A cancelled dialog is the
 * person's choice and sends nothing.
 *
 * Every Electron read is a dependency so the flow is testable outside
 * the runtime; `installDownloadFeedback()` binds the production ones.
 */

import type { WebContents } from 'electron';
import { BrowserWindow, ipcMain, session, shell } from 'electron';
import { sendToRendererWindow } from './renderer-broadcast';

const REVEAL_CHANNEL = 'oh:downloads:reveal';

export interface DownloadItemLike {
  getFilename(): string;
  getSavePath(): string;
  once(event: 'done', listener: (event: unknown, state: 'completed' | 'cancelled' | 'interrupted') => void): unknown;
}

export interface DownloadSessionLike {
  on(
    event: 'will-download',
    listener: (event: unknown, item: DownloadItemLike, webContents: WebContents) => void,
  ): unknown;
}

export interface DownloadFeedbackDeps {
  session: DownloadSessionLike;
  /** The window a download's web contents belong to; null when it has none (a destroyed one). */
  windowOf(webContents: WebContents): BrowserWindow | null;
  send(win: BrowserWindow, type: string, payload: unknown): void;
  reveal(path: string): void;
  handle(channel: string, listener: (event: unknown, path: unknown) => void): void;
}

export function installDownloadFeedbackWith(deps: DownloadFeedbackDeps): void {
  const reported = new Set<string>();
  deps.session.on('will-download', (_event, item, webContents) => {
    const win = deps.windowOf(webContents);
    item.once('done', (_doneEvent, state) => {
      if (state === 'cancelled') return;
      const path = item.getSavePath();
      if (state === 'completed') reported.add(path);
      if (win) deps.send(win, 'downloadDone', { filename: item.getFilename(), path, state });
    });
  });
  deps.handle(REVEAL_CHANNEL, (_event, path) => {
    if (typeof path === 'string' && reported.has(path)) deps.reveal(path);
  });
}

export function installDownloadFeedback(): void {
  installDownloadFeedbackWith({
    session: session.defaultSession,
    windowOf: (webContents) => BrowserWindow.fromWebContents(webContents),
    send: sendToRendererWindow,
    reveal: (path) => shell.showItemInFolder(path),
    handle: (channel, listener) => ipcMain.handle(channel, listener),
  });
}
