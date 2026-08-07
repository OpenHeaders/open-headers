/**
 * Launch verb — message-shape validation, the install-root anchoring
 * (the launched binary derives from the host's OWN location, and a dev
 * layout refuses), and the per-platform command shapes over an
 * injected detached-spawn seam.
 */

import { describe, expect, it } from 'vitest';
import { launchCommand, parseLaunchRequest, performLaunch } from '../../src/launch';

describe('parseLaunchRequest', () => {
  it('accepts the launch shape and refuses foreign ones', () => {
    expect(parseLaunchRequest({ kind: 'launch' })).toEqual({ kind: 'launch' });
    expect(parseLaunchRequest(null)).toBeNull();
    expect(parseLaunchRequest({ kind: 'watch', url: 'ws://127.0.0.1:59210' })).toBeNull();
  });
});

describe('launchCommand', () => {
  it('shapes the per-platform launch', () => {
    expect(launchCommand('/Applications/OpenHeaders.app', 'darwin')).toEqual({
      file: 'open',
      args: ['/Applications/OpenHeaders.app'],
    });
    expect(launchCommand('C:\\Program Files\\OpenHeaders', 'win32')).toEqual({
      file: 'C:\\Program Files\\OpenHeaders\\OpenHeaders.exe',
      args: [],
    });
    expect(launchCommand('/opt/OpenHeaders', 'linux')).toEqual({
      file: '/opt/OpenHeaders/open-headers',
      args: [],
    });
    expect(launchCommand('/anywhere', 'freebsd')).toBeNull();
  });
});

interface SpawnCall {
  file: string;
  args: readonly string[];
}

function spawnRecorder(result: boolean, calls: SpawnCall[]) {
  return async (file: string, args: readonly string[]): Promise<boolean> => {
    calls.push({ file, args });
    return result;
  };
}

describe('performLaunch', () => {
  it('refuses from a dev layout without spawning — no install root anchors the app', async () => {
    const calls: SpawnCall[] = [];
    const result = await performLaunch({
      ownExecutablePath: '/repo/apps/nm-host/dist-bun/oh-nm-host',
      platform: 'darwin',
      spawnDetached: spawnRecorder(true, calls),
    });
    expect(result).toEqual({ ok: false, reason: 'unanchored' });
    expect(calls).toEqual([]);
  });

  it('opens the macOS bundle the host ships inside', async () => {
    const calls: SpawnCall[] = [];
    const result = await performLaunch({
      ownExecutablePath: '/Applications/OpenHeaders.app/Contents/Resources/nm-host/oh-nm-host',
      platform: 'darwin',
      spawnDetached: spawnRecorder(true, calls),
    });
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([{ file: 'open', args: ['/Applications/OpenHeaders.app'] }]);
  });

  it('spawns the packaged Windows binary when it exists', async () => {
    const calls: SpawnCall[] = [];
    const result = await performLaunch({
      ownExecutablePath: 'C:\\Users\\dev\\AppData\\Local\\Programs\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe',
      platform: 'win32',
      spawnDetached: spawnRecorder(true, calls),
      fileExists: () => true,
    });
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([
      { file: 'C:\\Users\\dev\\AppData\\Local\\Programs\\OpenHeaders\\OpenHeaders.exe', args: [] },
    ]);
  });

  it('refuses when the anchored binary is missing', async () => {
    const calls: SpawnCall[] = [];
    const result = await performLaunch({
      ownExecutablePath: 'C:\\Users\\dev\\AppData\\Local\\Programs\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe',
      platform: 'win32',
      spawnDetached: spawnRecorder(true, calls),
      fileExists: () => false,
    });
    expect(result).toEqual({ ok: false, reason: 'unanchored' });
    expect(calls).toEqual([]);
  });

  it('spawns the packaged Linux binary detached', async () => {
    const calls: SpawnCall[] = [];
    const result = await performLaunch({
      ownExecutablePath: '/opt/OpenHeaders/resources/nm-host/oh-nm-host',
      platform: 'linux',
      spawnDetached: spawnRecorder(true, calls),
      fileExists: () => true,
    });
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([{ file: '/opt/OpenHeaders/open-headers', args: [] }]);
  });

  it('maps a failed spawn to launch-failed', async () => {
    const result = await performLaunch({
      ownExecutablePath: '/Applications/OpenHeaders.app/Contents/Resources/nm-host/oh-nm-host',
      platform: 'darwin',
      spawnDetached: async () => false,
    });
    expect(result).toEqual({ ok: false, reason: 'launch-failed' });
  });
});
