/**
 * Main-side reader for the renderer's diagnostic bundle (the
 * crash-and-error-reports plan §4.5): the live `main.log` and the
 * rotated `main.old.log` electron-log leaves beside it, text as written.
 * The sibling of `log-reveal` — one reveals the folder, this one hands
 * the files over so the bundle can carry them; nothing is sent by either.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiagnosticsLogFile } from '@openheaders/core/diagnostics';
import { ipcMain } from 'electron';
import { getLogDirectory } from './logger';

const CHANNEL = 'oh:logs:read';
/** The current file first; electron-log's rotation names the previous one `.old.log`. */
const LOG_FILENAMES = ['main.log', 'main.old.log'] as const;

export async function readLogFiles(): Promise<DiagnosticsLogFile[]> {
  const dir = getLogDirectory();
  const files: DiagnosticsLogFile[] = [];
  for (const name of LOG_FILENAMES) {
    try {
      files.push({ name, text: await readFile(join(dir, name), 'utf8') });
    } catch {
      // Absent (no rotation yet) or unreadable — the bundle lists what it got.
    }
  }
  return files;
}

export function installLogFilesHandler(): void {
  ipcMain.handle(CHANNEL, () => readLogFiles());
}
