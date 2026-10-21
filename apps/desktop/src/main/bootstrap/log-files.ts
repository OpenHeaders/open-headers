/**
 * Main-side reader for the renderer's diagnostic bundle (the
 * crash-and-error-reports plan §4.5): `main.log` and the rotated
 * `main.old.log` electron-log leaves beside it, read as one stream and
 * cut to this launch and the one before it (the launch before is the
 * one a grey-window report is about); and the folders main knows about
 * itself — home, the app, its userData, its logs — each with the
 * placeholder the bundle's redaction puts in its place. The sibling of
 * `log-reveal` — one reveals the folder, this one hands the text over
 * so the bundle can carry it; nothing is sent by either.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { DiagnosticsLogFile, DiagnosticsRoot } from '@openheaders/core/diagnostics';
import { app, ipcMain } from 'electron';
import { LAUNCH_MARKER_LINE } from './launch-marker';
import { getLogDirectory } from './logger';

const READ_CHANNEL = 'oh:logs:read';
const ROOTS_CHANNEL = 'oh:logs:roots';
/** Oldest first, so the two read as one stream; electron-log's rotation names the previous file `.old.log`. */
const LOG_FILENAMES = ['main.old.log', 'main.log'] as const;
/** How many launches the bundled log keeps, counted back from this one. */
export const BUNDLED_LAUNCHES = 2;
export const BUNDLED_LOG_NOTE = 'this launch and the one before it';

/** The text from the start of the Nth-last launch — every launch writes the marker once its window exists; fewer launches keep everything. */
export function keepRecentLaunches(text: string, launches: number = BUNDLED_LAUNCHES): string {
  const lines = text.split('\n');
  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (line.includes(LAUNCH_MARKER_LINE)) starts.push(index);
  });
  if (starts.length <= launches) return text;
  return lines.slice(starts[starts.length - launches]).join('\n');
}

function endedLine(text: string): string {
  return text === '' || text.endsWith('\n') ? text : `${text}\n`;
}

export async function readLogFiles(): Promise<DiagnosticsLogFile[]> {
  const dir = getLogDirectory();
  const texts: string[] = [];
  for (const name of LOG_FILENAMES) {
    try {
      texts.push(endedLine(await readFile(join(dir, name), 'utf8')));
    } catch {
      // Absent (no rotation yet) or unreadable — the bundle carries what it got.
    }
  }
  if (texts.length === 0) return [];
  return [{ name: 'main.log', text: keepRecentLaunches(texts.join('')), note: BUNDLED_LOG_NOTE }];
}

/** Main's own folders; in dev the app's code is the whole monorepo, two levels above `apps/desktop` (the nm-host idiom). */
export function diagnosticsRoots(): DiagnosticsRoot[] {
  const appPath = app.getAppPath();
  return [
    { path: app.getPath('home'), placeholder: '<home>', collapse: true },
    { path: app.isPackaged ? appPath : resolve(appPath, '..', '..'), placeholder: '<app>' },
    ...(app.isPackaged ? [{ path: process.resourcesPath, placeholder: '<resources>' }] : []),
    { path: app.getPath('userData'), placeholder: '<userData>' },
    { path: getLogDirectory(), placeholder: '<logs>' },
  ];
}

export function installLogFilesHandler(): void {
  ipcMain.handle(READ_CHANNEL, () => readLogFiles());
  ipcMain.handle(ROOTS_CHANNEL, () => diagnosticsRoots());
}
