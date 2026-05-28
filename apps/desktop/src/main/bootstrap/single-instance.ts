/**
 * Single-instance lock. A second launch (double-clicked app, deep-link
 * click while a copy is running, etc.) must hand off to the existing
 * process — not boot a parallel one that would race for the SQLite
 * file lock, the WS server port, and the tray icon slot. Acquire BEFORE
 * `app.whenReady` so a lost race quits fast.
 */

import { app } from 'electron';

export function enforceSingleInstanceLock(): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  }
}
