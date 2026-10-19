import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installLogFilesHandler, readLogFiles } from '@/main/bootstrap/log-files';

let logDir = '';

vi.mock('@/main/bootstrap/logger', () => ({ getLogDirectory: () => logDir }));

describe('log-files', () => {
  beforeEach(() => {
    logDir = mkdtempSync(join(tmpdir(), 'oh-log-files-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(logDir, { recursive: true, force: true });
  });

  it('reads the live file first and the rotated one after it', async () => {
    writeFileSync(join(logDir, 'main.log'), 'now\n');
    writeFileSync(join(logDir, 'main.old.log'), 'before\n');
    expect(await readLogFiles()).toEqual([
      { name: 'main.log', text: 'now\n' },
      { name: 'main.old.log', text: 'before\n' },
    ]);
  });

  it('skips a file that is not there', async () => {
    writeFileSync(join(logDir, 'main.log'), 'only\n');
    expect(await readLogFiles()).toEqual([{ name: 'main.log', text: 'only\n' }]);
    rmSync(join(logDir, 'main.log'));
    expect(await readLogFiles()).toEqual([]);
  });

  it('answers the renderer channel with the same read', async () => {
    writeFileSync(join(logDir, 'main.log'), 'ipc\n');
    let handler: (() => Promise<unknown>) | null = null;
    vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: () => Promise<unknown>) => {
      if (channel === 'oh:logs:read') handler = fn;
    }) as typeof ipcMain.handle);
    installLogFilesHandler();
    expect(handler).not.toBeNull();
    expect(await (handler as unknown as () => Promise<unknown>)()).toEqual([{ name: 'main.log', text: 'ipc\n' }]);
  });
});
