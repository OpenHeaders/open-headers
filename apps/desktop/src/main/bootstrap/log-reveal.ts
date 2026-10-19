/**
 * Main-side handler for the renderer's "Open logs folder" (the root
 * error fallback, the crash-and-error-reports plan §3.2): reveals
 * `main.log` — the file the error funnel's lines land in — in the OS
 * file manager. Also the first caller `getLogDirectory()` ever had.
 */

import { join } from 'node:path';
import { ipcMain, shell } from 'electron';
import { getLogDirectory } from './logger';

const CHANNEL = 'oh:logs:reveal';
const LOG_FILENAME = 'main.log';

export function revealLogFile(): void {
  shell.showItemInFolder(join(getLogDirectory(), LOG_FILENAME));
}

export function installLogRevealHandler(): void {
  ipcMain.handle(CHANNEL, () => {
    revealLogFile();
  });
}
