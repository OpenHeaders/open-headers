import { join } from 'node:path';
import { shell } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealLogFile } from '@/main/bootstrap/log-reveal';

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
});
