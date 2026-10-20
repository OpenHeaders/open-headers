/**
 * Reveals `main.log` — the file the error funnel's lines land in — in
 * the OS file manager: the Help menu's "Open Logs Folder" and the
 * crash dialog's "Open Logs" (the crash-and-error-reports plan §3.3).
 * Also the first caller `getLogDirectory()` ever had.
 */

import { join } from 'node:path';
import { shell } from 'electron';
import { getLogDirectory } from './logger';

const LOG_FILENAME = 'main.log';

export function revealLogFile(): void {
  shell.showItemInFolder(join(getLogDirectory(), LOG_FILENAME));
}
