import { join } from 'node:path';
import { ipcMain, shell } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installLogRevealHandler, revealLogFile } from '@/main/bootstrap/log-reveal';

const LOG_DIR = join('/tmp', 'oh-logs-test');

vi.mock('@/main/bootstrap/logger', () => ({ getLogDirectory: () => LOG_DIR }));

describe('log-reveal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reveals main.log inside the live log directory', () => {
    const reveal = vi.spyOn(shell, 'showItemInFolder');
    revealLogFile();
    expect(reveal).toHaveBeenCalledWith(join(LOG_DIR, 'main.log'));
  });

  it('answers the renderer channel with the same reveal', () => {
    let handler: (() => void) | null = null;
    vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: () => void) => {
      if (channel === 'oh:logs:reveal') handler = fn;
    }) as typeof ipcMain.handle);
    const reveal = vi.spyOn(shell, 'showItemInFolder');
    installLogRevealHandler();
    expect(handler).not.toBeNull();
    (handler as unknown as () => void)();
    expect(reveal).toHaveBeenCalledOnce();
  });
});
