/**
 * The CLI's browser opener — the device grant's convenience: the
 * platform opener where a display can show the person a page, false
 * over SSH, in a headless session and on a spawn failure, so `oh
 * login` prints the link and carries on either way.
 */

import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { browserOpenerFor, openBrowser } from '../../src/open-browser';

const URL = 'http://10.0.0.5:8137/auth/oauth/device/verify?user_code=BCDF-GHJK';

function fakeSpawn(outcome: 'spawn' | 'error' | 'throw') {
  const calls: Array<{ file: string; args: string[]; options: Record<string, unknown> }> = [];
  const spawnFn = vi.fn((file: string, args: string[], options: Record<string, unknown>) => {
    calls.push({ file, args, options });
    if (outcome === 'throw') throw new Error('ENOENT');
    const child = new EventEmitter() as EventEmitter & { unref: () => void };
    child.unref = vi.fn();
    queueMicrotask(() => child.emit(outcome, outcome === 'error' ? new Error('ENOENT') : undefined));
    return child;
  });
  return { spawnFn: spawnFn as unknown as typeof import('node:child_process').spawn, calls };
}

describe('browserOpenerFor', () => {
  it('names the platform opener, and none over SSH or without a display', () => {
    expect(browserOpenerFor('darwin', {}, URL)).toEqual({ file: 'open', args: [URL] });
    expect(browserOpenerFor('win32', {}, URL)).toEqual({ file: 'cmd', args: ['/c', 'start', '', URL] });
    expect(browserOpenerFor('linux', { DISPLAY: ':0' }, URL)).toEqual({ file: 'xdg-open', args: [URL] });
    expect(browserOpenerFor('linux', { WAYLAND_DISPLAY: 'wayland-0' }, URL)).toEqual({ file: 'xdg-open', args: [URL] });
    expect(browserOpenerFor('linux', {}, URL)).toBeNull();
    expect(browserOpenerFor('darwin', { SSH_TTY: '/dev/pts/0' }, URL)).toBeNull();
    expect(browserOpenerFor('linux', { DISPLAY: ':0', SSH_CONNECTION: '10.0.0.9 5 10.0.0.5 22' }, URL)).toBeNull();
  });
});

describe('openBrowser', () => {
  it('spawns the opener detached and answers true once it started', async () => {
    const { spawnFn, calls } = fakeSpawn('spawn');
    expect(await openBrowser(URL, { platform: 'darwin', env: {}, spawnFn })).toBe(true);
    expect(calls).toEqual([
      { file: 'open', args: [URL], options: { detached: true, stdio: 'ignore', env: {}, windowsHide: true } },
    ]);
  });

  it('answers false without spawning where no browser can be reached, and on a failed spawn', async () => {
    const headless = fakeSpawn('spawn');
    expect(await openBrowser(URL, { platform: 'linux', env: {}, spawnFn: headless.spawnFn })).toBe(false);
    expect(await openBrowser('file:///etc/passwd', { platform: 'darwin', env: {}, spawnFn: headless.spawnFn })).toBe(
      false,
    );
    expect(headless.calls).toEqual([]);

    const failed = fakeSpawn('error');
    expect(await openBrowser(URL, { platform: 'darwin', env: {}, spawnFn: failed.spawnFn })).toBe(false);
    const thrown = fakeSpawn('throw');
    expect(await openBrowser(URL, { platform: 'darwin', env: {}, spawnFn: thrown.spawnFn })).toBe(false);
  });
});
