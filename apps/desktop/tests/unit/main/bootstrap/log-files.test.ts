import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUNDLED_LOG_NOTE,
  diagnosticsRoots,
  installLogFilesHandler,
  keepRecentLaunches,
  readLogFiles,
} from '@/main/bootstrap/log-files';

let logDir = '';

vi.mock('@/main/bootstrap/logger', () => ({ getLogDirectory: () => logDir }));

const launch = (n: number): string => `2026-10-21T0${n}:00:00.000Z INFO  [startup] main window created (+0.5s)\n`;

describe('log-files', () => {
  beforeEach(() => {
    logDir = mkdtempSync(join(tmpdir(), 'oh-log-files-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(logDir, { recursive: true, force: true });
  });

  it('keeps the text from the start of the launch before this one, or everything with fewer launches', () => {
    const text = `${launch(1)}one\n${launch(2)}two\n    at x\n${launch(3)}three\n`;
    expect(keepRecentLaunches(text)).toBe(`${launch(2)}two\n    at x\n${launch(3)}three\n`);
    expect(keepRecentLaunches(`${launch(1)}one\n`)).toBe(`${launch(1)}one\n`);
    expect(keepRecentLaunches('no marker\n')).toBe('no marker\n');
    expect(keepRecentLaunches(text, 1)).toBe(`${launch(3)}three\n`);
  });

  it('reads the rotated file and the live one as one stream, cut to the recent launches, under one name', async () => {
    writeFileSync(join(logDir, 'main.old.log'), `${launch(1)}old one\n${launch(2)}old two`);
    writeFileSync(join(logDir, 'main.log'), `now\n${launch(3)}three\n`);
    expect(await readLogFiles()).toEqual([
      { name: 'main.log', text: `${launch(2)}old two\nnow\n${launch(3)}three\n`, note: BUNDLED_LOG_NOTE },
    ]);
  });

  it('skips a file that is not there', async () => {
    writeFileSync(join(logDir, 'main.log'), 'only\n');
    expect(await readLogFiles()).toEqual([{ name: 'main.log', text: 'only\n', note: BUNDLED_LOG_NOTE }]);
    rmSync(join(logDir, 'main.log'));
    expect(await readLogFiles()).toEqual([]);
  });

  it('names its own folders with their placeholders — in dev the app is the monorepo root', () => {
    expect(diagnosticsRoots()).toEqual([
      { path: '/tmp/open-headers-test/home', placeholder: '<home>', collapse: true },
      { path: '/tmp/open-headers-test/repo', placeholder: '<app>' },
      { path: '/tmp/open-headers-test/userData', placeholder: '<userData>' },
      { path: logDir, placeholder: '<logs>' },
    ]);
  });

  it('answers the renderer channels with the same reads', async () => {
    writeFileSync(join(logDir, 'main.log'), 'ipc\n');
    const handlers = new Map<string, () => Promise<unknown> | unknown>();
    vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: () => Promise<unknown>) => {
      handlers.set(channel, fn);
    }) as typeof ipcMain.handle);
    installLogFilesHandler();
    expect(await handlers.get('oh:logs:read')?.()).toEqual([
      { name: 'main.log', text: 'ipc\n', note: BUNDLED_LOG_NOTE },
    ]);
    expect(await handlers.get('oh:logs:roots')?.()).toEqual(diagnosticsRoots());
  });
});
