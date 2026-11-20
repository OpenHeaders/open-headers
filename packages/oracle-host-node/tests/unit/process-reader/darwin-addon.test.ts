/**
 * The process reader on macOS against the REAL addon and the real
 * system (the activity monitor plan §4): this process, a child that
 * exits, a child that stays, a terminal with a process that outlived
 * its parent, a process of another user. Runs only on a Mac where the
 * addon is built; everywhere else the reading is pinned on a made-up
 * binding beside this file.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createDarwinProcessReader,
  type DarwinProcessBinding,
  type ProcessRecord,
  readProcessDescendants,
} from '../../../src/process-reader';

const ADDON = fileURLToPath(new URL('../../../../../native/process-reader/index.js', import.meta.url));

function loadBinding(): DarwinProcessBinding | null {
  if (process.platform !== 'darwin') return null;
  try {
    const addon: { load(): DarwinProcessBinding | null } = createRequire(import.meta.url)(ADDON);
    return addon.load();
  } catch {
    return null;
  }
}

const binding = loadBinding();

async function until<T>(read: () => T | undefined, timeoutMs = 5_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = read();
    if (found !== undefined) return found;
    if (Date.now() > deadline) throw new Error('timed out waiting for the system to show it');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe.skipIf(binding === null)('the macOS process reader on the real addon', () => {
  const reader = createDarwinProcessReader(binding as DarwinProcessBinding);
  const started: ChildProcess[] = [];
  /** Pids started beneath a child, which ending the child does not end. */
  const strays: number[] = [];

  afterEach(() => {
    for (const child of started.splice(0)) child.kill('SIGKILL');
    for (const pid of strays.splice(0)) process.kill(pid, 'SIGKILL');
  });

  const self = (): ProcessRecord => {
    const record = reader.read(process.pid);
    if (record === null) throw new Error('this process could not be read');
    return record;
  };

  it('reads this process: its parent, its start, its executable’s base name, a cost that agrees with the runtime’s', () => {
    const record = self();
    expect(record.parentPid).toBe(process.ppid);
    expect(record.name).toBe(path.basename(process.execPath));
    expect(Math.abs(record.startedAt - (Date.now() - process.uptime() * 1000))).toBeLessThan(2_000);

    const runtime = process.cpuUsage();
    expect(Math.abs((record.cost?.cpuSeconds ?? 0) - (runtime.user + runtime.system) / 1e6)).toBeLessThan(0.25);
    expect(record.cost?.memoryBytes).toBeGreaterThan(1024 * 1024);
  });

  it('keeps the CPU of a child that exited on this process’s own record', () => {
    const before = self().cost?.exitedChildrenCpuSeconds ?? 0;
    spawnSync(process.execPath, [
      '-e',
      'const end = process.cpuUsage().user + 300000; while (process.cpuUsage().user < end);',
    ]);
    expect((self().cost?.exitedChildrenCpuSeconds ?? 0) - before).toBeGreaterThan(0.25);
  });

  it('finds a child that stays by walking down from this process', async () => {
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
    started.push(child);
    const root = { pid: process.pid, startedAt: self().startedAt };
    const found = await until(() => readProcessDescendants(reader, root).find((record) => record.pid === child.pid));
    expect(found.parentPid).toBe(process.pid);
    expect(found.name).toBe(path.basename(process.execPath));
    expect(found.startedAt).toBeGreaterThanOrEqual(root.startedAt);
    expect(reader.childPids(process.pid)).toContain(child.pid);
  });

  it('keeps a process that outlived its parent in its terminal’s row, and out of the walk without the terminal', async () => {
    // A pty with a shell in it; the shell starts one process through a parent that exits at once.
    const keeper = spawn('script', ['-q', '/dev/null', '/bin/sh', '-c', '(sleep 31 &); exec sleep 32'], {
      stdio: 'ignore',
    });
    started.push(keeper);
    const keeperPid = keeper.pid ?? -1;

    const shell = await until(() =>
      readProcessDescendants(reader, { pid: keeperPid, startedAt: reader.read(keeperPid)?.startedAt ?? 0 }).find(
        (record) => record.name === 'sleep',
      ),
    );
    const root = { pid: shell.pid, startedAt: shell.startedAt };

    const outlived = await until(() =>
      readProcessDescendants(reader, root, { terminal: true }).find((record) => record.name === 'sleep'),
    );
    strays.push(outlived.pid);
    // It is launchd's child now — nothing the shell's own children lead to.
    expect(outlived.parentPid).toBe(1);
    expect(readProcessDescendants(reader, root)).toEqual([]);
    expect(reader.terminalPids(shell.pid)).toEqual(expect.arrayContaining([shell.pid, outlived.pid]));
  });

  it('lists no terminal for a process that has none', () => {
    const detached = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
      stdio: 'ignore',
      detached: true,
    });
    started.push(detached);
    expect(reader.terminalPids(detached.pid ?? -1)).toEqual([]);
  });

  it.skipIf(process.getuid?.() === 0)('keeps another user’s process with its name and no cost', () => {
    const launchd = reader.read(1);
    expect(launchd?.name).toBe('launchd');
    expect(launchd?.parentPid).toBe(0);
    expect(launchd?.cost).toBeNull();
  });

  it('answers null for a pid no process holds', () => {
    expect(reader.read(999_999)).toBeNull();
    expect(reader.childPids(999_999)).toEqual([]);
  });
});
